import { describe, expect, it } from "vitest";

import { analyzePath, type AdjusterInput } from "@/lib/agent/path-adjuster";
import type {
  ErrorRecord,
  LearningPath,
  LearningPathModule,
  Mastery,
  PathAdjustment,
} from "@/lib/db/types";

const NOW = Date.now();

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 60 * 60 * 1000).toISOString();
}

function masteryOf(
  conceptId: string,
  score: number,
  errorCount = 0,
): Mastery {
  return {
    studentId: "s1",
    conceptId,
    score,
    lastReviewedAt: null,
    errorCount,
    status: "in_progress",
    updatedAt: hoursAgo(1),
  };
}

function errorOf(conceptId: string, hours: number, problems: string[]): ErrorRecord {
  return {
    id: `err-${conceptId}-${hours}`,
    studentId: "s1",
    moduleId: conceptId,
    conceptId,
    taskType: "code",
    question: "题面",
    studentAnswer: "作答",
    problems,
    correctExample: "",
    relatedAntiPattern: null,
    isCorrected: false,
    variantQuestionsGenerated: 0,
    nextReviewAt: null,
    createdAt: hoursAgo(hours),
  };
}

function pathModule(
  order: number,
  moduleId: string,
  status: LearningPathModule["status"],
): LearningPathModule {
  return {
    order,
    moduleId,
    status,
    startedAt: null,
    completedAt: null,
    mastery: 0,
  };
}

function pathOf(
  modules: LearningPathModule[],
  adjustments: PathAdjustment[] = [],
): LearningPath {
  return {
    studentId: "s1",
    currentModule: modules[0]?.moduleId ?? "llm-api",
    nextModule: null,
    modules,
    adjustments,
    updatedAt: hoursAgo(1),
  };
}

function inputOf(overrides: Partial<AdjusterInput>): AdjusterInput {
  return {
    studentId: "s1",
    conceptId: "ai-safety",
    mastery: [],
    errors: [],
    path: pathOf([pathModule(0, "ai-safety", "in_progress")]),
    ...overrides,
  };
}

describe("学习路径调整器：四条规则", () => {
  it("没有任何触发条件时返回空数组", () => {
    expect(analyzePath(inputOf({ mastery: [masteryOf("ai-safety", 3)] }))).toEqual(
      [],
    );
  });

  it("规则 1：同概念 72 小时内 3 条错题 → 建议插入变式题，并摘录问题", () => {
    const errors = [
      errorOf("ai-safety", 2, ["没说明白为什么"]),
      errorOf("ai-safety", 10, ["漏掉了边界"]),
      errorOf("ai-safety", 30, ["结论下得太早"]),
    ];
    const decisions = analyzePath(inputOf({ errors }));

    expect(decisions).toHaveLength(1);
    expect(decisions[0].reason).toContain("连续 3 次校验不通过");
    expect(decisions[0].action).toContain("变式练习");
    expect(decisions[0].action).toContain("没说明白为什么");
  });

  it("规则 1 不触发：第 3 条错题已超过 72 小时", () => {
    const errors = [
      errorOf("ai-safety", 1, ["a"]),
      errorOf("ai-safety", 2, ["b"]),
      errorOf("ai-safety", 80, ["c"]),
    ];
    expect(analyzePath(inputOf({ errors }))).toEqual([]);
  });

  it("规则 2：累计错题达到 3 次时预警，2 次不预警", () => {
    const hit = analyzePath(
      inputOf({ mastery: [masteryOf("ai-safety", 2, 3)] }),
    );
    expect(hit[0].reason).toContain("已达预警线");

    const miss = analyzePath(
      inputOf({ mastery: [masteryOf("ai-safety", 2, 2)] }),
    );
    expect(miss).toEqual([]);
  });

  it("规则 3：前一模块已完成且掌握度差 ≥ 2 才算下滑", () => {
    const path = pathOf([
      pathModule(0, "llm-api", "completed"),
      pathModule(1, "ai-safety", "in_progress"),
    ]);
    const mastery = [masteryOf("llm-api", 5), masteryOf("ai-safety", 2)];

    const hit = analyzePath(
      inputOf({ conceptId: "ai-safety", path, mastery }),
    );
    expect(hit[0].reason).toContain("掌握度从");

    // 差值只有 1 → 不算实质性下滑
    const shallow = analyzePath(
      inputOf({
        conceptId: "ai-safety",
        path,
        mastery: [masteryOf("llm-api", 3), masteryOf("ai-safety", 2)],
      }),
    );
    expect(shallow).toEqual([]);
  });

  it("规则 3 不触发：前一模块尚未完成", () => {
    const path = pathOf([
      pathModule(0, "llm-api", "in_progress"),
      pathModule(1, "ai-safety", "in_progress"),
    ]);
    const mastery = [masteryOf("llm-api", 5), masteryOf("ai-safety", 1)];
    expect(analyzePath(inputOf({ path, mastery }))).toEqual([]);
  });

  it("规则 4：掌握度 4 分但模块未完成 → 提示可跳过；已完成则不提示", () => {
    const path = pathOf([pathModule(0, "ai-safety", "in_progress")]);
    const hit = analyzePath(
      inputOf({ path, mastery: [masteryOf("ai-safety", 4)] }),
    );
    expect(hit[0].action).toContain("可以跳过");

    const completed = pathOf([pathModule(0, "ai-safety", "completed")]);
    const miss = analyzePath(
      inputOf({ path: completed, mastery: [masteryOf("ai-safety", 5)] }),
    );
    expect(miss).toEqual([]);
  });

  it("同 reason 在 7 天去重窗口内不重复产出", () => {
    const errors = [
      errorOf("ai-safety", 2, ["x"]),
      errorOf("ai-safety", 10, ["y"]),
      errorOf("ai-safety", 30, ["z"]),
    ];
    const first = analyzePath(inputOf({ errors }));
    const path = pathOf([pathModule(0, "ai-safety", "in_progress")], [
      { date: hoursAgo(1), reason: first[0].reason, action: first[0].action },
    ]);

    expect(analyzePath(inputOf({ errors, path }))).toEqual([]);
  });

  it("最多只返回 2 条，且按紧迫度排序", () => {
    const decisions = analyzePath(
      inputOf({
        mastery: [masteryOf("ai-safety", 5, 3)],
        path: pathOf([pathModule(0, "ai-safety", "in_progress")]),
      }),
    );
    expect(decisions).toHaveLength(2);
    expect(decisions[0].reason).toContain("已达预警线");
    expect(decisions[1].action).toContain("可以跳过");
  });
});
