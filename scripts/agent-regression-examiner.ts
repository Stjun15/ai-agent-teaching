/**
 * 出题 Agent 回归测试
 *
 * 和 teacher / reviewer 一样，真模型用例在这里混编：
 * 前几条纯函数守 schema 形状，最后一条真跑模型守提示词效果。
 *
 * 运行：
 *   pnpm test:agent:examiner
 */

import assert from "node:assert/strict";
import test from "node:test";

import { runAgent } from "@/lib/agent/runtime";
import { ExaminerOutputSchema, type ExaminerOutput } from "@/lib/agent/outputs";

// ---------------------------------------------------------------------------
// 纯函数：Schema 形状
// ---------------------------------------------------------------------------

test("ExaminerOutputSchema：合法输出通过校验", () => {
  const output: ExaminerOutput = {
    questions: [
      {
        id: "q-llm-api-001",
        type: "选择题",
        concept_id: "llm-api",
        difficulty: 2,
        scenario:
          "小明想用 API 调用大模型，但他不知道 temperature 参数的作用。",
        question: "以下关于 temperature 参数的说法，哪个是正确的？",
        options: ["A. 越高越好", "B. 控制随机性", "C. 越低越好", "D. 没用"],
        correct_answer: "B",
        explanation: "temperature 控制输出随机性，0=确定，1=随机。",
        hint_levels: ["思考 temperature 的含义", ""],
        related_anti_pattern: null,
      },
    ],
    total_count: 1,
    estimated_time: "3min",
  };
  const result = ExaminerOutputSchema.safeParse(output);
  assert.equal(result.success, true);
});

test("ExaminerOutputSchema：难度超出 1-5 被拒", () => {
  const output = {
    questions: [
      {
        id: "q-1",
        type: "选择题",
        concept_id: "x",
        difficulty: 6,
        scenario: "x",
        question: "x",
        correct_answer: "A",
        explanation: "x",
        hint_levels: [],
        related_anti_pattern: null,
      },
    ],
    total_count: 1,
    estimated_time: "1min",
  };
  const result = ExaminerOutputSchema.safeParse(output);
  assert.equal(result.success, false);
});

test("ExaminerOutputSchema：questions 为空数组被拒", () => {
  const result = ExaminerOutputSchema.safeParse({
    questions: [],
    total_count: 0,
    estimated_time: "0min",
  });
  assert.equal(result.success, false);
});

test("ExaminerOutputSchema：非法题型被拒", () => {
  const result = ExaminerOutputSchema.safeParse({
    questions: [
      {
        id: "q-1",
        type: "论述题",
        concept_id: "x",
        difficulty: 3,
        scenario: "x",
        question: "x",
        correct_answer: "x",
        explanation: "x",
        hint_levels: [],
        related_anti_pattern: null,
      },
    ],
    total_count: 1,
    estimated_time: "1min",
  });
  assert.equal(result.success, false);
});

test("ExaminerOutputSchema：选择题无 options 可通过（optional 字段）", () => {
  const output = {
    questions: [
      {
        id: "q-1",
        type: "选择题",
        concept_id: "x",
        difficulty: 1,
        scenario: "x",
        question: "x",
        correct_answer: "A",
        explanation: "x",
        hint_levels: [],
        related_anti_pattern: null,
      },
    ],
    total_count: 1,
    estimated_time: "1min",
  };
  const result = ExaminerOutputSchema.safeParse(output);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// 真模型：提示词效果
// ---------------------------------------------------------------------------

test(
  "出题 Agent：真实模型调用产出合法 JSON 且包含至少一道题",
  { timeout: 120_000 },
  async () => {
    const result = await runAgent({
      agent: "examiner",
      skill: "generate-question",
      input: {
        module_id: "llm-api",
        concept_id: "llm-api",
        mastery: 1,
        quiz_bank: [],
      },
    });

    assert.equal(result.ok, true, `运行失败：${result.error ?? "未知原因"}`);
    assert.equal(result.usedFallback, false, "不应动用兜底");

    const output = result.data;
    assert.ok(output, "应有结构化输出");

    const validated = ExaminerOutputSchema.safeParse(output);
    assert.equal(
      validated.success,
      true,
      validated.error ? `Schema 校验失败：${validated.error.message}` : "",
    );

    // 性质断言而非快照
    assert.ok(output.questions.length >= 1, "至少应产出一道题");
    for (const q of output.questions) {
      assert.ok(q.difficulty >= 1 && q.difficulty <= 5, "难度应在 1-5 之间");
      assert.ok(q.scenario.length > 0, "场景描述不应为空");
      assert.ok(q.question.length > 0, "题目内容不应为空");
      assert.ok(q.correct_answer.length > 0, "正确答案不应为空");
      assert.ok(q.explanation.length > 0, "解析不应为空");
    }
  },
);
