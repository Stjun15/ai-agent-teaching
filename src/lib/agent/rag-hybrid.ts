/**
 * 混合检索 —— 关键词路 + 向量路双路召回，RRF 融合
 *
 * 为什么两条路都要
 * ----------------
 * 关键词路（`wiki/query.ts`）毫秒级、可解释、零依赖，但对**语义改述**无能为力：
 * 问「系统提示词」召不回 id 叫 system-prompt 的页（实测基线 recall@3 = 17/22，
 * 5 个 miss 全是改述形态）。向量路补的正是这一块。反过来，向量路对术语的
 * 精确匹配并不占优，且依赖一次 embedding 调用与一份离线索引。生产 RAG 的
 * 常规做法是双路召回、排名融合（RRF），本模块照此实现。
 *
 * 降级纪律（与全仓库兜底哲学一致）
 * -------------------------------
 * 向量路任何失败（无密钥、无索引、接口错误）→ **整体回退纯关键词路**并打
 * `usedFallback` 标记。检索是锦上添花，绝不让它让对话失败，但降级必须可识别。
 *
 * RRF（Reciprocal Rank Fusion）
 * ---------------------------
 * fused(d) = Σ 1/(K + rank_i(d))，K=60（原论文值）。只用排名不用分数：
 * 两路分数量纲完全不同（关键词无上界、余弦 0~1），排名是唯一公共语言。
 */

import { knowledgeEmbeddingDb } from "@/lib/db";

import { query, type WikiHit } from "@/wiki";

import { cosine, embedTexts, readEmbeddingSettings } from "./embeddings";

/** 每路召回的候选数。融合前多取一些，融合后截到 topK。 */
export const HYBRID_CANDIDATES = 8;

/** RRF 常数，原论文（Cormack et al., 2009）取 60。 */
export const RRF_K = 60;

export type RetrievalMode = "keyword" | "hybrid";

export interface HybridRetrievalResult {
  drafts: {
    source: string;
    snippet: string;
    relevance: number;
  }[];
  mode: RetrievalMode;
  /** true = 向量路失败，实际只走了关键词路。 */
  usedFallback: boolean;
}

/**
 * RRF 融合。输入两路的「已排序列表」（每路一个 string[]，下标即排名），
 * 输出融合后的排序列表。纯函数，供守卫测试直接断言。
 */
export function fuseRrf(
  keywordRanked: readonly string[],
  vectorRanked: readonly string[],
  k: number = RRF_K,
): string[] {
  const scores = new Map<string, number>();
  const add = (ranked: readonly string[]) => {
    for (let rank = 0; rank < ranked.length; rank += 1) {
      const source = ranked[rank];
      scores.set(source, (scores.get(source) ?? 0) + 1 / (k + rank + 1));
    }
  };
  add(keywordRanked);
  add(vectorRanked);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([source]) => source);
}

/** 向量路：查询向量化 → 与全部章节块算余弦 → 每页取最好块 → 排序。 */
export async function vectorRank(
  question: string,
  candidates: number = HYBRID_CANDIDATES,
): Promise<{ path: string; snippet: string; cosine: number }[]> {
  const chunks = knowledgeEmbeddingDb.listAll();
  if (chunks.length === 0) {
    throw new Error("向量索引为空，请先运行 pnpm rag:index。");
  }
  const settings = readEmbeddingSettings();
  const [queryVector] = await embedTexts([question], settings);

  const bestPerPage = new Map<string, { snippet: string; cosine: number }>();
  for (const chunk of chunks) {
    const similarity = cosine(queryVector, chunk.embedding);
    const known = bestPerPage.get(chunk.pagePath);
    if (!known || similarity > known.cosine) {
      bestPerPage.set(chunk.pagePath, {
        snippet: chunk.content,
        cosine: similarity,
      });
    }
  }
  return [...bestPerPage.entries()]
    .map(([path, { snippet, cosine: value }]) => ({
      path,
      snippet,
      cosine: value,
    }))
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, candidates);
}

/** 关键词 excerpts 索引：融合后给「关键词路见过的页」用它的原文摘录。 */
function excerptIndex(hits: WikiHit[]): Map<string, string> {
  return new Map(hits.map((hit) => [hit.path, hit.excerpt]));
}

/**
 * 混合检索引用。永不抛错：向量路失败降级为纯关键词（`usedFallback: true`），
 * 关键词路也失败则返回空（引用缺失好过对话失败）。
 */
export async function retrieveHybrid(
  question: string,
  topK: number,
  toRelevance: (score: number) => number,
): Promise<HybridRetrievalResult> {
  const keyword = await query(question, { topK: HYBRID_CANDIDATES })
    .then((result) => result.hits)
    .catch(() => [] as WikiHit[]);

  let vector: Awaited<ReturnType<typeof vectorRank>> = [];
  let usedFallback = false;
  try {
    vector = await vectorRank(question);
  } catch {
    usedFallback = true;
  }

  // 索引为空 / 无密钥等场景下向量路没有候选：退化成纯关键词，但要如实标注。
  if (vector.length === 0) usedFallback = true;

  const excerpts = excerptIndex(keyword);
  const vectorByPath = new Map(vector.map((hit) => [hit.path, hit]));
  const fused = fuseRrf(
    keyword.map((hit) => hit.path),
    vector.map((hit) => hit.path),
  ).slice(0, topK);

  const drafts = fused.map((path) => {
    const keywordHit = keyword.find((hit) => hit.path === path);
    const vectorHit = vectorByPath.get(path);
    const relevance = keywordHit
      ? toRelevance(keywordHit.score)
      : Math.max(0, Math.min(1, vectorHit?.cosine ?? 0));
    // 关键词路的摘录是问句相关行；向量路只有章节块，截一段作摘录。
    const snippet =
      excerpts.get(path) ??
      (vectorHit?.snippet ?? "").split("\n").find((line) => line.trim()) ??
      "";
    return { source: path, snippet, relevance };
  });

  return { drafts, mode: usedFallback ? "keyword" : "hybrid", usedFallback };
}
