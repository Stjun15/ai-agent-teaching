-- ============================================================================
-- 002_lecture_cache —— 讲解 / 示范讲稿的预生成缓存
--
-- 来源：2026-09-19 学生反馈「概念讲解不是提前准备好的吗？为什么点开要等
--       模型响应？」—— 讲解这种每讲内容固定、学生只读一遍的材料，
--       每次现场生成既慢（实测 35~42 秒）又重复烧 token。改为提前生成好
--       存库，学生点开即有；追问与点评仍走实时模型。
--
-- 与 data-models.md 的关系：该文档没有这张表（它是运行优化缓存，不是教学
-- 业务数据），故按 001_init.sql 的同款类型映射规则补一张：
--   主键 (module_id, step) 复合 —— 一个模块的讲解 / 示范各只有一份权威讲稿；
--   step 用 CHECK 钉死在两个可自动开讲的步骤上 —— 其它步骤没有「预先准备
--   的讲稿」（validate/practice 的结构化输出走 /api/agent/* 端点，见
--   step-prompt.ts 的留白说明）。
--
-- 缓存失效策略：提示词或模型升级后由维护者重跑
--   `node scripts/generate-lecture-cache.mjs --force`
-- 整表重建。运行时不做 TTL —— 讲稿不是会过期的数据，不会自动失效。
-- ============================================================================

CREATE TABLE lecture_cache (
  module_id     TEXT NOT NULL,
  step          TEXT NOT NULL,
  content       TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (module_id, step),
  CHECK (step IN ('explain', 'observe'))
) WITHOUT ROWID;
