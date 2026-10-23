-- 知识库向量索引（knowledge_embeddings 表）
--
-- 这张表是规格文档 `references/data-models.md` 里预留的 `knowledge_embeddings`，
-- 启用条件写在该文档建表 SQL 注释里：「出现向量检索消费方」。2026-09-30
-- 混合检索上线（关键词 + 向量双路召回，RRF 融合），条件满足。
--
-- 粒度是**章节块**（概念页按 `##` 标题切块），不是整页：与运行时
-- `STEP_SECTION_MAP` 的注入粒度对齐 —— 讲解只注入定义/关键点节，
-- 检索也应命中到节。写入者只有 `scripts/rag-index.ts`（离线索引脚本），
-- 应用运行期只读；wiki 内容变更后重跑脚本整表重建（先清后写）。
--
-- `embedding` 存 Float32Array 的原始字节（BLOB，little-endian），
-- `dim` 记录维度以便模型更换后校验；`model` 记录来源模型，排查
-- 「为什么这份索引语义漂移」时用。

CREATE TABLE knowledge_embeddings (
  id         TEXT PRIMARY KEY NOT NULL,
  page_path  TEXT NOT NULL,
  page_id    TEXT,
  heading    TEXT NOT NULL DEFAULT '',
  ordinal    INTEGER NOT NULL DEFAULT 0,
  content    TEXT NOT NULL,
  embedding  BLOB NOT NULL,
  model      TEXT NOT NULL,
  dim        INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_knowledge_embeddings_page ON knowledge_embeddings(page_path);
