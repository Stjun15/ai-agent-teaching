/**
 * 三板斧解析 —— 从概念页 markdown 正文里拆出三斧段落
 *
 * 哪里用
 * -----
 * ExplainColdStart 组件：platform-replica 模块无缓存时，
 * 把概念页正文渲染成可折叠的三板斧卡片。
 */

export interface AxeSection {
  title: string;
  emoji: string;
  body: string;
  subsections: AxeSubsection[];
}

export interface AxeSubsection {
  title: string;
  body: string;
}

const AXE_HEADER_SKIP = new Set([
  "启动台",
  "龙骨",
  "验收",
  "结算",
  "怎么造",
]);

export function parseAxes(markdown: string): AxeSection[] {
  const axes: AxeSection[] = [];
  const blocks = markdown.split(/\n(?=### )/);
  for (const block of blocks) {
    const headerMatch = block.match(/^### (.+)/m);
    if (!headerMatch) continue;
    const header = headerMatch[1].trim();

    const skip = [...AXE_HEADER_SKIP].some((kw) => header.includes(kw));
    if (skip) continue;

    const axeMatch = header.match(/^(第[一二三]斧)[：:]\s*(.+)/);
    if (!axeMatch) continue;

    const emoji = header.includes("一")
      ? "⚡"
      : header.includes("二")
        ? "🧠"
        : "🗄️";
    const body = block.slice(headerMatch[0].length).trim();
    const subsections: AxeSubsection[] = [];

    const subBlocks = body.split(/\n(?=#### )/);
    for (const sub of subBlocks) {
      const subMatch = sub.match(/^#### (.+)/m);
      if (subMatch) {
        subsections.push({
          title: subMatch[1].trim(),
          body: sub.slice(subMatch[0].length).trim(),
        });
      }
    }

    axes.push({ title: axeMatch[2], emoji, body, subsections });
  }
  return axes;
}

// ---------------------------------------------------------------------------
// 路径选择解析（python-basics / ts-basics）
// ---------------------------------------------------------------------------

export interface PathSelectContent {
  /** 路径选择表之前的引导内容（不含 front matter）。 */
  intro: string;
  /** 偷懒版正文。 */
  lazy: string;
  /** 完整版正文。 */
  full: string;
}

/**
 * 从概念页 markdown 中拆出「偷懒版 / 完整版」路径选择。
 *
 * 概念页的标记约定：
 *   <!-- PATH:LAZY START -->   ← 偷懒版起点
 *   ## 📚 完整版               ← 完整版起点
 *
 * 返回 null 表示当前概念页不含路径选择结构。
 */
export function parsePathSelect(markdown: string): PathSelectContent | null {
  const body = stripFrontMatter(markdown);

  const lazyStartIdx = body.indexOf("<!-- PATH:LAZY START -->");
  if (lazyStartIdx === -1) return null;

  const intro = body.slice(0, lazyStartIdx).trim();
  const afterMarker = body.slice(
    lazyStartIdx + "<!-- PATH:LAZY START -->".length,
  );

  const fullIdx = afterMarker.indexOf("## 📚 完整版");
  if (fullIdx === -1) return null;

  const lazy = afterMarker.slice(0, fullIdx).trim();
  const full = afterMarker.slice(fullIdx).trim();

  return { intro, lazy, full };
}

/** 去掉 YAML front matter（`---\n...\n---`）。 */
function stripFrontMatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---\n", 4);
  return end === -1 ? md : md.slice(end + 5);
}