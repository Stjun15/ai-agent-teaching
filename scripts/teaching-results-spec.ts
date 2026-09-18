/**
 * 教学结果表 DB 集成测试（不调模型）
 *
 * 守的是「question_results / validation_results 两张结果表的写入→读取闭环在真实
 * dev.db 上能跑通」—— 这正是 Phase 7 收口时钉死、随后由
 * feat(db): add validation/question result write paths 关闭的结构缺口：
 * 此前 src/lib/db 没有这两张表的写入路径，validation_results 甚至在 /api/agent/validate
 * 跑完点评后被直接丢弃，导致两表恒为 0 行。
 *
 * 为什么值得单独测、且只测 DB 层
 * ------------------------------
 * 模型调用是随机的、慢的、烧钱的，不适合放进「每次 npm test 都跑」的纯函数组；
 * 但结果表的持久化**不调模型**，必须能在 DB 层被钉死。本测试直接打 repository
 * （绕开 HTTP 与模型），验证真实的写→读链路在 dev.db 上确实生效，并让两张表
 * 出现**真实**行（而非伪造）。
 *
 * 在 dev.db 上真跑
 * --------------
 * 测试以 cwd=项目根运行，getDb() 默认命中 ./dev.db（与 app / 种子脚本同一文件）。
 * 跑完后 question_results / validation_results 会多出真实行，正是对「缺口已关闭」
 * 的事实核验。question_results.question_id 外键到 questions(id) 且非空，故
 * ensureDemoStudent 里先造一条固定的题库行。
 *
 * 运行：
 *   pnpm test:teaching-results
 */

import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getDb } from "@/lib/db/sqlite";
import { questionResultDb, validationResultDb } from "@/lib/db";

/** 与种子脚本 / 浏览器侧共用同一固定 UUID，避免「接口全报学生不存在」。 */
const DEMO_STUDENT = JSON.parse(
  readFileSync(
    new URL("../src/lib/demo-student.json", import.meta.url),
    "utf8",
  ),
) as { studentId: string };
const TEST_STUDENT_ID = DEMO_STUDENT.studentId;

/** 两条结果表都外键到 sessions(id)，复用旧测试的固定会话。 */
const TEST_SESSION_ID = "test-session-loop";

/**
 * question_results.question_id 外键到 questions(id) 且非空，必须先有一条题库行。
 * 用固定 id，使本组测试不依赖「手动先灌过题库」。
 */
const TEST_QUESTION_ID = "q_loop_test";

/**
 * 保证 demo 学生 / 会话 / 题库行存在（结果表及其外键都指向它们）。
 * 用 INSERT OR IGNORE，使本组测试不依赖「手动先跑过种子」：
 * 全新克隆拿到的是空 dev.db，npm test 也应能独立跑通。
 */
function ensureDemoStudent(): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO students (id, nickname, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    TEST_STUDENT_ID,
    "种子学生",
    new Date().toISOString(),
    new Date().toISOString(),
  );

  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, student_id, module_id)
     VALUES (?, ?, ?)`,
  ).run(TEST_SESSION_ID, TEST_STUDENT_ID, "llm-api");

  db.prepare(
    `INSERT OR IGNORE INTO questions (
       id, module_id, concept_id, type, question, correct_answer, explanation
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    TEST_QUESTION_ID,
    "llm-api",
    "llm-api",
    "简答题",
    "什么是大语言模型？",
    "一种基于深度学习的语言生成模型",
    "从定义与训练方式简述即可。",
  );
}

before(() => {
  ensureDemoStudent();
});

test("validation_results 写入/读取闭环（create + listByStudent + listBySession）", async () => {
  const id = crypto.randomUUID();
  await validationResultDb.create({
    id,
    studentId: TEST_STUDENT_ID,
    sessionId: TEST_SESSION_ID,
    taskType: "prompt",
    totalScore: 82,
    level: "良好",
    isCorrect: true,
    dimensions: [
      { name: "角色定义", score: 42, weight: 0.5, comment: "清晰" },
      { name: "输出格式", score: 40, weight: 0.5, comment: "规范" },
    ],
    issues: [
      {
        type: "优化建议",
        detail: "可补充约束",
        deduction: 8,
        related_dimension: "角色定义",
        related_anti_pattern: null,
      },
    ],
    suggestions: [{ priority: "中", action: "加一条约束", example: "…" }],
  });

  // 按学生查：应能读回刚写的那条。
  const byStudent = await validationResultDb.listByStudent(TEST_STUDENT_ID, 10);
  const found = byStudent.find((v) => v.id === id);
  assert.ok(found, "刚写入的校验结果应能被 listByStudent 读回");
  assert.equal(found?.taskType, "prompt");
  assert.equal(found?.totalScore, 82);
  assert.equal(found?.level, "良好");
  assert.equal(found?.isCorrect, true);
  assert.equal(found?.dimensions.length, 2, "dimensions 应原样读回");
  assert.deepEqual(found?.issues[0].deduction, 8, "issues 应原样读回");

  // 按会话查：同一条也应出现在会话维度。
  const bySession = await validationResultDb.listBySession(TEST_SESSION_ID);
  assert.ok(
    bySession.some((v) => v.id === id),
    "刚写入的校验结果应能被 listBySession 读回",
  );

  // 计数：写一条后该学生总数应 ≥1。
  const count = await validationResultDb.countByStudent(TEST_STUDENT_ID);
  assert.ok(count >= 1, "countByStudent 应 ≥1");
});

test("question_results 写入/读取闭环（create + listByStudent + get）", async () => {
  const id = crypto.randomUUID();
  await questionResultDb.create({
    id,
    studentId: TEST_STUDENT_ID,
    questionId: TEST_QUESTION_ID,
    sessionId: TEST_SESSION_ID,
    studentAnswer: "大语言模型是基于深度学习的生成式模型。",
    isCorrect: true,
    score: 100,
    attempts: 1,
  });

  // 单条读取：get 应命中。
  const got = await questionResultDb.get(id);
  assert.ok(got, "刚写入的答题结果应能被 get 读回");
  assert.equal(got?.questionId, TEST_QUESTION_ID);
  assert.equal(got?.isCorrect, true);
  assert.equal(got?.score, 100);
  assert.equal(got?.attempts, 1);

  // 按学生查：应能列出来。
  const list = await questionResultDb.listByStudent(TEST_STUDENT_ID, 10);
  assert.ok(
    list.some((q) => q.id === id),
    "刚写入的答题结果应能被 listByStudent 读回",
  );

  // 真实落库：表里该学生行数应 ≥1。
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM question_results WHERE student_id = ?")
    .get(TEST_STUDENT_ID) as { c: number };
  assert.ok(row.c >= 1, "question_results 真实行数应 ≥1");
});
