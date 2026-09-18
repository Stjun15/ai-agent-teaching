/**
 * 学生记录（错题 / Prompt 历史）写入测试（不调模型）
 *
 * 守的是什么
 * ---------
 * 报告页的「薄弱点」由 errors 聚合、「Prompt 平均分」由 prompt_history 平均，
 * 但两张表此前没有任何写入路径，这两个区块永远显示「还没有记录」。
 * 本文件守存储层行为：写进去读得回来、读视角语义正确、聚合不被污染。
 * 路由接线与兜底纪律的守卫见 `student-records-wiring-spec.ts`。
 *
 * 本测试覆盖不到的部分（诚实标注）
 * ---------------------------
 * 路由层的端到端写库要真调模型（validate / answer-grade 的点评分支），
 * 不进本组。运行时事实由人工端到端验证核（起 dev 服务、交一份不通过的
 * 作业，看两张表出现行）。
 *
 * 运行：
 *   npm run test:student-records
 */

import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "@/lib/db/sqlite";
import { errorDb, promptHistoryDb } from "@/lib/db";
import { runAssessLoop } from "@/lib/agent/orchestrator/assess-loop";

/** 本组专用学生，不与其它测试的行混在一起。 */
const TEST_STUDENT_ID = "00000000-0000-4000-8000-00000000aa01";

/** node:test 的钩子形式因加载器而异，直接在首个用例里建夹具更稳。 */
let fixtureReady = false;
async function ensureFixture(): Promise<void> {
  if (fixtureReady) return;
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO students (id, nickname, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(TEST_STUDENT_ID, "记录写入测试学生", now, now);
  fixtureReady = true;
}

test("prompt_history 落库后按学生读回，JSON 列原样还原", async () => {
  await ensureFixture();
  await promptHistoryDb.create({
    studentId: TEST_STUDENT_ID,
    moduleId: "llm-api",
    taskType: "prompt",
    content: "帮我写个总结",
    score: 62,
    dimensions: [
      { name: "角色定义", score: 50, weight: 0.6, comment: "角色不完整" },
      { name: "输出约束", score: 80, weight: 0.4, comment: "基本可用" },
    ],
    issues: [
      {
        type: "严重错误",
        detail: "缺少角色定义",
        deduction: 30,
        relatedDimension: "角色定义",
        relatedAntiPattern: null,
      },
    ],
    suggestions: ["先补一句完整的角色定义"],
    attemptNumber: 1,
    isPassed: false,
  });

  const rows = await promptHistoryDb.listByStudent(TEST_STUDENT_ID);
  const row = rows.find((r) => r.content === "帮我写个总结");
  assert.ok(row, "刚写入的行必须能读回");
  assert.equal(row.score, 62);
  assert.equal(row.isPassed, false);
  assert.equal(row.dimensions[0]?.name, "角色定义");
  assert.equal(row.issues[0]?.relatedDimension, "角色定义");
  assert.deepEqual(row.suggestions, ["先补一句完整的角色定义"]);
});

test("errors 落库后按学生读回：无题面时 question 映射为空串", async () => {
  await ensureFixture();
  await errorDb.create({
    studentId: TEST_STUDENT_ID,
    moduleId: "llm-api",
    conceptId: "llm-api",
    taskType: "prompt",
    studentAnswer: "帮我写个总结",
    problems: ["严重错误：缺少角色定义"],
    correctExample: "你是一位面向初中生的物理老师……",
    relatedAntiPattern: "prompt-no-format",
  });

  const rows = await errorDb.listByStudent(TEST_STUDENT_ID);
  const row = rows.find((r) => r.studentAnswer === "帮我写个总结");
  assert.ok(row, "刚写入的错题必须能读回");
  assert.equal(row.question, "");
  assert.equal(row.isCorrected, false);
  assert.equal(row.variantQuestionsGenerated, 0);
  assert.equal(row.relatedAntiPattern, "prompt-no-format");
  assert.deepEqual(row.problems, ["严重错误：缺少角色定义"]);
});

test("listUncorrected 只给未订正的，listRecentConcepts 去重", async () => {
  await ensureFixture();
  for (const answer of ["答案 A", "答案 B"]) {
    await errorDb.create({
      studentId: TEST_STUDENT_ID,
      moduleId: "llm-api",
      conceptId: "prompt-anatomy",
      taskType: "prompt",
      studentAnswer: answer,
      problems: [`严重错误：${answer}`],
    });
  }

  const uncorrected = await errorDb.listUncorrected(TEST_STUDENT_ID);
  assert.ok(uncorrected.every((r) => r.isCorrected === false));

  const concepts = await errorDb.listRecentConcepts(TEST_STUDENT_ID, 10);
  assert.equal(
    concepts.filter((c) => c === "prompt-anatomy").length,
    1,
    "同一概念的两条错题只出一次（出题 Agent 拿它排优先级）",
  );
});

test("averageScore 不被 NULL 分数拉低", async () => {
  const db = getDb();
  // 专用学生：averageScore 是学生级聚合，与其它用例共用学生会让人工
  // 复算期望值 —— 独立学生让断言只由本用例决定。
  const AVG_STUDENT_ID = "00000000-0000-4000-8000-00000000aa02";
  db.prepare(
    `INSERT OR IGNORE INTO students (id, nickname, created_at, updated_at)
     VALUES (?, '平均分测试学生', ?, ?)`,
  ).run(AVG_STUDENT_ID, new Date().toISOString(), new Date().toISOString());

  await promptHistoryDb.create({
    studentId: AVG_STUDENT_ID,
    moduleId: "llm-api",
    taskType: "code",
    content: "一份 80 分的提交",
    score: 80,
    dimensions: [],
    issues: [],
    suggestions: [],
    attemptNumber: 1,
    isPassed: true,
  });
  // 列允许 NULL 的历史行（旧数据形态）：直接落库验证 AVG 的过滤条件。
  db.prepare(
    `INSERT INTO prompt_history
       (id, student_id, module_id, task_type, content, score, attempt_number, is_passed)
     VALUES (?, ?, ?, ?, ?, NULL, 1, 0)`,
  ).run(crypto.randomUUID(), AVG_STUDENT_ID, "llm-api", "prompt", "旧记录");

  const avg = await promptHistoryDb.averageScore(AVG_STUDENT_ID);
  assert.ok(avg !== null);
  assert.equal(avg, 80, "NULL 分数不得计入平均（否则 80 会被拉成 40）");
});

test("客观题评分结论不携带 review、不标兜底（错题只来自点评路径）", async () => {
  const assessment = await runAssessLoop({
    question: { type: "选择题", correctAnswer: "A", explanation: "因为 A" },
    studentAnswer: "B",
    moduleId: "llm-api",
  });
  assert.equal(assessment.isCorrect, false);
  assert.equal(assessment.gradedBy, "rule");
  assert.equal(assessment.usedFallback, false);
  assert.equal(assessment.review, undefined);
});
