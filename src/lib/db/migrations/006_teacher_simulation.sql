-- ============================================================================
-- 006_teacher_simulation —— 教师端控制台 + 学生模拟 Agent 产品化
--
-- 编号说明：004/005 曾用于「课程审计」模块（commit 4e4deb5 / 921645b），
-- 该模块在 116d6eb 整体移除时只删了代码、没留迁移文件；生产库的
-- schema_migrations 里仍记着这两个 id。为避免与历史 id 撞号，本文件从 006 起。
-- 幂等性由迁移执行器保证（同一 id 只跑一次），不会与生产库冲突。
--
-- 两张表的分工
-- ------------
-- simulation_runs  = 一次运行的汇总（谁发起、跑哪个模块哪一步、花了多少 token）
-- simulation_turns = 该运行里逐轮的对话与「学生这一轮看到了什么」的快照
-- 拆两张表的理由：教师控制台先列运行、点开才拉明细；汇总数字（成本、轮次）
-- 不该靠遍历明细现算 —— 那是 O(轮次) 的读放大。
-- ============================================================================

-- 身份：教师控制台的准入依据。
-- 默认 'student' 让既有账号与注册路径零改动；教师账号由种子脚本写入
-- role='teacher'（scripts/seed-auth-accounts.mjs），**不开放任何自助升级接口**。
-- 判权在代码里（src/lib/api-auth.ts 的 requireTeacher），不靠前端隐藏入口。
ALTER TABLE students ADD COLUMN role TEXT NOT NULL DEFAULT 'student';

-- 一次模拟运行
CREATE TABLE simulation_runs (
  id            TEXT PRIMARY KEY NOT NULL,
  -- 发起人（教师）。学生的模拟身份不是真实账户，不落 students 表。
  teacher_id    TEXT NOT NULL REFERENCES students(id),
  module_id     TEXT NOT NULL,
  step          TEXT NOT NULL,
  persona       TEXT NOT NULL,
  -- running | completed | failed | aborted
  status        TEXT NOT NULL DEFAULT 'running',
  max_turns     INTEGER NOT NULL,
  turns_used    INTEGER NOT NULL DEFAULT 0,
  tokens_input  INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  -- 结束原因：max-turns | student-gave-up | token-budget | teacher-abort
  stop_reason   TEXT,
  error         TEXT,
  started_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at      TEXT
);

-- 一轮对话
CREATE TABLE simulation_turns (
  id              TEXT PRIMARY KEY NOT NULL,
  run_id          TEXT NOT NULL REFERENCES simulation_runs(id),
  -- 从 1 开始的轮次序号（教师看的是「第几轮」，不是数组下标）
  turn_index      INTEGER NOT NULL,
  -- student（模拟学生）| mentor（导师回答，即产品里学生会看到的回复）
  speaker         TEXT NOT NULL,
  content         TEXT NOT NULL,
  -- 模拟学生这一轮「看到的屏幕」文本快照（截断后）
  screen_digest   TEXT NOT NULL DEFAULT '',
  cognitive_state TEXT,
  action_type     TEXT,
  tokens_input    INTEGER NOT NULL DEFAULT 0,
  tokens_output   INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 控制台按教师列最近运行；按 run 顺序取明细
CREATE INDEX idx_simulation_runs_teacher ON simulation_runs(teacher_id, started_at);
CREATE INDEX idx_simulation_turns_run ON simulation_turns(run_id, turn_index);
