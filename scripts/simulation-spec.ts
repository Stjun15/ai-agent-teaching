/**
 * 教师端学生模拟器守卫
 *
 * 钉什么
 * ------
 * 1. **迁移真的落地**：006 在 schema_migrations 里、`students.role` 列存在。
 *    这两条一旦不成立，`/teacher` 在空库上会 500 —— CI 跑的正是空库。
 * 2. **数据闭环**：`simulationDb` 的 create / appendTurn / listTurns / finish /
 *    countByTeacherSince 在同一套行上自洽（轮次有序、汇总落值、24 小时计数正确）。
 * 3. **模拟循环的四种出口**：跑满轮次、学生放弃、触发成本上限、输出不合法。
 *    全部用注入的假模型跑，**不调真模型、不花钱**；断言的是「为什么停」，
 *    不是模型说了什么。
 * 4. **判权**：学生账号打教师端点是 403，教师账号是 200 —— 这条防线在代码里，
 *    不在前端隐藏入口上。
 *
 * 全组不依赖 dev server、不调模型，可进 CI 子集。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { requireTeacher } from "@/lib/api-auth";
import {
  SIMULATION_LIMITS,
} from "@/lib/agent/student/limits";
import {
  executeSimulation,
  parseSimulatedStudentTurn,
  type SimulationCompletion,
  type SimulationDeps,
} from "@/lib/agent/student/simulator";
import { simulationDb } from "@/lib/db";
import { getDb, listAppliedMigrationIds } from "@/lib/db/sqlite";
import type { SimulationRun, SimulationTurn } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

const PROBE_TEACHER_ID = "cccccccc-0000-4000-8000-000000000001";
const PROBE_STUDENT_ID = "cccccccc-0000-4000-8000-000000000002";
const PROBE_RUN_PREFIX = "spec-simulation-";

function seedProbeStudents(): void {
  const now = new Date().toISOString();
  const upsert = getDb().prepare(
    `INSERT INTO students (id, nickname, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET role = excluded.role`,
  );
  upsert.run(PROBE_TEACHER_ID, "spec-teacher", "teacher", now, now);
  upsert.run(PROBE_STUDENT_ID, "spec-student", "student", now, now);
}

function cleanupProbeRows(): void {
  const db = getDb();
  db.exec(
    `DELETE FROM simulation_turns WHERE run_id IN (
       SELECT id FROM simulation_runs WHERE teacher_id IN ('${PROBE_TEACHER_ID}', '${PROBE_STUDENT_ID}')
     )`,
  );
  db.exec(
    `DELETE FROM simulation_runs WHERE teacher_id IN ('${PROBE_TEACHER_ID}', '${PROBE_STUDENT_ID}')`,
  );
  db.exec(
    `DELETE FROM students WHERE id IN ('${PROBE_TEACHER_ID}', '${PROBE_STUDENT_ID}')`,
  );
}

/** 构造一条运行记录（不落库）。 */
function makeRun(overrides: Partial<SimulationRun> = {}): SimulationRun {
  return {
    id: `${PROBE_RUN_PREFIX}${crypto.randomUUID()}`,
    teacherId: PROBE_TEACHER_ID,
    moduleId: "llm-api",
    step: "explain",
    persona: "lost-beginner",
    status: "running",
    maxTurns: 2,
    turnsUsed: 0,
    tokensInput: 0,
    tokensOutput: 0,
    durationMs: 0,
    stopReason: null,
    error: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    ...overrides,
  };
}

/** 假模型：每轮学生说一句、导师回一句；token 固定。 */
function makeFakeCompletion(options?: {
  student?: () => string;
  tokens?: { input: number; output: number };
}): SimulationCompletion {
  let call = 0;
  return async () => {
    call += 1;
    const isStudent = call % 2 === 1;
    const text = isStudent
      ? (options?.student?.() ??
        JSON.stringify({
          action: "ask",
          content: `这是第 ${Math.ceil(call / 2)} 轮的提问`,
          cognitiveState: "confused",
        }))
      : `导师的第 ${Math.ceil(call / 2)} 轮回答`;
    return {
      text,
      tokens: options?.tokens ?? { input: 10, output: 5 },
    };
  };
}

/** 只用内存收集，不写库（循环用例与数据库用例解耦）。 */
function memoryDeps(complete: SimulationCompletion): SimulationDeps & {
  turns: SimulationTurn[];
  finished: { id: string; summary: Record<string, unknown> }[];
} {
  const turns: SimulationTurn[] = [];
  const finished: { id: string; summary: Record<string, unknown> }[] = [];
  return {
    complete,
    turns,
    finished,
    appendTurn: async (turn) => {
      turns.push(turn);
    },
    finish: async (id, summary) => {
      finished.push({ id, summary: summary as unknown as Record<string, unknown> });
    },
  };
}

// ---------------------------------------------------------------------------
// 1. 迁移
// ---------------------------------------------------------------------------

