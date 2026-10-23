/**
 * 六项子能力的分项建模 —— 唯一映射表与聚合函数
 *
 * 为什么是「课程设计口径」而不是「模型打分」
 * ----------------------------------------
 * `00-MASTER.md` 第一原则定义了六项可迁移能力，`module-specs.md` 给每个教学
 * 模块标注了它训练哪两项能力（原文表格）。本文件把那张表落成代码，再用学生
 * 在对应模块上的**真实掌握度**聚合 —— 不做模型二次打分，也不把「角色定义」
 * 这类点评维度名猜测成某一项能力（那种映射是编数据）。
 *
 * 数据来源只有一张表：`mastery`（概念 id 与模块 id 同值，分数 0~5）。
 * 因此：
 *   - 某个能力对应的模块**一条掌握度记录都没有**时，分数为 `null`，
 *     界面显示「未测评」而不是 0 分（0 分是一个测量结论，null 是没测）；
 *   - 分数是映射模块掌握度的算术平均，`samples` 是参与平均的记录数，
 *     界面必须把它显示出来，读者才知道这个数字由几条证据支撑。
 *
 * 为什么是叶子模块
 * --------------
 * 纯函数、零 import，能脱离 Next 与数据库直接单测（`tests/sub-abilities.test.ts`）。
 *
 * 未纳入映射的模块
 * --------------
 * `ts-basics` / `vibe-coding` / `platform-replica` 不在 `module-specs.md`
 * 的「训练子能力」表里（它们是工具链前置与综合实践），这里**不替它们编归属**。
 * 将来若课程设计补上归属，只改本文件一处。
 */

/** 六项能力的字段名，顺序取自 `00-MASTER.md`。 */
export const SUB_ABILITY_KEYS = [
  "intentExpression",
  "taskDecomposition",
  "contextManagement",
  "qualityJudgment",
  "iterativeOptimization",
  "understandingAI",
] as const;

export type SubAbilityKey = (typeof SUB_ABILITY_KEYS)[number];

/** 字段名 → 中文标签。 */
export const SUB_ABILITY_LABELS: Record<SubAbilityKey, string> = {
  intentExpression: "意图表达",
  taskDecomposition: "任务分解",
  contextManagement: "上下文管理",
  qualityJudgment: "质量判断",
  iterativeOptimization: "迭代调优",
  understandingAI: "理解 AI 行为模式",
};

/**
 * 能力 → 训练它的模块（逐字取自 `module-specs.md` / `01-teaching-system.md`
 * 的「训练子能力」列）。同一个模块可以同时训练两项能力。
 */
export const SUB_ABILITY_MODULES: Record<SubAbilityKey, readonly string[]> = {
  intentExpression: ["llm-api", "system-prompt", "tool-calling", "mcp"],
  taskDecomposition: ["agent-loop", "multi-agent"],
  contextManagement: ["system-prompt", "rag", "llm-wiki", "multi-agent"],
  qualityJudgment: ["tool-calling", "rag", "mcp", "ai-safety"],
  iterativeOptimization: ["llm-wiki"],
  understandingAI: ["llm-api", "agent-loop", "ai-safety"],
};

/** 一项能力的聚合结果。 */
export interface SubAbilityEvidence {
  /** 0~5；没有任何证据时为 `null`（不是 0 分）。 */
  score: number | null;
  /** 参与平均的掌握度记录数。 */
  samples: number;
  /** 该能力对应的模块 id（用于界面解释「为什么是这几个」）。 */
  modules: readonly string[];
}

