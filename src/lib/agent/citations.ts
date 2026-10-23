/**
 * 引用检索 —— 把 Wiki 命中结果变成 SSE 的 `citation` 事件
 *
 * 依据
 * ----
 * `api-spec.md`「三、SSE 事件协议」的 `CitationEvent`：
 * `{ source, page?, snippet, relevance }`。本文件负责产出这四个字段。
 *
 * 为什么引用要在模型回答**之前**发
 * --------------------------
 * 学生在等第一个 token 的这段时间里，界面是空的。引用来自本地 Wiki 检索
 * （关键词路毫秒级；混合路多一次 embedding 调用，约数百毫秒，且与
 * prelude 的其它工作并行），完全可以先到 —— 学生先看到「本节参考了
 * 哪几页」，再看到答案。反过来（答完再补引用）等于把这段时间白扔掉。
 *
 * ⚠️ 相关度 `relevance` 是**经验值**，不是概率
 * ------------------------------------
 * `wiki/query.ts` 的打分是「字段权重 × 命中次数 + 短语奖励」的累加和，
 * **没有上界**，不能直接当 0~1 的相关度用。这里除以一个参考分再截断到 1：
 *
 * - 参考分 `REFERENCE_SCORE = 40`：一次同时命中页名（8×若干）与标签（5×若干）
 *   再加短语奖励（20）时的量级。取它是为了让「确实相关」的页接近 1，
 *   而不是让「碰巧命中一个词」的页也拿到高分。
 * - 低于 `MIN_RELEVANCE` 的命中直接丢掉：`query` 的门槛只是 `score > 0`，
 *   一个常用词（比如「的」「LLM」）就能让几十页都过线，全发给学生是噪音。
 *
 * 这套数字来自对 `query.ts` 权重的推算，**没有用真实语料标定过** ——
 * 若发现引用经常不相关，应先来调这两个常量，而不是怀疑检索坏了。
 */

import type { SSEEvent } from "../sse-server";
import { retrieveHybrid, type RetrievalMode } from "./rag-hybrid";

/** 见文件头：归一化用的参考分。 */
const REFERENCE_SCORE = 40;

/** 见文件头：低于此相关度的命中视为噪音。 */
const MIN_RELEVANCE = 0.15;

/** 引用条数上限。API 侧的默认值，与 `DEFAULT_TOP_K` 解耦以便单独调整。 */
export const DEFAULT_CITATION_COUNT = 3;

/**
 * 一条引用（未落库形态）。
 *
 * `Citation` 还需要 `id` 与 `messageId`，那两个只有等助手消息建好才知道，
 * 所以这里是「内容」而不是完整的 `Citation` —— 避免在拿到 messageId 之前
 * 先编一个假的，再回头改。
 */
export interface CitationDraft {
  /** Wiki 页面路径，例如 `concepts/llm-api.md`。与 `Citation.source` 同义。 */
  source: string;
  /** 命中片段。 */
  snippet: string;
  /** 0~1，见文件头关于经验值的说明。 */
  relevance: number;
}

/** 把原始分数压到 0~1。四舍五入到 4 位是为了让断言与日志可读。 */
function toRelevance(score: number): number {
  return (
    Math.round((Math.min(1, score / REFERENCE_SCORE) + Number.EPSILON) * 1e4) /
    1e4
  );
}

/**
 * 检索与问题相关的 Wiki 页面（混合路：关键词 + 向量，RRF 融合）。
 *
 * 检索永不抛错：向量路失败自动降级为纯关键词并打 `usedFallback`（见
 * `rag-hybrid.ts` 文件头）；关键词路也失败则返回空数组 —— 引用是锦上添花，
 * 不该因为它让整轮对话失败。调用方拿到空数组就直接不发事件。
 *
 * 需要区分「混合」还是「降级」的调用方用 `retrieveCitationsDetailed`；
 * 本函数保留旧签名，供既有调用方与守卫测试使用。
 */
export async function retrieveCitations(
  question: string,
  topK: number = DEFAULT_CITATION_COUNT,
): Promise<CitationDraft[]> {
  const { drafts } = await retrieveCitationsDetailed(question, topK);
  return drafts;
}

export async function retrieveCitationsDetailed(
  question: string,
  topK: number = DEFAULT_CITATION_COUNT,
): Promise<{
  drafts: CitationDraft[];
  mode: RetrievalMode;
  usedFallback: boolean;
}> {
  const result = await retrieveHybrid(question, topK, toRelevance);
  return {
    drafts: result.drafts
      .filter((draft) => draft.relevance >= MIN_RELEVANCE)
      .slice(0, topK),
    mode: result.mode,
    usedFallback: result.usedFallback,
  };
}

/** 把引用转成 SSE 事件，供 `runAgentLoop` 的 `preludeEvents` 使用。 */
export function toCitationEvents(drafts: readonly CitationDraft[]): SSEEvent[] {
  return drafts.map((draft) => ({
    type: "citation",
    data: {
      source: draft.source,
      snippet: draft.snippet,
      relevance: draft.relevance,
    },
  }));
}
