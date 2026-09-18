/**
 * 报告页「评分维度」的聚合 —— 只汇总真实存在的维度
 *
 * 为什么要有这一块
 * --------------
 * `ReportResponse.subAbilities`（意图表达 / 任务分解 / …）是 api-spec 里的
 * 六项固定能力，但本项目**没有按能力建模**：`mastery` 表是「概念 → 分数」，
 * 路由只能拿总体平均掌握度填那六个字段，六根进度条因此永远一样长。
 *
 * 而真实存在的是另一组维度：点评 Agent 每次按 rubric 打出的
 * `dimensions[]` —— 名字由模型给出（实测是「角色定义 / 工具描述 / 输出格式 /
 * 边界条件 / 简洁性」这类），**不是固定的六个**，所以映射不到 subAbilities 上。
 * 硬做模糊匹配等于把「角色定义」猜成「意图表达」，那是编数据。
 *
 * 所以这里不猜，只聚合：把历次点评里出现过的维度按名字汇成
 * 「平均分 + 样本数」，交报告页原样显示。模型下次换个维度名，
 * 页面上就多一行 —— 不需要改代码，也不需要人来做映射。
 *
 * 为什么是叶子模块
 * --------------
 * 纯函数、不 import 任何东西（与 `scores.ts` 同构），因此能脱离 Next 与数据库
 * 直接单测（`scripts/report-dimensions-spec.ts`）。聚合规则放在路由文件里的话，
 * 「空数组会不会污染平均分」这种事就只能靠浏览器点了才知道。
 */

/** 一个维度在历次点评里的汇总。 */
export interface DimensionSummary {
  /** 维度名（点评 Agent 给的原名，不翻译、不映射）。 */
  name: string;
  /** 该维度的平均分，量纲 **0~100**（来自 `ReviewerOutputSchema`）。 */
  averageScore: number;
  /** 有多少次点评包含这个维度。 */
  samples: number;
}

/** 一次点评里的一个维度（只取聚合需要的两个字段）。 */
export interface DimensionSample {
  name?: string;
  score?: number;
}

/**
 * 汇总多次点评的维度。
 *
 * 三条规则，每一条都对应一个真实会犯的错：
 *
 * 1. **`score` 不是有限数就跳过**。历史里存在 `dimensions` 为空数组的行
 *    （客观题、或点评失败前写入的早期数据），把 `undefined` 当 0 参与平均
 *    会把「这个维度从没被评过」显示成「这个维度 0 分」—— 与「没数据不显示 0 分」
 *    是同一条纪律。
 * 2. **空维度名跳过**。模型偶尔给出空字符串，那不是「未命名维度」，是脏数据。
 * 3. **按样本数降序、同样本数按名字升序**。排序不稳定的话，刷新一次页面
 *    维度条就换一次位置，看起来像数据在跳。
 */
export function summarizeDimensions(
  prompts: readonly { dimensions?: readonly DimensionSample[] | null }[],
): DimensionSummary[] {
  const buckets = new Map<string, { sum: number; count: number }>();

  for (const prompt of prompts) {
    for (const dimension of prompt.dimensions ?? []) {
      const name =
        typeof dimension?.name === "string" ? dimension.name.trim() : "";
      const score = dimension?.score;
      if (!name || typeof score !== "number" || !Number.isFinite(score))
        continue;

      const bucket = buckets.get(name) ?? { sum: 0, count: 0 };
      bucket.sum += score;
      bucket.count += 1;
      buckets.set(name, bucket);
    }
  }

  return [...buckets.entries()]
    .map(([name, bucket]) => ({
      name,
      averageScore: Math.round((bucket.sum / bucket.count) * 100) / 100,
      samples: bucket.count,
    }))
    .sort(
      (a, b) => b.samples - a.samples || a.name.localeCompare(b.name, "zh"),
    );
}
