/**
 * 沙箱实验清单规格测试
 *
 * 守的是一件事：**清单里声明的请求体，必须真的过得了服务端那道 Zod 校验**。
 *
 * 为什么这件事值得单独测
 * --------------------
 * 沙箱是学生第一次「直接看见接口契约」的地方。如果清单里的字段名写错了
 * （比如 `answer` 的模块字段写成 `moduleId` 而不是 `currentModule`），
 * 学生看到的是一个 400 —— 而他会以为是**自己填错了**。这种缺陷在界面上
 * 完全看不出是代码的问题：页面照常渲染、按钮照常可点、结果区照常显示报错。
 *
 * 所以这里把每个实验的 `build()` 输出直接喂给**同一个** `schemas/api.ts`
 * 里的 schema（服务端路由用的就是它），断言 `safeParse` 成功。
 * 字段名漂移、漏字段、类型不符，任何一种都会让这条用例报红。
 *
 * `needsSession` 也不靠人记
 * ----------------------
 * 哪个端点要 `sessionId`，答案就在 schema 里：`ExplainSchema` 有
 * `sessionId` 字段，`GenerateQuestionSchema` 没有。所以这里直接比对
 * `"sessionId" in schema.shape`，而不是维护一张手写的对照表 ——
 * 服务端加一个必填会话的端点，这个断言会立刻提醒改清单。
 *
 * 运行：
 *   pnpm test:playground
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { z } from "zod";

import { LAB_EXPERIMENTS } from "@/components/playground/lab-experiments";
import { coerceValue } from "@/components/playground/lab-types";
import {
  AnswerSchema,
  ExplainSchema,
  GenerateQuestionSchema,
  ValidateSchema,
  WikiQuerySchema,
} from "@/schemas";

/** 与 `api-spec.md` 一致的固定测试身份（见 `seed-test-student`）。 */
const STUDENT_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";

/** 实验 id → 服务端用的 schema。这里的键必须与清单里的 id 一一对应。 */
const SCHEMAS: Record<string, z.ZodType> = {
  explain: ExplainSchema,
  validate: ValidateSchema,
  "generate-question": GenerateQuestionSchema,
  answer: AnswerSchema,
  "wiki-query": WikiQuerySchema,
};

/** 每个实验填一份**有代表性的合法值**（不是边界值，边界是 schema 的事）。 */
const SAMPLE_VALUES: Record<string, Record<string, string>> = {
  explain: { moduleId: "llm-api", mode: "normal" },
  validate: {
    moduleId: "llm-api",
    taskType: "prompt",
    content: "你是专家，回答我的问题。",
  },
  "generate-question": { moduleId: "llm-api", count: "3", difficulty: "2" },
  answer: { currentModule: "llm-api", question: "AI 为什么记不住？" },
  "wiki-query": { query: "上下文窗口", topK: "3" },
};

/**
 * 按字段类型转换一份样例值 —— 复用运行器真正走的那个 `coerceValue`，
 * 而不是在测试里另写一遍转换。否则测的就不是「运行器发出去的东西」了。
 */
function buildFromSample(experimentId: string): {
  values: Record<string, string | number | undefined>;
  body: unknown;
} {
  const experiment = LAB_EXPERIMENTS.find((item) => item.id === experimentId);
  assert.ok(experiment, `清单里没有实验 ${experimentId}`);

  const sample = SAMPLE_VALUES[experimentId] ?? {};
  const values: Record<string, string | number | undefined> = {};
  for (const field of experiment.fields) {
    values[field.key] = coerceValue(field, sample[field.key] ?? "");
  }

  return {
    values,
    body: experiment.build(values, {
      studentId: STUDENT_ID,
      sessionId: experiment.needsSession ? SESSION_ID : null,
    }),
  };
}

test("清单覆盖全部 5 个实验，且 id 与 schema 表一一对应", () => {
  assert.equal(LAB_EXPERIMENTS.length, 5);
  const ids = LAB_EXPERIMENTS.map((item) => item.id).sort();
  assert.deepEqual(ids, Object.keys(SCHEMAS).sort());
});

