/**
 * frontmatter 读写
 *
 * 自写 YAML 子集解析器，不引入 `gray-matter` / `yaml` 依赖 —— 理由与 db 层
 * 选择 `node:sqlite` 一致：SCHEMA.md 的模板只用到「标量 + 行内数组 + 缩进数组」
 * 三种形式，为此装一个完整 YAML 解析器换不到实际收益，还会多一条供应链。
 *
 * 三条硬规则：
 *
 * 1. **遇到不支持的写法必须报错并给出行号**（嵌套映射、锚点、多行标量）。
 *    frontmatter 是「页面类型」与「必填字段」的唯一来源，静默降级解析
 *    会让整条校验链失去意义。
 * 2. **输出必须是 Prettier 的稳定解**。已实测 Prettier 会改写 markdown 的
 *    frontmatter（`key:    value` → `key: value`、`[a,   b]` → `[a, b]`），
 *    所以这里直接产出规范化形式，而不是尽量保留原文 —— 否则代码写回文件后
 *    `pnpm check` 里的 `prettier --check` 会失败。
 * 3. **日期保持字符串**。`2026-09-17` 不按数字或 Date 解析，避免写出时
 *    变成时间戳或带引号的形式。
 */

import { WikiFrontmatterError } from "./errors";
import type { WikiFrontmatter, WikiFrontmatterValue } from "./types";

/** frontmatter 的分隔线。 */
export const FENCE = "---";

export interface ParsedMarkdown {
  frontmatter: WikiFrontmatter;
  /** 原文是否以 frontmatter 块开头 */
  hasFrontmatter: boolean;
  /** frontmatter 之后的正文；无 frontmatter 时为去 BOM 的原文 */
  body: string;
}

function stripBom(text: string): string {
  return text.startsWith("\uFEFF") ? text.slice(1) : text;
}

/**
 * 拆分「frontmatter + 正文」。
 *
 * `source` 只用于错误信息里指路（通常是页面相对路径）。
 */
export function parseMarkdown(
  raw: string,
  source = "<string>",
): ParsedMarkdown {
  const text = stripBom(raw);
  const lines = text.split(/\r?\n/);

  if (lines[0]?.trim() !== FENCE) {
    return { frontmatter: {}, hasFrontmatter: false, body: text };
  }

  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === FENCE,
  );
  if (end === -1) {
    throw new WikiFrontmatterError(
      `${source}: frontmatter 起始的 "${FENCE}" 没有配对的结束标记`,
    );
  }

  const frontmatter = parseBlock(lines.slice(1, end), source);
  const body = lines
    .slice(end + 1)
    .join("\n")
    .replace(/^\n+/, "");

  return { frontmatter, hasFrontmatter: true, body };
}

function parseBlock(lines: string[], source: string): WikiFrontmatter {
  const result: WikiFrontmatter = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    // frontmatter 的正文从文件第 2 行开始，报错行号据此还原
    const lineNumber = index + 2;

    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }

    if (/^\s/.test(line)) {
      throw new WikiFrontmatterError(
        `${source}:${lineNumber}: 意外的缩进行「${line.trim()}」；缩进列表必须紧跟在「字段名:」之后`,
      );
    }

    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      throw new WikiFrontmatterError(
        `${source}:${lineNumber}: 无法解析的 frontmatter 行「${line}」。仅支持「键: 值」、行内数组 [a, b] 与缩进列表`,
      );
    }

    const key = match[1];
    const inlineValue = match[2];

    if (inlineValue.trim() === "") {
      const { items, nextIndex } = parseIndentedList(
        lines,
        index + 1,
        key,
        source,
        lineNumber,
      );
      result[key] = items;
      index = nextIndex;
      continue;
    }

    result[key] = parseScalar(inlineValue.trim());
    index += 1;
  }

  return result;
}

function parseIndentedList(
  lines: string[],
  start: number,
  key: string,
  source: string,
  keyLineNumber: number,
): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let cursor = start;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.trim() === "") {
      cursor += 1;
      continue;
    }
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (!item) break;
    items.push(unquote(item[1].trim()));
    cursor += 1;
  }

  if (items.length === 0) {
    throw new WikiFrontmatterError(
      `${source}:${keyLineNumber}: 字段「${key}」既没有值也没有缩进列表`,
    );
  }

  return { items, nextIndex: cursor };
}

function parseScalar(raw: string): WikiFrontmatterValue {
  if (raw === "[]") return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => unquote(item.trim()));
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  // 只把「纯数字」当数字。日期（2026-09-17）、时长（30min）都会落到下面的字符串分支。
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return unquote(raw);
}

function unquote(value: string): string {
  const quoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")));
  return quoted ? value.slice(1, -1) : value;
}

/**
 * 序列化 frontmatter。
 *
 * 键序按传入对象的插入顺序原样输出 —— SCHEMA.md 虽然没有强制字段顺序，
 * 但各页面统一成「type、last_updated 在前」是靠调用方保证的（见 orderFrontmatter）。
 */
export function serializeFrontmatter(frontmatter: WikiFrontmatter): string {
  const lines = Object.entries(frontmatter).map(
    ([key, value]) => `${key}: ${serializeValue(value)}`,
  );
  return [FENCE, ...lines, FENCE].join("\n");
}

function serializeValue(value: WikiFrontmatterValue): string {
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return needsQuote(value) ? JSON.stringify(value) : value;
}

/** 会被 YAML 误读的首字符（`-` 开头会被当成列表项，`#` 会被当成注释）。 */
const LEADING_SPECIAL = new Set([
  "[",
  "{",
  "'",
  '"',
  "#",
  "&",
  "*",
  "!",
  "|",
  ">",
  "%",
  "@",
  "`",
  "-",
  "?",
  ":",
]);

function needsQuote(value: string): boolean {
  if (value === "" || value.trim() !== value) return true;
  if (LEADING_SPECIAL.has(value[0])) return true;
  if (value.includes(": ") || value.includes(" #")) return true;
  return false;
}

/** 把 frontmatter 与正文拼回一个完整的 markdown 文件。 */
export function composePage(
  frontmatter: WikiFrontmatter,
  body: string,
): string {
  const normalizedBody = body.replace(/^\n+/, "").replace(/\s+$/, "");
  return `${serializeFrontmatter(frontmatter)}\n\n${normalizedBody}\n`;
}

/**
 * 把 `type`、`last_updated` 排到最前，其余字段保持原相对顺序。
 *
 * SCHEMA.md 把必填字段分成「所有页面」与「某类页面额外」两组，文本上就是这样
 * 排序的；写入时统一成同一顺序，跨页面 diff 才不会因为字段位置漂移而变脏。
 */
export function orderFrontmatter(
  frontmatter: WikiFrontmatter,
): WikiFrontmatter {
  const ordered: WikiFrontmatter = {};
  const keys = ["type", "last_updated", ...Object.keys(frontmatter)];
  for (const key of keys) {
    if (Object.hasOwn(ordered, key)) continue;
    if (!Object.hasOwn(frontmatter, key)) continue;
    ordered[key] = frontmatter[key];
  }
  return ordered;
}
