-- ============================================================================
-- 001_init —— 开发期 SQLite 建表
--
-- 来源：agent-prompts/references/data-models.md「二、CloudBase 建表 SQL」
--       （原文档为 PostgreSQL 方言）
--
-- 类型映射规则（PG → SQLite）：
--   UUID PRIMARY KEY DEFAULT gen_random_uuid()  →  TEXT PRIMARY KEY
--       id 由应用层生成（crypto.randomUUID()），使两种后端行为一致
--   TIMESTAMPTZ DEFAULT NOW()                   →  TEXT NOT NULL DEFAULT (当前 UTC ISO8601)
--   TIMESTAMPTZ（可空）                          →  TEXT
--   JSONB / JSONB DEFAULT '[]' / '{}'           →  TEXT / TEXT NOT NULL DEFAULT '[]' / '{}'
--   BOOLEAN                                     →  INTEGER（0/1）
--   FLOAT                                       →  REAL
--   INT                                         →  INTEGER
--
-- 两处 SQLite 必需的必要修正（非语义变更）：
--   1. 所有主键列显式声明 NOT NULL —— SQLite 对非 INTEGER 主键不自动隐含 NOT NULL
--   2. 时间统一以 ISO 8601 UTC 字符串存储 —— SQLite 无原生时间类型
--
-- 刻意未收录：knowledge_embeddings（PG + pgvector 专用，属 Phase 2 RAG）
-- 刻意未添加：ON DELETE CASCADE —— 设计文档未规定级联行为，不擅自引入语义
-- ============================================================================

