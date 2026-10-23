import { describe, expect, it } from "vitest";

import { SUB_ABILITY_KEYS, aggregateSubAbilities } from "@/lib/sub-abilities";

describe("六项子能力聚合", () => {
  it("没有掌握度记录时六项都是 null（不是 0 分）", () => {
    const result = aggregateSubAbilities([]);
    for (const key of SUB_ABILITY_KEYS) {
      expect(result[key].score).toBeNull();
      expect(result[key].samples).toBe(0);
    }
  });

  it("按模块映射取平均，并记录样本数", () => {
    const result = aggregateSubAbilities([
      { conceptId: "llm-api", score: 4 },
      { conceptId: "system-prompt", score: 3 },
      { conceptId: "mcp", score: 5 },
      { conceptId: "ai-safety", score: 2 },
      // 不在任何映射里的模块不参与
      { conceptId: "ts-basics", score: 5 },
    ]);

    // 意图表达：llm-api 4 / system-prompt 3 / mcp 5（tool-calling 未测）
    expect(result.intentExpression.score).toBe(4);
    expect(result.intentExpression.samples).toBe(3);
    // 理解 AI 行为模式：llm-api 4 / ai-safety 2（agent-loop 未测）
    expect(result.understandingAI.score).toBe(3);
    expect(result.understandingAI.samples).toBe(2);
    // 迭代调优只映射 llm-wiki，没有记录 → null
    expect(result.iterativeOptimization.score).toBeNull();
  });

  it("跳过非有限分数，避免脏数据把平均分拉成 NaN", () => {
    const result = aggregateSubAbilities([
      { conceptId: "llm-api", score: Number.NaN },
      { conceptId: "system-prompt", score: 4 },
    ]);

    expect(result.intentExpression.score).toBe(4);
    expect(result.intentExpression.samples).toBe(1);
  });
});
