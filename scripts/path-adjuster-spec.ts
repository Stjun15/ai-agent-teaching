/**
 * 路径自动调整器规格测试
 *
 * 背景（2026-09-26）：`path-adjuster.ts` 是 Ploy「闭环」策略的教学场景实现。
 * 它在每次答题评分后读取 mastery/errors/path 快照，按四条阈值判定是否写入
 * 路径调整记录。此前 `analyzePath` 没有任何测试——四条规则全在脑测阶段。
 *
 * 钉什么：
 * 1. **四条阈值各自命中**——给相应形状的输入必须产出对应 reason 的决策。
 * 2. **正常态不误报**——没有问题的快照必须返回空数组。
 * 3. **去重**——7 天内同 reason 已存在的调整不重复产出。
 * 4. **上限**——最多返回 2 条决策，不刷屏。
 * 5. **UI 组件存在且接对数据源**（文本守卫，不跑 DOM）。
 *
 * 运行：
 *   pnpm test:path-adjuster
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, describe } from "node:test";

import { analyzePath, type AdjusterInput } from "../src/lib/agent/path-adjuster";
import type {
  ErrorRecord,
  LearningPath,
  LearningPathModule,
  Mastery,
} from "../src/lib/db/types";

// ---------------------------------------------------------------------------
// 工厂函数 —— 构造符合类型形状的测试数据
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();
const STUDENT_ID = "s001";

function m(overrides?: Partial<Mastery>): Mastery {
  return {
    studentId: STUDENT_ID,
    conceptId: "tool-calling",
    score: 2,
    lastReviewedAt: null,
    errorCount: 0,
    status: "in_progress",
    updatedAt: NOW,
    ...overrides,
  };
}

function otherMastery(conceptId: string, score: number, status: Mastery["status"] = "completed"): Mastery {
  return m({ conceptId, score, status });
}

function e(overrides?: Partial<ErrorRecord>): ErrorRecord {
  return {
    id: `err-${Math.random().toString(36).slice(2, 8)}`,
    studentId: STUDENT_ID,
    moduleId: "tool-calling",
    conceptId: "tool-calling",
    taskType: "question",
    question: "请说明 tool calling 的执行流程",
    studentAnswer: "不知道",
    problems: ["流程完全错误"],
    correctExample: "先定义 function，再…",
    relatedAntiPattern: null,
    isCorrected: false,
    variantQuestionsGenerated: 0,
    nextReviewAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1h 前
    ...overrides,
  };
}

function p(overrides?: Partial<LearningPath>): LearningPath {
  return {
    studentId: STUDENT_ID,
    currentModule: "tool-calling",
    nextModule: "rag",
    modules: [
      lpModule("system-prompt", 1, "completed", 4),
      lpModule("tool-calling", 2, "in_progress", 2),
    ],
    adjustments: [],
    updatedAt: NOW,
    ...overrides,
    modules: overrides?.modules ?? [
      lpModule("system-prompt", 1, "completed", 4),
      lpModule("tool-calling", 2, "in_progress", 2),
    ],
  };
}

function lpModule(
  moduleId: string,
  order: number,
  status: LearningPathModule["status"],
  mastery: number,
): LearningPathModule {
  return {
    order,
    moduleId,
    status,
    startedAt: null,
    completedAt: status === "completed" ? "2026-09-20T00:00:00.000Z" : null,
    mastery,
  };
}

function input(overrides?: Partial<AdjusterInput>): AdjusterInput {
  return {
    studentId: STUDENT_ID,
    conceptId: "tool-calling",
    mastery: [otherMastery("system-prompt", 4), m()],
    errors: [],
    path: p(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 规则 1：连续失败
// ---------------------------------------------------------------------------

describe("规则 1：同一概念连续 3 次校验不通过", () => {
  test("3 条同概念错题 ∈ 72h → 命中", () => {
    const result = analyzePath(
      input({
        errors: [
          e({ conceptId: "tool-calling", createdAt: ago(48) }),
          e({ conceptId: "tool-calling", createdAt: ago(24) }),
          e({ conceptId: "tool-calling", createdAt: ago(2) }),
        ],
      }),
    );

    const hit = result.find((d) => d.reason.includes("连续 3 次校验不通过"));
    assert.ok(hit, "应该产出「连续失败」调整");
    assert.match(hit.action, /变式/);
    assert.match(hit.action, /回放/);
  });

  test("只有 2 条 → 不命中", () => {
    const result = analyzePath(
      input({
        errors: [
          e({ conceptId: "tool-calling", createdAt: ago(24) }),
          e({ conceptId: "tool-calling", createdAt: ago(2) }),
        ],
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("连续 3 次")).length,
      0,
    );
  });

  test("3 条但最早一条距今 > 72h → 不命中（间隔太久不是连续失败）", () => {
    const result = analyzePath(
      input({
        errors: [
          e({ conceptId: "tool-calling", createdAt: ago(80) }),
          e({ conceptId: "tool-calling", createdAt: ago(24) }),
          e({ conceptId: "tool-calling", createdAt: ago(2) }),
        ],
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("连续 3 次")).length,
      0,
      "间隔超过 72h 不应判定为连续失败",
    );
  });

  test("3 条错题但分属不同概念 → 不命中", () => {
    const result = analyzePath(
      input({
        errors: [
          e({ conceptId: "system-prompt", createdAt: ago(24) }),
          e({ conceptId: "rag", createdAt: ago(12) }),
          e({ conceptId: "tool-calling", createdAt: ago(2) }),
        ],
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("连续 3 次")).length,
      0,
      "不同概念的错题不应算作同一概念的连续失败",
    );
  });
});

// ---------------------------------------------------------------------------
// 规则 2：掌握度下降
// ---------------------------------------------------------------------------

describe("规则 2：掌握度连续下降", () => {
  test("当前模块 < 上一已完成模块 → 命中", () => {
    const result = analyzePath(
      input({
        mastery: [
          otherMastery("system-prompt", 4),
          m({ conceptId: "tool-calling", score: 1 }),
        ],
      }),
    );
    const hit = result.find((d) => d.reason.includes("下降"));
    assert.ok(hit, "掌握度 4→1 应命中下降规则");
    assert.match(hit.reason, /system-prompt/);
    assert.match(hit.reason, /tool-calling/);
    assert.match(hit.action, /类比|动画/);
  });

  test("当前 ≥ 上一 → 不命中", () => {
    const result = analyzePath(
      input({
        mastery: [
          otherMastery("system-prompt", 2),
          m({ conceptId: "tool-calling", score: 4 }),
        ],
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("下降")).length,
      0,
    );
  });

  test("前一个模块未完成 → 不命中（无比较基线）", () => {
    const result = analyzePath(
      input({
        mastery: [
          otherMastery("system-prompt", 4, "in_progress"),
          m({ conceptId: "tool-calling", score: 1 }),
        ],
        path: p({
          modules: [
            lpModule("system-prompt", 1, "in_progress", 4),
            lpModule("tool-calling", 2, "in_progress", 1),
          ],
        }),
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("下降")).length,
      0,
      "上一个模块 status 不是 completed 不应比较",
    );
  });
});

// ---------------------------------------------------------------------------
// 规则 3：错题积压
// ---------------------------------------------------------------------------

describe("规则 3：错题积压预警（errorCount ≥ 3）", () => {
  test("errorCount = 3 → 命中", () => {
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ errorCount: 3 })],
      }),
    );
    const hit = result.find((d) => d.reason.includes("错题"));
    assert.ok(hit, "errorCount=3 应命中积压规则");
    assert.match(hit.action, /复习/);
  });

  test("errorCount = 5 → 命中（大于阈值的也应该命中）", () => {
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ errorCount: 5 })],
      }),
    );
    const hit = result.find((d) => d.reason.includes("错题"));
    assert.ok(hit, "errorCount=5 应命中");
  });

  test("errorCount = 2 → 不命中", () => {
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ errorCount: 2 })],
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("错题")).length,
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// 规则 4：可跳过
// ---------------------------------------------------------------------------

describe("规则 4：掌握度达标但模块未完成", () => {
  test("score=4 + module=in_progress → 命中", () => {
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ score: 4 })],
        path: p({
          modules: [
            lpModule("system-prompt", 1, "completed", 4),
            lpModule("tool-calling", 2, "in_progress", 4),
          ],
        }),
      }),
    );
    const hit = result.find((d) => d.reason.includes("掌握度已达"));
    assert.ok(hit, "score=4 且模块未完成应命中");
    assert.match(hit.action, /跳过/);
  });

  test("score=4 + module=completed → 不命中", () => {
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ score: 4 })],
        path: p({
          modules: [
            lpModule("system-prompt", 1, "completed", 4),
            lpModule("tool-calling", 2, "completed", 4),
          ],
        }),
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("掌握度已达")).length,
      0,
      "已完成的模块不应再提示跳过",
    );
  });

  test("score=2 + module=in_progress → 不命中", () => {
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ score: 2 })],
      }),
    );
    assert.equal(
      result.filter((d) => d.reason.includes("掌握度已达")).length,
      0,
      "score < 4 不应触发可跳过",
    );
  });
});

// ---------------------------------------------------------------------------
// 边界与集成
// ---------------------------------------------------------------------------

describe("边界与集成", () => {
  test("无任何异常的干净快照 → 返回空数组", () => {
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ score: 3, errorCount: 0 })],
        errors: [],
      }),
    );
    assert.equal(result.length, 0, "干净快照应为空");
  });

  test("最多返回 2 条调整", () => {
    // 构造一个同时命中四条规则的快照
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 5), m({ score: 4, errorCount: 5 })],
        errors: [
          e({ conceptId: "tool-calling", createdAt: ago(24) }),
          e({ conceptId: "tool-calling", createdAt: ago(12) }),
          e({ conceptId: "tool-calling", createdAt: ago(2) }),
        ],
        path: p({
          modules: [
            lpModule("system-prompt", 1, "completed", 5),
            lpModule("tool-calling", 2, "in_progress", 4),
          ],
        }),
      }),
    );

    assert.ok(result.length <= 2, `期望 ≤2 条，实际 ${result.length}`);
  });

  test("去重：已存在同 reason 的 7 天内调整 → 跳过", () => {
    const existingReason = "概念「tool-calling」累计错题 5 次，已达预警线";
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ errorCount: 5 })],
        path: p({
          adjustments: [
            {
              date: ago(24), // 1 天前写过同一条
              reason: existingReason,
              action: "建议复习",
            },
          ],
        }),
      }),
    );

    const duplicates = result.filter((d) => d.reason === existingReason);
    assert.equal(duplicates.length, 0, "7 天内同 reason 不应重复产出");
  });

  test("去重：超过 7 天的同 reason → 允许重新产出", () => {
    const reason = "概念「tool-calling」累计错题 3 次，已达预警线";
    const result = analyzePath(
      input({
        mastery: [otherMastery("system-prompt", 4), m({ errorCount: 3 })],
        path: p({
          adjustments: [
            {
              date: ago(200), // 8 天前
              reason,
              action: "旧建议",
            },
          ],
        }),
      }),
    );

    const hits = result.filter((d) => d.reason === reason);
    assert.equal(hits.length, 1, "超过 7 天应允许重新产出");
  });

  test("空 mastery 数组 → 不抛异常，返回空数组", () => {
    const result = analyzePath(
      input({ mastery: [], errors: [], path: p() }),
    );
    assert.equal(result.length, 0);
  });

  test("空 errors 数组 → 不抛异常", () => {
    const result = analyzePath(
      input({ errors: [] }),
    );
    assert.ok(Array.isArray(result));
  });
});

// ---------------------------------------------------------------------------
// UI 文本守卫（不跑 DOM）
// ---------------------------------------------------------------------------

describe("PathAdjustmentList UI 组件守卫", () => {
  function readComponent(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
  }

  test("组件文件存在且是客户端组件", () => {
    const source = readComponent("../src/components/learn/path-adjustment-list.tsx");
    assert.match(source, /"use client"/, "必须是客户端组件（订阅 Zustand store）");
  });

  test("从 StudentStore 读取 adjustments", () => {
    const source = readComponent("../src/components/learn/path-adjustment-list.tsx");
    assert.match(
      source,
      /useStudentStore/,
      "必须从 StudentStore 订阅数据",
    );
    assert.match(
      source,
      /learningPath\??\.adjustments/,
      "必须读取 learningPath.adjustments",
    );
  });

  test("无调整时不渲染任何内容", () => {
    const source = readComponent("../src/components/learn/path-adjustment-list.tsx");
    assert.match(
      source,
      /adjustments\.length === 0/,
      "空数组时应该 return null 避免渲染空标题",
    );
  });

  test("module-workspace 引用 PathAdjustmentList", () => {
    const ws = readComponent("../src/components/learn/module-workspace.tsx");
    assert.match(
      ws,
      /PathAdjustmentList/,
      "module-workspace 必须导入并渲染路径调整列表",
    );
  });

  test("四种调整类型都有对应图标", () => {
    const source = readComponent("../src/components/learn/path-adjustment-list.tsx");
    assert.match(source, /AlertTriangle/, "连续校验应有警报图标");
    assert.match(source, /Lightbulb/, "错题积压应有灯泡图标");
    assert.match(source, /RotateCcw/, "掌握度下降应有重试图标");
    assert.match(source, /ArrowRight/, "可跳过应有前进图标");
  });

  test("最多展示最近 3 条", () => {
    const source = readComponent("../src/components/learn/path-adjustment-list.tsx");
    assert.match(
      source,
      /slice\(0,\s*3\)/,
      "应只展示最近 3 条",
    );
  });
});

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 构造相对当前时间的 ISO 时间戳。
 * @param hoursAgo 几小时前（正数 = 过去）
 */
function ago(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}