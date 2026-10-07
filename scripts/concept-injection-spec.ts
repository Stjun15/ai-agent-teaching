/**
 * 概念页注入链路回归
 *
 * 钉什么
 * -----
 * 1. ts-basics 概念页开场白含定位段落「这是哪一站」，
 *    确保学生看到的冷启动卡片讲清了这一讲的定位。
 * 2. resolveStepAgent('explain') 返回讲解导师，系统提示词不为空。
 * 3. 概念页 body（去 frontmatter）能被 parsePathSelect 正确拆出 intro 与
 *    两版路径 —— 但不在这里重复已覆盖的解析测试，只测「文件结构未损坏」。
 *
 * 全组不调模型。
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveStepAgent } from "@/lib/agent/step-prompt";

function stripConceptFrontmatter(raw: string): string {
  const text = raw.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return text;
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (end === -1) return text;
  return lines
    .slice(end + 1)
    .join("\n")
    .replace(/^\n+/, "");
}

function readConceptBody(moduleId: string): string {
  const filePath = resolve(
    process.cwd(),
    "llm-wiki/concepts",
    `${moduleId}.md`,
  );
  const raw = readFileSync(filePath, "utf-8");
  return stripConceptFrontmatter(raw);
}

// ---------------------------------------------------------------------------
// ① 概念页开场白 ——「这是哪一站」
// ---------------------------------------------------------------------------

test("ts-basics：开场白含定位段落「为什么需要这一站」与引导句式", () => {
  const body = readConceptBody("ts-basics");
  assert.ok(
    body.includes("为什么需要这一站"),
    "ts-basics 应包含「为什么需要这一站」章节",
  );
  assert.ok(
    body.includes("看完开场白就可以进 LLM API"),
    "应包含「看完开场白就可以进 LLM API」引导句",
  );
});

// ---------------------------------------------------------------------------
// ② 概念页路径标记完整 —— PATH:LAZY 与「完整版」标记都在
// ---------------------------------------------------------------------------

test("ts-basics：PATH:LAZY 与完整版标记均在", () => {
  const body = readConceptBody("ts-basics");
  assert.ok(
    body.includes("<!-- PATH:LAZY START -->"),
    "ts-basics 应包含偷懒版起始标记",
  );
  assert.ok(
    body.includes("## \u{1F4DA} 完整版"),
    "ts-basics 应包含完整版章节标题",
  );
});

// ---------------------------------------------------------------------------
// ③ resolveStepAgent —— explain 步骤走讲解导师
// ---------------------------------------------------------------------------

test("resolveStepAgent('explain') 返回讲解导师，systemPrompt 非空", () => {
  const spec = resolveStepAgent("explain");
  assert.equal(spec.teaching, true, "explain 步骤应为 teaching=true");
  assert.ok(spec.systemPrompt.length > 0, "讲解导师的 systemPrompt 不应为空");
  assert.ok(
    spec.systemPrompt.includes("讲解"),
    "systemPrompt 应包含「讲解」关键词",
  );
});
