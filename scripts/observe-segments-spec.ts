/**
 * 观察面板的散文 / 代码分段
 *
 * 钉什么
 * -----
 * 概念页「## 示范代码」小节里，代码块之间夹着面向学生的说明与类比。
 * 观察面板原先只渲染代码块、把这些整段丢掉 —— 扇出审计实测 8/10 讲命中，
 * 丢掉的恰好是最该给零基础学生的部分：
 * - multi-agent 的「把它想象成『招聘』」
 * - llm-wiki 的「就像用微波炉不用懂磁控管原理」
 * - rag 的「你不用懂它们怎么算」免责句
 *
 * `segmentByCode` 是修法：散文按**原文**保留，不经结构化 token 往返
 * （往返有损，列表层级与软换行会变形）。
 *
 * 不调模型、不碰浏览器：纯函数。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { readDemoCode } from "@/lib/teaching-script";
import { segmentByCode, type DocSegment } from "@/lib/markdown";

/** 取散文段的原文；传错段类型时立刻报错，而不是静默返回 undefined。 */
function proseSource(segment: DocSegment | undefined): string {
  assert.ok(segment !== undefined && segment.kind === "prose");
  return segment.source;
}

test("散文与代码交替切分，代码段带递增序号", () => {
  const source = [
    "先看这段说明。",
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
    "再看这句类比。",
    "",
    "```python",
    "print(a)",
    "```",
  ].join("\n");

  const segments = segmentByCode(source);

  assert.deepEqual(
    segments.map((s) => s.kind),
    ["prose", "code", "prose", "code"],
  );
  assert.equal(proseSource(segments[0]), "先看这段说明。");
  assert.equal(
    segments[1].kind === "code" && segments[1].value,
    "const a = 1;",
  );
  assert.equal(segments[1].kind === "code" && segments[1].language, "ts");
  assert.equal(segments[1].kind === "code" && segments[1].ordinal, 1);
  assert.equal(proseSource(segments[2]), "再看这句类比。");
  assert.equal(segments[3].kind === "code" && segments[3].ordinal, 2);
});

test("代码块内的空行与围栏标记不被误切", () => {
  const source = ["```ts", "", "const a = 1;", "", "```", "尾注"].join("\n");
  const segments = segmentByCode(source);

  assert.equal(segments.length, 2);
  assert.equal(
    segments[0].kind === "code" && segments[0].value,
    "\nconst a = 1;\n",
  );
  assert.equal(proseSource(segments[1]), "尾注");
});

test("纯散文（无围栏）返回单段，不产生空段", () => {
  const segments = segmentByCode("只有说明文字。\n\n第二段。");
  assert.equal(segments.length, 1);
  assert.equal(segments[0].kind, "prose");
  assert.equal(proseSource(segments[0]), "只有说明文字。\n\n第二段。");
});

test("未闭合围栏按到文末处理（流式中途的形态）", () => {
  const segments = segmentByCode("前言\n\n```ts\nconst a = 1;");
  assert.equal(segments.length, 2);
  assert.equal(
    segments[1].kind === "code" && segments[1].value,
    "const a = 1;",
  );
});

test("真实概念页：multi-agent 的招聘类比能被切出来（回归钉）", () => {
  const demo = readDemoCode("multi-agent");
  assert.notEqual(demo, "", "multi-agent 概念页应有「## 示范代码」小节");

  const prose = segmentByCode(demo)
    .filter((s) => s.kind === "prose")
    .map((s) => s.source)
    .join("\n");

  assert.match(
    prose,
    /招聘/,
    "「招聘」类比应作为散文保留下来 —— 它原先被观察面板丢弃",
  );
  assert.match(prose, /createAgent/);
});

test("真实概念页：rag 的「你不用懂」免责句能被切出来", () => {
  const demo = readDemoCode("rag");
  assert.notEqual(demo, "");

  const prose = segmentByCode(demo)
    .filter((s) => s.kind === "prose")
    .map((s) => s.source)
    .join("\n");

  assert.match(
    prose,
    /embed\(\)|不用懂|不需要懂/,
    "rag 的免责句应保留 —— 审计里「示范代码零定义」的成因之一就是它被丢了",
  );
});

test("真实概念页：llm-wiki 的微波炉类比能被切出来", () => {
  const demo = readDemoCode("llm-wiki");
  assert.notEqual(demo, "");

  const prose = segmentByCode(demo)
    .filter((s) => s.kind === "prose")
    .map((s) => s.source)
    .join("\n");

  assert.match(prose, /微波炉|磁控管/);
});
