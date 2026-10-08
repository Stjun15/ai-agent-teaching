/**
 * 思维链内部口径过滤（铁律 5 的服务端兜底）
 *
 * 为什么必须在服务端做
 * --------------------
 * 靠提示词让模型自我约束**已被实测证伪**（2026-10-08 B 核验）：
 * `teaching-chat.ts` 铁律 5 把「门禁/掌握度/前置模块/编排层/铁律」逐个列举、
 * 还给了具体反例，模型要遵守禁令就必须先在 thinking 里想一遍这些词是什么
 * —— **复述禁令的过程本身就是泄漏**。实测 `agent-loop` 模块 thinking 12328 字、
 * 命中 5 个内部词，原话是 `I should avoid words like 门禁、掌握度… I did mention
 * "铁律" accidentally`。
 *
 * 所以最终口径改成：**不指望模型自觉，在服务端把内部词从 thinking 流里拿走。**
 * 这与「权限由代码控制」同源 —— 靠代码保证，不靠提示词。
 *
 * 为什么需要跨块缓冲
 * ------------------
 * thinking 是流式增量（`thinking_delta` 逐块到达），内部词可能被拆到两个 delta
 * 之间（例如「铁」+「律」）。逐块正则替换会漏掉这种情况。
 *
 * ⚠️ 实现要点（首版曾写错过一次，教训记在下面）
 * ------------------------------------------------
 * 首版把「替换」作用在 head、把尾部 3 字留在缓冲，结果**跨块拆词照样漏**
 * （实测 7 个用例 6 个 FAIL）。原因有二：
 *   1. 替换只在 head 上做，而泄漏词常常就在 head 里（缓冲长度 3 < 「编排层」3 字、
 *      「根据铁律」4 字，压根没被保护到）；
 *   2. `hasWordPrefix` 只判断「缓冲是否恰为某词的前缀」，一旦缓冲够长就直接吐出，
 *      于是「铁」+「律」这种刚好跨块的组合在第一次调用就被放行。
 *
 * 正确顺序：**先在「残留 + 新 delta」的整段上做替换，再决定切多少出去**。
 * 只有当尾部不足以构成任何内部词的前缀时才安全吐出。
 */

/** 需要过滤的内部词。与 `verify-thinking-leak.ts` 的词表保持一致。 */
export const INTERNAL_WORDS = [
  "铁律",
  "掌握度",
  "门禁",
  "前置模块",
  "编排层",
  "评分标准",
  "内部机制",
  "系统内部",
  "根据铁律",
] as const;

/** 命中后的替换文本。用中性说法，避免留断句露痕迹。 */
const REPLACEMENT = "教学要求";

/**
 * 要留在 carry 里的尾部字符数。
 *
 * ⚠️ 这里踩过两次坑，教训写下来别重犯：
 *  1. 首版留「最长词长 - 1」（=3）：跨块拆词照样漏。原因是切点判断方向错了——
 *     它只检查「切点之后到末尾」，而泄漏发生在**切点之前**（「掌握」被当安全前缀吐出去，
 *     后到的「度」再也配不上）。
 *  2. 现在改为：只要 carry 长度 < 最长词长，就一律不吐。
 *     这样任何内部词的前缀都不可能被提前放行 —— 「掌握」留在 carry 里，
 *     等「度」到达时先替换成中性词，再把安全部分吐出去。
 *
 * 值取「最长词长」，比理论最小值多留 1 字，换取实现简单且绝不会漏。
 */
const TAIL_KEEP = INTERNAL_WORDS.reduce((n, w) => Math.max(n, w.length), 0);

/**
 * 把 thinking 增量文本过滤成可安全发给学生的片段。
 *
 * 增量式用法：每次喂入一个 delta，返回本次**可以立即发出去**的前缀；
 * 尾部可能被截成半个内部词的残留会留在内部缓冲，等下一个 delta 或 `flush()` 时吐出。
 *
 * @param delta 本次到达的 thinking 增量
 * @param carry 上一次调用留下的尾部残留（首次传空串）
 * @returns 可发送的文本；第二个返回值是新的 carry
 */
export function filterThinkingDelta(
  delta: string,
  carry: string,
): { emit: string; carry: string } {
  // ⚠️ 顺序关键：先把残留与新 delta 拼起来，**在整段上替换**，再决定切分点。
  // 反过来（先切后替换）会让跨块的词漏掉 —— 首版就是这么错的。
  const masked = maskWords(carry + delta);

  if (masked.length === 0) {
    return { emit: "", carry: "" };
  }

  // 长度不足一个词长：整段都留着，避免吐出半个词
  if (masked.length < TAIL_KEEP) {
    return { emit: "", carry: masked };
  }

  // ⚠️ 只在「尾部已有足够长度、不可能与后续 delta 拼成内部词」时切分。
  // 判断标准是**长度**，不是「是否恰为某词前缀」—— 后者会漏掉
  // 「掌握|度」这种切点落在词前面的情况（实测粒度=2 必漏）。
  const cut = masked.length - TAIL_KEEP;
  return { emit: masked.slice(0, cut), carry: masked.slice(cut) };
}

/** 收尾：把残留缓冲吐出去（此时流已结束，不再有后续 delta）。 */
export function flushThinking(carry: string): string {
  return maskWords(carry);
}

/** 把所有内部词替换成中性说法。 */
function maskWords(text: string): string {
  let out = text;
  for (const word of INTERNAL_WORDS) {
    out = out.split(word).join(REPLACEMENT);
  }
  return out;
}
