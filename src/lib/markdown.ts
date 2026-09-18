/**
 * 极简 Markdown 解析器 —— 输出 token 树，从不生成 HTML 字符串
 * ==========================================================
 * 为什么自己写、而不是装 `react-markdown`
 * --------------------------------------
 * 1. **注入面**。模型输出是不可信内容：里面可能有 `<script>`、`<img onerror>`、
 *    `[点我](javascript:alert(1))`。`react-markdown` 那条链要安全就得再叠
 *    `rehype-sanitize`（等于两套依赖 + 一份需要长期跟进的净化配置）。本模块
 *    换成一条更硬的路：**解析结果只描述结构，不描述字符串**，交给 React 渲染。
 *    React 渲染文本节点时天然转义，而整条链上根本不存在「HTML 字符串」这个
 *    中间物 —— 没有可注入的载体，也就没有绕过白名单的可能。
 *    该路径的取舍写在 `MessageItem` 旁边的注释里（Phase 3 时决定先不做）。
 * 2. **依赖成本**。本机装包很慢（见项目记忆），而需要的语法其实很少：
 *    标题、列表、代码块、行内代码、粗斜体、链接、引用、分割线。
 *
 * 子集边界（明确不支持，而不是「碰巧没实现」）
 * -------------------------------------------
 * - **原始 HTML 一律当纯文本**：`<b>x</b>` 就显示 `<b>x</b>`，不做任何解释。
 * - **不支持图片**：图片会让不可信内容具备「发起请求」的能力（追踪像素、
 *   甚至外带信息）。`![a](url)` 里的 `!` 会作为普通字符留在文本里。
 * - **不支持 `_` 斜体**：模型输出里 `system_prompt`、`max_tokens` 这类标识符
 *   很常见，`_` 当强调符会把它们吃掉。只认 `*`。
 * - **不支持表格 / 脚注 / 嵌套列表缩进层级**：用不上，成本不划算。
 *
 * 流式容错
 * -------
 * 模型是一个 token 一个 token 吐出来的，解析器**每次都会拿到半截 Markdown**：
 * 未闭合的 `**`、刚打出 ``` 还没写内容、列表写到一半。因此规则是
 * 「**半成品一律降级为字面量，绝不抛异常**」：解析器只输出它确定的东西，
 * 剩下的照原样当文本。`closed: false` 用来告诉渲染层「这个代码块还在写」。
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 行内 token。没有 `html` 这一支 —— 这是刻意的，见文件头。 */
export type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineToken[] }
  | { type: "emphasis"; children: InlineToken[] }
  | { type: "link"; href: string; children: InlineToken[] };

/** 块级 token。 */
export type MarkdownBlock =
  | { type: "paragraph"; children: InlineToken[] }
  | { type: "heading"; level: number; children: InlineToken[] }
  | {
      type: "code";
      language: string | null;
      value: string;
      /** 闭合的围栏为 true；流式输出中途为 false。 */
      closed: boolean;
    }
  | {
      type: "list";
      ordered: boolean;
      /** 有序列表的起始序号，取自第一项。 */
      start: number;
      items: InlineToken[][];
    }
  | { type: "quote"; children: MarkdownBlock[] }
  | { type: "rule" };

// ---------------------------------------------------------------------------
// 链接协议白名单
// ---------------------------------------------------------------------------

/**
 * 允许的协议。
 *
 * 只放 http / https / mailto：`javascript:` 能执行脚本，`data:` 能承载
 * HTML 文档，`blob:`、`file:` 同理 —— 一条都不能留。
 */
const SAFE_PROTOCOLS: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "mailto:",
]);

/** 站内相对路径的合法开头。 */
const RELATIVE_PREFIXES = ["#", "/", "./", "../"];

/**
 * 判断链接目标是否安全。
 *
 * 两道防线：
 * 1. **先剥控制字符与空白再判断**。`java\tscript:alert(1)`、`java\nscript:`
 *    在浏览器里仍会被当成 `javascript:`（URL 解析会忽略这些字符），
 *    所以不能只对原始字符串做 `startsWith`。
 * 2. **白名单而非黑名单**。只认已知安全的协议，其余一律拒绝 ——
 *    黑名单永远会漏掉下一个新协议。
 */
