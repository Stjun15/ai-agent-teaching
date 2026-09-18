/**
 * 点评 Agent 回归测试
 *
 * 用例来源：`agent-prompts/references/agent-prompts-lib.md`「六、回归测试用例」。
 *
 * 为什么用 `node:test` 而不是装 vitest/jest
 * -----------------------------------
 * Node 22 自带测试运行器与类型剥离，配合 `scripts/ts-loader.mjs` 就能直接
 * import `src/` 下的**真实 TS 源码** —— 零新增依赖。本机装测试框架既慢
 * （跨盘 pnpm）又会给「依赖清单」多加一项，而这里需要的只是「跑一段代码、
 * 断言结果、非零退出」。
 *
 * 两类用例，故意混在一起
 * ----------------
 * 1. **纯函数用例**（`isPassing`、`extractJson`）：不花钱、秒级、每次都能跑，
 *    守住的是**规则**（通过条件怎么算、JSON 怎么抠）。
 * 2. **真实模型用例**（模糊 Prompt 应扣分）：花钱、慢，守住的是**提示词效果**。
 *    提示词一改就可能退化，只有真跑才能发现 —— 这正是「回归」二字的意义。
 *
 * 真实模型用例的断言为什么这么松（`< 60`，不是 `=== 42`）
 * ---------------------------------------------
 * 模型输出不是确定值。断言「模糊 Prompt 应得低分」而不是「应得 37 分」：
 * 前者是我们要保证的**性质**，后者是把一次运行的偶然值钉成契约，
 * 下次模型微调就会红。用例要守的是性质，不是快照。
 *
 * 运行：
 *   pnpm test:agent:reviewer
 *   # 等价：node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/agent-regression-reviewer.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { extractJson, runAgent } from "@/lib/agent/runtime";
import { isPassing } from "@/lib/agent/orchestrator/validation-loop";
import type { ReviewerOutput } from "@/lib/agent/outputs";

/** 构造一份点评输出，只覆盖用例关心的字段。 */
function review(overrides: Partial<ReviewerOutput> = {}): ReviewerOutput {
  return {
    total_score: 0,
    level: "不及格",
    is_correct: false,
    dimensions: [{ name: "角色定义", score: 0, weight: 1, comment: "" }],
    issues: [],
    suggestions: [],
    next_action: "retry",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 纯函数：通过条件
// ---------------------------------------------------------------------------

test("isPassing：分数达标且无严重错误才算通过", () => {
  assert.equal(
    isPassing(
      review({
        total_score: 80,
        is_correct: true,
        dimensions: [{ name: "角色定义", score: 80, weight: 1, comment: "" }],
      }),
    ),
    true,
  );
});

test("isPassing：分数够但有严重错误 → 不通过", () => {
  assert.equal(
    isPassing(
      review({
        total_score: 90,
        is_correct: true,
        issues: [
          {
            type: "严重错误",
            detail: "缺少必填参数",
            deduction: 20,
            related_dimension: "参数",
            related_anti_pattern: null,
          },
        ],
      }),
    ),
    false,
  );
});

test("isPassing：is_correct=false 时分数再高也不通过", () => {
  assert.equal(
    isPassing(review({ total_score: 100, is_correct: false })),
    false,
  );
});

// ---------------------------------------------------------------------------
// 纯函数：从模型输出里抠 JSON
// ---------------------------------------------------------------------------

test("extractJson：能剥掉 Markdown 代码围栏", () => {
  const text = '好的，这是结果：\n```json\n{"a":1}\n```\n希望有帮助！';
  assert.equal(extractJson(text), '{"a":1}');
});

test("extractJson：能从前后寒暄里取出裸 JSON", () => {
  const text = '我的评价如下：\n{"total_score": 42}\n以上仅供参考。';
  assert.equal(extractJson(text), '{"total_score": 42}');
});

test("extractJson：完全不是 JSON 时返回 null（而不是抛错）", () => {
  assert.equal(extractJson("这个问题我无法回答。"), null);
});

// ---------------------------------------------------------------------------
// 真实模型：模糊 Prompt 必须被扣分
// ---------------------------------------------------------------------------

test("点评 Agent：对模糊 Prompt 应给出低分并指出问题", async () => {
  const result = await runAgent({
    agent: "reviewer",
    skill: "validate-prompt",
    input: {
      task_type: "prompt",
      student_answer: "你是一个助手，尽量帮忙。",
      module_id: "system-prompt",
      concept_id: "system-prompt",
      attempt_number: 1,
    },
  });

  assert.equal(result.ok, true, `运行失败：${result.error ?? "未知原因"}`);
  assert.equal(result.usedFallback, false, "不应动用兜底");

  const reviewOutput = result.data;
  assert.ok(reviewOutput, "应有结构化输出");

  // 性质 1：分数要低。「你是一个助手，尽量帮忙。」既无角色也无约束。
  assert.ok(
    reviewOutput.total_score < 60,
    `模糊 Prompt 分数应低于 60，实际 ${reviewOutput.total_score}`,
  );

  // 性质 2：必须指出问题所在，且问题要能落地到具体维度。
  assert.ok(
    reviewOutput.issues.length > 0,
    "模糊 Prompt 至少要有一条 issue，否则学生不知道改哪里",
  );
  assert.ok(
    reviewOutput.issues.every((issue) => issue.related_dimension.length > 0),
    "每条 issue 都必须关联到具体评分维度，否则扣分无法复核",
  );

  // 性质 3：必须给改进方向。只扣分不给方向等于没教。
  assert.ok(reviewOutput.suggestions.length > 0, "应至少给出一条改进建议");
});
