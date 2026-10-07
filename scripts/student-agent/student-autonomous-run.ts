/**
 * 学生 Agent 自主学习全流程 —— 有视力的零基础学生独立完成一个模块
 *
 * 架构
 * ----
 * See    → 屏幕描述器提取当前页面的语义区域
 * Decide → 基于屏幕内容 + 认知状态 + 历史，决定下一步做什么
 * Act    → Playwright 在浏览器里执行动作
 * Verify → 理解验证器判断学生是否真的懂了
 * Loop   → 重复直到七步走完或学生放弃
 *
 * 认知状态机（约束）
 * ----------------
 * normal → stuck：连续两次验证分 < 40%
 * confused → normal：VLM 探针通过
 * stuck → giving_up：连续三个步骤没有任何产出
 * overconfident → confused：VLM 探针未通过（傲慢被打脸）
 *
 * 运行
 * ----
 * node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/student-agent/student-autonomous-run.ts --module=ts-basics
 *
 * 前置：pnpm dev 在 localhost:3311
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  describePage,
  closeBrowser,
} from "@/lib/agent/student/screen-describer";
import { executeAction } from "@/lib/agent/student/action-executor";
import {
  generateProbe,
  evaluateProbeAnswer,
  verifyComprehension,
  summarizeComprehension,
} from "@/lib/agent/student/comprehension-verifier";
import type {
  ScreenState,
  StudentAction,
  CognitiveState,
} from "@/lib/agent/student/types";
import type {
  ComprehensionProbe,
  ComprehensionReport,
} from "@/lib/agent/student/comprehension-verifier";
import type { ScreenDescriberOptions } from "@/lib/agent/student/types";
import { ARK_API_KEY_ENV, ARK_DEFAULT_BASE_URL } from "@/lib/agent/ark-config";

const OUT_DIR = path.resolve("student-agent-output");
mkdirSync(OUT_DIR, { recursive: true });

const STUDENT_ID = "a9e70000-0000-4000-8000-0000000000a1";
const BASE_URL = process.env.TEACHING_BASE_URL ?? "http://localhost:3311";

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined =>
  args
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");

const moduleId = getArg("module") ?? "ts-basics";

const LEARNING_STEPS = [
  { id: "explain", label: "概念讲解", next: "observe" },
  { id: "observe", label: "观察示范", next: "imitate" },
  { id: "imitate", label: "动手模仿", next: "review" },
  { id: "review", label: "校验点评", next: "visualize" },
  { id: "visualize", label: "可视化", next: "variant" },
  { id: "variant", label: "变式练习", next: "mastery" },
  { id: "mastery", label: "掌握判定", next: null },
];

async function registerAndGetToken(): Promise<string | null> {
  const username = `agent-autonomous-${Date.now()}`;
  const password = "vision-agent-test-2026";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!loginRes.ok) return null;
      const body = (await loginRes.json()) as { token?: string };
      return body.token ?? null;
    }
    const body = (await res.json()) as { token?: string };
    return body.token ?? null;
  } catch {
    return null;
  }
}

function tick(
  label: string,
  _steps: {
    step: string;
    action: string;
    result: string;
    probeScore?: number;
  }[],
): void {
  const step = LEARNING_STEPS.find((s) => s.id === label);
  const idx = step ? LEARNING_STEPS.indexOf(step) + 1 : "?";
  console.log(
    `\n━━━ 步骤 ${idx}/${LEARNING_STEPS.length}：${step?.label ?? label} ━━━`,
  );
}

// ---- 认知状态机 ----
function updateCognitiveState(
  current: CognitiveState,
  comprehensionScore: number,
  consecutiveProbeFails: number,
  consecutiveZeroProductivity: number,
): {
  next: CognitiveState;
  reason: string;
} {
  // 连续两次验证分 < 40% → confused
  if (comprehensionScore < 0.4 && consecutiveProbeFails >= 2) {
    return {
      next: "confused",
      reason: `连续 ${consecutiveProbeFails} 次验证不及格`,
    };
  }

  // 连续三个步骤没有任何产出 → stuck
  if (consecutiveZeroProductivity >= 3) {
    return {
      next: "stuck",
      reason: `连续 ${consecutiveZeroProductivity} 个步骤无产出`,
    };
  }

  // stuck 太久了 → giving_up
  if (
    current === "stuck" &&
    comprehensionScore < 0.2 &&
    consecutiveZeroProductivity >= 4
  ) {
    return { next: "giving_up", reason: "陷入卡壳过久，放弃" };
  }

  // overconfident + 验证未通过 → confused（傲慢被打脸）
  if (current === "overconfident" && comprehensionScore < 0.5) {
    return { next: "confused", reason: "自以为懂但验证未通过" };
  }

  // confused + 最近一次通过 → normal
  if (current === "confused" && comprehensionScore >= 0.6) {
    return { next: "normal", reason: "困惑中抓住了一条线索" };
  }

  // 高验证分 → 保持/回归 normal
  if (comprehensionScore >= 0.7) {
    if (current !== "normal") {
      return { next: "normal", reason: "理解度回升" };
    }
  }

  return { next: current, reason: "状态保持" };
}

// ---- 决策引擎：基于屏幕内容决定下一步 ----
function decideAction(
  state: ScreenState,
  cognitiveState: CognitiveState,
  stepId: string,
  probe: ComprehensionProbe | null,
  roundInStep: number,
): StudentAction {
  const chatRegion = state.regions.find((r) => r.type === "chat-messages");
  const composerRegion = state.regions.find((r) => r.type === "composer");
  const codeRegion = state.regions.find((r) => r.type === "code-editor");
  const hasChat = !!(chatRegion && chatRegion.content.length > 10);
  const hasCode = !!(codeRegion && codeRegion.content.length > 10);
  const hasComposer = !!composerRegion;

  // giving_up → 直接退出
  if (cognitiveState === "giving_up") {
    return {
      type: "give_up",
      target: "当前步骤",
      hesitationMs: 2000,
      cognitiveState: "giving_up",
    };
  }

  // 有未回答的探针 → 优先回答
  if (probe && hasComposer && roundInStep > 0) {
    return {
      type: "ask",
      target: "输入框",
      question: generateProbeAnswer(probe, cognitiveState),
      hesitationMs: 3000 + Math.floor(Math.random() * 4000),
      cognitiveState,
    };
  }

  // 在概念讲解步骤：看懂了文字 → 提问
  if (stepId === "explain" && hasChat && hasComposer && roundInStep === 0) {
    const questions = pickQuestionForStep("explain", cognitiveState, state);
    return {
      type: "ask",
      target: "输入框",
      question: questions[roundInStep % questions.length],
      hesitationMs: 2000 + Math.floor(Math.random() * 3000),
      cognitiveState,
    };
  }

  // 在观察/模仿步骤：有代码编辑器 → 尝试修改/写代码
  if (
    (stepId === "observe" || stepId === "imitate") &&
    hasCode &&
    hasComposer
  ) {
    if (cognitiveState === "confused" || cognitiveState === "stuck") {
      return {
        type: "ask",
        target: "输入框",
        question: "能不能给我一点提示？我不知道从哪里开始。",
        hesitationMs: 5000,
        cognitiveState,
      };
    }
    return {
      type: "click",
      target: "讲解完毕，进入观察示范",
      hesitationMs: 3000,
      cognitiveState,
    };
  }

  // 尝试进入下一步
  const stepInfo = LEARNING_STEPS.find((s) => s.id === stepId);
  if (stepInfo?.next && roundInStep >= 2) {
    const nextStep = LEARNING_STEPS.find((s) => s.id === stepInfo.next);
    if (nextStep) {
      const navRegion = state.regions.find(
        (r) => r.type === "step-nav" && r.content.includes(nextStep.label),
      );
      if (navRegion) {
        return {
          type: "navigate",
          target: `/learn/${moduleId}/${stepInfo.next}`,
          hesitationMs: 2000,
          cognitiveState,
        };
      }
    }
  }

  // 默认：等待（阅读）
  return {
    type: "wait",
    target: "3000",
    hesitationMs: 0,
    cognitiveState,
  };
}

/** 根据认知状态和屏幕内容选择提问。 */
function pickQuestionForStep(
  _stepId: string,
  cognitiveState: CognitiveState,
  state: ScreenState,
): string[] {
  const chatContent =
    state.regions
      .find((r) => r.type === "chat-messages")
      ?.content.toLowerCase() ?? "";

  const hasTokenDecomposition =
    chatContent.includes("任务分解") || chatContent.includes("拆");
  const hasTokenFunction =
    chatContent.includes("函数") || chatContent.includes("def");
  const hasTokenLoop =
    chatContent.includes("循环") || chatContent.includes("for");
  const hasTokenVariable =
    chatContent.includes("变量") || chatContent.includes("赋值");

  if (cognitiveState === "confused") {
    return [
      "我有点跟不上，能不能用更简单的话讲一遍？",
      "这部分我没看懂，可以用生活中的例子解释吗？",
      "不好意思，刚才那段能再讲一次吗？",
    ];
  }

  if (cognitiveState === "overconfident") {
    return [
      "这个我大概懂了，是不是就是……算了你直接说下一步吧",
      "看起来不难，我可以试试",
    ];
  }

  const contextQuestions: string[] = [];
  if (hasTokenDecomposition) {
    contextQuestions.push("任务分解和写代码有什么关系啊？能不能举个例子？");
  }
  if (hasTokenFunction) {
    contextQuestions.push("你说的函数是什么意思？就是数学里的函数吗？");
  }
  if (hasTokenLoop) {
    contextQuestions.push("循环是什么？就是不停地做一件事情吗？");
  }
  if (hasTokenVariable) {
    contextQuestions.push("变量是干什么用的？为什么要叫变量？");
  }

  if (contextQuestions.length > 0) return contextQuestions;

  return [
    "这个知识点在实际项目中怎么用？",
    "能不能演示一段代码看看？",
    "这个和前面学的有什么联系？",
  ];
}

