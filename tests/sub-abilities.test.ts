import { describe, expect, it } from "vitest";

import {
  SUB_ABILITY_KEYS,
  aggregateSubAbilities,
  buildSubAbilityTimeline,
  trendDelta,
} from "@/lib/sub-abilities";

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

describe("六项子能力成长曲线", () => {
  it("没有记录时六项都是空数组（不是 0 分的平线）", () => {
    const timeline = buildSubAbilityTimeline([]);
    for (const key of SUB_ABILITY_KEYS) {
      expect(timeline[key]).toEqual([]);
    }
  });

  it("单条记录产出一个点，分数与样本数取自该记录", () => {
    const timeline = buildSubAbilityTimeline([
      {
        conceptId: "llm-api",
        score: 4,
        updatedAt: "2026-10-01T08:00:00.000Z",
      },
    ]);

    expect(timeline.intentExpression).toEqual([
      { date: "2026-10-01", score: 4, samples: 1 },
    ]);
  });

  it("累积重算：旧分保留、新分覆盖、同能力多模块取均值", () => {
    const timeline = buildSubAbilityTimeline([
      { conceptId: "llm-api", score: 2, updatedAt: "2026-10-01T00:00:00Z" },
      {
        conceptId: "system-prompt",
        score: 4,
        updatedAt: "2026-10-02T00:00:00Z",
      },
      { conceptId: "llm-api", score: 5, updatedAt: "2026-10-03T00:00:00Z" },
    ]);

    // 意图表达 = llm-api + system-prompt：10-01 只有前者；10-02 两者均值 3；
    // 10-03 llm-api 被新记录覆盖为 5，均值 (5+4)/2 = 4.5。
    expect(timeline.intentExpression).toEqual([
      { date: "2026-10-01", score: 2, samples: 1 },
      { date: "2026-10-02", score: 3, samples: 2 },
      { date: "2026-10-03", score: 4.5, samples: 2 },
    ]);

    // 上下文管理只映射 system-prompt，所以它的第一个点在 10-02 —— 且
    // 后续没有新记录时不会补平点。
    expect(timeline.contextManagement).toEqual([
      { date: "2026-10-02", score: 4, samples: 1 },
    ]);
    // 迭代调优只映射 llm-wiki，本次没有任何记录 → 空
    expect(timeline.iterativeOptimization).toEqual([]);
  });

  it("缺失/非法日期与非有限分数被跳过，映射外模块不产点", () => {
    const timeline = buildSubAbilityTimeline([
      { conceptId: "llm-api", score: 4, updatedAt: "" },
      { conceptId: "llm-api", score: Number.NaN, updatedAt: "2026-10-01" },
      { conceptId: "llm-api", score: 3, updatedAt: "not-a-date" },
      // ts-basics 不在六项能力映射里，哪怕有分也不该出现在任何曲线上
      { conceptId: "ts-basics", score: 5, updatedAt: "2026-10-02" },
    ]);

    for (const key of SUB_ABILITY_KEYS) {
      expect(timeline[key]).toEqual([]);
    }
  });

  it("trendDelta：不足两点返回 null，多点返回首尾差", () => {
    expect(trendDelta([])).toBeNull();
    expect(trendDelta([{ date: "2026-10-01", score: 3, samples: 1 }])).toBeNull();
    expect(
      trendDelta([
        { date: "2026-10-01", score: 2, samples: 1 },
        { date: "2026-10-03", score: 4.5, samples: 2 },
      ]),
    ).toBe(2.5);
    expect(
      trendDelta([
        { date: "2026-10-01", score: 4, samples: 1 },
        { date: "2026-10-03", score: 3, samples: 1 },
      ]),
    ).toBe(-1);
  });
});
