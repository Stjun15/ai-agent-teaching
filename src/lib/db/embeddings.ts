/**
 * 知识库向量索引（knowledge_embeddings 表）的数据访问
 *
 * 写入者只有 `scripts/rag-index.ts`（离线索引脚本，先清后写整表重建）；
 * 应用运行期只读 —— 与 lecture_cache 同一条纪律：索引内容必须全部来自
 * 审核过的生成流程，不允许请求路径悄悄写。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import { asNumber, asString, nowIso, type Row } from "./helpers";

export interface KnowledgeChunk {
  /** 形如 `concepts/rag.md`，与 WikiHit.path 同构，便于与关键词路融合。 */
  pagePath: string;
  /** frontmatter.id，缺失为 null。 */
  pageId: string | null;
  /** 所属 `##` 章节标题，页首块为空串。 */
  heading: string;
  /** 页内块序号（从 0 起），与 id 共同构成主键。 */
  ordinal: number;
  content: string;
  embedding: Float32Array;
  model: string;
}

interface KnowledgeChunkRow extends Row {
  id: string;
  page_path: string;
  page_id: string | null;
  heading: string;
  ordinal: number;
  content: string;
  embedding: Buffer;
  model: string;
  dim: number;
}

function toRow(row: KnowledgeChunkRow): KnowledgeChunk {
  const dim = asNumber(row.dim);
  const floats = new Float32Array(row.embedding.buffer, 0, dim);
  return {
    pagePath: asString(row.page_path),
    pageId: row.page_id ?? null,
    heading: asString(row.heading),
    ordinal: asNumber(row.ordinal),
    content: asString(row.content),
    // slice 一份独立内存：Buffer 底下的池可能被复用
    embedding: floats.slice(),
    model: asString(row.model),
  };
}

function chunkId(pagePath: string, ordinal: number): string {
  return `${pagePath}#${ordinal}`;
}

export const knowledgeEmbeddingDb = {
  /**
   * 整表重建：一个事务里先清后写。索引脚本只走这一个入口 —— 半途失败的
   * 索引比没有索引更糟（查询时会拿到「看起来能用」的残缺召回）。
   */
  rebuildAll(chunks: KnowledgeChunk[]): void {
    const db = getDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM knowledge_embeddings").run();
      const insert = db.prepare(
        `INSERT INTO knowledge_embeddings
           (id, page_path, page_id, heading, ordinal, content, embedding, model, dim, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const chunk of chunks) {
        insert.run(
          chunkId(chunk.pagePath, chunk.ordinal),
          chunk.pagePath,
          chunk.pageId,
          chunk.heading,
          chunk.ordinal,
          chunk.content,
          Buffer.from(
            chunk.embedding.buffer,
            chunk.embedding.byteOffset,
            chunk.embedding.byteLength,
          ),
          chunk.model,
          chunk.embedding.length,
          nowIso(),
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },

  /** 全量加载到内存。当前语料（66 页 × 按节切块）几百条，余弦在内存算微秒级。 */
  listAll(): KnowledgeChunk[] {
    const rows = getDb()
      .prepare("SELECT * FROM knowledge_embeddings ORDER BY page_path, ordinal")
      .all() as KnowledgeChunkRow[];
    return rows.map(toRow);
  },

  count(): number {
    const row = getDb()
      .prepare("SELECT count(*) AS c FROM knowledge_embeddings")
      .get() as { c: number };
    return asNumber(row.c);
  },
};
