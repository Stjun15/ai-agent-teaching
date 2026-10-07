/**
 * 确定性审计检查器
 *
 * 钉什么
 * -----
 * 五项检查各自的**判据边界**，尤其是「不报」的那一侧。
 *
 * 这套检查器的价值全在可信度：它必须只报真问题。扇出审计（10 讲、独立
 * 裁判）给了三份可对照的基准结论，测试就钉在这些基准上：
 * - ai-safety 概念页承诺「四层 / 五类 / 场景 A」而讲稿零出现 → 必须报
 * - llm-api 的「上下文」直接当已知在用 → 必须报
 * - mcp 的「Agent」出现却从未定义 → 必须报
 *
 * 误报是这套东西的致命伤（开发期实测栽过两次，见 deterministic.ts 里
 * 「内容一致性」与「术语断层」的注释），所以每条误报形态都要钉一条
 * 「不得报」的断言：
 * - 讲稿用「先给大白话定义：**X**」声明要定义 → 不得报未定义
 * - 「上下文」只出现在「模型上下文协议」里 → 不得算被使用
 * - 讲稿与概念页只是标题措辞不同 → 不得报「不重合」
 *
 * 不调模型、不碰浏览器、不写数据库。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auditSubjectDeterministically,
  fingerprintOf,
  type AuditSubject,
} from "@/lib/audit/deterministic";

/** 造一讲的审计输入。各字段按需覆盖。 */
function subject(over: Partial<AuditSubject> = {}): AuditSubject {
  return {
    moduleId: "test",
    moduleName: "测试讲",
    conceptPage: "## 为什么需要\n## 示范代码\n",
    demoCode: "```ts\nconst a = 1;\n```\n",
    lecture:
      "开场白\n\n## 一、为什么需要\n讲清了什么。\n\n## 二、概念\n概念内容。\n\n## 五、现在轮到你\n动手做一件事。\n",
    ...over,
  };
}

const titles = (s: AuditSubject): string[] =>
  auditSubjectDeterministically(s).findings.map((f) => f.title);

// ---------------------------------------------------------------------------
// 检查 1：任务节
// ---------------------------------------------------------------------------

test("讲稿缺任务节 → critical（任务卡不渲染，学生面对空编辑器）", () => {
  const lecture =
    "开场白\n\n## 一、为什么需要\n讲清了什么。\n\n## 四、概念测验\n选一个。\n";
  const found = auditSubjectDeterministically(subject({ lecture }));
  const task = found.findings.find((f) => f.dimension === "可达性");

  assert.ok(task);
  assert.equal(task.severity, "critical");
  assert.match(task.title, /任务节/);
  assert.equal(found.scores.reachability, 0);
});

test("有任务节 → 不报可达性问题", () => {
  const found = auditSubjectDeterministically(subject());
  assert.equal(
    found.findings.filter((f) => f.dimension === "可达性").length,
    0,
  );
  assert.equal(found.scores.reachability, 1);
});

test("无讲稿缓存 → 报 high 并说明是缺缓存（不是内容缺陷）", () => {
  const found = auditSubjectDeterministically(subject({ lecture: null }));
  assert.match(found.findings[0].title, /无 explain 讲稿缓存/);
  assert.equal(found.findings[0].severity, "high");
});

test("讲稿为 null 时术语/一致性维度是 null 而不是 0（未检测 ≠ 很差）", () => {
  const found = auditSubjectDeterministically(subject({ lecture: null }));
  assert.equal(found.scores.terminologyGap, null);
  assert.equal(found.scores.consistency, null);
});

// ---------------------------------------------------------------------------
// 检查 2：示范代码节的散文
// ---------------------------------------------------------------------------

test("示范代码节只有代码没有说明 → medium", () => {
  const found = auditSubjectDeterministically(
    subject({ demoCode: "```ts\nconst a = 1;\n```\n" }),
  );
  const demo = found.findings.find((f) => f.dimension === "可读性");

  assert.ok(demo);
  assert.match(demo.title, /没有任何面向学生的说明/);
  assert.equal(found.scores.demoReadability, 0.4);
});

test("示范代码节有说明散文 → 不报（这正是 61d1469 修完的形态）", () => {
  const demoCode =
    "这一段解决什么问题。\n\n```ts\nconst a = 1;\n```\n\n你不需要懂内部实现。\n";
  const found = auditSubjectDeterministically(subject({ demoCode }));

  assert.equal(
    found.findings.filter((f) => f.dimension === "可读性").length,
    0,
    "有散文说明就不该报 —— 观察面板渲染层已修，内容侧也齐了",
  );
  assert.equal(found.scores.demoReadability, 1);
});

