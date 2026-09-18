/**
 * Markdown 表格的解析与格式化
 *
 * 为什么需要它：`index.md` 与 `log.md` 是**由代码维护**的，而 Prettier 会把
 * markdown 表格的每一列补齐到该列的最大显示宽度。代码追加一行后若不补齐，
 * `pnpm check` 里的 `prettier --check` 立刻失败。
 *
 * 两个已实测的 Prettier 行为（用 llm-wiki/ 现有文件验证）：
 *
 * 1. **CJK 按 2 列计宽**。`| a | b |` + 单元格 `中文中文中文`（6 个字）
 *    会被补齐成 12 个 dash 的分隔线，即宽度按显示宽度而非字符数。
 * 2. **列宽取该列所有单元格的最大显示宽度，下限 3**（`| a |` 补成 `| a   |`）。
 *
 * `displayWidth` 只覆盖 East Asian Wide/Fullwidth 与 emoji 区段 —— 够用且可验证：
 * 对 `llm-wiki/` 下现有的全部表格做「解析 → 重新格式化」的往返，输出与原文逐字节相同。
 */

/** East Asian Wide / Fullwidth 区段（含 emoji）。 */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd],
];

/** 文本在等宽终端里占的列数。 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    width += WIDE_RANGES.some(([from, to]) => code >= from && code <= to)
      ? 2
      : 1;
  }
  return width;
}

export type TableAlignment = "none" | "left" | "center" | "right";

export interface MarkdownTable {
  header: string[];
  alignments: TableAlignment[];
  rows: string[][];
}

/** 一行的原始单元格（已去掉首尾竖线与两侧空白）。 */
export function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** 该行是否属于表格（含表头行、分隔行、数据行）。 */
export function isTableRow(line: string): boolean {
  return line.trimStart().startsWith("|");
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function alignmentOf(cell: string): TableAlignment {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (left) return "left";
  if (right) return "right";
  return "none";
}

/** 解析一个连续表格块（首行表头、次行分隔线、其余数据行）。不是表格则返回 null。 */
export function parseMarkdownTable(lines: string[]): MarkdownTable | null {
  if (lines.length < 2) return null;
  if (!isTableRow(lines[0]) || !isTableRow(lines[1])) return null;

  const separator = splitTableRow(lines[1]);
  if (!isSeparatorRow(separator)) return null;

  return {
    header: splitTableRow(lines[0]),
    alignments: separator.map(alignmentOf),
    rows: lines.slice(2).map(splitTableRow),
  };
}

function separatorCell(width: number, alignment: TableAlignment): string {
  switch (alignment) {
    case "left":
      return `:${"-".repeat(Math.max(2, width - 1))}`;
    case "right":
      return `${"-".repeat(Math.max(2, width - 1))}:`;
    case "center":
      return `:${"-".repeat(Math.max(1, width - 2))}:`;
    default:
      return "-".repeat(width);
  }
}

function padCell(cell: string, width: number): string {
  return cell + " ".repeat(Math.max(0, width - displayWidth(cell)));
}

/** 按 Prettier 的规则重新排布表格，返回完整的表格行。 */
export function formatMarkdownTable(table: MarkdownTable): string[] {
  const columnCount = Math.max(
    table.header.length,
    ...table.rows.map((row) => row.length),
    0,
  );
  // 下限 3：Prettier 的分隔线最短也是 `---`
  const widths = new Array<number>(columnCount).fill(3);

  const measure = (row: string[]): void => {
    for (let index = 0; index < columnCount; index += 1) {
      widths[index] = Math.max(widths[index], displayWidth(row[index] ?? ""));
    }
  };
  measure(table.header);
  for (const row of table.rows) measure(row);

  const render = (cells: string[]): string =>
    `| ${cells.map((cell, index) => padCell(cell, widths[index])).join(" | ")} |`;

  const separator = widths.map((width, index) =>
    separatorCell(width, table.alignments[index] ?? "none"),
  );

  return [
    render(table.header),
    render(separator),
    ...table.rows.map((row) => render(row)),
  ];
}
