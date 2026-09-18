/**
 * log.md 追加
 *
 * `log.md` 的既定格式是一张 4 列表格，且 Prettier 会按显示宽度补齐每一列
 * （CJK 按 2 列计），所以这里**必须**用 `formatMarkdownTable` 重排整张表，
 * 而不是简单 `appendFile` 一行 —— 后者会让 `prettier --check` 失败。
 *
 * 与 `index.md` 的分工：`index.md` 记「有哪些页面、建了没有」，`log.md` 记
 * 「谁在什么时候动了什么」。两者都由代码维护，但只有 log 是只追加的。
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { today } from "./clock";
import { WikiError } from "./errors";
import {
  formatMarkdownTable,
  isTableRow,
  parseMarkdownTable,
} from "./markdown-table";
import { LOG_FILE, resolvePagePath, resolveWikiRoot } from "./paths";

export interface WikiLogEntry {
  /** 操作类型，与既有条目保持同一词汇：init / add / update / fix / remove */
  operation: string;
  /** 影响的页面或目录（相对 wiki 根，如 `concepts/llm-api.md`） */
  scope: string;
  /** 一句话说明；建议带上依据来源 */
  summary: string;
  /** 默认取本地今天 */
  date?: string;
}

/**
 * 在 `log.md` 的表格末尾追加一条记录。
 *
 * 只改表格块，表格前后的说明文字原样保留。找不到表格时抛错而不是退化成
 * 追加纯文本 —— 格式被破坏时应当立刻暴露，而不是悄悄写出一份不合规的日志。
 */
export async function appendWikiLog(
  entry: WikiLogEntry,
  root = resolveWikiRoot(),
): Promise<void> {
  const absolutePath = resolvePagePath(LOG_FILE, root);
  if (!existsSync(absolutePath)) {
    throw new WikiError(`变更日志不存在：${LOG_FILE}`);
  }

  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
  const start = lines.findIndex(isTableRow);
  if (start === -1) {
    throw new WikiError(`${LOG_FILE}: 找不到表格，无法追加记录`);
  }

  let end = start;
  while (end < lines.length && isTableRow(lines[end])) end += 1;

  const table = parseMarkdownTable(lines.slice(start, end));
  if (!table) {
    throw new WikiError(`${LOG_FILE}: 表格格式无法解析（缺少表头或分隔线）`);
  }

  table.rows.push([
    entry.date ?? today(),
    entry.operation,
    entry.scope,
    entry.summary,
  ]);

  const output = [
    ...lines.slice(0, start),
    ...formatMarkdownTable(table),
    ...lines.slice(end),
  ].join("\n");

  writeFileSync(absolutePath, output, "utf8");
}
