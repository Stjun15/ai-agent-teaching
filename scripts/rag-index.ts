/**
 * 知识库向量索引脚本 —— 把 `llm-wiki/` 全部页面按章节切块并向量化落库
 *
 * 写入 `knowledge_embeddings` 表（整表重建，事务保证不留半截索引）。
 * 运行期只读这张表，索引只从这里来 —— 见 `src/lib/db/embeddings.ts` 文件头。
 *
 * 切块口径：按 `##` 标题切块，页首（frontmatter 之后的引言）为第 0 块。
 * 与运行时 `STEP_SECTION_MAP` 的注入粒度对齐：讲解只注入定义/关键点节，
 * 检索也应命中到节而不是整页。
 *
 * 用法：`pnpm rag:index`（需要 DASHSCOPE_API_KEY；66 页约几百块，几十秒）
 */

import { knowledgeEmbeddingDb } from "@/lib/db";
import { embedTexts, readEmbeddingSettings } from "@/lib/agent/embeddings";
import { listPagePaths, readPageSync, type WikiPage } from "@/wiki";

/** 单块正文上限（字符）。超出截断 —— 章节块天然不大，这只是护栏。 */
const MAX_CHUNK_CHARS = 2400;

interface RawChunk {
  heading: string;
  ordinal: number;
  content: string;
}

/** 按 `##` 标题切块。页首引言（frontmatter 之后、第一个 `##` 之前）为第 0 块。 */
function splitSections(body: string): RawChunk[] {
  const lines = body.split("\n");
  const chunks: RawChunk[] = [];
  let current: RawChunk = { heading: "", ordinal: 0, content: "" };
  for (const line of lines) {
    const match = line.match(/^##\s+(.*)$/);
    if (match) {
      chunks.push(current);
      current = {
        heading: match[1].trim(),
        ordinal: chunks.length,
        content: "",
      };
      continue;
    }
    current.content += `${line}\n`;
  }
  chunks.push(current);
  return chunks.filter((chunk) => chunk.content.trim().length > 0);
}

function chunkText(page: WikiPage, chunk: RawChunk): string {
  const name =
    typeof page.frontmatter.name === "string" ? page.frontmatter.name : "";
  const id = typeof page.frontmatter.id === "string" ? page.frontmatter.id : "";
  const header = `《${name}》（${id}）${chunk.heading ? `· ${chunk.heading}` : ""}`;
  const content =
    chunk.content.length > MAX_CHUNK_CHARS
      ? `${chunk.content.slice(0, MAX_CHUNK_CHARS)}…`
      : chunk.content;
  return `${header}\n\n${content}`;
}

async function main(): Promise<void> {
  const settings = readEmbeddingSettings();
  const paths = listPagePaths().filter((path) => path.endsWith(".md"));
  const rawChunks: { page: WikiPage; pagePath: string; chunk: RawChunk }[] = [];

  for (const pagePath of paths) {
    const page = readPageSync(pagePath);
    for (const chunk of splitSections(page.body)) {
      rawChunks.push({ page, pagePath, chunk });
    }
  }
  console.log(
    `共 ${paths.length} 页，切出 ${rawChunks.length} 块；模型 ${settings.model}，开始向量化…`,
  );

  const vectors = await embedTexts(
    rawChunks.map(({ page, chunk }) => chunkText(page, chunk)),
    settings,
  );

  knowledgeEmbeddingDb.rebuildAll(
    rawChunks.map(({ page, pagePath, chunk }, index) => ({
      pagePath,
      pageId:
        typeof page.frontmatter.id === "string" ? page.frontmatter.id : null,
      heading: chunk.heading,
      ordinal: chunk.ordinal,
      content: chunkText(page, chunk),
      embedding: vectors[index],
      model: settings.model,
    })),
  );

  console.log(
    `索引完成：${knowledgeEmbeddingDb.count()} 块已写入 knowledge_embeddings。`,
  );
}

main().catch((error) => {
  console.error("索引失败：", error instanceof Error ? error.message : error);
  process.exit(1);
});
