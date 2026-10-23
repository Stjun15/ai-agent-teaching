/**
 * RAG 检索评测 —— 三路对比（关键词 / 纯向量 / 混合）
 *
 * 评测集：`scripts/rag-eval-set.json`，22 条查询，每条标注应命中的模块页。
 * 查询取材于学生 Agent 模拟的真实提问（讲解步困惑、答疑），标注约定是
 * 「该问题在对应模块的学习语境下提出，应至少召回该模块的概念页」——
 * 这是保守口径：理想答案可能还包含关联页，但我们只统计保守标签。
 *
 * 指标：
 * - recall@3：应命中页出现在 top3 的比例（引用位就是 3 条，对齐产品口径）
 * - MRR：应命中页排名倒数的均值（对排序质量更敏感）
 *
 * 用法：`pnpm rag:eval`
 * - 关键词路零依赖；
 * - 向量/混合路需要 `pnpm rag:index` 先建索引 + DASHSCOPE_API_KEY。
 */

import { readFileSync } from "node:fs";

import { retrieveHybrid } from "@/lib/agent/rag-hybrid";
import { vectorRank } from "@/lib/agent/rag-hybrid";
import { query } from "@/wiki";

interface EvalItem {
  module: string;
  question: string;
}

function loadEvalSet(): EvalItem[] {
  return JSON.parse(readFileSync("scripts/rag-eval-set.json", "utf8"));
}

function summarize(
  name: string,
  items: EvalItem[],
  ranks: number[][],
): { recall: number; mrr: number } {
  const misses: string[] = [];
  let recallSum = 0;
  let mrrSum = 0;
  for (let i = 0; i < items.length; i += 1) {
    const rank = ranks[i].findIndex((position) => position > 0);
    const hit = rank >= 0;
    recallSum += hit ? 1 : 0;
    mrrSum += hit ? 1 / ranks[i][rank] : 0;
    if (!hit) {
      misses.push(
        `  ✗ [${items[i].module}] ${items[i].question.slice(0, 24)}…`,
      );
    }
  }
  console.log(
    `${name}：recall@3 = ${recallSum}/${items.length}，MRR = ${(mrrSum / items.length).toFixed(3)}`,
  );
  for (const miss of misses) console.log(miss);
  return { recall: recallSum / items.length, mrr: mrrSum / items.length };
}

/** 关键词路：query 的排名里找期望页（-1 = 未进前 3）。 */
async function evalKeyword(items: EvalItem[]): Promise<number[][]> {
  const ranks: number[][] = [];
  for (const item of items) {
    const result = await query(item.question, { topK: 3 });
    ranks.push(
      result.hits.map((hit, index) => (hit.id === item.module ? index + 1 : 0)),
    );
  }
  return ranks;
}

/** 纯向量路：每页取最好块的余弦排序。 */
async function evalVector(items: EvalItem[]): Promise<number[][]> {
  const ranks: number[][] = [];
  for (const item of items) {
    const ranked = await vectorRank(item.question, 8);
    const pages = [...new Set(ranked.map((hit) => hit.path))];
    ranks.push(
      pages
        .slice(0, 3)
        .map((path) =>
          path.endsWith(`/${item.module}.md`) ? pages.indexOf(path) + 1 : 0,
        ),
    );
  }
  return ranks;
}

/** 混合路：retrieveHybrid 的最终引用序。 */
async function evalHybrid(items: EvalItem[]): Promise<number[][]> {
  const ranks: number[][] = [];
  for (const item of items) {
    const { drafts } = await retrieveHybrid(item.question, 3, (score) =>
      Math.min(1, score / 40),
    );
    ranks.push(
      drafts.map((draft) =>
        draft.source.endsWith(`/${item.module}.md`)
          ? drafts.indexOf(draft) + 1
          : 0,
      ),
    );
  }
  return ranks;
}

async function main(): Promise<void> {
  const items = loadEvalSet();
  console.log(`评测集：${items.length} 条（标注为模块概念页，保守口径）\n`);
  summarize("关键词路", items, await evalKeyword(items));
  console.log("");
  summarize("纯向量路", items, await evalVector(items));
  console.log("");
  summarize("混合路（RRF）", items, await evalHybrid(items));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