export function isSafeHref(raw: string): boolean {
  const value = raw.trim();
  if (value === "") return false;

  // 剥掉 ASCII 控制字符与空白（含 \t \n \r 与 NUL）。
  const normalized = value.replace(/[\u0000-\u0020\u007f]/g, "").toLowerCase();

  // 协议相对链接（`//evil.com`）会继承当前页面的协议，视作外部链接拒绝；
  // 必须在单斜杠判断之前，否则会被下一条当成站内路径放过去。
  if (normalized.startsWith("//")) return false;

  if (RELATIVE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  const colon = normalized.indexOf(":");
  if (colon === -1) return true; // 没有冒号的相对路径，如 `wiki/query`

  return SAFE_PROTOCOLS.has(normalized.slice(0, colon + 1));
}

// ---------------------------------------------------------------------------
// 行内解析
// ---------------------------------------------------------------------------

/** 数出 `start` 处连续重复的 `ch` 个数（用来区分 `*` 与 `**`）。 */
function countRun(source: string, start: number, ch: string): number {
  let count = 0;
  while (start + count < source.length && source[start + count] === ch) {
    count += 1;
  }
  return count;
}

/** 找强调符号的闭合位置。内容两端是空白则不算闭合（避免 `2 * 3 * 4` 误判）。 */
function matchEmphasis(
  source: string,
  start: number,
  marker: string,
): { value: string; end: number } | null {
  let from = start;
  while (from <= source.length) {
    const at = source.indexOf(marker, from);
    if (at === -1) return null;
    const value = source.slice(start, at);
    if (value !== "" && !/^\s/.test(value) && !/\s$/.test(value)) {
      return { value, end: at + marker.length };
    }
    from = at + marker.length;
  }
  return null;
}

/**
 * 尝试从 `start` 处匹配 `[label](href)`。
 *
 * 不安全的目标**不丢弃内容**：降级成纯文本（只留 label、不留链接），
 * 否则学生看到的就是「话说到一半没了」。
 */
function matchLink(
  source: string,
  start: number,
): { tokens: InlineToken[]; end: number } | null {
  const labelEnd = source.indexOf("]", start + 1);
  if (labelEnd === -1 || source[labelEnd + 1] !== "(") return null;

  const hrefEnd = source.indexOf(")", labelEnd + 2);
  if (hrefEnd === -1) return null;

  const label = source.slice(start + 1, labelEnd);
  const href = source.slice(labelEnd + 2, hrefEnd).trim();
  const children = parseInline(label);

  if (!isSafeHref(href)) {
    return { tokens: children, end: hrefEnd + 1 };
  }
  return { tokens: [{ type: "link", href, children }], end: hrefEnd + 1 };
}

/** 解析一行（或一段）里的行内标记。 */
export function parseInline(source: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = "";
  let i = 0;

  const flush = (): void => {
    if (buffer !== "") {
      tokens.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < source.length) {
    const ch = source[i];

    // 行内代码优先级最高：`**` 写在反引号里不该变成粗体。
    if (ch === "`") {
      const ticks = countRun(source, i, "`");
      const marker = "`".repeat(ticks);
      const end = source.indexOf(marker, i + ticks);
      if (end === -1) {
        // 半截（流式常见）：原样保留。
        buffer += marker;
        i += ticks;
        continue;
      }
      flush();
      tokens.push({ type: "code", value: source.slice(i + ticks, end).trim() });
      i = end + ticks;
      continue;
    }

    if (ch === "[") {
      const link = matchLink(source, i);
      if (link !== null) {
        flush();
        for (const token of link.tokens) tokens.push(token);
        i = link.end;
        continue;
      }
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === "*") {
      const run = countRun(source, i, "*");
      const strong = run >= 2;
      const marker = strong ? "**" : "*";
      const inner = matchEmphasis(source, i + marker.length, marker);
      if (inner === null) {
        buffer += marker;
        i += marker.length;
        continue;
      }
      flush();
      const children = parseInline(inner.value);
      tokens.push(
        strong ? { type: "strong", children } : { type: "emphasis", children },
      );
      i = inner.end;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return tokens;
}