test("每个实验的 build() 输出都过得了服务端的 Zod 校验", () => {
  for (const experiment of LAB_EXPERIMENTS) {
    const schema = SCHEMAS[experiment.id];
    const { body } = buildFromSample(experiment.id);
    const parsed = schema.safeParse(body);

    // 失败时把 Zod 的原文放进断言消息：报错只说「false」等于没说，
    // 这里要能直接看出是哪个字段不合规。
    assert.ok(
      parsed.success,
      `${experiment.id} 的请求体没过 ${schema.constructor.name}：` +
        (parsed.success ? "" : JSON.stringify(parsed.error.issues)),
    );
  }
});

test("needsSession 与 schema 里是否真的要求 sessionId 保持一致", () => {
  for (const experiment of LAB_EXPERIMENTS) {
    const schema = SCHEMAS[experiment.id] as unknown as {
      shape?: Record<string, unknown>;
    };
    const shape = schema.shape ?? {};
    assert.equal(
      experiment.needsSession,
      "sessionId" in shape,
      `${experiment.id} 的 needsSession 与 schema 不符：` +
        `清单说 ${experiment.needsSession}，schema ${"sessionId" in shape ? "要求" : "不要求"} sessionId`,
    );
  }
});

test("build() 产出的键名必须都在对应 schema 的字段里", () => {
  // 这是最容易写错、又在界面上最难看出来的一类错：`answer` 的模块字段叫
  // `currentModule` 而不是 `moduleId`，写错后服务端会把它当多余键**静默剥离**，
  // 于是报错变成「currentModule 是必填」，而学生明明选了模块。
  // 断言方向是「产出的键都在 schema 里」而不是「字段键都在 schema 里」——
  // 因为 `wiki-query` 的 `topK` 是要嵌进 `options` 的，字段键与请求体键
  // 本就不必同名；`build()` 的产出才是真正发出去的东西。
  for (const experiment of LAB_EXPERIMENTS) {
    const schema = SCHEMAS[experiment.id] as unknown as {
      shape?: Record<string, unknown>;
    };
    const shape = schema.shape ?? {};
    const { body } = buildFromSample(experiment.id);

    for (const key of Object.keys(body as Record<string, unknown>)) {
      assert.ok(
        key in shape,
        `${experiment.id} 的请求体多出 schema 里没有的键 ${key}`,
      );
    }
  }
});

test("wiki-query 把 topK 嵌进 options 里（而不是放在顶层）", () => {
  const experiment = LAB_EXPERIMENTS.find((item) => item.id === "wiki-query");
  assert.ok(experiment);
  const body = experiment.build(
    { query: "上下文窗口", topK: 5 },
    { studentId: STUDENT_ID, sessionId: null },
  );

  assert.deepEqual(body, {
    query: "上下文窗口",
    options: { topK: 5 },
  });
});

test("留空的难度不发送该字段，而不是发一个 0", () => {
  // `difficulty` 的可选语义是「由服务端决定」。空输入硬转成 0 会撞上
  // `min(1)` 报 400，而学生只是没填 —— 这条守住「留空 = 不发送」。
  const experiment = LAB_EXPERIMENTS.find(
    (item) => item.id === "generate-question",
  );
  assert.ok(experiment);

  const body = experiment.build(
    { moduleId: "llm-api", count: 3, difficulty: undefined },
    { studentId: STUDENT_ID, sessionId: null },
  ) as Record<string, unknown>;

  assert.equal("difficulty" in body, false);
  assert.equal(GenerateQuestionSchema.safeParse(body).success, true);
});

test("coerceValue：空串一律 undefined，数字才转数字", () => {
  const numberField = {
    key: "count",
    label: "计数",
    kind: "number" as const,
  };
  const textField = { key: "query", label: "查询词", kind: "text" as const };

  assert.equal(coerceValue(numberField, ""), undefined);
  assert.equal(coerceValue(numberField, "   "), undefined);
  assert.equal(coerceValue(numberField, "3"), 3);
  assert.equal(coerceValue(textField, " 上下文窗口 "), "上下文窗口");
  // 非数字**原样保留字符串**：让服务端给出「期望数字、收到字符串」的原文，
  // 比在本地悄悄变成 NaN 更有说明力（NaN 序列化成 null，报错会更难懂）。
  assert.equal(coerceValue(numberField, "三"), "三");
});
