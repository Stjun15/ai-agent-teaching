/**
 * 模块内的学习步骤 —— 七步教学法
 *
 * ⚠️ 本文件在 Phase 3 被修正过一次，起因是一次**事实核查**
 * -------------------------------------------------------
 * 首版按 `00-MASTER.md`「教学流程」的 5 个阶段实现（explain / practice /
 * validate / visualize / quiz），并在文件头标注为「推断，待确认」。
 * 随后核查发现推断是错的：
 *
 * - `data-models.md:136-143` 明确定义 `type StepType = "explain" | "observe"
 *   | "imitate" | "validate" | "visualize" | "practice" | "mastery"`（**7 个**）；
 * - `Session.currentStep: StepType` 直接使用该类型，即步骤取值是**数据库契约**，
 *   不是界面自定的；
 * - `src/lib/db/sessions.ts:60` 的注释原文就写着「初始 currentStep 为 'explain'
 *   —— **七步教学法**的第一步」。项目自己的代码早已这么称呼它。
 *
 * 所以步骤的正确来源是 `StepType`，不是教学流程的 5 个阶段：
 * 教学流程描述的是「一个场景怎么教」，步骤描述的是「会话停在哪一格」，
 * 两者粒度不同 —— 5 个阶段是 7 步的一个子集。
 *
 * 七步与两份文档的对应关系（中文名是渲染选择，英文 id 是契约）
 * ----------------------------------------------------------
 * | id | 中文 | 依据 |
 * |---|---|---|
 * | `explain` | 概念讲解 | 概念页的「## 定义」与《关键点》 |
 * | `observe` | 观察示范 | 教学流程 Step 1「导师展示预设代码」 |
 * | `imitate` | 动手模仿 | 教学流程 Step 2「学生完成场景」 |
 * | `validate` | 校验点评 | 教学流程 Step 3 + 点评 Agent |
 * | `visualize` | 可视化 | 教学流程 Step 4「可视化展示 Agent Loop」 |
 * | `practice` | 变式练习 | 教学流程 Step 5「出题 Agent 给变式练习」 |
 * | `mastery` | 掌握判定 | `00-MASTER.md` 总框架「掌握学习」+ `Mastery` 表 |
 *
 * 七步也正好对应「认知学徒制（示范 → 辅导 → 退隐）」：observe/imitate 是示范，
 * validate/visualize 是辅导，practice/mastery 是退隐。
 *
 * 为什么 id 不随中文文案变
 * ----------------------
 * 步骤 id 会进 URL（`/learn/[moduleId]/[step]`）与数据库
 * （`Session.currentStep`）。文案改了不该让旧链接失效、也不该让库里的旧数据
 * 变成非法值。**改中文可以，改 id 要同时改 migration。**
 */

import type { StepType } from "@/lib/db";
import type { Expect } from "@/lib/type-assert";

export const LEARNING_STEPS = [
  {
    id: "explain",
    label: "概念讲解",
    fromFlowStep: null,
    detail: "导师 Agent 讲清这一讲的核心概念，先建立可用的心智模型",
  },
  {
    id: "observe",
    label: "观察示范",
    fromFlowStep: 1,
    detail: "看导师展示的预设代码，先看清「对的」长什么样",
  },
  {
    id: "imitate",
    label: "动手模仿",
    fromFlowStep: 2,
    detail: "自己写 Prompt、工具定义或核心逻辑，AI 不代写",
  },
  {
    id: "validate",
    label: "校验点评",
    fromFlowStep: 3,
    detail: "点评 Agent 按评分标准给出分项得分与扣分理由",
  },
  {
    id: "visualize",
    label: "可视化",
    fromFlowStep: 4,
    detail: "把刚写的代码放进可视化场景，看它逐步运转",
  },
  {
    id: "practice",
    label: "变式练习",
    fromFlowStep: 5,
    detail: "出题 Agent 换一个条件再问一次，确认真的掌握",
  },
  {
    id: "mastery",
    label: "掌握判定",
    fromFlowStep: null,
    detail: "掌握度达标才进入下一个模块 —— 这是掌握式学习的关卡",
  },
] as const satisfies readonly {
  id: StepType;
  label: string;
  fromFlowStep: number | null;
  detail: string;
}[];

/** 步骤 id 的联合类型，从数据本身推出来（不是手写的第二份列表）。 */
export type LearningStepId = (typeof LEARNING_STEPS)[number]["id"];

// ---------------------------------------------------------------------------
// 编译期钉子
//
// `satisfies` 只能保证「写出来的 id 都是合法 StepType」，管不了**漏写** ——
// 少写一步仍然编译通过，症状是界面上悄悄少了一个步骤，很难发现。
// 下面这条断言补上完整性检查。
//
// ⚠️ 不要退回 `[X extends never ? true : never][0]` 的写法
// ------------------------------------------------------
// 那个写法**是空的**：条件不成立时它只是把类型静默解析成 `never`，
// tsc 不报任何错。本文件首版就是这么写的，实测「故意删掉 mastery 一步」后
// `tsc --noEmit` 依然全绿 —— 一个永远不报警的断言等于没有断言。
//
// 有效写法必须让条件不成立时**违反一个泛型约束** —— 用 `@/lib/type-assert`
// 的 `Expect`：传入 `false` 时报 "Type 'false' does not satisfy the constraint 'true'"。
// 反向（多写）由上面的 `satisfies` 负责。两头都钉住，StepType 变更时必然报错。
// ---------------------------------------------------------------------------

/** 未被 `LEARNING_STEPS` 覆盖的步骤。非 `never` 即为漏写。 */
type _UncoveredStep = Exclude<StepType, LearningStepId>;

export type __AssertAllStepsCovered = Expect<
  _UncoveredStep extends never ? true : false
>;

/** 全部步骤 id，供路由参数校验与穷举检查使用。 */
export const LEARNING_STEP_IDS: readonly StepType[] = LEARNING_STEPS.map(
  (step) => step.id,
);

/** 步骤 id → 它在列表中的序号（从 0 开始）；未知 id 返回 -1。 */
export function stepIndex(stepId: string): number {
  return LEARNING_STEPS.findIndex((step) => step.id === stepId);
}

/**
 * 路由参数 → `StepType` 的类型守卫。
 *
 * 为什么需要它：URL 上的 `[step]` 在类型上只是 `string`，而组件与数据库要的是
 * `StepType`。用 `as StepType` 强转能把编译骗过去，但非法值会一路流到
 * `Session.currentStep` 才炸。守卫让「非法步骤」在页面入口就被拦成 404。
 */
export function isStepType(value: string): value is StepType {
  return stepIndex(value) !== -1;
}

/** 会话默认停在第一步（与 `sessionDb.create` 的初始值一致）。 */
export const FIRST_STEP_ID: StepType = LEARNING_STEPS[0].id;
