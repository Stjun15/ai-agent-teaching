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
 * ⚠️ `subAbilities` 的口径
 * ----------------------
 * 六项能力由 `src/lib/sub-abilities.ts` 按「模块 → 能力」映射聚合真实掌握度
 * （映射逐字取自 `module-specs.md` 的「训练子能力」列）。某个能力对应的模块
 * 一条掌握度记录都没有时，值是 `null`，界面必须显示「未测评」而不是 0 分。
 */

import type { PathAdjustment } from "@/lib/db";
import {
  SUB_ABILITY_KEYS,
  SUB_ABILITY_LABELS,
  type SubAbilityKey,
} from "@/lib/sub-abilities";

export type { PathAdjustment };
export { SUB_ABILITY_KEYS, SUB_ABILITY_LABELS, type SubAbilityKey };

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

/**
 * `00-MASTER.md` 第一原则的六个子能力。
 *
 * 分项建模见 `src/lib/sub-abilities.ts`：每一项由「该能力对应的教学模块」
 * 的真实掌握度聚合而来。**没有证据时值是 `null`**（界面显示「未测评」），
 * 不是 0 分 —— 两者的区别是「没测」与「测得 0 分」。
 */
export type ReportSubAbilities = Record<SubAbilityKey, number | null>;

/** 一项子能力的证据：分数 + 样本数 + 来源模块。 */
export interface ReportSubAbilityEvidence {
  key: SubAbilityKey;
  label: string;
  /** 0~5；无证据时为 `null`。 */
  score: number | null;
  /** 参与平均的掌握度记录数。 */
  samples: number;
  /** 该能力对应的模块 id（课程设计口径，见 `sub-abilities.ts`）。 */
  modules: readonly string[];
}

/**
 * 一项子能力成长曲线上的一点。
 *
 * ⚠️ 量纲与 `subAbilities` 相同（0~5）。`samples` 是「当天可见的模块数」，
 * 累积重算的口径见 `sub-abilities.ts` 的 `buildSubAbilityTimeline`。
 */
export interface ReportSubAbilityTrendPoint {
  /** `YYYY-MM-DD`。 */
  date: string;
  /** 0~5。 */
  score: number;
  /** 当天参与平均的模块数。 */
  samples: number;
}

/** 一项能力的成长曲线（点只出现在「该能力真有新证据」的日期上）。 */
export interface ReportSubAbilityTrend {
  key: SubAbilityKey;
  label: string;
  points: ReportSubAbilityTrendPoint[];
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
  /** 六项子能力的分数（0~5；无证据为 null）。 */
  subAbilities: ReportSubAbilities;
  /** 每一项子能力的证据（样本数 + 来源模块），供界面解释数字的来路。 */
  subAbilityEvidence: ReportSubAbilityEvidence[];
  /**
   * 六项子能力的成长曲线（按截至当日的累积掌握度重算）。
   *
   * 某项能力一个点都没有时是空数组 —— 界面显示「暂无时间点」，
   * 不要用 0 分补齐。
   */
  subAbilityTrends: ReportSubAbilityTrend[];
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