-- 学生
CREATE TABLE students (
  id         TEXT PRIMARY KEY NOT NULL,
  nickname   TEXT NOT NULL,
  email      TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 学生画像
CREATE TABLE student_profiles (
  student_id             TEXT PRIMARY KEY NOT NULL REFERENCES students(id),
  programming_background TEXT NOT NULL,
  learning_goal          TEXT,
  preferred_language     TEXT DEFAULT 'typescript',
  pace                   TEXT DEFAULT 'normal',
  explanation_style      TEXT DEFAULT 'analogy',
  hint_preference        TEXT DEFAULT 'try_first',
  feedback_preference    TEXT DEFAULT 'encouraging',
  visual_preference      TEXT DEFAULT 'animation',
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 掌握度
CREATE TABLE mastery (
  student_id       TEXT NOT NULL REFERENCES students(id),
  concept_id       TEXT NOT NULL,
  score            INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 5),
  last_reviewed_at TEXT,
  error_count      INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'not_started',
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (student_id, concept_id)
);

-- 学习路径
CREATE TABLE learning_paths (
  student_id   TEXT PRIMARY KEY NOT NULL REFERENCES students(id),
  current_module TEXT,
  next_module  TEXT,
  modules      TEXT NOT NULL DEFAULT '[]',
  adjustments  TEXT NOT NULL DEFAULT '[]',
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 错题记录
CREATE TABLE errors (
  id                    TEXT PRIMARY KEY NOT NULL,
  student_id            TEXT REFERENCES students(id),
  module_id             TEXT NOT NULL,
  concept_id            TEXT NOT NULL,
  task_type             TEXT NOT NULL,
  question              TEXT,
  student_answer        TEXT,
  problems              TEXT NOT NULL DEFAULT '[]',
  correct_example       TEXT,
  related_anti_pattern  TEXT,
  is_corrected          INTEGER NOT NULL DEFAULT 0,
  variant_questions_generated INTEGER DEFAULT 0,
  next_review_at        TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Prompt 历史
CREATE TABLE prompt_history (
  id             TEXT PRIMARY KEY NOT NULL,
  student_id     TEXT REFERENCES students(id),
  module_id      TEXT NOT NULL,
  task_type      TEXT NOT NULL,
  content        TEXT NOT NULL,
  score          INTEGER,
  dimensions     TEXT NOT NULL DEFAULT '[]',
  issues         TEXT NOT NULL DEFAULT '[]',
  suggestions    TEXT NOT NULL DEFAULT '[]',
  attempt_number INTEGER DEFAULT 1,
  is_passed      INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 项目
CREATE TABLE projects (
  id                  TEXT PRIMARY KEY NOT NULL,
  student_id          TEXT REFERENCES students(id),
  project_template_id TEXT NOT NULL,
  name                TEXT NOT NULL,
  status              TEXT DEFAULT 'not_started',
  web_app_checklist   TEXT NOT NULL DEFAULT '[]',
  ide_checklist       TEXT NOT NULL DEFAULT '[]',
  prompt_record_ids   TEXT NOT NULL DEFAULT '[]',
  repo_url            TEXT,
  demo_url            TEXT,
  mentor_comment      TEXT,
  started_at          TEXT,
  completed_at        TEXT
);

-- 会话
CREATE TABLE sessions (
  id             TEXT PRIMARY KEY NOT NULL,
  student_id     TEXT REFERENCES students(id),
  module_id      TEXT NOT NULL,
  current_step   TEXT DEFAULT 'explain',
  status         TEXT DEFAULT 'active',
  started_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at       TEXT,
  total_tokens   INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0
);

-- 消息
CREATE TABLE messages (
  id         TEXT PRIMARY KEY NOT NULL,
  session_id TEXT REFERENCES sessions(id),
  role       TEXT NOT NULL,
  content    TEXT,
  code       TEXT,
  language   TEXT,
  citations  TEXT NOT NULL DEFAULT '[]',
  metadata   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 引用
CREATE TABLE citations (
  id         TEXT PRIMARY KEY NOT NULL,
  message_id TEXT REFERENCES messages(id),
  source     TEXT NOT NULL,
  page       INTEGER,
  snippet    TEXT,
  relevance  REAL NOT NULL DEFAULT 0
);

-- Agent 事件
CREATE TABLE agent_events (
  id         TEXT PRIMARY KEY NOT NULL,
  session_id TEXT REFERENCES sessions(id),
  message_id TEXT REFERENCES messages(id),
  agent      TEXT NOT NULL,
  type       TEXT NOT NULL,
  content    TEXT,
  metadata   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 校验结果
CREATE TABLE validation_results (
  id          TEXT PRIMARY KEY NOT NULL,
  student_id  TEXT REFERENCES students(id),
  session_id  TEXT REFERENCES sessions(id),
  task_type   TEXT NOT NULL,
  total_score INTEGER,
  level       TEXT,
  is_correct  INTEGER,
  dimensions  TEXT NOT NULL DEFAULT '[]',
  issues      TEXT NOT NULL DEFAULT '[]',
  suggestions TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 题库（id 为外部定义的可读 ID，非 UUID）
CREATE TABLE questions (
  id                   TEXT PRIMARY KEY NOT NULL,
  module_id            TEXT NOT NULL,
  concept_id           TEXT NOT NULL,
  type                 TEXT NOT NULL,
  difficulty           INTEGER,
  scenario             TEXT,
  question             TEXT NOT NULL,
  options              TEXT,
  correct_answer       TEXT,
  explanation          TEXT,
  hint_levels          TEXT NOT NULL DEFAULT '[]',
  related_anti_pattern TEXT
);

-- 答题结果
CREATE TABLE question_results (
  id            TEXT PRIMARY KEY NOT NULL,
  student_id    TEXT REFERENCES students(id),
  question_id   TEXT REFERENCES questions(id),
  session_id    TEXT REFERENCES sessions(id),
  student_answer TEXT,
  is_correct    INTEGER,
  score         INTEGER,
  attempts      INTEGER DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Trace
CREATE TABLE agent_traces (
  id         TEXT PRIMARY KEY NOT NULL,
  trace_id   TEXT NOT NULL,
  timestamp  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  student_id TEXT REFERENCES students(id),
  session_id TEXT REFERENCES sessions(id),
  agent      TEXT NOT NULL,
  skill      TEXT,
  input      TEXT,
  output     TEXT,
  wiki_reads  TEXT NOT NULL DEFAULT '[]',
  wiki_writes TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER,
  tokens      TEXT NOT NULL DEFAULT '{}',
  retries     INTEGER NOT NULL DEFAULT 0,
  success     INTEGER NOT NULL DEFAULT 1,
  error       TEXT
);

-- 索引（与设计文档一致）
CREATE INDEX idx_mastery_student ON mastery(student_id);
CREATE INDEX idx_errors_student ON errors(student_id, module_id);
CREATE INDEX idx_prompts_student ON prompt_history(student_id, module_id);
CREATE INDEX idx_sessions_student ON sessions(student_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_agent_events_session ON agent_events(session_id);
CREATE INDEX idx_traces_student ON agent_traces(student_id, timestamp);
CREATE INDEX idx_question_results_student ON question_results(student_id);
