/**
 * 学习路径自动调整器 —— 四条规则 + 去重
 *
 * analyzePath 是纯函数，四条规则各自可独立喂数据断言。
 * writeAdjustments 依赖 DB，不在这里测。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzePath } from "@/lib/agent/path-adjuster";
import type { AdjusterInput } from "@/lib/agent/path-adjuster";
import type { ErrorRecord, LearningPath, Mastery, PathAdjustment } from "@/lib/db/types";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400 * 1000).toISOString();
}

/**
 * 完整的 `ErrorRecord` fixture。
 *
 * 规则引擎只看 `conceptId` / `createdAt` / `problems` 三个字段，其余字段
 * 是数据库契约要求（缺一个就不算 `ErrorRecord`），取固定默认值即可。
 */
function makeError(
  conceptId: string,
  createdAt: string,
  problems: string[] = [],
): ErrorRecord {
  return {
    id: `err-${conceptId}-${createdAt}`,
    studentId: "s1",
    moduleId: conceptId,
    conceptId,
    taskType: "code",
    question: "",
    studentAnswer: "",
    problems,
    correctExample: "",
    relatedAntiPattern: null,
    isCorrected: false,
    variantQuestionsGenerated: 0,
    nextReviewAt: null,
    createdAt,
  };
}

// ---------------------------------------------------------------------------
// 规则 1：连续 3 次校验不通过
// ---------------------------------------------------------------------------

test("连续 3 次校验不通过 → 产出调整建议", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [],
    errors: [
      makeError("agent-loop", hoursAgo(1), ["理解偏差", "步骤遗漏"]),
      makeError("agent-loop", hoursAgo(5), ["代码错误"]),
      makeError("agent-loop", hoursAgo(10)),
    ],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  assert.ok(decisions.length >= 1);
  const d = decisions[0];
  assert.ok(d.reason.includes("3 次校验不通过"));
  assert.ok(d.action.includes("变式练习题"));
});

test("只有 2 次失败 → 不触发", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [],
    errors: [
      makeError("agent-loop", hoursAgo(1)),
      makeError("agent-loop", hoursAgo(5)),
    ],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const failure = decisions.find((d) => d.reason.includes("3 次"));
  assert.equal(failure, undefined);
});

test("分散在 72 小时外 → 不视为连续密集失败", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [],
    errors: [
      makeError("agent-loop", hoursAgo(1)),
      makeError("agent-loop", hoursAgo(40)),
      makeError("agent-loop", daysAgo(4)), // >72h
    ],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const failure = decisions.find((d) => d.reason.includes("3 次"));
  assert.equal(failure, undefined);
});

// ---------------------------------------------------------------------------
// 规则 2：掌握度连续下降
// ---------------------------------------------------------------------------

test("掌握度从上一模块下降 ≥2 → 产出调整", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "tool-calling",
    mastery: [
      { conceptId: "agent-loop", score: 5, errorCount: 0 },
      { conceptId: "tool-calling", score: 2, errorCount: 0 },
    ] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [
        { moduleId: "agent-loop", status: "completed" },
        { moduleId: "tool-calling", status: "in_progress" },
      ],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const decline = decisions.find((d) => d.reason.includes("掌握度"));
  assert.ok(decline, "应产出掌握度下降调整");
  assert.ok(decline.action.includes("类比"));
});

test("差值 < 2 不下调 → 不触发", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "tool-calling",
    mastery: [
      { conceptId: "agent-loop", score: 4, errorCount: 0 },
      { conceptId: "tool-calling", score: 3, errorCount: 0 },
    ] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [
        { moduleId: "agent-loop", status: "completed" },
        { moduleId: "tool-calling", status: "in_progress" },
      ],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const decline = decisions.find((d) => d.reason.includes("掌握度"));
  assert.equal(decline, undefined, "下降 <2 不触发");
});

test("上一模块未完成 → 不触发", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "tool-calling",
    mastery: [
      { conceptId: "agent-loop", score: 5, errorCount: 0 },
      { conceptId: "tool-calling", score: 2, errorCount: 0 },
    ] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [
        { moduleId: "agent-loop", status: "in_progress" },
        { moduleId: "tool-calling", status: "in_progress" },
      ],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const decline = decisions.find((d) => d.reason.includes("掌握度"));
  assert.equal(decline, undefined);
});

