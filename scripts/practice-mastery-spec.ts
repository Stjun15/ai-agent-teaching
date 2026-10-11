/**
 * 变式练习 / 掌握判定接线守卫
 *
 * 背景（2026-09-19）：零基础走查发现七步的 practice / mastery 两步点进去
 * 没有任何界面内容，而出题与评分端点早就建好 —— 本组钉住「消费方接线」
 * 的关键约束，防止将来重构把学生刚走通的路又悄悄断掉。
 *
 * 钉什么：
 * 1. **答案不泄漏** —— 出题响应原样带着 `correct_answer`，渲染形状必须剥掉
 *    它。这是「靠不渲染」升级成「字段根本不在展示类型里」的编译期保证。
 * 2. **兜底诚实** —— `usedFallback` 必须被消费（面板要明说分数不算数），
 *    与点评面板同一纪律。
 * 3. **先开会话再评分** —— answer-grade 校验会话归属，面板必须先建会话。
 * 4. **两条路由各自挂对面板**，且判定线用共享常量 `MASTERY_PASS_SCORE`
 *    （与学习路径解锁同一档，不允许第二处写死 3）。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("出题响应的答案字段不得进入展示类型（文本守卫）", () => {
  const source = read("../src/hooks/use-practice.ts");
  const card = read("../src/components/learn/practice-question-card.tsx");

  // 展示用的 DisplayQuestion 必须存在且不含答案字段。
  const displayMatch = card.match(
    /export interface DisplayQuestion \{[\s\S]*?\n\}/,
  );
  assert.ok(displayMatch !== null, "DisplayQuestion 接口必须存在");
  assert.doesNotMatch(
    displayMatch[0],
    /correct_answer|correctAnswer|explanation/,
    "展示形状不得携带 correct_answer / explanation —— 泄题必须是类型层面的不可能，而不是「不渲染」",
  );

  // 原始形状（snake_case）与归一化点存在 —— 说明确实做过剥离。
  assert.match(
    card,
    /export interface RawQuestion [\s\S]*?correct_answer: string;/,
    "原始响应形状要如实声明 correct_answer（路由原样透传模型输出）",
  );
  assert.match(
    source,
    /map\(\(raw\) => \(\{/,
    "渲染前必须经归一化剥离答案字段",
  );
  assert.match(
    source,
    /questions:\s*RawQuestion\[\]/,
    "出题响应必须如实声明为 RawQuestion[]（含答案字段），由归一化点显式剥掉",
  );
});

test("评分兜底必须被诚实消费（文本守卫）", () => {
  const source = read("../src/hooks/use-practice.ts");
  const panel = read("../src/components/learn/practice-panel.tsx");
  assert.match(
    source,
    /anyFallback/,
    "usedFallback 必须被聚合并展示 —— 兜底的 0 分是编的，学生不能当真",
  );
  assert.match(
    panel,
    /没能连上/,
    "兜底提示要说明「没能连上模型」而不是静默显示占位分",
  );
  // 出题兜底（题目本身是编的）直接退回，不展示假题。
  assert.match(
    source,
    /result\.usedFallback/,
    "出题响应的 usedFallback 必须被检查 —— 兜底题目没有可判分的正确答案",
  );
});

test("先开会话、再逐题评分（文本守卫）", () => {
  const source = read("../src/hooks/use-practice.ts");
  const sessionAt = source.indexOf('"/api/session"');
  const gradeAt = source.indexOf('"/api/agent/answer-grade"');
  assert.ok(sessionAt !== -1, "必须通过 POST /api/session 开真实会话");
  assert.ok(gradeAt !== -1, "必须调用 /api/agent/answer-grade 评分");
  assert.ok(
    sessionAt < gradeAt,
    "会话创建必须在评分调用之前定义 —— answer-grade 校验会话归属",
  );
});

test("practice / mastery 两步各挂对面板，判定线用共享常量", () => {
  const workspace = read("../src/components/learn/module-workspace.tsx");
  assert.match(
    workspace,
    /currentStepId === "practice" \? \(\s*<Card>[\s\S]*?<PracticePanel moduleId=\{teachingModule\.id\} \/>/,
    "practice 步必须挂 PracticePanel",
  );
  assert.match(
    workspace,
    /currentStepId === "mastery" \? \(\s*(?:<>[\s\S]*?)?<Card>[\s\S]*?<MasteryCheck/,
    "mastery 步必须挂 MasteryCheck（允许包一层 Fragment）",
  );

  const check = read("../src/components/learn/mastery-check.tsx");
  assert.match(
    check,
    /MASTERY_PASS_SCORE/,
    "判定线必须用 scores.ts 的共享常量 —— 与下一讲解锁是同一条线，不许第二处写死 3",
  );
  assert.match(
    check,
    /nextModule/,
    "判定通过后要给出下一讲入口 —— 判定不含行动建议就只是个分数",
  );
});

test("出题与评分端点的落库契约未被面板绕过（文本守卫）", () => {
  const source = read("../src/components/learn/practice-panel.tsx");
  assert.doesNotMatch(
    source,
    /@\/lib\/db|node:sqlite|questionResultDb|errorDb/,
    "面板不得直接碰数据层 —— question_results / errors 的写入只发生在 answer-grade 路由内（分层约定）",
  );
});
