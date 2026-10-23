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

// ---------------------------------------------------------------------------
// 块级解析
// ---------------------------------------------------------------------------

const FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)\s*$/;
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const UNORDERED_ITEM = /^\s*([-*+])\s+(.+)$/;
const ORDERED_ITEM = /^\s*(\d{1,9})[.)]\s+(.+)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** 是否是一个块级结构的开头（段落遇到它就得收尾）。 */
function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    UNORDERED_ITEM.test(line) ||
    ORDERED_ITEM.test(line) ||
    QUOTE.test(line) ||
    RULE.test(line)
  );
}

/** 解析 `>` 块：剥掉标记后递归解析内部（引用里可以有列表和代码块）。 */
function parseQuote(
  lines: string[],
  start: number,
): { block: MarkdownBlock; end: number } {
  const inner: string[] = [];
  let i = start;
  while (i < lines.length) {
    const match = QUOTE.exec(lines[i]);
    if (match === null) break;
    inner.push(match[1]);
    i += 1;
  }
  return {
    block: { type: "quote", children: parseMarkdown(inner.join("\n")) },
    end: i,
  };
}

/**
 * 解析列表。
 *
 * 只用「同一类标记的连续行」判定一个列表，空行即结束 —— 不做松/紧列表、
 * 缩进嵌套那些规则。模型输出里 99% 是平铺列表，为剩下的 1% 引入状态机会
 * 让「半截输入下会怎样」变得难以推理。
 */
function parseList(
  lines: string[],
  start: number,
): { block: MarkdownBlock; end: number } {
  const unordered = UNORDERED_ITEM.test(lines[start]);
  const items: InlineToken[][] = [];
  let orderedStart = 1;
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const match = unordered
      ? UNORDERED_ITEM.exec(line)
      : ORDERED_ITEM.exec(line);
    if (match === null) break;

    if (!unordered && items.length === 0) {
      orderedStart = Number.parseInt(match[1], 10);
    }

    // 续行：紧跟在条目后、不缩进也不算新条目或新块的行，并入当前条目。
    const parts = [match[2]];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !startsBlock(lines[i])
    ) {
      parts.push(lines[i].trim());
      i += 1;
    }
    items.push(parseInline(parts.join("\n")));
  }

  return {
    block: {
      type: "list",
      ordered: !unordered,
      start: Number.isNaN(orderedStart) ? 1 : orderedStart,
      items,
    },
    end: i,
  };
}

/**
 * 把 Markdown 源码解析成块级 token 数组。
 *
 * 输入永远是「当前已知的全部文本」，包括流式过程中的半成品。
 */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const marker = fence[1];
      const language = fence[2] === "" ? null : fence[2];
      const body: string[] = [];
      let closed = false;
      i += 1;
      while (i < lines.length) {
        const closing = FENCE_CLOSE.exec(lines[i]);
        // 关闭围栏必须与开围栏同种字符（``` 不能用 ~~~ 关）。
        if (closing !== null && closing[1].startsWith(marker.charAt(0))) {
          closed = true;
          i += 1;
          break;
        }
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: "code", language, value: body.join("\n"), closed });
      continue;
    }

    // 分割线要排在列表之前判断：`***` 同时满足两者的字面条件。
    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        children: parseInline(heading[2].trim()),
      });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted = parseQuote(lines, i);
      blocks.push(quoted.block);
      i = quoted.end;
      continue;
    }

    if (UNORDERED_ITEM.test(line) || ORDERED_ITEM.test(line)) {
      const list = parseList(lines, i);
      blocks.push(list.block);
      i = list.end;
      continue;
    }

    // 段落：吃到空行或下一个块级开头为止。
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      (paragraph.length === 0 || !startsBlock(lines[i]))
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({
      type: "paragraph",
      children: parseInline(paragraph.join("\n")),
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// 代码块 / 散文分段
// ---------------------------------------------------------------------------

/** 示范代码面板的一段：散文原文，或一个代码块。 */
export type DocSegment =
  | { kind: "prose"; source: string }
  | { kind: "code"; language: string | null; value: string; ordinal: number };

/**
 * 把一段 Markdown 切成「散文段 / 代码段」交替的序列，代码段带序号。
 *
 * 为什么不用 `parseMarkdown` 再拼回去
 * ----------------------------------
 * `parseMarkdown` 产出的是结构化 token（段落/标题/列表…），从中还原
 * Markdown 原文是有损的 —— 列表层级、引用嵌套、软换行都可能变形。
 * 而本函数的使用场景（示范代码面板）需要**原样**渲染散文：那里的内容
 * 正是给学生看的说明与类比，转述不得。
 *
 * 所以这里走行级切分，散文按原文保留，只把围栏块抽出来。
 * 围栏判定复用 `parseMarkdown` 同一套正则，两处不会漂移。
 *
 * 用途背景：2026-10-07 扇出审计发现概念页「## 示范代码」小节里的
 * 说明与类比被观察面板整段丢弃（8/10 讲命中）。
 */
export function segmentByCode(source: string): DocSegment[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const segments: DocSegment[] = [];
  let prose: string[] = [];
  let ordinal = 0;
  let i = 0;

  const flushProse = (): void => {
    // 丢掉纯空白的散文段，避免渲染出一堆空 margin。
    const text = prose.join("\n").trim();
    if (text !== "") segments.push({ kind: "prose", source: text });
    prose = [];
  };

  while (i < lines.length) {
    const fence = FENCE.exec(lines[i]);
    if (fence === null) {
      prose.push(lines[i]);
      i += 1;
      continue;
    }

    const marker = fence[1];
    const body: string[] = [];
    i += 1;
    while (i < lines.length) {
      const closing = FENCE_CLOSE.exec(lines[i]);
      // 关闭围栏必须与开围栏同种字符（``` 不能用 ~~~ 关）。
      if (closing !== null && closing[1].startsWith(marker.charAt(0))) {
        i += 1;
        break;
      }
      body.push(lines[i]);
      i += 1;
    }

    flushProse();
    segments.push({
      kind: "code",
      language: fence[2] === "" ? null : fence[2],
      value: body.join("\n"),
      ordinal: (ordinal += 1),
    });
  }

  flushProse();
  return segments;
}