/** 聚合所需的掌握度记录（只取聚合需要的两个字段）。 */
export interface MasterySample {
  conceptId: string;
  score: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 把掌握度记录聚合成六项能力。
 *
 * 规则只有三条：
 * 1. 只统计 `SUB_ABILITY_MODULES[key]` 里的模块 —— 不在映射里的模块不参与；
 * 2. 分数不是有限数的记录跳过（防脏数据把平均分拉成 NaN）；
 * 3. 没有样本时分数是 `null`，不是 0。
 */
export function aggregateSubAbilities(
  mastery: readonly MasterySample[],
): Record<SubAbilityKey, SubAbilityEvidence> {
  const scoresByConcept = new Map<string, number>();
  for (const record of mastery) {
    if (typeof record?.conceptId !== "string") continue;
    if (typeof record.score !== "number" || !Number.isFinite(record.score)) {
      continue;
    }
    scoresByConcept.set(record.conceptId, record.score);
  }

  const result = {} as Record<SubAbilityKey, SubAbilityEvidence>;
  for (const key of SUB_ABILITY_KEYS) {
    const modules = SUB_ABILITY_MODULES[key];
    const values = modules
      .map((moduleId) => scoresByConcept.get(moduleId))
      .filter((score): score is number => score !== undefined);

    result[key] = {
      score: values.length
        ? round2(values.reduce((sum, score) => sum + score, 0) / values.length)
        : null,
      samples: values.length,
      modules,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// 成长曲线
// ---------------------------------------------------------------------------

/** 带时间戳的掌握度记录（时间轴只多要一个 `updatedAt`）。 */
export interface MasteryTimelineSample extends MasterySample {
  /** ISO 时间戳（`mastery.updated_at`）；只取前 10 位当日期。 */
  updatedAt: string;
}

/** 曲线上的一点：某个能力在某一天、按当日可见证据重算的均值。 */
export interface SubAbilityTrendPoint {
  /** `YYYY-MM-DD`。 */
  date: string;
  /** 0~5。 */
  score: number;
  /** 当天参与平均的模块数。 */
  samples: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 六项能力的成长曲线。
 *
 * 口径（为什么不是「按日期分桶求平均」）
 * ----------------------------------
 * `mastery` 每个概念只有**一行最新值**，没有历史快照。按日期分桶会把
 * 「今天只重测了一讲」画成「今天全站掌握度掉了下来」——那不是成长，是噪音。
 * 所以这里做**截至当日的累积重算**：对每个有记录的日期，把每个模块取
 * 「≤ 当日最近一次」的分数，再按能力求平均。这样每个点是「那一天你已知的
 * 全部证据」，曲线只会在真正有记录变化的日期上出现拐点。
 *
 * 三条与聚合函数一致的规则：
 * 1. 只统计映射里的模块；不在映射里的模块不产生点；
 * 2. 非有限分数、缺失或非法 `updatedAt` 的记录直接跳过（不猜日期）；
 * 3. 某个能力在某个日期没有任何证据时**不产点**（缺席不等于 0 分）。
 */
export function buildSubAbilityTimeline(
  records: readonly MasteryTimelineSample[],
): Record<SubAbilityKey, SubAbilityTrendPoint[]> {
  // 先规整：只留下「能确定是哪天」且分数有效的记录，并按日期升序；
  // 同一天的多条记录按输入顺序覆盖（后写的算更新的那次测量）。
  const normalized = records
    .map((record) => ({
      conceptId: record?.conceptId,
      score: record?.score,
      date: typeof record?.updatedAt === "string"
        ? record.updatedAt.slice(0, 10)
        : "",
    }))
    .filter(
      (record): record is { conceptId: string; score: number; date: string } =>
        typeof record.conceptId === "string" &&
        typeof record.score === "number" &&
        Number.isFinite(record.score) &&
        DATE_PATTERN.test(record.date),
    )
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const dates = [...new Set(normalized.map((record) => record.date))].sort();

  const result = {} as Record<SubAbilityKey, SubAbilityTrendPoint[]>;
  for (const key of SUB_ABILITY_KEYS) {
    const modules = new Set(SUB_ABILITY_MODULES[key]);
    // 截至当前日期的「每模块最新分」；只缓存映射内的模块。
    const latest = new Map<string, number>();
    let cursor = 0;
    let dirty = false;
    const points: SubAbilityTrendPoint[] = [];

    for (const date of dates) {
      while (cursor < normalized.length && normalized[cursor].date <= date) {
        const record = normalized[cursor];
        if (modules.has(record.conceptId)) {
          latest.set(record.conceptId, record.score);
          dirty = true;
        }
        cursor += 1;
      }

      // 只在该能力「真有新证据」的日期上取点：学生在别的模块上留下的
      // 掌握度不该在这条曲线上补一个平点（那是无信息量的噪音）。
      if (!dirty || latest.size === 0) {
        dirty = false;
        continue;
      }
      const values = [...latest.values()];
      points.push({
        date,
        score: round2(
          values.reduce((sum, score) => sum + score, 0) / values.length,
        ),
        samples: values.length,
      });
      dirty = false;
    }

    result[key] = points;
  }
  return result;
}

/**
 * 曲线首尾变化量：`latest - first`，四舍五入到 2 位。
 * 点数不足 2 时返回 `null`（一个点构不成趋势，别画成 0 变化）。
 */
export function trendDelta(points: readonly SubAbilityTrendPoint[]): number | null {
  if (points.length < 2) return null;
  return round2(points[points.length - 1].score - points[0].score);
}