test("006 迁移已应用，students.role 列存在", () => {
  const applied = listAppliedMigrationIds();
  assert.ok(
    applied.includes("006_teacher_simulation.sql"),
    "006_teacher_simulation.sql 必须已在 schema_migrations 里（空库跑 db:migrate 后应有）",
  );

  const columns = getDb().prepare("PRAGMA table_info(students)").all() as {
    name: string;
  }[];
  assert.ok(
    columns.some((column) => column.name === "role"),
    "students.role 列缺失 —— 教师端判权与登录令牌都会失效",
  );
});

// ---------------------------------------------------------------------------
// 2. 数据闭环
// ---------------------------------------------------------------------------

test("simulationDb 闭环：写入、逐轮、计数、收尾", async () => {
  seedProbeStudents();
  try {
    const run = makeRun();
    await simulationDb.create(run);

    const loaded = await simulationDb.get(run.id);
    assert.ok(loaded !== null, "create 后必须能读到");
    assert.equal(loaded.status, "running");
    assert.equal(loaded.maxTurns, 2);
    assert.equal(loaded.turnsUsed, 0);
    assert.equal(loaded.startedAt.length > 0, true, "started_at 应由库填默认值");

    // 故意乱序写入，验证读取按 turn_index 排序而不是按插入顺序。
    await simulationDb.appendTurn({
      id: crypto.randomUUID(),
      runId: run.id,
      turnIndex: 2,
      speaker: "mentor",
      content: "第二条",
      screenDigest: "",
      cognitiveState: null,
      actionType: null,
      tokensInput: 1,
      tokensOutput: 1,
      durationMs: 5,
      createdAt: new Date().toISOString(),
    });
    await simulationDb.appendTurn({
      id: crypto.randomUUID(),
      runId: run.id,
      turnIndex: 1,
      speaker: "student",
      content: "第一条",
      screenDigest: "屏幕快照",
      cognitiveState: "confused",
      actionType: "ask",
      tokensInput: 2,
      tokensOutput: 3,
      durationMs: 7,
      createdAt: new Date().toISOString(),
    });

    const turns = await simulationDb.listTurns(run.id);
    assert.deepEqual(
      turns.map((turn) => turn.turnIndex),
      [1, 2],
    );
    assert.equal(turns[0].speaker, "student");
    assert.equal(turns[0].screenDigest, "屏幕快照");
    assert.equal(turns[0].cognitiveState, "confused");
    assert.equal(turns[1].speaker, "mentor");

    const counted = await simulationDb.countByTeacherSince(
      PROBE_TEACHER_ID,
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );
    assert.equal(counted, 1, "24 小时窗口应数到刚建的这条");

    const future = await simulationDb.countByTeacherSince(
      PROBE_TEACHER_ID,
      new Date(Date.now() + 60_000).toISOString(),
    );
    assert.equal(future, 0, "窗口起点在未来时不应误数");

    await simulationDb.finish(run.id, {
      status: "completed",
      turnsUsed: 1,
      tokensInput: 3,
      tokensOutput: 4,
      durationMs: 12,
      stopReason: "max-turns",
      error: null,
    });
    const finished = await simulationDb.get(run.id);
    assert.ok(finished !== null, "收尾后必须能读到");
    assert.equal(finished.status, "completed");
    assert.equal(finished.turnsUsed, 1);
    assert.equal(finished.tokensInput, 3);
    assert.equal(finished.stopReason, "max-turns");
    assert.ok(finished.endedAt !== null, "收尾必须写 ended_at");

    const listed = await simulationDb.listByTeacher(PROBE_TEACHER_ID, 10);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, run.id);
  } finally {
    cleanupProbeRows();
  }
});

// ---------------------------------------------------------------------------
// 3. 模拟循环的四类出口
// ---------------------------------------------------------------------------

test("跑满轮次：两轮共四条消息，token 逐轮累加", async () => {
  const run = makeRun({ maxTurns: 2 });
  const deps = memoryDeps(makeFakeCompletion());
  const outcome = await executeSimulation(run, deps);

  assert.equal(outcome.status, "completed");
  assert.equal(outcome.stopReason, "max-turns");
  assert.equal(outcome.turnsUsed, 2, "turnsUsed 计的是学生轮次");
  assert.equal(outcome.tokensInput, 40, "两轮 × 两次调用 × 10");
  assert.equal(outcome.tokensOutput, 20, "两轮 × 两次调用 × 5");
  assert.deepEqual(
    deps.turns.map((turn) => turn.speaker),
    ["student", "mentor", "student", "mentor"],
  );
  assert.deepEqual(
    deps.turns.map((turn) => turn.turnIndex),
    [1, 1, 2, 2],
  );
  assert.ok(
    deps.turns[0].screenDigest.includes("当前步骤：概念讲解"),
    "学生轮必须带上这一轮看到的屏幕快照",
  );
  assert.ok(deps.turns[1].screenDigest === "", "导师轮不带屏幕快照");
  assert.equal(deps.finished.length, 1);
});

