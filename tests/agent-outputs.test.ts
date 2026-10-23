import { describe, expect, it } from "vitest";

import {
  ReviewerOutputSchema,
  TeacherOutputSchema,
  checkDimensionWeights,
} from "@/lib/agent/outputs";

describe("评分维度权重", () => {
  it("权重之和为 1 时通过", () => {
    expect(checkDimensionWeights([{ weight: 0.6 }, { weight: 0.4 }])).toEqual({
      ok: true,
      sum: 1,
    });
  });

  it("权重残缺时拒绝", () => {
    expect(checkDimensionWeights([{ weight: 0.6 }]).ok).toBe(false);
  });
});

describe("点评 Agent 输出校验", () => {
  const valid = {
    total_score: 82,
    level: "良好" as const,
    is_correct: true,
    dimensions: [{ name: "角色定义", score: 85, weight: 1, comment: "清晰" }],
    issues: [
      {
        type: "优化建议" as const,
        detail: "可以补充边界条件",
        deduction: -8,
        related_dimension: "角色定义",
        related_anti_pattern: null,
      },
    ],
    suggestions: [
      { priority: "中" as const, action: "补充边界", example: "..." },
    ],
    next_action: "pass" as const,
  };

  it("扣分符号被无损归一为正数", () => {
    const parsed = ReviewerOutputSchema.parse(valid);
    expect(parsed.issues[0].deduction).toBe(8);
  });

  it("维度权重之和不是 1 时拒绝", () => {
    const result = ReviewerOutputSchema.safeParse({
      ...valid,
      dimensions: [
        { name: "角色定义", score: 85, weight: 0.5, comment: "清晰" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("讲解 Agent 输出校验", () => {
  it("拒绝未注册的可视化场景 ID", () => {
    const result = TeacherOutputSchema.safeParse({
      type: "visualize",
      content: "...",
      concept_id: "agent-loop",
      visualize_scene: "scene-does-not-exist",
      next_action: "continue",
    });
    expect(result.success).toBe(false);
  });
});
