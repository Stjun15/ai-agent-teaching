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
