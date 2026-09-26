/**
 * 学习报告（`GET /api/report`）的响应形状
 *
 * 依据 `api-spec.md` 第 289-314 行，逐字对应其中的字段名与嵌套层级。
 *
 * 为什么放在 schemas 里而不是各自写一份
 * ----------------------------------
 * 这个形状有**两个消费方**：路由（生产它）与报告页（消费它）。
 * 页面手写一个接口、路由手写一个对象字面量，两者都不会因为对方改了而报错 ——
 * 漂移的表现是页面上某一项永远显示 `undefined`，界面上看不出是「字段改名了」，
 * 只看到一块空白或一个 0。
 *
 * 所以这里只留一份 `ReportResponse`，路由的返回体用它的类型标注（tsc 当场
 * 校验字面量），页面直接 import 这个类型。改字段名只有一种改法：改这里，
 * 然后两边一起编译报错。
 *
 * 为什么是 TS 类型而不是 Zod schema
 * ------------------------------
 * `api-spec.md` 这一节给的就是 TypeScript 类型（不是 Zod），而且它是**响应**
 * 而非输入 —— 本站的响应由自己的聚合代码构造，不存在「不可信的外部输入」
 * 需要运行时校验。运行时 `parse` 一遍自己刚构造的数据只会白付开销，
 * 真正需要挡住的是「两边形状不一致」，那是编译期的事。
 *
 * ⚠️ 本响应里存在**两种量纲**（详见 `ReportOverview` 各字段注释）：
 * `averageMastery` / `masteryTrend[].score` 是 0~5，`averagePromptScore`
 * 是 0~100。api-spec 只写了 `number`，没有区分 —— 消费方必须自己知道，
 * 否则「4 分（满分 5）」会被显示成「4 / 100」。
 *
 * ⚠️ `subAbilities` 目前是占位数据
 * ----------------------------
 * `mastery` 表建的是「概念 → 分数」，没有按这 6 项能力建模，所以路由暂时用
 * 「总体平均掌握度」填这 6 个字段（见 `src/app/api/report/route.ts` 文件头）。
 * 前端在六个数值完全相同时应理解为「暂无分项数据」而不是「六项能力一模一样」。
 */

import type { PathAdjustment } from "@/lib/db";
export type { PathAdjustment };

/** 报告页顶部四个总览数字。 */
export interface ReportOverview {
  /** 掌握度达标的模块数（判据是 `mastery.score >= 4`，满分 5）。 */
  completedModules: number;
  /**
   * 全部概念的平均掌握度。
   *
   * ⚠️ **量纲是 0~5，不是 0~100** —— 它的取值来自 `mastery.score`，
   * 而建表约束是 `CHECK (score >= 0 AND score <= 5)`（`001_init.sql`，
   * 与 `data-models.md` 第 275 行一致）。要显示成百分比请用
   * `masteryToPercent()`（`src/lib/mastery.ts`），不要在消费方各写一遍 ×20。
   */
  averageMastery: number;
  /** 累计答题数。 */
  totalQuestions: number;
  /**
   * Prompt 历史里的平均得分。
   *
   * ⚠️ **量纲是 0~100** —— 来自点评 Agent 的 `total_score`
   * （`ReviewerOutputSchema` 的 `min(0).max(100)`），
 * 与上面 `averageMastery` **不是同一个量纲**，两者不能直接比较。
 */
  averagePromptScore: number;
}

/** `00-MASTER.md` 第一原则的六个子能力（当前为占位，见文件头）。 */
export interface ReportSubAbilities {
  intentExpression: number;
  taskDecomposition: number;
  contextManagement: number;
  qualityJudgment: number;
  iterativeOptimization: number;
  understandingAI: number;
}

/** 掌握度趋势上的一点：某天的平均分。 */
export interface ReportTrendPoint {
  /** `YYYY-MM-DD`（由 `updatedAt` 截取）。 */
  date: string;
  /** 0~5（同 `averageMastery`，来自 `mastery.score`）。 */
  score: number;
}

/** 一个薄弱点：概念 + 问题描述。 */
export interface ReportWeakness {
  /** 概念 id（与模块 id 同值）。 */
  concept: string;
  issue: string;
}

/**
 * 一个**真实存在**的评分维度的汇总。
 *
 * 与 `ReportSubAbilities` 是两回事：那六项是 api-spec 写死的固定能力，
 * 本项目没有按它建模；这里的维度是点评 Agent 每次实际打出来的
 * （`prompt_history.dimensions`），名字不固定、有多少显示多少。
 * 聚合规则见 `src/lib/report-dimensions.ts`。
 */
export interface ReportPromptDimension {
  /** 维度名，直接用模型给的原名。 */
  name: string;
  /** 平均分，量纲 **0~100**（与 `averagePromptScore` 同一量纲）。 */
  averageScore: number;
  /** 样本数：有多少次点评包含该维度。样本数为 0 的行不会出现。 */
  samples: number;
}

export interface ReportResponse {
  overview: ReportOverview;
  subAbilities: ReportSubAbilities;
  /** 真实评分维度的汇总；一次点评都没有时是空数组。 */
  promptDimensions: ReportPromptDimension[];
  masteryTrend: ReportTrendPoint[];
  weaknesses: ReportWeakness[];
  recommendations: string[];
  /**
   * 系统自动产出的路径调整记录（来自 path-adjuster）。
   *
   * 每次答题评分后，path-adjuster 按四条阈值判定并写入
   * `learning_paths.adjustments`；报告页从中取最近 3 条展示。
   * 无调整时为空数组。
   */
  adjustments: PathAdjustment[];
}

/** 六个子能力字段名 → 中文标签。报告页按此顺序渲染，顺序取自 `00-MASTER.md`。 */
export const SUB_ABILITY_LABELS: Record<keyof ReportSubAbilities, string> = {
  intentExpression: "意图表达",
  taskDecomposition: "任务分解",
  contextManagement: "上下文管理",
  qualityJudgment: "质量判断",
  iterativeOptimization: "迭代调优",
  understandingAI: "理解 AI 行为模式",
};

/** 六个子能力的字段名，顺序与 `SUB_ABILITY_LABELS` 一致，便于遍历渲染。 */
export const SUB_ABILITY_KEYS = Object.keys(
  SUB_ABILITY_LABELS,
) as (keyof ReportSubAbilities)[];