/** 根据探针合预测学生回答质量。未来由 persona 引擎接管。 */
function generateProbeAnswer(
  probe: ComprehensionProbe,
  cognitiveState: CognitiveState,
): string {
  if (cognitiveState === "confused" || cognitiveState === "stuck") {
    const confusedReplies = [
      "我不太确定……好像是先……不对我忘了",
      "对不起，我没记住。能再讲一遍吗？",
      "我猜应该是先定菜单，然后买菜……剩下的记不清了",
    ];
    return confusedReplies[Math.floor(Math.random() * confusedReplies.length)];
  }

  if (cognitiveState === "overconfident") {
    return (
      "这个太简单了，就是" + (probe.groundTruth.slice(0, 50) || "那个东西")
    );
  }

  // normal：尝试基于 groundTruth 转述
  if (probe.groundTruth.length > 20) {
    return "我觉得" + probe.groundTruth.slice(0, 120) + "……大概就是这样吧";
  }

  return "我看到的好像是" + (probe.groundTruth || "那个内容") + "……对吗？";
}

// ---- 主流程 ----

interface StepLog {
  step: string;
  action: string;
  result: string;
  comprehensionScore: number;
  cognitiveState: CognitiveState;
}

interface RunLog {
  moduleId: string;
  startTime: string;
  steps: StepLog[];
  comprehensionReports: ComprehensionReport[];
}

