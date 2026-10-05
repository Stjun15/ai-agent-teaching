/**
 * 「提交点评」接线的规格测试（2026-09-19 接通 /api/agent/validate）
 *
 * 起因：零基础学生走查发现「提交点评」按钮一直禁用，注释写着
 * 「接线提交点：feat(integration)」—— 而讲解结尾让学生「做完发给我」。
 * 讲 → 模仿 → 批改的闭环断在批改，等于核心卖点没兑现。
 *
 * 这里钉三件事：
 *   1. 工作区必须挂接线组件（不许退回「禁用按钮 + 开发注释」）；
 *   2. 接线必须真的调 /api/agent/validate，且会话先建后用；
 *   3. 学生界面不得再出现开发者术语（提交点 / Phase / 原始场景 id /
 *      「接入 RAG」这类面向开发者的占位文案）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { moduleRubricSupplement } from "../src/lib/agent/skills/module-rubric";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("工作区挂的是接线组件，不是裸编辑器", () => {
  const workspace = read("../src/components/learn/module-workspace.tsx");
  assert.match(
    workspace,
    /<ValidateSubmit moduleId=\{teachingModule\.id\} \/>/,
    "动手模仿区必须挂 ValidateSubmit —— 裸 CodeEditor 意味着提交按钮禁用",
  );
  assert.doesNotMatch(
    workspace,
    /<CodeEditor \/>/,
    "裸 <CodeEditor /> 不该再出现（它的 onSubmit 是 undefined，按钮必禁用）",
  );
});

test("接线层真的调用点评端点，且会话先建后用", () => {
  const wiring = read("../src/components/code/validate-submit.tsx");
  assert.match(
    wiring,
    /apiPost<ValidateResponse>\("\/api\/agent\/validate"/,
    "必须调用 /api/agent/validate —— 这是点评闭环的核心一步",
  );
  assert.match(
    wiring,
    /apiPost<\{ sessionId: string \}>\("\/api\/session"/,
    "点评需要真实会话（服务端校验归属），必须在提交前创建会话",
  );
  // 会话的创建必须先于点评请求 —— 文本顺序在这里就是执行顺序。
  assert.ok(
    wiring.indexOf('/api/session"') < wiring.indexOf('/api/agent/validate"'),
    "会话创建必须出现在点评调用之前（首次提交时先开会话）",
  );
  assert.match(
    wiring,
    /usedFallback/,
    "响应里的 usedFallback 必须被消费 —— 兜底点评要明说「没能连上模型」，不能冒充真实批改",
  );
});

test("学生界面不泄漏开发者术语", () => {
  const studentFacing = [
    "../src/components/learn/module-workspace.tsx",
    "../src/components/chat/citation-panel.tsx",
    "../src/components/code/code-editor.tsx",
    "../src/components/chat/chat-panel.tsx",
    "../src/components/chat/visualization-panel.tsx",
    "../src/components/chat/token-counter.tsx",
    "../src/components/chat/agent-timeline.tsx",
  ];
  for (const file of studentFacing) {
    const text = read(file);
    assert.doesNotMatch(
      text,
      /接线提交点|feat\([a-z-]+\)|Phase \d 提交点/,
      `${file} 面向学生，不得出现提交点 / commit 号这类开发术语`,
    );
    assert.doesNotMatch(
      text,
      /接入检索（RAG）/,
      `${file} 不得用「接入检索（RAG）后」这种开发者口吻解释空态`,
    );
  }

  // 原始场景 id 不得直接渲染（有 SCENE_LABELS 映射表不用等于偷懒）。
  const workspace = read("../src/components/learn/module-workspace.tsx");
  assert.doesNotMatch(
    workspace,
    /\{teachingModule\.sceneId\}<\/Badge>/,
    "场景徽标必须显示中文名（SCENE_LABELS），不能渲染 scene-xxx 原始 id",
  );
});

test("工作区常驻当前步横幅（切步反馈不能只靠左栏高亮）", () => {
  // 零基础走查（2026-09-19）：七步共用同一工作区，步骤 1–4 切步只有左栏
  // 高亮和描述在变，学生感知不到「切步发生了」。守卫钉住中栏顶部的横幅：
  // 它渲染当前步序号与名称，数据必须来自 LEARNING_STEPS（不写第二份步骤表）。
  const workspace = read("../src/components/learn/module-workspace.tsx");
  assert.match(
    workspace,
    /LEARNING_STEPS\.find\(\(step\) => step\.id === currentStepId\)/,
    "横幅数据必须来自 LEARNING_STEPS —— 在模块元数据之外抄步骤表是禁忌",
  );
  assert.match(
    workspace,
    /第 \{stepIndex\(currentStep\.id\) \+ 1\} \/ \{LEARNING_STEPS\.length\} 步/,
    "中栏必须常驻「第 N / 7 步 · 名称」横幅，只换左栏高亮不算切步反馈",
  );
});

test("点评路径必须更新掌握度（设计数据职责的第三张表）", () => {
  // `02-agent-system.md`「数据职责」：点评 Agent 写 prompts / errors / mastery。
  // 前两张表此前已接线，mastery 一直零写入 —— 点评通过也抬不动掌握度，
  // 前置门槛永远停在种子分，掌握式学习的「测评 → 解锁」循环走不动。
  // 本守卫钉住两条点评路径都必须调 masteryDb.update，且量纲换算必须走
  // scores.ts 的共享函数（两边各写一个 `/ 20` 是迟早的分叉）。
  for (const route of [
    "../src/app/api/agent/validate/route.ts",
    "../src/app/api/agent/answer-grade/route.ts",
  ]) {
    const text = read(route);
    assert.match(
      text,
      /masteryDb\.update\(/,
      `${route} 必须更新掌握度 —— 这是「点评 → 解锁」闭环的关键一条`,
    );
    assert.match(
      text,
      /masteryScoreFromPromptScore\(/,
      `${route} 的量纲换算必须走 scores.ts 共享口径，不得手写 / 20`,
    );
  }
});

test("复刻检验单必须按验收清单评分（rubric 模块定制）", () => {
  // HANDOFF 待办 2（2026-10-05）：复刻的点评对象是最终交付，检验单此前
  // 按通用四维（参数/返回值/边界/可读性）打分，评不出「这台车能不能跑」。
  // 定制分两层钉住：
  //   ① skills 层有复刻追加段（怎么按清单评 + 无证据不编分的诚实条款）；
  //   ② 题面（七条清单）由路由从 wiki 现读经 question_text 下发 —— 清单
  //      唯一事实源是概念页，追加段与路由都不得抄一份清单正文。
  const supplement = moduleRubricSupplement("platform-replica");
  assert.ok(supplement, "复刻模块必须返回 rubric 追加段");
  assert.match(supplement, /验收清单/, "追加段必须以验收清单为评分依据");
  assert.match(
    supplement,
    /不得给分、不得扣分/,
    "无证据条目不得编分的诚实条款必须在场",
  );
  assert.doesNotMatch(
    supplement,
    /- \[ \]/,
    "追加段不得复制清单正文 —— wiki 是唯一事实源，抄一份必然漂移",
  );
  assert.equal(
    moduleRubricSupplement("llm-api"),
    undefined,
    "非复刻模块不得被追加 —— 通用四维是九讲的正确口径",
  );

  // 拼接链路：validation-loop 取追加段，runtime 拼到 Skill 内容尾部
  //（skill id 与 allowedSkills 白名单不变 —— 铁律 3 的收敛不能绕）。
  const loop = read("../src/lib/agent/orchestrator/validation-loop.ts");
  assert.match(
    loop,
    /moduleRubricSupplement\(/,
    "validation-loop 必须按模块取追加段",
  );
  const runtime = read("../src/lib/agent/runtime.ts");
  assert.match(
    runtime,
    /skillSupplement/,
    "runtime 必须有 skillSupplement 拼接通道",
  );

  // 题面：复刻点评必须带 wiki 现读的验收清单；其他模块不带。
  const route = read("../src/app/api/agent/validate/route.ts");
  assert.match(
    route,
    /REPLICA_ACCEPTANCE_MODULE/,
    "路由必须按模块键控题面（只有复刻带验收清单）",
  );
  assert.match(
    route,
    /readPracticeTask\(/,
    "题面必须从概念页「动手任务」节现读，不得内联一份清单常量",
  );

  // 事实源健康：清单真在概念页里（页面被改名/删节时这里先红）。
  const wiki = read("../llm-wiki/concepts/platform-replica.md");
  assert.match(wiki, /## 动手任务：最终验收/);
  assert.match(wiki, /- \[ \] 能跟 AI 实时对话/);
});
