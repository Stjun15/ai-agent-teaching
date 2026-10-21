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

import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import { resolveStepAgent } from "@/lib/agent/step-prompt";
import {
  TEACHING_CHAT_SYSTEM_PROMPT,
  TEACHING_EXPLAIN_PROMPT,
} from "@/lib/agent/prompts/teaching-chat";
import { ChatRequestSchema } from "@/schemas";

test("讲解三步由讲解导师接管", () => {
  // explain 拿专用提示词（无动手），observe / imitate 拿完整版（含动手）
  {
    const spec = resolveStepAgent("explain");
    assert.equal(spec.teaching, true, "explain 应由讲解导师接管");
    assert.equal(
      spec.systemPrompt,
      TEACHING_EXPLAIN_PROMPT,
      "explain 应走无动手版提示词",
    );
  }
  for (const step of ["observe", "imitate"] as const) {
    const spec = resolveStepAgent(step);
    assert.equal(spec.teaching, true, `${step} 应由讲解导师接管`);
    assert.equal(
      spec.systemPrompt,
      TEACHING_CHAT_SYSTEM_PROMPT,
      `${step} 应走含动手版提示词`,
    );
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

test("教学提示词要求讲透 + 实例", () => {
  // observe / imitate 版：讲透 + 实例 + 双任务守门（不另出题）
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /禁止一句话回答/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /打个比方/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /正经说清楚/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /看一个完整例子/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /容易引起|容易踩的坑/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /现在轮到你/);
  assert.match(TEACHING_CHAT_SYSTEM_PROMPT, /不要另出一道新任务/);
  // explain 版：讲透 + 实例，但**没有**动手环节
  assert.match(TEACHING_EXPLAIN_PROMPT, /禁止一句话回答/);
  // 2026-10-01：旧结构第一节是「🚪 门禁确认」，会把「编排层没有提示前置
  // 掌握度不足」这类系统术语直接讲给学生（与铁律 5 冲突）。改为学生视角
  // 的「开场」——守卫双向钉住：新结构在，旧术语不出。
  assert.match(TEACHING_EXPLAIN_PROMPT, /### 开场/);
  assert.match(TEACHING_EXPLAIN_PROMPT, /不需要任何基础/);
  assert.match(TEACHING_EXPLAIN_PROMPT, /为什么需要/);
  assert.match(TEACHING_EXPLAIN_PROMPT, /核心概念/);
  assert.match(TEACHING_EXPLAIN_PROMPT, /防踩坑/);
  assert.match(TEACHING_EXPLAIN_PROMPT, /概念测验/);
  assert.match(TEACHING_EXPLAIN_PROMPT, /通关宣告/);
  assert.ok(
    !/🚪|门禁通过|编排层提示|编排层没有提示/.test(TEACHING_EXPLAIN_PROMPT),
    "讲解提示词的结构节不得指挥模型输出系统内部术语（铁律 5 枚举的禁用词本身除外）",
  );
  // 2026-10-07 审计 C2：任务卡（assignment-card）从 explain 讲稿抽
  // 「五、现在轮到你」整节，10-01 门禁化时把它从 explain 提示词删掉，
  // 11/11 模块缓存缺任务节、模仿页任务卡全站消失。新不变量双向钉住：
  // 任务节必须在（缓存里要有），但配「输出节奏」声明压住「停在这里」
  // 的互动语义（不许停在测验），且概念讲解页渲染时 truncate 会把本节
  // 截掉——学生看不见，守卫只管提示词与缓存的口径。
  assert.match(
    TEACHING_EXPLAIN_PROMPT,
    /现在轮到你/,
    "explain 提示词必须包含任务节（模仿页任务卡的唯一来源）",
  );
  assert.match(
    TEACHING_EXPLAIN_PROMPT,
    /做完发给我/,
    "explain 提示词的任务节必须有可验证的收尾口径",
  );
  assert.match(
    TEACHING_EXPLAIN_PROMPT,
    /开场讲稿是一次性输出/,
    "必须有输出节奏声明压住「停在这里」，否则讲稿截断在测验（C2 根因）",
  );
});

test("教学提示词不带任何 JSON 输出契约", () => {
  for (const prompt of [TEACHING_CHAT_SYSTEM_PROMPT, TEACHING_EXPLAIN_PROMPT]) {
    for (const marker of [
      "严格返回 JSON",
      "check_question",
      "next_action",
      "expected_keywords",
      "hint_levels",
    ]) {
      assert.ok(
        !prompt.includes(marker),
        `教学提示词不该要求输出 ${marker}：SSE 逐字吐给学生，学生会看到原始报文`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 2026-09-19 补：/api/chat 也要按步骤选导师
//
// 起因是一次**真实踩坑**：第一版只接了落库端点 `/api/session/[id]/message`，
// 但学习页输入框实际走的是不落库的 `/api/chat`（`useChatStream()` 默认
// url）—— 「讲透 + 实例 + 模仿」在用户真正用的那条路上根本没生效。
// 守卫方式沿用 student-records-wiring-spec 的文本断言：这两条路由没有
// 可直接调用的纯函数出口，文本是最诚实的钉子。
// ---------------------------------------------------------------------------

test("step 缺省时走通用答疑口径（演练场自由对话不受影响）", () => {
  for (const step of [undefined, null]) {
    const spec = resolveStepAgent(step);
    assert.equal(spec.teaching, false);
    assert.equal(spec.systemPrompt, "");
  }
});

test("ChatRequestSchema 接受七个合法步骤、拒绝编造的", () => {
  for (const step of [
    "explain",
    "observe",
    "imitate",
    "validate",
    "visualize",
    "practice",
    "mastery",
  ]) {
    const parsed = ChatRequestSchema.safeParse({ content: "hi", step });
    assert.equal(parsed.success, true, `${step} 应是合法 step`);
  }
  assert.equal(
    ChatRequestSchema.safeParse({ content: "hi", step: "play" }).success,
    false,
    "编造的 step 必须被 Zod 拒掉",
  );
  // 缺省合法：演练场不带 step。
  assert.equal(ChatRequestSchema.safeParse({ content: "hi" }).success, true);
});

test("两条对话管道都按步骤选导师（文本守卫）", () => {
  const chatRoute = readFileSync(
    new URL("../src/app/api/chat/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    chatRoute,
    /resolveStepAgent\(parsed\.data\.step\)/,
    "/api/chat 必须按请求体里的 step 选身份层 —— 学习页输入框走的就是这条管道",
  );

  const composer = readFileSync(
    new URL("../src/components/chat/composer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    composer,
    /\?\s*\{\s*step\s*\}/,
    "Composer 必须把学习步骤随消息发出去",
  );
});

test("讲解步骤自动开讲，且不发假提问（文本守卫）", () => {
  const launcher = readFileSync(
    new URL("../src/components/chat/lecture-launcher.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    launcher,
    /silent:\s*true/,
    "自动开讲必须静默 —— 对话里不能冒出「请讲讲…」的假学生消息（2026-09-19 学生反馈：进去就该直接讲）",
  );
  assert.match(
    launcher,
    /send\(\{\s*content:\s*prompt,\s*step\s*\}/,
    "自动开场必须把步骤随请求带上，否则退回答疑口径",
  );
  assert.match(
    launcher,
    /messages\.some\(\(message\) => message\.step === step\)\) return/,
    "该步骤已有消息时不得自动插话 —— 按 step 判而不是按 messages.length 判：" +
      "讲解三步共用一个对话区，讲解步留下的消息不该挡死示范步的开场（2026-09-19 改）",
  );

  const workspace = readFileSync(
    new URL("../src/components/learn/module-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workspace, /LectureLauncher/, "模块工作区必须挂自动开讲组件");
  // 讲解与观察示范都要自动开场（观察示范此前是空白对话区，学生不知道干什么）；
  // 动手模仿不得自动开场 —— 那一步的主体是学生自己写。
  assert.match(
    workspace,
    /currentStepId === "explain"/,
    "概念讲解步必须挂自动开讲组件",
  );
  // 2026-09-26：观察示范改为读 wiki 示范代码（零模型调用、零等待），
  // 不再自动开讲 —— 守卫钉住 AUTO_LECTURE_STEPS 不含 observe，
  // 防止将来有人把 observe 悄悄加回自动开讲。
  const openers = readFileSync(
    new URL("../src/lib/lecture-openers.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    openers,
    /AUTO_LECTURE_STEPS = \["explain"\] as const/,
    "自动开讲只允许 explain —— observe 的示范代码走 wiki 直读",
  );
  assert.match(workspace, /LectureLauncher/g, "讲解步应自动开场");
  const launcherCount = (workspace.match(/<LectureLauncher/g) || []).length;
  assert.ok(
    launcherCount >= 1,
    `LectureLauncher 应至少挂载一次（当前 ${launcherCount} 次；文件长度 ${workspace.length}）`,
  );
  assert.match(
    workspace,
    /step=\{currentStepId\}/,
    "开场组件必须拿到当前步骤（两个步骤用不同的开场词）",
  );
  assert.doesNotMatch(
    workspace,
    /starter/,
    "starter 按钮已移除 —— 不许再加回来让学生自己点「请讲讲…」",
  );

  const store = readFileSync(
    new URL("../src/stores/session.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    store,
    /options\?\.silent === true/,
    "beginTurn 必须支持静默（不落学生消息）",
  );
});