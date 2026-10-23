/**
 * 思维链内部词过滤（铁律5 服务端兜底）单元测试
 *
 * 为什么要测这个
 * --------------
 * 首版实现有真实缺陷：把替换作用在 head、尾部只留 3 字缓冲，结果**跨块拆词照样漏**
 * （7 个用例 6 个 FAIL）。thinking 是流式增量，词可能被拆到两个 delta 之间
 * （「铁」+「律」），这类bug 在真实流里极难靠肉眼发现，故固化成测试。
 *
 * 与 `verify-thinking-leak.ts`（B 核验，真调模型）分工：
 * 本文件是**纯函数**、不调模型、可离线跑，负责防回归；B 核验负责端到端实证。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  filterThinkingDelta,
  flushThinking,
  INTERNAL_WORDS,
} from "@/lib/agent/thinking-filter";

/** 把一串 delta 按序喂进过滤器，返回学生最终会看到的完整文本。 */
function feed(chunks: readonly string[]): string {
  let carry = "";
  let out = "";
  for (const chunk of chunks) {
    const r = filterThinkingDelta(chunk, carry);
    carry = r.carry;
    out += r.emit;
  }
  return out + flushThinking(carry);
}

/** 断言输出里没有任何内部词。 */
function assertNoLeak(text: string): void {
  const leaked = INTERNAL_WORDS.filter((w) => text.includes(w));
  assert.deepEqual(leaked, [], `泄漏内部词 ${leaked.join(",")}：${text}`);
}

test("thinking 过滤：不含内部词的普通文本原样保留", () => {
  const src = "我想先看看今天的作业要求，再决定怎么讲。";
  assert.equal(feed([src]), src);
});

test("thinking 过滤：整块命中内部词时被替换", () => {
  assertNoLeak(feed(["根据铁律我要先检查门禁"]));
});

test("thinking 过滤：跨块拆词（铁|律）不漏", () => {
  assertNoLeak(feed(["我提到铁", "律了"]));
});

test("thinking 过滤：跨块拆词（门|禁）不漏", () => {
  assertNoLeak(feed(["学生过了门", "禁阶段"]));
});

test("thinking 过滤：跨块拆词（掌握|度）不漏", () => {
  assertNoLeak(feed(["看掌握", "度即可"]));
});

test("thinking 过滤：逐字喂入（最严苛分块）不漏", () => {
  assertNoLeak(feed(["根", "据", "铁", "律", "要", "守", "规"]));
});

test("thinking 过滤：多个内部词混在一块全部被替换", () => {
  assertNoLeak(feed(["铁律、掌握度、门禁、前置模块、编排层"]));
});

test("thinking 过滤：全部 9 个内部词都覆盖", () => {
  assertNoLeak(
    feed(["评分标准", "内部机制", "系统内部", "根据铁律", "前置模块"]),
  );
});

test("thinking 过滤：长文本中夹带内部词，前后文不丢", () => {
  const out = feed([
    "这是一个很长的思考过程，中间提到了门禁这个词，后面还有更多内容继续写下去。",
  ]);
  assertNoLeak(out);
  assert.ok(out.includes("很长的思考过程"), "开头应保留");
  assert.ok(out.includes("继续写下去"), "结尾应保留");
});

test("thinking 过滤：被替换后不丢字（语义完整）", () => {
  // 「铁律」2 字 → 「教学要求」4 字，长度会变，但前后文必须都在
  const out = feed(["我提到铁律了"]);
  assertNoLeak(out);
  assert.ok(out.includes("我提到"), "前缀应保留");
  assert.ok(out.endsWith("了"), "后缀应保留");
});

test("thinking 过滤：空输入不产出噪声", () => {
  assert.equal(feed([]), "");
  assert.equal(flushThinking(""), "");
});

test("thinking 过滤：掌握|度 被拆到两块时不漏（粒度=2 回归）", () => {
  // 这条是真实 B 核验抓到的泄漏：chunks 为 ["…模块","掌握","度低…"] 时，
  // 首版把「掌握」当成安全前缀吐了出去，后到的「度」再也配不上。
  assertNoLeak(feed(["学生刚进模块", "掌握", "度低", "所以要全部展开"]));
});

test("thinking 过滤：穷举全部切分方式均不漏", () => {
  // 固定粒度 + 每个可能的单点切法 + 逐字，覆盖流式分块的现实情形。
  const sentences = [
    "学生刚进模块掌握度低所以要全部展开",
    "根据铁律我要先检查门禁再讲",
    "不暴露系统内部机制，思维链里也别复述这些词",
    "评分标准与前置模块都要考虑编排层",
  ];
  for (const s of sentences) {
    for (let size = 1; size <= s.length; size++) {
      const chunks: string[] = [];
      for (let i = 0; i < s.length; i += size)
        chunks.push(s.slice(i, i + size));
      assertNoLeak(feed(chunks));
    }
    for (let i = 1; i < s.length; i++) {
      assertNoLeak(feed([s.slice(0, i), s.slice(i)]));
    }
    assertNoLeak(feed([...s]));
  }
});