test("缺「## 示范代码」小节 → high 且示范可读性为 0", () => {
  const found = auditSubjectDeterministically(subject({ demoCode: "" }));
  assert.match(found.findings[0].title, /缺「## 示范代码」小节/);
  assert.equal(found.scores.demoReadability, 0);
});

// ---------------------------------------------------------------------------
// 检查 3：任务要求超纲语法
// ---------------------------------------------------------------------------

test("任务要求用讲稿从未教过的语法 → high", () => {
  const lecture =
    "## 一、为什么需要\n讲清。\n\n## 五、现在轮到你\n请定义一个 interface Foo { a: string }。\n";
  const found = auditSubjectDeterministically(subject({ lecture }));
  const syntax = found.findings.filter((f) => f.title.includes("interface"));

  assert.equal(syntax.length, 1);
  assert.equal(syntax[0].severity, "high");
  assert.match(syntax[0].evidence, /任务节出现 1 次/);
});

test("讲稿教过该语法 → 不报超纲", () => {
  const lecture =
    "## 一、为什么需要\n先讲 interface 是什么。\n\n## 五、现在轮到你\n请定义一个 interface Foo。\n";
  const found = auditSubjectDeterministically(subject({ lecture }));

  assert.equal(
    found.findings.filter((f) => f.title.includes("interface")).length,
    0,
  );
});

// ---------------------------------------------------------------------------
// 检查 4：术语断层（含三类不得误报）
// ---------------------------------------------------------------------------

test("术语在讲稿里当已知在用 → medium", () => {
  const lecture =
    "## 一、为什么需要\n这里说的上下文管理很重要。\n\n## 五、现在轮到你\n动手。\n";
  const found = auditSubjectDeterministically(subject({ lecture }));
  const term = found.findings.find((f) => f.title.includes("上下文"));

  assert.ok(term);
  assert.equal(term.dimension, "术语断层");
});

test("不得误报①：讲稿用「先给大白话定义：」声明要定义", () => {
  const lecture =
    "## 一、为什么需要\n**先给大白话定义：**Agent 就是会自己干活的程序。\n\n## 五、现在轮到你\n动手。\n";
  assert.equal(
    titles(subject({ lecture })).filter((t) => t.includes("Agent")).length,
    0,
    "讲稿明确声明「我要定义它」了，不该报未定义",
  );
});

test("不得误报②：「上下文」只在「模型上下文协议」里出现，不算被使用", () => {
  const lecture =
    "## 一、为什么需要\n**MCP**（Model Context Protocol，模型上下文协议）：一套标准约定。\n\n## 五、现在轮到你\n动手。\n";
  assert.equal(
    titles(subject({ lecture })).filter((t) => t.includes("上下文")).length,
    0,
    "「上下文」只是复合词的一部分，不是术语被使用",
  );
});

test("不得误报③：括号内联解释算已定义", () => {
  const lecture =
    "## 一、为什么需要\n设熔断（停止条件）：遇到 X 就停。\n\n## 五、现在轮到你\n动手。\n";
  assert.equal(
    titles(subject({ lecture })).filter((t) => t.includes("熔断")).length,
    0,
    "「熔断（停止条件）」的括号就是解释",
  );
});

// ---------------------------------------------------------------------------
// 检查 5：内容一致性（含不得误报）
// ---------------------------------------------------------------------------

test("概念页承诺的机制结构讲稿零出现 → high（ai-safety 基准）", () => {
  const conceptPage = [
    "## 四层闸门",
    "## 五类风险",
    "## 场景 A",
    "## 场景 B",
    "## 示范代码",
    "```ts",
    "const a = 1;",
    "```",
  ].join("\n");
  const found = auditSubjectDeterministically(
    subject({ conceptPage, demoCode: "说明。\n\n```ts\nconst a=1;\n```\n" }),
  );
  const consistency = found.findings.find((f) => f.dimension === "内容一致性");

  assert.ok(consistency);
  assert.equal(consistency.severity, "high");
  assert.match(consistency.evidence, /四层/);
  assert.match(consistency.evidence, /五类/);
});

test("不得误报④：讲稿与概念页只是标题措辞不同，不算不重合", () => {
  // 概念页叫「常见模式」，讲稿叫「三、怎么分工」—— 字面 0 命中但内容一致。
  const conceptPage = [
    "## 为什么要多 Agent",
    "## 常见模式",
    "## 关键问题",
    "## 自己动手",
    "## 示范代码",
    "```ts",
    "const a = 1;",
    "```",
  ].join("\n");
  const found = auditSubjectDeterministically(
    subject({
      conceptPage,
      demoCode: "说明。\n\n```ts\nconst a=1;\n```\n",
    }),
  );

  assert.equal(
    found.findings.filter((f) => f.dimension === "内容一致性").length,
    0,
    "第一版判据在这里误报了 8/11 讲 —— 标题措辞不同 ≠ 内容不重合",
  );
});

test("机制承诺大部分都在讲稿里 → 不报", () => {
  const conceptPage =
    "## 四层闸门\n## 五类风险\n## 示范代码\n```ts\nconst a=1;\n```\n";
  const lecture =
    "## 一、为什么需要\n四层闸门与五类风险都很重要。\n\n## 五、现在轮到你\n动手。\n";
  const found = auditSubjectDeterministically(
    subject({
      conceptPage,
      lecture,
      demoCode: "说明。\n\n```ts\nconst a=1;\n```\n",
    }),
  );

  assert.equal(
    found.findings.filter((f) => f.dimension === "内容一致性").length,
    0,
  );
});

// ---------------------------------------------------------------------------
// 汇总与工具
// ---------------------------------------------------------------------------

test("fingerprint 稳定且区分维度", () => {
  assert.equal(
    fingerprintOf("rag", "可读性", "标题 A"),
    fingerprintOf("rag", "可读性", "标题 A"),
  );
  assert.notEqual(
    fingerprintOf("rag", "可读性", "标题 A"),
    fingerprintOf("rag", "术语断层", "标题 A"),
    "同标题不同维度必须是不同指纹，否则会互相覆盖",
  );
});

test("全部通过的讲：分数为满分且 findings 为空", () => {
  const demoCode = "这段说明用途。\n\n```ts\nconst a = 1;\n```\n";
  const lecture =
    "## 一、为什么需要\n讲清了什么。\n\n## 五、现在轮到你\n动手做一件事。\n";
  const found = auditSubjectDeterministically(
    subject({ conceptPage: "## 为什么需要\n", demoCode, lecture }),
  );

  assert.deepEqual(found.findings, []);
  assert.equal(found.scores.reachability, 1);
  assert.equal(found.scores.demoReadability, 1);
  assert.equal(found.scores.consistency, 1);
});
