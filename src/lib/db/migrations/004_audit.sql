-- 课程审计发现（2026-10-07 产品内审计员）
--
-- 存「自动审计跑出来的缺陷」，供竞赛演示时展示「我们对自己的课程做过
-- 质量审计」。与 `errors` 表的区别要说清：
--   errors       —— 学生的错题，来自点评/判分路径
--   audit_findings —— 课程内容的缺陷，来自审计编排层
-- 两者都是「问题清单」，但主体不同（学生 vs 课程），混在一张表里会让
-- 报告页无法按主体筛选。
--
-- 为什么不直接复用 curriculum-audit.ts 的内存结构落 JSON：
-- 审计结论要能被前端按严重度筛选、按讲聚合、被评审翻查证据，逐条成行
-- 才好查。JSON 列适合「一次性返回整包」，不适合「按 severity 筛」。
--
-- dimension 用中文短语（可读性 / 认知负荷 / 可达性 / 术语断层 / 内容一致性），
-- 与 curriculum-audit.ts 的 AuditFinding.dimension 同源 —— 前端直接显示，
-- 内部口径不额外做映射，少一处可能漂移的地方。

CREATE TABLE audit_findings (
  id         TEXT PRIMARY KEY NOT NULL,
  module_id  TEXT NOT NULL,
  module_name TEXT NOT NULL,
  severity   TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  dimension  TEXT NOT NULL,
  title      TEXT NOT NULL,
  -- 证据必须能独立复核：文件路径 / 行号 / 原文摘录，不写「感觉不对」。
  evidence   TEXT NOT NULL,
  recommendation TEXT NOT NULL DEFAULT '',
  -- 幂等键：同一 (module, dimension, title) 重复审计不产生新行，
  -- 而是覆盖 evidence（内容变了要能反映出来）。
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_audit_findings_module ON audit_findings(module_id);
CREATE INDEX idx_audit_findings_severity ON audit_findings(severity);

-- 一讲一次审计的整体结果（分数、覆盖率、耗时）。findings 明细挂在这里，
-- 不另开「审计批次」表 —— 目前只需要「每讲最新一次」。
CREATE TABLE module_audits (
  module_id   TEXT PRIMARY KEY NOT NULL,
  module_name TEXT NOT NULL,
  -- 四个维度 0-1；null = 该维度本轮未检测（不许用 0 冒充「检测过但很差」）。
  explain_readability REAL,
  cognitive_load      REAL,
  terminology_gap     REAL,
  consistency         REAL,
  -- 是否跑通了真实模型（false = 只跑了确定性检查，结论覆盖面更窄）
  used_model          INTEGER NOT NULL DEFAULT 0,
  findings_count      INTEGER NOT NULL DEFAULT 0,
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
