/**
 * 交互式冷启动 + /api/module-content 守卫
 *
 * 钉什么
 * -----
 * 1. <parseAxes> 三板斧解析：从 platform-replica 概念页正文里
 *    正确拆出三斧（每斧有标题、emoji、正文、四级子节），跳过
 *    非斧级标题（启动台、龙骨等）。
 * 2. <MODULE_ID_RE> 正则：放行合法 moduleId，拒绝空值、含特殊
 *    字符、含路径穿越（../、\ 等）的输入。
 * 3. <GET /api/module-content> 端点：200 返回正文（切掉 frontmatter）、
 *    400 拒绝非法 ID、404 处理不存在的模块。
 *
 * 全组不调模型。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseAxes, parsePathSelect } from "@/lib/explain-cold-start-parser";

// ---------------------------------------------------------------------------
// 1. parseAxes 三板斧解析
// ---------------------------------------------------------------------------

test("parseAxes：三段 ### 斧头全被拆出", () => {
  const md = `
### 第一斧：LLM API

内容一

### 第二斧：多步 Agent

内容二

### 第三斧：知识 + 数据库

内容三
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 3, "应拆出三斧");
  assert.equal(axes[0].emoji, "⚡");
  assert.equal(axes[0].title, "LLM API");
  assert.ok(axes[0].body.includes("内容一"), "正文应包含在 body 里");

  assert.equal(axes[1].emoji, "🧠");
  assert.equal(axes[1].title, "多步 Agent");

  assert.equal(axes[2].emoji, "🗄️");
  assert.equal(axes[2].title, "知识 + 数据库");
});

test("parseAxes：跳过非斧级标题（启动台/龙骨/验收/结算/怎么造）", () => {
  const md = `
### 启动台：环境准备

启动内容

### 第一斧：核心功能

斧头内容

### 龙骨：页面连线

龙骨内容

### 验收

验收内容
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 1, "只有第一斧被保留，其余全被跳过");
  assert.equal(axes[0].title, "核心功能");
});

test("parseAxes：识别中文冒号分隔的斧头标题", () => {
  const md = `
### 第一斧：用中文冒号

内容
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 1);
  assert.equal(axes[0].title, "用中文冒号");
});

test("parseAxes：识别英文冒号分隔的斧头标题", () => {
  const md = `
### 第一斧: with english colon

内容
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 1);
  assert.equal(axes[0].title, "with english colon");
});

test("parseAxes：拆 #### 四级标题为 subsections", () => {
  const md = `
### 第一斧：测试

斧头正文

#### 子节一

子节一正文

#### 子节二

子节二正文
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 1);
  assert.equal(axes[0].subsections.length, 2);
  assert.equal(axes[0].subsections[0].title, "子节一");
  assert.ok(
    axes[0].subsections[0].body.includes("子节一正文"),
    "子节正文应在 body 里",
  );
  assert.equal(axes[0].subsections[1].title, "子节二");
});

test("parseAxes：无斧头时返回空数组", () => {
  const md = `
## 最终目标

没有斧头

### 启动台

也没有
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 0);
});

test("parseAxes：空的 markdown 返回空数组", () => {
  const axes = parseAxes("");
  assert.equal(axes.length, 0);
});

test("parseAxes：只匹配「第X斧」开头的 ### 标题", () => {
  const md = `
### 概述

这不是斧头

### 第零斧：不应该出现

也不匹配（不是一二三）

### 第四斧：也不应该

也不匹配
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 0, "只有一二三斧才被识别");
});

test("parseAxes：正文保留表格/代码块等 markdown 结构", () => {
  const md = `
### 第一斧：测试

| 列1 | 列2 |
|-----|-----|
| A   | B   |

\`\`\`bash
echo hello
\`\`\`
`;
  const axes = parseAxes(md);
  assert.equal(axes.length, 1);
  assert.ok(axes[0].body.includes("| 列1"), "表格应保留");
  assert.ok(axes[0].body.includes("echo hello"), "代码块应保留");
});

// ---------------------------------------------------------------------------
// 1b. parsePathSelect 路径选择解析
// ---------------------------------------------------------------------------

test("parsePathSelect：拆出 intro / lazy / full 三段", () => {
  const md = `---
type: concept
id: ts-basics
---
# 标题

引导内容，介绍这门课要做什么。

<!-- PATH:LAZY START -->

## 🏃 偷懒版

这是偷懒版内容。

## 📚 完整版

这是完整版内容。

## 结语

不管你选了哪个版本，都不重要。
`;
  const result = parsePathSelect(md);
  assert.ok(result !== null, "应识别路径选择结构");
  assert.ok(result!.intro.includes("引导内容"), "intro 应包含引导段落");
  assert.ok(result!.lazy.includes("偷懒版内容"), "lazy 应包含偷懒版正文");
  assert.ok(result!.full.includes("完整版内容"), "full 应包含完整版正文");
  assert.ok(
    result!.full.includes("结语"),
    "完整版之后的结语也应包含在 full 中",
  );
});

test("parsePathSelect：不含路径标记时返回 null", () => {
  const md = `# 普通概念页

只有一段内容，没有 <!-- PATH:LAZY START --> 标记。`;
  const result = parsePathSelect(md);
  assert.equal(result, null, "无标记时应返回 null");
});

test("parsePathSelect：有标记但无完整版标题时返回 null", () => {
  const md = `# 不完整的路径

<!-- PATH:LAZY START -->

偷懒版内容

但没有完整版标题。`;
  const result = parsePathSelect(md);
  assert.equal(result, null, "缺少完整版标题应返回 null");
});

test("parsePathSelect：intro 不含 YAML frontmatter", () => {
  const md = `---
type: concept
id: python-basics
---
# Python 基础

这是真正的正文开始。

<!-- PATH:LAZY START -->

## 🏃 偷懒版

快速上手。

## 📚 完整版

系统学习。`;
  const result = parsePathSelect(md);
  assert.ok(result !== null);
  assert.equal(
    result!.intro.includes("type:"),
    false,
    "intro 不应包含 YAML front matter",
  );
  assert.ok(result!.intro.startsWith("#"), "intro 应以正文标题开头");
});

// ---------------------------------------------------------------------------
// 2. MODULE_ID_RE 正则
// ---------------------------------------------------------------------------

const MODULE_ID_RE = /^[a-z0-9-]+$/;

test("MODULE_ID_RE：放行合法模块 ID", () => {
  assert.ok(MODULE_ID_RE.test("platform-replica"));
  assert.ok(MODULE_ID_RE.test("python-basics"));
  assert.ok(MODULE_ID_RE.test("ts-basics"));
  assert.ok(MODULE_ID_RE.test("a"));
  assert.ok(MODULE_ID_RE.test("abc-123-def"));
});

test("MODULE_ID_RE：拒绝空字符串", () => {
  assert.equal(MODULE_ID_RE.test(""), false);
});

test("MODULE_ID_RE：拒绝含特殊字符的 ID", () => {
  assert.equal(MODULE_ID_RE.test("invalid!!!"), false, "含感叹号");
  assert.equal(MODULE_ID_RE.test("module name"), false, "含空格");
  assert.equal(MODULE_ID_RE.test("module_name"), false, "含下划线");
  assert.equal(MODULE_ID_RE.test("Module"), false, "含大写");
  assert.equal(MODULE_ID_RE.test("中文"), false, "含中文");
});

test("MODULE_ID_RE：拒绝路径穿越", () => {
  assert.equal(MODULE_ID_RE.test("../etc/passwd"), false);
  assert.equal(MODULE_ID_RE.test("..\\windows"), false);
  assert.equal(MODULE_ID_RE.test("./config"), false);
  assert.equal(MODULE_ID_RE.test("/etc/passwd"), false);
  assert.equal(MODULE_ID_RE.test("a/b"), false);
});

// ---------------------------------------------------------------------------
// 3. /api/module-content 端点（需服务器运行）
// ---------------------------------------------------------------------------

const BASE = "http://localhost:3000";

test("/api/module-content：platform-replica 返回 200 + 正文", async () => {
  const res = await fetch(
    `${BASE}/api/module-content?moduleId=platform-replica`,
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { content: string };
  assert.ok(typeof body.content === "string", "应有 content 字段");
  assert.ok(body.content.length > 100, "正文长度应 > 100 字符");
  // 正文不应包含 frontmatter（不应该以 --- 开头）
  assert.equal(body.content.startsWith("---"), false, "frontmatter 应已被切掉");
});

test("/api/module-content：ts-basics 返回 200", async () => {
  const res = await fetch(`${BASE}/api/module-content?moduleId=ts-basics`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { content: string };
  assert.ok(body.content.length > 100);
});

test("/api/module-content：python-basics 返回 200", async () => {
  const res = await fetch(`${BASE}/api/module-content?moduleId=python-basics`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { content: string };
  assert.ok(body.content.length > 100);
});

test("/api/module-content：非法 moduleId 返回 400", async () => {
  const res = await fetch(`${BASE}/api/module-content?moduleId=invalid!!!`);
  assert.equal(res.status, 400);
  const body = (await res.json()) as {
    error: { code: string; message: string };
  };
  assert.equal(body.error.code, "INVALID_INPUT");
  assert.ok(body.error.message, "应有错误信息");
});

test("/api/module-content：路径穿越返回 400", async () => {
  const res = await fetch(`${BASE}/api/module-content?moduleId=../etc/passwd`);
  assert.equal(res.status, 400);
});

test("/api/module-content：不存在的模块返回 404", async () => {
  const res = await fetch(
    `${BASE}/api/module-content?moduleId=nonexistent-module-xyz`,
  );
  assert.equal(res.status, 404);
  const body = (await res.json()) as {
    error: { code: string; message: string };
  };
  assert.equal(body.error.code, "NOT_FOUND");
  assert.ok(body.error.message.includes("不存在"), "404 消息应包含「不存在」");
});

test("/api/module-content：缺少 moduleId 参数返回 400", async () => {
  const res = await fetch(`${BASE}/api/module-content`);
  assert.equal(res.status, 400);
});

test("/api/module-content：空 moduleId 返回 400", async () => {
  const res = await fetch(`${BASE}/api/module-content?moduleId=`);
  assert.equal(res.status, 400);
});
