/**
 * 教学循环 DB 集成测试（不调模型）
 *
 * 守的是「教学循环在真实 dev.db 上跑得通那条写→读闭环」—— 也就是 Phase 6
 * 验收标准里「9 模块能完整跑通教学流程 / 端到端测试通过」目前最缺的事实支撑。
 *
 * 为什么值得单独测、且只测 DB 层
 * ------------------------------
 * 教学循环分三层：编排层（teaching-loop.ts，1~6 步，含模型调用）、
 * 数据访问层（src/lib/db/*）、HTTP 端点（src/app/api/*）。
 * 模型调用是随机的、慢的、烧钱的，不适合放进「每次 npm test 都跑」的纯函数组；
 * 但 7~9 步（更新掌握度 / 更新学习路径 / 进入下一模块）要写库，这部分**不调模型**，
 * 必须能在 DB 层被钉死。本测试直接打 repository（绕开 HTTP 与模型），验证
 * 真实的写→读链路在 dev.db 上确实生效，并让相关表出现**真实**行（而非伪造）。
 *
 * 在 dev.db 上真跑
 * --------------
 * 测试以 cwd=项目根运行，getDb() 默认命中 ./dev.db（与 app / 种子脚本同一文件）。
 * 跑完后 learning_paths / agent_traces / mastery 会多出真实行，正是 Phase 6 收口
 * 想要的「接口能被真实地打一遍」。
 *
 * question_results / validation_results 的写入闭环
 * ---------------------------------------------
 * 这两张结果表此前在 src/lib/db 没有写入路径（Phase 7 钉死的结构缺口），已由
 * feat(db): add validation/question result write paths 关闭，对应的写→读测试
 * 见 scripts/teaching-results-spec.ts（同样在真实 dev.db 上真跑）。本文件只守
 * mastery / learning_path / agent_traces 三条链。
 *
 * 运行：
 *   pnpm test:teaching-loop
 */

import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getDb } from "@/lib/db/sqlite";
import {
  learningPathDb,
  masteryDb,
  traceDb,
  type LearningPathModule,
} from "@/lib/db";

/** 与种子脚本 / 浏览器侧共用同一固定 UUID，避免「接口全报学生不存在」。 */
const DEMO_STUDENT = JSON.parse(
  readFileSync(
    new URL("../src/lib/demo-student.json", import.meta.url),
    "utf8",
  ),
) as { studentId: string };
const TEST_STUDENT_ID = DEMO_STUDENT.studentId;

/**
 * 保证 demo 学生行存在（mastery / learning_paths / agent_traces 都外键到它）。
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

  // agent_traces 外键到 sessions(id)，先造一条固定测试会话，避免写 trace 时 FK 失败。
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, student_id, module_id)
     VALUES (?, ?, ?)`,
  ).run("test-session-loop", TEST_STUDENT_ID, "llm-api");
}

before(() => {
  ensureDemoStudent();
});

test("mastery 写入/读取闭环（upsert + getByConcept）", async () => {
  // 用一个专属概念 id，不碰种子脚本刻意种下的 llm-api=4 / system-prompt=1。
  const concept = "loop_test_concept";
  await masteryDb.update(TEST_STUDENT_ID, concept, 5);
  const row = await masteryDb.getByConcept(TEST_STUDENT_ID, concept);
  assert.ok(row, `应读回 ${concept} 的掌握度行`);
  assert.equal(row?.score, 5, "写入分数应被原样读回");

  // 第二次 upsert 应覆盖，验证「写→读」是同一行而非追加。
  await masteryDb.update(TEST_STUDENT_ID, concept, 2);
  const row2 = await masteryDb.getByConcept(TEST_STUDENT_ID, concept);
  assert.equal(row2?.score, 2, "第二次 upsert 应覆盖分数");
});

test("learning_path 创建→推进→调整闭环（create + updateModule + addAdjustment + get）", async () => {
  const modules: LearningPathModule[] = [
    {
      order: 1,
      moduleId: "llm-api",
      status: "not_started",
      startedAt: null,
      completedAt: null,
      mastery: 0,
    },
    {
      order: 2,
      moduleId: "system-prompt",
      status: "not_started",
      startedAt: null,
      completedAt: null,
      mastery: 0,
    },
  ];

  // 此前没有任何代码能建这行 —— 这一步现在真的能写入了。
  await learningPathDb.create(TEST_STUDENT_ID, {
    currentModule: "llm-api",
    nextModule: "system-prompt",
    modules,
  });

  let path = await learningPathDb.get(TEST_STUDENT_ID);
  assert.ok(path, "create 后应能读回学习路径");
  assert.equal(path?.currentModule, "llm-api");
  assert.equal(path?.nextModule, "system-prompt");
  assert.equal(path?.modules.length, 2, "应读回 2 个模块");

  // 进入 in_progress：应补 startedAt，completedAt 仍空。
  await learningPathDb.updateModule(TEST_STUDENT_ID, "llm-api", "in_progress");
  path = await learningPathDb.get(TEST_STUDENT_ID);
  const m1 = path?.modules.find((m) => m.moduleId === "llm-api");
  assert.equal(m1?.status, "in_progress");
  assert.ok(m1?.startedAt, "in_progress 应写入 startedAt");
  assert.equal(m1?.completedAt, null, "in_progress 时 completedAt 应为空");

  // 完成：startedAt 保留，补 completedAt。
  await learningPathDb.updateModule(TEST_STUDENT_ID, "llm-api", "completed");
  path = await learningPathDb.get(TEST_STUDENT_ID);
  const m1b = path?.modules.find((m) => m.moduleId === "llm-api");
  assert.equal(m1b?.status, "completed");
  assert.ok(m1b?.completedAt, "completed 应写入 completedAt");

  // 路径内不存在的模块应抛错，而不是静默无操作（让问题早暴露）。
  await assert.rejects(
    () => learningPathDb.updateModule(TEST_STUDENT_ID, "nope", "in_progress"),
    /不存在模块 nope/,
    "对路径内不存在的模块 updateModule 应抛错",
  );

  // 追加一条调整记录。
  await learningPathDb.addAdjustment(TEST_STUDENT_ID, {
    date: new Date().toISOString(),
    reason: "teaching-loop-spec 集成验证",
    action: "promote",
  });
  path = await learningPathDb.get(TEST_STUDENT_ID);
  assert.equal(path?.adjustments.length, 1, "应追加一条调整记录");
});

test("agent_traces 写入/读取闭环（create + listByStudent）", async () => {
  const id = crypto.randomUUID();
  await traceDb.create({
    id,
    traceId: `trace_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    studentId: TEST_STUDENT_ID,
    sessionId: "test-session-loop",
    agent: "teacher",
    skill: "explain-concept",
    input: { module_id: "llm-api" },
    output: { ok: true },
    wikiReads: ["concepts/llm-api"],
    wikiWrites: [],
    durationMs: 123,
    tokens: { input: 10, output: 20 },
    retries: 0,
    success: true,
  });

  const list = await traceDb.listByStudent(TEST_STUDENT_ID, 10);
  const found = list.find((t) => t.id === id);
  assert.ok(found, "刚写入的 trace 应能被 listByStudent 读回");
  assert.equal(found?.agent, "teacher");
  assert.deepEqual(found?.tokens, { input: 10, output: 20 });
});
