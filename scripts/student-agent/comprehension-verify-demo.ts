/**
 * 理解验证演示 —— 三条线索交叉验证学生是否真懂了
 *
 * 这个脚本和学生 Agent 的日常运作不同：它不是为了模拟学习全流程，
 * 而是专门验证「验证器本身能不能工作」。像一个教学平台的质量审计工具。
 *
 * 流程
 * ----
 * 1. 打开讲解页 → 看一眼
 * 2. 学生提问（模拟困惑）
 * 3. 线索 1：分析行为信号（停顿、犹豫、认知状态）
 * 4. 线索 2：VLM 判断提问是否和教学内容相关
 * 5. 线索 3：VLM 生成理解探针 → 学生作答 → VLM 交叉打分
 * 6. 三条线索加权汇总 → ComprehensionReport
 *
 * 运行
 * ----
 * node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/student-agent/comprehension-verify-demo.ts
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
import type { StudentAction } from "@/lib/agent/student/types";
import type { ComprehensionReport } from "@/lib/agent/student/comprehension-verifier";
import type { ScreenDescriberOptions } from "@/lib/agent/student/types";
import { DASHSCOPE_API_KEY_ENV, readDashScopeSettings } from "@/lib/agent/dashscope-config";

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
const step = getArg("step") ?? "explain";

async function registerAndGetToken(): Promise<string | null> {
  const username = `agent-verify-${Date.now()}`;
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

function printClue(clue: {
  name: string;
  score: number;
  evidence: string;
}): void {
  const bar = "█".repeat(Math.round(clue.score * 20)).padEnd(20, "░");
  console.log(`  [${clue.name}] ${bar} ${(clue.score * 100).toFixed(0)}%`);
  console.log(`      判据：${clue.evidence}`);
}

function printReport(report: ComprehensionReport): void {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  📊 理解验证报告");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const overallBar = "█"
    .repeat(Math.round(report.overallScore * 30))
    .padEnd(30, "░");
  console.log(
    `  综合理解度：${overallBar} ${(report.overallScore * 100).toFixed(0)}%`,
  );
  console.log("");
  for (const clue of report.clues) {
    printClue(clue);
  }
  console.log(`  时间：${report.timestamp}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

async function main(): Promise<void> {
  const apiKey = process.env[DASHSCOPE_API_KEY_ENV];
  if (!apiKey) {
    console.error(`缺少环境变量 ${DASHSCOPE_API_KEY_ENV}`);
    process.exit(1);
  }

  const settings = readDashScopeSettings();
  const options: ScreenDescriberOptions = {
    baseUrl: BASE_URL,
    studentId: STUDENT_ID,
    visionModel: settings.visionModel,
    visionApiKey: apiKey,
    visionBaseUrl: settings.baseUrl,
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

  const url = `${BASE_URL}/learn/${moduleId}/${step}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  await page
    .waitForSelector('[data-role="assistant"], [data-slot="composer"]', {
      timeout: 10000,
    })
    .catch(() => {});

  // ---- 步骤 1：看一眼 ----
  console.log("👁 步骤 1：获取屏幕状态");
  const state1 = await describePage(page, options);
  console.log(`   步骤：${state1.step} | 区域数：${state1.regions.length}\n`);

  // ---- 步骤 2：学生提问（模拟一个困惑的零基础学生）----
  console.log("🙋 步骤 2：学生提问");
  const question1: StudentAction = {
    type: "ask",
    target: "输入框",
    question: "函数和变量有什么区别啊？我不太懂",
    hesitationMs: 3000,
    cognitiveState: "confused",
  };

  const actionResult = await executeAction(page, question1, BASE_URL);
  console.log(`   ${actionResult.description}`);

  // 等待导师回复
  console.log("   ⏳ 等待导师回复…");
  await page
    .waitForSelector('[data-status="done"]', { timeout: 30000 })
    .catch(() => console.log("   ⚠ 回复超时"));
  await new Promise((r) => setTimeout(r, 2000));

  // 再看一眼（导师回复后的新状态）
  const state2 = await describePage(page, options);

  // ---- 步骤 3：线索 1 + 线索 2 验证 ----
  console.log("\n🔍 步骤 3：线索 1 + 2 验证");
  const report12 = await verifyComprehension(state1, question1, [], options);
  for (const clue of report12.clues) {
    printClue(clue);
  }

  // ---- 步骤 4：生成理解探针（线索 3）----
  console.log("\n🎯 步骤 4：生成理解探针");
  const probe = await generateProbe(state2, [], options);
  console.log(`   类型：${probe.type}`);
  console.log(`   问题：${probe.question}`);
  console.log(`   难度：${probe.difficulty.toFixed(1)}`);
  console.log(`   标准答案片段：${probe.groundTruth.slice(0, 100)}…\n`);

  // ---- 步骤 5：学生回答探针 ----
  console.log("✏️ 步骤 5：学生回答探针");

  // 用简化学生模型生成回答（替代真实 persona 调用）
  const studentAnswers: Record<string, string> = {
    recall:
      "变量是用来存数据的，函数是用来存一段可以重复使用的代码。变量像一个盒子，函数像一张菜谱。",
    paraphrase:
      "我觉得函数就是把一些操作打包起来，给它取个名字，下次要用的时候直接叫名字就行。变量就是放一个值在里面。最大的区别是函数可以做事情，变量只是存东西。",
    apply:
      "如果代码是一栋房子，那变量就是房间里的一件一件家具，函数就是一道道工序——先开门、再开灯、再坐下。工序是动作，家具是东西。",
    connect:
      "函数和变量的关系有点像 Agnet 里的工具和状态。变量记录当前状态，函数执行动作改变状态。比如一个 AI Agnet 记着「用户想订机票」这个变量，然后调用「查航班」这个函数。前面讲的「任务分解」其实就是把一个大函数拆成很多小函数。",
  };

  // 根据探针类型选择对应质量的回答
  const answerQuality = studentAnswers[probe.type] ?? studentAnswers.recall;
  console.log(`   回答：${answerQuality}`);
  console.log("   ⏳ 模拟打字发送…");

  const answerAction: StudentAction = {
    type: "ask",
    target: "输入框",
    question: answerQuality,
    hesitationMs: 5000, // 回答理解题比提问更费脑子
    cognitiveState: "normal",
  };
  await executeAction(page, answerAction, BASE_URL);
  await new Promise((r) => setTimeout(r, 1000));

  // ---- 步骤 6：VLM 评分探针回答 ----
  console.log("\n📝 步骤 6：VLM 交叉评分");
  const probeClue = await evaluateProbeAnswer(probe, answerQuality, options);
  printClue(probeClue);

  // ---- 汇总 ----
  const fullReport = summarizeComprehension([...report12.clues, probeClue]);
  printReport(fullReport);

  // 保存
  writeFileSync(
    path.join(OUT_DIR, "comprehension-report.json"),
    JSON.stringify(
      {
        moduleId,
        step,
        probe,
        studentAnswer: answerQuality,
        report: fullReport,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`📋 报告已保存：comprehension-report.json`);

  await browser.close();
  await closeBrowser();
}

main().catch((err) => {
  console.error("演示失败：", err);
  process.exit(1);
});
