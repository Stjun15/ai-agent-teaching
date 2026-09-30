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
 * 用法：`pnpm rag:eval`（关键词路零依赖；向量/混合路需要先跑 `pnpm rag:index`）
 */

import { readFileSync } from "node:fs";

import { query } from "@/wiki";

interface EvalItem {
  module: string;
  question: string;
}

interface HitLike {
  id: string | null;
  score: number;
}

function loadEvalSet(): EvalItem[] {
  return JSON.parse(readFileSync("scripts/rag-eval-set.json", "utf8"));
}

function recallAndMrr(ranked: HitLike[], expected: string): [boolean, number] {
  const top = ranked.slice(0, 3);
  const index = top.findIndex((hit) => hit.id === expected);
  const recall = index >= 0;
  const mrr = index >= 0 ? 1 / (index + 1) : 0;
  return [recall, mrr];
}

async function evalKeyword(items: EvalItem[]): Promise<void> {
  let recallSum = 0;
  let mrrSum = 0;
  const misses: string[] = [];
  for (const item of items) {
    const result = await query(item.question, { topK: 3 });
    const [recall, mrr] = recallAndMrr(result.hits, item.module);
    recallSum += recall ? 1 : 0;
    mrrSum += mrr;
    if (!recall) {
      const got = result.hits
        .map((hit) => hit.id ?? hit.path)
        .slice(0, 3)
        .join(", ");
      misses.push(`  ✗ [${item.module}] ${item.question.slice(0, 24)}… → ${got || "（无命中）"}`);
    }
  }
  console.log(
    `关键词路：recall@3 = ${recallSum}/${items.length}，MRR = ${(mrrSum / items.length).toFixed(3)}`,
  );
  for (const miss of misses) console.log(miss);
}

async function main(): Promise<void> {
  const items = loadEvalSet();
  console.log(`评测集：${items.length} 条（标注为模块概念页，保守口径）\n`);
  await evalKeyword(items);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