test("学生主动放弃：立刻收尾，不再调导师", async () => {
  const run = makeRun({ maxTurns: 4 });
  const deps = memoryDeps(
    makeFakeCompletion({
      student: () =>
        JSON.stringify({
          action: "give_up",
          content: "算了，我不想学了",
          cognitiveState: "giving_up",
        }),
    }),
  );
  const outcome = await executeSimulation(run, deps);

  assert.equal(outcome.status, "completed");
  assert.equal(outcome.stopReason, "student-gave-up");
  assert.equal(outcome.turnsUsed, 1);
  assert.deepEqual(deps.turns.map((turn) => turn.speaker), ["student"]);
});

test("单轮 token 超限：明确停止并把原因写给教师", async () => {
  const run = makeRun({ maxTurns: 4 });
  const deps = memoryDeps(
    makeFakeCompletion({
      tokens: { input: SIMULATION_LIMITS.maxTurnTokens + 1, output: 0 },
    }),
  );
  const outcome = await executeSimulation(run, deps);

  assert.equal(outcome.status, "completed", "预算到线是设计内结束，不是故障");
  assert.equal(outcome.stopReason, "token-budget");
  assert.ok(outcome.error !== null && outcome.error.includes("单轮"));
  assert.equal(deps.turns.length, 1, "触发上限的那一轮仍要留存，教师才能看出花了多少");
});

test("输出不符合契约：记 failed 并保留模型原文", async () => {
  const run = makeRun();
  const deps = memoryDeps(async () => ({
    text: "我不会输出 JSON，直接说吧：这课太难了。",
    tokens: { input: 8, output: 4 },
  }));
  const outcome = await executeSimulation(run, deps);

  assert.equal(outcome.status, "failed");
  assert.ok(outcome.error !== null && outcome.error.includes("不符合契约"));
  assert.equal(deps.turns.length, 1);
  assert.equal(deps.turns[0].actionType, "unparsed");
  assert.ok(deps.turns[0].content.includes("这课太难了"));
});

test("未知人设 / 不存在的模块：快速失败且不调模型", async () => {
  let calls = 0;
  const fake: SimulationCompletion = async () => {
    calls += 1;
    return { text: "{}", tokens: { input: 0, output: 0 } };
  };

  const badPersona = await executeSimulation(
    makeRun({ persona: "no-such-persona" }),
    memoryDeps(fake),
  );
  assert.equal(badPersona.status, "failed");
  assert.ok(badPersona.error?.includes("未知人设"));

  const badModule = await executeSimulation(
    makeRun({ moduleId: "no-such-module" }),
    memoryDeps(fake),
  );
  assert.equal(badModule.status, "failed");
  assert.ok(badModule.error?.includes("模块不存在"));

  assert.equal(calls, 0, "前置校验失败时不应产生任何模型调用");
});

// ---------------------------------------------------------------------------
// 4. 输出解析
// ---------------------------------------------------------------------------

test("parseSimulatedStudentTurn：围栏 JSON 可用、越界与非法动作被拒", () => {
  const ok = parseSimulatedStudentTurn(
    '```json\n{"action":"ask","content":"这是什么意思？","cognitiveState":"confused"}\n```',
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.action, "ask");
    assert.equal(ok.data.cognitiveState, "confused");
  }

  const noJson = parseSimulatedStudentTurn("我直接说话了，没有 JSON。");
  assert.equal(noJson.ok, false);

  const badAction = parseSimulatedStudentTurn(
    JSON.stringify({ action: "click", content: "点按钮", cognitiveState: "normal" }),
  );
  assert.equal(badAction.ok, false);

  const tooLong = parseSimulatedStudentTurn(
    JSON.stringify({
      action: "ask",
      content: "啊".repeat(301),
      cognitiveState: "normal",
    }),
  );
  assert.equal(tooLong.ok, false);
});

// ---------------------------------------------------------------------------
// 5. 判权
// ---------------------------------------------------------------------------

test("requireTeacher：学生 403、教师放行，无身份 401", async () => {
  seedProbeStudents();
  try {
    const studentResponse = await requireTeacher(
      new Request("http://localhost/api/teacher/simulate", {
        headers: { "x-student-id": PROBE_STUDENT_ID },
      }),
    );
    assert.equal(studentResponse.ok, false);
    if (!studentResponse.ok) {
      assert.equal(studentResponse.response.status, 403);
    }

    const teacherResponse = await requireTeacher(
      new Request("http://localhost/api/teacher/simulate", {
        headers: { "x-student-id": PROBE_TEACHER_ID },
      }),
    );
    assert.equal(teacherResponse.ok, true);
    if (teacherResponse.ok) {
      assert.equal(teacherResponse.student.role, "teacher");
    }

    const anonymous = await requireTeacher(
      new Request("http://localhost/api/teacher/simulate"),
    );
    assert.equal(anonymous.ok, false);
    if (!anonymous.ok) {
      assert.equal(anonymous.response.status, 401);
    }
  } finally {
    cleanupProbeRows();
  }
});