// ---------------------------------------------------------------------------
// 规则 3：错题积压预警
// ---------------------------------------------------------------------------

test("同一概念累计错题 ≥3 → 预警", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [{ conceptId: "agent-loop", score: 2, errorCount: 4 }] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const buildup = decisions.find((d) => d.reason.includes("累计错题"));
  assert.ok(buildup, "错题 ≥3 应预警");
  assert.ok(buildup.action.includes("复习"));
});

test("错题 < 3 → 不触发", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [{ conceptId: "agent-loop", score: 2, errorCount: 2 }] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const buildup = decisions.find((d) => d.reason.includes("累计错题"));
  assert.equal(buildup, undefined);
});

// ---------------------------------------------------------------------------
// 规则 4：掌握度 ≥4 可跳过
// ---------------------------------------------------------------------------

test("掌握度 ≥4 且未完成 → 建议跳过", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [{ conceptId: "agent-loop", score: 4, errorCount: 0 }] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [],
      nextModule: "tool-calling",
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const skip = decisions.find((d) => d.reason.includes("掌握度已达"));
  assert.ok(skip, "掌握度 ≥4 应建议跳过");
  assert.ok(skip.action.includes("tool-calling"), "应提示下一模块");
});

test("掌握度 < 4 → 不触发", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [{ conceptId: "agent-loop", score: 3, errorCount: 0 }] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const skip = decisions.find((d) => d.reason.includes("掌握度已达"));
  assert.equal(skip, undefined);
});

test("已完成的模块不触发跳过", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [{ conceptId: "agent-loop", score: 5, errorCount: 0 }] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "completed" }],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const skip = decisions.find((d) => d.reason.includes("掌握度已达"));
  assert.equal(skip, undefined, "已完成不触发");
});

// ---------------------------------------------------------------------------
// 去重
// ---------------------------------------------------------------------------

test("7 天内同 reason 不重复产出", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [
      { conceptId: "agent-loop", score: 5, errorCount: 0 },
    ] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [
        { date: hoursAgo(1), reason: "概念「agent-loop」掌握度已达 5/5（优秀档），但模块未完成", action: "skip" },
      ] as PathAdjustment[],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const skip = decisions.find((d) => d.reason.includes("掌握度已达"));
  assert.equal(skip, undefined, "7天内重复应去重");
});

test("7 天前的旧调整不阻止新产出", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [
      { conceptId: "agent-loop", score: 5, errorCount: 0 },
    ] as Mastery[],
    errors: [],
    path: {
      studentId: "s1",
      modules: [{ moduleId: "agent-loop", status: "in_progress" }],
      adjustments: [
        { date: daysAgo(10), reason: "概念「agent-loop」掌握度已达 5/5（优秀档），但模块未完成", action: "skip" },
      ] as PathAdjustment[],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  const skip = decisions.find((d) => d.reason.includes("掌握度已达"));
  assert.ok(skip, "10天前不阻止新产出");
});

// ---------------------------------------------------------------------------
// 上限：最多 2 条
// ---------------------------------------------------------------------------

test("多规则命中 → 最多 2 条", () => {
  const input: AdjusterInput = {
    studentId: "s1",
    conceptId: "agent-loop",
    mastery: [
      { conceptId: "agent-loop", score: 4, errorCount: 3 },
      { conceptId: "ts-basics", score: 5, errorCount: 0 },
    ] as Mastery[],
    errors: [
      makeError("agent-loop", hoursAgo(1), ["a"]),
      makeError("agent-loop", hoursAgo(2), ["b"]),
      makeError("agent-loop", hoursAgo(3), ["c"]),
    ],
    path: {
      studentId: "s1",
      modules: [
        { moduleId: "ts-basics", status: "completed" },
        { moduleId: "agent-loop", status: "in_progress" },
      ],
      adjustments: [],
    } as unknown as LearningPath,
  };

  const decisions = analyzePath(input);
  assert.ok(decisions.length <= 2, "最多 2 条决策");
});