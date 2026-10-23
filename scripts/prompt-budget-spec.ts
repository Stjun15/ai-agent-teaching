/**
 * 提示词预算测试（不调模型）
 *
 * 守的是什么
 * ---------
 * 多轮历史是「全文拼进 prompt」的（见 loop.ts 的 `composeHistory`）。此前只有
 * 「最近 20 条」这一个上限，而**条数与 token 成本不成比例**：20 条长讲解
 * （每条数千字）能撑到十万字符量级，且它们会每一轮重复进 prompt。
 * 本组把「历史不会随会话长度线性膨胀」钉成可断言的事实。
 *
 * 为什么能用纯函数测
 * --------------
 * `composeHistory` / `composeUserPrompt` 都是「喂一组输入、比对字符串」的
 * 纯函数，不需要模型、不需要数据库。历史裁剪一旦出错，症状是「模型忽然答非所问」
 * 或「账单忽然变高」，两者都很难当场归因 —— 所以必须能用断言拦住。
 *
 * 运行：
 *   pnpm test:prompt-budget
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  HISTORY_CHAR_BUDGET,
  composeHistory,
  composeUserPrompt,
  type AgentHistoryTurn,
} from "@/lib/agent/loop";

/** 历史块的引导语，取自 composeHistory 的输出。 */
const GUIDE = "以下是本次会话此前的对话，用于理解上下文，不要在回答里复述它：";

test("空历史不产生任何输出（调用方可以直接拼接）", () => {
  assert.equal(composeHistory([]), "");
});

test("预算内的历史按原顺序完整保留", () => {
  const history: AgentHistoryTurn[] = [
    { role: "student", content: "什么是 LLM？" },
    { role: "assistant", content: "它是一种语言模型。" },
  ];

  const text = composeHistory(history);

  assert.ok(text.startsWith(GUIDE), "应带引导语");
  assert.ok(text.includes("学生：什么是 LLM？"));
  assert.ok(text.includes("助手：它是一种语言模型。"));
  assert.ok(
    text.indexOf("学生：") < text.indexOf("助手："),
    "顺序必须保持时间升序",
  );
});

test("超出预算时从最旧整条丢弃，最新一轮必留", () => {
  const history: AgentHistoryTurn[] = [
    // 单这一条就超过预算
    {
      role: "student",
      content: `最早的一条${"很".repeat(HISTORY_CHAR_BUDGET)}`,
    },
    { role: "assistant", content: "中间一条" },
    { role: "student", content: "最新一条" },
  ];

  const text = composeHistory(history);

  assert.ok(!text.includes("最早的一条"), "超预算的最早轮次应被整条丢弃");
  assert.ok(text.includes("中间一条"), "预算内的较新轮次应保留");
  assert.ok(text.includes("最新一条"), "最新一轮必须保留");
});

test("单条超预算时，唯一（且最新）的一轮仍保留", () => {
  const huge = "长".repeat(HISTORY_CHAR_BUDGET + 500);
  const text = composeHistory([{ role: "student", content: huge }]);

  assert.ok(
    text.includes(huge),
    "历史裁剪不该承担「单条超长」的约束 —— 那是调用方输入长度上限的职责；丢了这一条模型就看不到刚才在说什么",
  );
});

test("历史块以分隔线收尾，与用户输入隔开", () => {
  const text = composeHistory([{ role: "student", content: "在吗" }]);
  assert.ok(text.trimEnd().endsWith("---"), "应以 --- 收尾");
});

test("空代码不产生空代码围栏", () => {
  assert.equal(
    composeUserPrompt({ prompt: "帮我看看", code: "   " }),
    "帮我看看",
    "空白代码等同于没附代码，不该发出空围栏",
  );

  const withCode = composeUserPrompt({
    prompt: "帮我看看",
    code: "const a = 1;",
    language: "typescript",
  });
  assert.ok(
    withCode.includes("```typescript"),
    "语言后缀要带上（语法信息影响错误模式）",
  );
  assert.ok(withCode.includes("const a = 1;"));
});
