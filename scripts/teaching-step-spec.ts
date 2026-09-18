/**
 * 学习步骤 → 对话身份层 的规格测试
 *
 * 起因是学生的真实反馈：「概念讲解就一句话吗？应该先仔细讲讲，然后再给出
 * 实例，之后再让用户模仿。」
 *
 * 排查下来是一串叠加：学习页的对话一律用 `DEFAULT_AGENT_ID`（"chat"）
 * 配 loop 里的临时提示词，而那条提示词的准则写着「简洁直接，先给结论再给
 * 理由」—— 答疑的口径，讲概念就成了「一句话打发」。
 *
 * 这里钉三件事：
 *   1. 讲解三步一定由讲解导师接管，其余步骤一定不接管（防反谚：谁把
 *      validate 也塞进来，学生就会在对话流里看到点评 Agent 的 JSON 原文）；
 *   2. 教学提示词必须要求「讲透 + 实例 + 让学生动手」三个环节都在；
 *   3. **教学提示词里不许出现 JSON 输出契约**。这是最容易复发的一条：
 *      改提示词的人顺手从 TEACHER_SYSTEM_PROMPT 复制一段，那份要求输出
 *      `check_question` / `next_action`，而 SSE 是逐字吐给学生的 ——
 *      一旦带上，学生屏幕上就是一坨未解析的报文，且这类错在单元测试里
 *      通常看不出来（Zod 不会参与，因为聊天流压根不校验）。
 */

import test from "node:test";
import assert from "node:assert/strict";

import { resolveStepAgent } from "@/lib/agent/step-prompt";
import { TEACHING_CHAT_SYSTEM_PROMPT } from "@/lib/agent/prompts/teaching-chat";

test("讲解三步由讲解导师接管", () => {
  for (const step of ["explain", "observe", "imitate"] as const) {
    const spec = resolveStepAgent(step);
    assert.equal(spec.teaching, true, `${step} 应由讲解导师接管`);
    assert.equal(spec.systemPrompt, TEACHING_CHAT_SYSTEM_PROMPT);
  }
});

test("其余步骤保持通用答疑口径", () => {
  for (const step of [
    "validate",
    "visualize",
    "practice",
    "mastery",
  ] as const) {
    const spec = resolveStepAgent(step);
    assert.equal(spec.teaching, false, `${step} 不该由讲解导师接管`);
    // 空串 = 让 loop 用自己的默认值（见 step-prompt.ts 的注释）。
    assert.equal(spec.systemPrompt, "");
  }
});

test("教学提示词要求讲透 + 实例 + 学生动手", () => {
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /禁止一句话回答/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /打个比方/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /正经说清楚/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /看一个完整例子/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /容易引起|容易踩的坑/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /现在轮到你/);
  // 停在这里等学生动手 —— 不许自问自答
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /做完发给我/);
});

test("教学提示词不带任何 JSON 输出契约", () => {
  for (const marker of [
    "严格返回 JSON",
    "check_question",
    "next_action",
    "expected_keywords",
    "hint_levels",
  ]) {
    assert.ok(
      !TEACHING_CHAT_SYSTEM_PROMPT.includes(marker),
      `教学提示词不该要求输出 ${marker}：SSE 逐字吐给学生，学生会看到原始报文`,
    );
  }
});