async function main(): Promise<void> {
  const apiKey = process.env[ARK_API_KEY_ENV];
  if (!apiKey) {
    console.error(`缺少环境变量 ${ARK_API_KEY_ENV}`);
    process.exit(1);
  }

  const options: ScreenDescriberOptions = {
    baseUrl: BASE_URL,
    studentId: STUDENT_ID,
    visionModel: process.env.ARK_VISION_MODEL ?? "doubao-seed-2-1-pro-260915",
    visionApiKey: apiKey,
    visionBaseUrl: process.env.ARK_BASE_URL ?? ARK_DEFAULT_BASE_URL,
  };

  console.log("🔑 注册身份…");
  const token = await registerAndGetToken();
  if (!token) {
    console.error("鉴权失败");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ "x-student-id": STUDENT_ID });
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: "ai-teaching:authToken", value: token },
  );

  const runLog: RunLog = {
    moduleId,
    startTime: new Date().toISOString(),
    steps: [],
    comprehensionReports: [],
  };

  let cognitiveState: CognitiveState = "normal";
  let consecutiveProbeFails = 0;
  let consecutiveZeroProductivity = 0;
  let pendingProbe: ComprehensionProbe | null = null;
  const previousActions: StudentAction[] = [];

  console.log(`\n🎓 学生 Agent 自主学习开始`);
  console.log(`   模块：${moduleId}`);
  console.log(`   初始认知状态：${cognitiveState}`);
  console.log("=".repeat(60));

  for (let stepIdx = 0; stepIdx < LEARNING_STEPS.length; stepIdx++) {
    const stepDef = LEARNING_STEPS[stepIdx];
    const stepId = stepDef.id;
    tick(stepId, runLog.steps);

    // 导航到当前步骤
    const stepUrl = `${BASE_URL}/learn/${moduleId}/${stepId}`;
    await page.goto(stepUrl, { waitUntil: "networkidle", timeout: 15000 });
    await page
      .waitForSelector('[data-role="assistant"], [data-slot="composer"]', {
        timeout: 10000,
      })
      .catch(() => console.log("   ⚠ 页面元素未完全加载"));

    // 每个步骤最多 3 轮 See→Act
    for (let round = 0; round < 3; round++) {
      // ---- See ----
      const state = await describePage(page, options);
      const chatContent =
        state.regions.find((r) => r.type === "chat-messages")?.content ?? "";
      const hasContent = chatContent.length > 10;

      if (!hasContent && round === 0) {
        console.log(`   ⚠ 步骤 ${stepId} 无教学内容`);
        consecutiveZeroProductivity++;
        break;
      }

      // ---- Decide ----
      const action = decideAction(
        state,
        cognitiveState,
        stepId,
        pendingProbe,
        round,
      );

      console.log(
        `   🧠 [${cognitiveState}] ${action.type}: ${
          action.question ?? action.target
        }`,
      );

      if (action.type === "give_up") {
        console.log("   ❌ 学生放弃，终止学习");
        runLog.steps.push({
          step: stepId,
          action: "give_up",
          result: "放弃学习",
          comprehensionScore: 0,
          cognitiveState,
        });
        const endReport = summarizeComprehension([]);
        runLog.comprehensionReports.push(endReport);
        break;
      }

      // ---- Act ----
      const actResult = await executeAction(page, action, BASE_URL);
      console.log(`   ✋ ${actResult.description}`);

      // ---- Verify ----
      let comprehensionScore = 0.5;
      if (action.type === "ask" && action.question) {
        const report = await verifyComprehension(
          state,
          action,
          previousActions,
          options,
        );
        comprehensionScore = report.overallScore;
        runLog.comprehensionReports.push(report);

        const probeClue = report.clues.find((c) => c.name === "理解探针");
        if (probeClue && probeClue.score < 0.4) {
          consecutiveProbeFails++;
        } else if (probeClue) {
          consecutiveProbeFails = 0;
        }
      }

      // ---- 生成/处理理解探针 ----
      if (round === 1 && !pendingProbe) {
        pendingProbe = await generateProbe(state, [], options);
        console.log(`   🎯 探针：${pendingProbe.question}`);
      }

      if (pendingProbe && round === 2) {
        // 学生回答了探针（在 Action 中已经做了）
        const probeAnswer =
          previousActions.find((a) => a.type === "ask")?.question ?? "";
        if (probeAnswer) {
          const probeResult = await evaluateProbeAnswer(
            pendingProbe,
            probeAnswer,
            options,
          );
          console.log(
            `   📝 探针评分：${(probeResult.score * 100).toFixed(0)}% — ${probeResult.evidence}`,
          );
          pendingProbe = null;
        }
      }

      // ---- 更新认知状态 ----
      const stateUpdate = updateCognitiveState(
        cognitiveState,
        comprehensionScore,
        consecutiveProbeFails,
        consecutiveZeroProductivity,
      );
      if (stateUpdate.next !== cognitiveState) {
        console.log(
          `   🔄 认知状态：${cognitiveState} → ${stateUpdate.next}（${stateUpdate.reason}）`,
        );
      }
      cognitiveState = stateUpdate.next;

      // 产出追踪
      if (actResult.ok && action.type !== "wait") {
        consecutiveZeroProductivity = 0;
      } else if (action.type === "wait") {
        consecutiveZeroProductivity++;
      }

      previousActions.push(action);

      runLog.steps.push({
        step: stepId,
        action: `${action.type}: ${action.question ?? action.target}`,
        result: actResult.description,
        comprehensionScore,
        cognitiveState,
      });

      // 等待导师回复
      if (action.type === "ask") {
        console.log("   ⏳ 等待导师回复…");
        await page
          .waitForSelector('[data-status="done"]', { timeout: 30000 })
          .catch(() => {});
        await new Promise((r) => setTimeout(r, 2000));
      }

      // giving_up 后退出步骤循环
      if (cognitiveState === "giving_up") break;
    }

    if (cognitiveState === "giving_up") break;
  }

  // ---- 最终报告 ----
  console.log("\n" + "=".repeat(60));
  console.log("📊 自主学习报告");
  console.log("=".repeat(60));
  console.log(`   总步骤数：${runLog.steps.length}`);
  console.log(`   最终认知状态：${cognitiveState}`);

  const avgComprehension =
    runLog.comprehensionReports.length > 0
      ? runLog.comprehensionReports.reduce(
          (sum, r) => sum + r.overallScore,
          0,
        ) / runLog.comprehensionReports.length
      : 0;
  console.log(`   平均理解度：${(avgComprehension * 100).toFixed(0)}%`);

  const stepBreakdown = new Map<string, StepLog[]>();
  for (const s of runLog.steps) {
    const existing = stepBreakdown.get(s.step) ?? [];
    existing.push(s);
    stepBreakdown.set(s.step, existing);
  }
  for (const [step, logs] of stepBreakdown) {
    console.log(`   ${step}：${logs.length} 轮动作`);
  }

  writeFileSync(
    path.join(OUT_DIR, "autonomous-run-log.json"),
    JSON.stringify(
      {
        ...runLog,
        summary: {
          totalSteps: runLog.steps.length,
          finalCognitiveState: cognitiveState,
          avgComprehension,
          steps: Array.from(stepBreakdown.keys()),
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\n📋 完整日志：autonomous-run-log.json`);

  await browser.close();
  await closeBrowser();
}

main().catch((err) => {
  console.error("运行失败：", err);
  process.exit(1);
});
