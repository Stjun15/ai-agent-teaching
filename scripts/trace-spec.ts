/**
 * Trace 接线 DB 集成测试（不调模型）
 *
 * 守的是什么
 * ---------
 * Phase 4 验收标准「Trace 记录写入数据库」此前**只在基础设施层成立**：
 * `runAgent` 支持 `trace` 上下文、传入就写库，但全仓 4 个调用点一个都没传。
 * 结果是真实 HTTP 流量零写入 —— `agent_traces` 里现存的 5 行**全部**来自测试
 * 脚本直接写（`session_id` 形如 `test-session-*`），没有一行来自真实请求。
 * 本组测试守的是这次接通后的两个事实：
 *   1. 写入层的两种形态都正确 —— 有会话（讲解/校验/答疑）与**无会话**
 *      （出题是模块级操作，见 generate-question 路由文件头）；
 *   2. 观测失败不静默 —— 写库失败要带回原因，而不是吞掉。
 *
 * 为什么无会话是「写 NULL」而不是「不记录」
 * -----------------------------------
 * `TraceContext.sessionId` 可选、`AgentTrace.sessionId` 可空，与表里
 * `session_id` 允许为空一致。为「字段齐全」编造一个会话 id 会让观测数据
 * 指向错误归属 —— 归属错了比缺失更糟。
 *
 * 本测试覆盖不到的部分（诚实标注）
 * ---------------------------
 * `runAgent` 的端到端写库要真调模型，因此不进本组。这里用一组**文本断言**
 * 守住「五个端点的接线未被回退」—— 它不能证明运行时行为，但能拦住
 * 「新增调用点忘传 trace」这类最常见的回退。运行时的事实在人工端到端验证里
 * 核（起 dev 服务打端点，观察 agent_traces 是否出现真实会话 id 的行）。
 *
 * 运行：
 *   pnpm test:trace
 */

import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getDb } from "@/lib/db/sqlite";
import { traceDb } from "@/lib/db";
import { recordAgentTrace } from "@/lib/agent/trace";

/** 与种子脚本 / 其它 DB 测试共用同一固定 UUID。 */
const DEMO_STUDENT = JSON.parse(
  readFileSync(
    new URL("../src/lib/demo-student.json", import.meta.url),
    "utf8",
  ),
) as { studentId: string };
const TEST_STUDENT_ID = DEMO_STUDENT.studentId;

/** `agent_traces.session_id` 外键到 sessions(id)，有会话的用例需要它存在。 */
const TEST_SESSION_ID = "test-session-loop";

function ensureFixture(): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO students (id, nickname, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(TEST_STUDENT_ID, "种子学生", now, now);
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, student_id, module_id)
     VALUES (?, ?, ?)`,
  ).run(TEST_SESSION_ID, TEST_STUDENT_ID, "llm-api");
}

before(() => {
  ensureFixture();
});

test("有会话的 trace：写入→读回，sessionId 保留", async () => {
  const result = await recordAgentTrace({
    studentId: TEST_STUDENT_ID,
    sessionId: TEST_SESSION_ID,
    agent: "teacher",
    skill: "explain-concept",
    input: { module_id: "llm-api" },
    output: { type: "explanation" },
    durationMs: 1234,
    tokens: { input: 100, output: 200 },
    retries: 0,
    success: true,
  });

  assert.equal(result.recorded, true, "有会话的 trace 应写入成功");

  const found = (await traceDb.listByStudent(TEST_STUDENT_ID, 50)).find(
    (t) => t.traceId === result.traceId,
  );
  assert.ok(found, "刚写入的 trace 应能被 listByStudent 读回");
  assert.equal(found?.sessionId, TEST_SESSION_ID);
  assert.equal(found?.agent, "teacher");
  assert.equal(found?.skill, "explain-concept");
  assert.deepEqual(found?.tokens, { input: 100, output: 200 });
  assert.equal(found?.success, true);
  assert.deepEqual(found?.input, { module_id: "llm-api" });
});

test("无会话的 trace（模块级调用，如出题）：落 NULL 而非编造会话", async () => {
  const result = await recordAgentTrace({
    studentId: TEST_STUDENT_ID,
    // 故意省略 sessionId —— generate-question 就是这种形态。
    agent: "examiner",
    skill: "generate-question",
    input: { module_id: "llm-api", count: 3 },
    output: { questions: [] },
    durationMs: 800,
    tokens: { input: 50, output: 60 },
    retries: 0,
    success: true,
  });

  assert.equal(result.recorded, true, "无会话的 trace 也应写入成功");

  const found = (await traceDb.listByStudent(TEST_STUDENT_ID, 50)).find(
    (t) => t.traceId === result.traceId,
  );
  assert.ok(found, "无会话的 trace 应能被读回");
  assert.equal(found?.sessionId, null, "无会话时应为 null");

  // 直查表：确认落的是 SQL NULL，而不是空字符串（空串会污染归属查询）。
  const row = getDb()
    .prepare("SELECT session_id FROM agent_traces WHERE trace_id = ?")
    .get(result.traceId) as { session_id: string | null };
  assert.equal(row.session_id, null, "库里应是 NULL，不是空串");
});

test("观测失败不静默：返回 recorded:false 且带回原因", async () => {
  // student_id 外键到 students(id)，不存在的学生必然插入失败。
  const result = await recordAgentTrace({
    studentId: "no-such-student-for-fk",
    agent: "teacher",
    skill: "explain-concept",
    input: {},
    output: {},
    durationMs: 1,
    tokens: { input: 0, output: 0 },
    retries: 0,
    success: true,
  });

  assert.equal(result.recorded, false, "外键失败时应返回 recorded:false");
  assert.ok(
    result.error,
    "失败必须带回原因（静默吞掉会让「少一半数据」长期不被发现）",
  );
});

/** 五个 Agent 端点。前四个有会话上下文，最后一个（出题）没有。 */
const SESSION_ENDPOINTS = [
  "src/app/api/agent/explain/route.ts",
  "src/app/api/agent/validate/route.ts",
  "src/app/api/agent/answer-grade/route.ts",
  "src/app/api/agent/answer/route.ts",
];
const MODULE_ENDPOINT = "src/app/api/agent/generate-question/route.ts";

test("端点接线未回退：真实流量能产生 trace", () => {
  for (const file of SESSION_ENDPOINTS) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(
      text,
      /trace:\s*\{[^}]*studentId[^}]*sessionId/,
      `${file} 应传带 sessionId 的 trace 上下文`,
    );
  }

  const moduleText = readFileSync(
    new URL(`../${MODULE_ENDPOINT}`, import.meta.url),
    "utf8",
  );
  const traceLiteral = moduleText.match(/trace:\s*\{[^}]*\}/);
  assert.ok(traceLiteral, `${MODULE_ENDPOINT} 应传 trace 上下文`);
  assert.match(traceLiteral[0], /studentId/, "出题至少要带学生归属");
  assert.doesNotMatch(
    traceLiteral[0],
    /sessionId/,
    "出题是模块级操作，不该编造会话归属",
  );
});
