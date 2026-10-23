/**
 * 数据隔离纯函数测试
 *
 * 守的是「学生 A 查不到学生 B 的数据」这条安全红线。
 * 往库里写两个学生的数据，再分别用各自的 studentId 查询 ——
 * 任何一边能读到另一边的数据就是红线被跨过。
 *
 * 运行：
 *   pnpm test:isolation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { getDb } from "@/lib/db/sqlite";

const STUDENT_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const STUDENT_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const SESSION_A = "cccccccc-3333-4333-8333-cccccccccccc";
const SESSION_B = "dddddddd-4444-4444-8444-dddddddddddd";

function ensureSchema(): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO students (id, nickname, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(STUDENT_A, "学生A", new Date().toISOString(), new Date().toISOString());
  db.prepare(
    `INSERT OR IGNORE INTO students (id, nickname, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(STUDENT_B, "学生B", new Date().toISOString(), new Date().toISOString());
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, student_id, module_id)
     VALUES (?, ?, ?)`,
  ).run(SESSION_A, STUDENT_A, "llm-api");
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, student_id, module_id)
     VALUES (?, ?, ?)`,
  ).run(SESSION_B, STUDENT_B, "agent-loop");
}

// ---------------------------------------------------------------------------
// 掌握度隔离
// ---------------------------------------------------------------------------

test("掌握度：学生 A 的记录不影响学生 B", () => {
  const db = getDb();
  ensureSchema();

  // 写入 A 的掌握度
  db.prepare(
    `INSERT OR REPLACE INTO mastery (student_id, concept_id, score, status, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(STUDENT_A, "llm-api", 4, "in_progress", new Date().toISOString());

  // 写入 B 的掌握度
  db.prepare(
    `INSERT OR REPLACE INTO mastery (student_id, concept_id, score, status, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(STUDENT_B, "agent-loop", 2, "in_progress", new Date().toISOString());

  const aRows = db
    .prepare("SELECT * FROM mastery WHERE student_id = ?")
    .all(STUDENT_A) as Array<{
    student_id: string;
    concept_id: string;
    score: number;
  }>;
  const bRows = db
    .prepare("SELECT * FROM mastery WHERE student_id = ?")
    .all(STUDENT_B) as Array<{
    student_id: string;
    concept_id: string;
    score: number;
  }>;

  // A 只能看到自己的
  assert.equal(aRows.length, 1);
  assert.equal(aRows[0].student_id, STUDENT_A);
  assert.equal(aRows[0].concept_id, "llm-api");
  assert.equal(aRows[0].score, 4);

  // B 只能看到自己的
  assert.equal(bRows.length, 1);
  assert.equal(bRows[0].student_id, STUDENT_B);
  assert.equal(bRows[0].concept_id, "agent-loop");
  assert.equal(bRows[0].score, 2);

  // 清理
  db.prepare("DELETE FROM mastery WHERE student_id IN (?, ?)").run(
    STUDENT_A,
    STUDENT_B,
  );
});

// ---------------------------------------------------------------------------
// 校验结果隔离
// ---------------------------------------------------------------------------

test("校验结果：学生 A 的记录不影响学生 B", () => {
  const db = getDb();
  ensureSchema();

  db.prepare(
    `INSERT OR REPLACE INTO validation_results
     (id, student_id, session_id, task_type, total_score, level, is_correct, dimensions, issues, suggestions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "v-a-001",
    STUDENT_A,
    SESSION_A,
    "prompt",
    85,
    "良好",
    1,
    "[]",
    "[]",
    "[]",
    new Date().toISOString(),
  );

  db.prepare(
    `INSERT OR REPLACE INTO validation_results
     (id, student_id, session_id, task_type, total_score, level, is_correct, dimensions, issues, suggestions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "v-b-001",
    STUDENT_B,
    SESSION_B,
    "tool",
    40,
    "不及格",
    0,
    "[]",
    "[]",
    "[]",
    new Date().toISOString(),
  );

  const aRows = db
    .prepare("SELECT * FROM validation_results WHERE student_id = ?")
    .all(STUDENT_A) as Array<{ student_id: string; total_score: number }>;
  const bRows = db
    .prepare("SELECT * FROM validation_results WHERE student_id = ?")
    .all(STUDENT_B) as Array<{ student_id: string; total_score: number }>;

  assert.equal(aRows.length, 1);
  assert.equal(aRows[0].student_id, STUDENT_A);
  assert.equal(aRows[0].total_score, 85);

  assert.equal(bRows.length, 1);
  assert.equal(bRows[0].student_id, STUDENT_B);
  assert.equal(bRows[0].total_score, 40);

  // 清理
  db.prepare("DELETE FROM validation_results WHERE id IN (?, ?)").run(
    "v-a-001",
    "v-b-001",
  );
});

// ---------------------------------------------------------------------------
// 会话隔离
// ---------------------------------------------------------------------------

test("会话：学生 A 的会话不属于学生 B", () => {
  const db = getDb();
  ensureSchema();

  const aSessions = db
    .prepare("SELECT * FROM sessions WHERE student_id = ?")
    .all(STUDENT_A) as Array<{ student_id: string }>;
  const bSessions = db
    .prepare("SELECT * FROM sessions WHERE student_id = ?")
    .all(STUDENT_B) as Array<{ student_id: string }>;

  assert.equal(aSessions.length, 1);
  assert.equal(aSessions[0].student_id, STUDENT_A);
  assert.equal(bSessions.length, 1);
  assert.equal(bSessions[0].student_id, STUDENT_B);

  // 交叉查：用 A 的 id 查 B 的会话 —— 不应存在
  const crossSessions = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND student_id = ?")
    .all(SESSION_B, STUDENT_A) as Array<{ id: string }>;
  assert.equal(crossSessions.length, 0);
});

// ---------------------------------------------------------------------------
// 清理（最后跑，确保不残留）
// ---------------------------------------------------------------------------

test("清理：删除测试数据", () => {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id IN (?, ?)").run(
    SESSION_A,
    SESSION_B,
  );
  db.prepare("DELETE FROM students WHERE id IN (?, ?)").run(
    STUDENT_A,
    STUDENT_B,
  );
  // 验证已删除
  const r = db
    .prepare("SELECT COUNT(*) AS cnt FROM students WHERE id IN (?, ?)")
    .get(STUDENT_A, STUDENT_B) as { cnt: number };
  assert.equal(r.cnt, 0);
});
