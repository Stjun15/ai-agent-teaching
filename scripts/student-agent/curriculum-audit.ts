/**
 * 课程设计审计 —— 用零基础学生 Agent 逐讲扫一遍，找出系统性缺陷
 *
 * 和 autonomous-run.ts 的区别
 * -------------------------
 * autonomous-run 是单个模块的完整学习模拟（7 步全走）。
 * 本脚本不同：**只走概念讲解这一步，但走全部 12 讲**。
 * 目的不是模拟学习，是审计教学内容——找出让零基础学生卡住的地方。
 *
 * 审计维度
 * -------
 * 1. **可达性**：页面能打开吗？教学内容渲染出来了吗？
 * 2. **可读性**：学生看完后的提问是否和教学内容相关？（相关性 < 40% 的告警）
 * 3. **理解度**：理解探针的回答评分（连续 < 40% = 该讲的教学解释有缺陷）
 * 4. **前置知识断层**：学生提的问题是否是本讲应该解释但没解释的？
 * 5. **认知负荷**：学生是否从 normal 状态跌入 confused/stuck？
 *
 * 输出
 * ----
 * 一份 `curriculum-audit-report.md` 放在 `student-agent-output/`，
 * 按严重程度排序，每条缺陷带证据片段。
 *
 * 运行
 * ----
 * node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/student-agent/curriculum-audit.ts
 * 前置：pnpm dev 在 localhost:3311
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { Page } from "playwright";
import {
  describePage,
  closeBrowser,
} from "@/lib/agent/student/screen-describer";
import { executeAction } from "@/lib/agent/student/action-executor";
import {
  generateProbe,
  evaluateProbeAnswer,
  verifyComprehension,
} from "@/lib/agent/student/comprehension-verifier";
import type {
  StudentAction,
  CognitiveState,
  ScreenDescriberOptions,
} from "@/lib/agent/student/types";
import type { ComprehensionReport } from "@/lib/agent/student/comprehension-verifier";
import {
  getKnowledgeWindow,
  formatLeakReport,
  MODULE_ORDER,
} from "./knowledge-window";
import type { ConceptLeak } from "./knowledge-window";

const OUT_DIR = path.resolve("student-agent-output");
mkdirSync(OUT_DIR, { recursive: true });

const STUDENT_ID = "a9e70000-0000-4000-8000-0000000000a1";
const BASE_URL = process.env.TEACHING_BASE_URL ?? "http://localhost:3311";
const AUDIT_MODULES_KEY = "AUDIT_MODULES";

async function registerAndGetToken(): Promise<string | null> {
  const username = `agent-audit-${Date.now()}`;
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

// ---- 审计数据类型 ----

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface AuditFinding {
  moduleId: string;
  moduleName: string;
  severity: Severity;
  dimension: string;
  title: string;
  evidence: string;
  recommendation: string;
}

interface ModuleAuditResult {
  moduleId: string;
  moduleName: string;
  difficulty: number;
  reachable: boolean;
  hasContent: boolean;
  contentLength: number;
  rounds: number;
  comprehensionScore: number;
  cognitiveStateEnd: CognitiveState;
  probeScore: number | null;
  queryRelevanceScore: number | null;
  /** 概念-代码断层：观察示范页代码可读性评分（0-1），null=未检测 */
  codeReadabilityScore: number | null;
  /** 代码-动手断层：模仿任务可及性评分（0-1），null=未检测 */
  imitationGapScore: number | null;
  /** 观察示范页是否有示范代码 */
  hasDemoCode: boolean;
  /** 动手模仿页是否有明确任务 */
  hasAssignment: boolean;
  findings: AuditFinding[];
}

/** 代码断层分析结果 */
interface CodeGapAnalysis {
  codeReadabilityScore: number | null;
  imitationGapScore: number | null;
  hasDemoCode: boolean;
  hasAssignment: boolean;
  codeReadabilityReason: string;
  imitationGapReason: string;
  findings: AuditFinding[];
  /** 概念泄漏：示范代码中出现了未来模块才定义的术语 */
  conceptLeaks: import("./knowledge-window.js").ConceptLeak[];
  /** 知识窗内可用术语数 */
  knownTermCount: number;
  /** 代码中检测到的未知术语数 */
  unknownTermCount: number;
}

// ---- 核心审计逻辑 ----

/** 分析单个模块的 explain 步骤，返回审计结果。 */
async function auditModule(
  moduleId: string,
  moduleName: string,
  difficulty: number,
  page: Page,
  options: ScreenDescriberOptions,
): Promise<ModuleAuditResult> {
  const findings: AuditFinding[] = [];
  let reachable = false;
  let hasContent = false;
  let contentLength = 0;
  let comprehensionScore = 0.5;
  let cognitiveStateEnd: CognitiveState = "normal";
  let probeScore: number | null = null;
  let queryRelevanceScore: number | null = null;
  let rounds = 0;

  const add = (f: AuditFinding) => findings.push(f);

  // ---- 维度 1：可达性 ----
  const url = `${BASE_URL}/learn/${moduleId}/explain`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    reachable = true;
    console.log("     ✓ page.goto 完成");
  } catch (err) {
    add({
      moduleId,
      moduleName,
      severity: "critical",
      dimension: "可达性",
      title: "页面无法访问",
      evidence: `导航到 ${url} 超时或失败`,
      recommendation: "检查路由和页面组件是否存在",
    });
    return {
      moduleId,
      moduleName,
      difficulty,
      reachable: false,
      hasContent: false,
      contentLength: 0,
      rounds: 0,
      comprehensionScore: 0,
      cognitiveStateEnd: "giving_up",
      probeScore: null,
      queryRelevanceScore: null,
      codeReadabilityScore: null,
      imitationGapScore: null,
      hasDemoCode: false,
      hasAssignment: false,
      findings,
    };
  }

  // 等待内容加载（evaluate + 轮询，绕过 Playwright waitFor 超时 bug）
  console.log("     ⏳ 等待内容渲染...");
  let hasContentRendered = false;
  const POLL_MS = 500;
  const MAX_POLLS = 20; // 10 seconds total
  for (let p = 0; p < MAX_POLLS; p++) {
    const found = await page.evaluate(() => {
      return (
        !!document.querySelector('[data-role="assistant"]') ||
        !!document.querySelector('[data-slot="composer"]')
      );
    });
    if (found) {
      hasContentRendered = true;
      console.log("     ✓ 内容已渲染");
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  if (!hasContentRendered) {
    // platform-replica 特殊处理：聊天面板默认折叠，需要点击「开始对聊」
    const startChatBtn = await page
      .evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find(
          (b) =>
            b.textContent?.includes("开始对聊") ||
            b.textContent?.includes("開始對聊"),
        );
        return btn ? true : false;
      })
      .catch(() => false);

    if (startChatBtn) {
      console.log("     🔘 点击「开始对聊」...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find(
          (b) =>
            b.textContent?.includes("开始对聊") ||
            b.textContent?.includes("開始對聊"),
        );
        btn?.click();
      });
      // 等待聊天面板出现（platform-replica 没有 data-slot 属性，
      // 但 Composer 有 textarea，ChatPanel 空态有"还没有对话"）
      for (let p2 = 0; p2 < 30; p2++) {
        const found2 = await page.evaluate(() => {
          return (
            !!document.querySelector('[data-role="assistant"]') ||
            !!document.querySelector('[data-slot="composer"]') ||
            !!document.querySelector("textarea") ||
            document.body.innerText.includes("还没有对话")
          );
        });
        if (found2) {
          hasContentRendered = true;
          console.log("     ✓ 聊天面板已打开");
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!hasContentRendered) {
      console.log("     ⚠ 内容未渲染");
      add({
        moduleId,
        moduleName,
        severity: "high",
        dimension: "可达性",
        title: "教学内容未渲染",
        evidence: "页面打开但未检测到导师消息或输入框",
        recommendation:
          "检查该模块的 explain 页面和 LectureLauncher 是否正常触发",
      });
    }
  }

  // ---- 维度 2：看一眼 ----
  const state = await describePage(page, options);
  const chatRegion = state.regions.find((r) => r.type === "chat-messages");
  hasContent = !!(chatRegion && chatRegion.content.length > 20);
  contentLength = chatRegion?.content.length ?? 0;

  if (!hasContent) {
    // 如果聊天面板已经渲染成功（包括点击「开始对聊」后），只是还没消息，
    // 就不要提早退场——接下来的 Q&A 环节会产出内容。
    if (hasContentRendered) {
      console.log("     📝 聊天面板已就绪（暂无消息），进入交互环节...");

      // platform-replica 聊天面板刚打开，LectureLauncher 可能还未触发。
      // 主动发送一个打招呼消息来唤醒导师讲解。
      try {
        const hasComposer = await page.evaluate(() => {
          const ta = document.querySelector("textarea");
          return ta ? true : false;
        });
        if (hasComposer) {
          console.log("     💬 发送唤醒消息触发导师开讲...");
          await page.evaluate(() => {
            const ta = document.querySelector("textarea");
            if (ta) {
              (ta as HTMLTextAreaElement).value = "你好，开始上课吧";
              ta.dispatchEvent(new Event("input", { bubbles: true }));
              const btn = Array.from(document.querySelectorAll("button")).find(
                (b) =>
                  b.textContent?.includes("发送") ||
                  b.textContent?.includes("發送") ||
                  b.getAttribute("type") === "submit",
              );
              btn?.click();
            }
          });
          await page
            .waitForSelector('[data-status="done"]', { timeout: 60000 })
            .catch(() => console.log("     ⚠ 唤醒消息无回复"));
          console.log("     ✓ 唤醒完成");

          // 重新读取页面状态，获取最新的 chatRegion
          const state2 = await describePage(page, options);
          const cr2 = state2.regions.find((r) => r.type === "chat-messages");
          if (cr2 && cr2.content.length > 20) {
            hasContent = true;
            contentLength = cr2.content.length;
            console.log(`     📖 已获取 ${contentLength} 字教学内容`);
          }
          // 更新 chatRegion 引用供后续使用
          Object.assign(state, state2);
        }
      } catch (e) {
        console.log("     ⚠ 唤醒失败:", String(e).slice(0, 80));
      }
    } else {
      add({
        moduleId,
        moduleName,
        severity: "critical",
        dimension: "可读性",
        title: "概念讲解内容为空或过短",
        evidence: `聊天区域内容长度仅 ${contentLength} 字符`,
        recommendation:
          "检查该模块的讲稿缓存是否存在；若使用实时生成，确认 LectureLauncher prompt 是否正确",
      });
      return {
        moduleId,
        moduleName,
        difficulty,
        reachable,
        hasContent: false,
        contentLength,
        rounds: 0,
        comprehensionScore: 0,
        cognitiveStateEnd: "giving_up",
        probeScore: null,
        queryRelevanceScore: null,
        codeReadabilityScore: null,
        imitationGapScore: null,
        hasDemoCode: false,
        hasAssignment: false,
        findings,
      };
    }
  }

  // ---- 维度 3：内容量适中 ----
  if (contentLength < 200) {
    add({
      moduleId,
      moduleName,
      severity: "high",
      dimension: "可读性",
      title: "讲稿内容过短",
      evidence: `仅 ${contentLength} 字符，无法充分展开核心概念`,
      recommendation: "检查讲稿生成 prompt 或预缓存内容",
    });
  }
  if (contentLength > 5000) {
    add({
      moduleId,
      moduleName,
      severity: "medium",
      dimension: "认知负荷",
      title: "讲稿内容过长",
      evidence: `${contentLength} 字符，零基础学生可能信息过载`,
      recommendation: "考虑将长讲稿分段，或插入交互提问来检测理解",
    });
  }

  // ---- 维度 4+5：学生提问 + 验证 ----
  const previousActions: StudentAction[] = [];
  let cognitiveState: CognitiveState = "normal";

  // 重新获取 chatRegion（唤醒后可能已有内容）
  const currentChatRegion =
    chatRegion ??
    state.regions.find((r) => r.type === "chat-messages") ??
    (await (async () => {
      const s = await describePage(page, options);
      return s.regions.find((r) => r.type === "chat-messages");
    })());

  const chatContent = currentChatRegion?.content ?? "";
  const contextQuestions = generateQuestionsFromContent(chatContent);
  const questionsToAsk = contextQuestions.slice(0, 2);

  for (let i = 0; i < questionsToAsk.length; i++) {
    const question = questionsToAsk[i];
    rounds = i + 1;

    const action: StudentAction = {
      type: "ask",
      target: "输入框",
      question,
      hesitationMs: 2000 + Math.floor(Math.random() * 3000),
      cognitiveState,
    };

    // 执行提问
    await executeAction(page, action, BASE_URL);

    // 等待导师回复
    await page
      .waitForSelector('[data-status="done"]', { timeout: 30000 })
      .catch(() => console.log("     ⚠ 导师回复超时"));
    console.log("     ✓ 导师已回复");
    await new Promise((r) => setTimeout(r, 1500));

    // 再看一眼
    const stateAfter = await describePage(page, options);

    // 验证理解
    let report: ComprehensionReport;
    try {
      report = await verifyComprehension(
        stateAfter,
        action,
        previousActions,
        options,
      );
    } catch {
      console.log("     ⚠ 理解验证调用失败，使用默认评分");
      report = {
        overallScore: 0.5,
        clues: [{ name: "行为信号", score: 0.5, evidence: "VLM调用失败" }],
        timestamp: new Date().toISOString(),
      } satisfies ComprehensionReport;
    }
    comprehensionScore = report.overallScore;

    const relClue = report.clues.find((c) => c.name === "提问相关性");
    if (relClue) queryRelevanceScore = relClue.score;

    // 提问相关性低 = 学生看了内容但问的是别的事
    if (relClue && relClue.score < 0.4) {
      add({
        moduleId,
        moduleName,
        severity: "high",
        dimension: "可读性",
        title: "学生提问与教学内容关联度低",
        evidence: `相关问题得分 ${(relClue.score * 100).toFixed(0)}%：${relClue.evidence}`,
        recommendation: "讲稿可能需要更聚焦核心概念，避免引入过多无关信息",
      });
    }

    // 理解度持续低
    if (comprehensionScore < 0.4) {
      if (cognitiveState === "normal") {
        cognitiveState = "confused";
      } else if (cognitiveState === "confused") {
        cognitiveState = "stuck";
      }

      add({
        moduleId,
        moduleName,
        severity: cognitiveState === "stuck" ? "critical" : "high",
        dimension: "理解度",
        title: `学生理解度持续偏低（${(comprehensionScore * 100).toFixed(0)}%）`,
        evidence: `第 ${i + 1} 轮提问后综合分 ${(comprehensionScore * 100).toFixed(0)}%，认知状态：${cognitiveState}`,
        recommendation:
          "该讲的概念解释方式可能不适合零基础学生，建议：(1) 增加生活化类比；(2) 拆分复杂概念为多个子步骤；(3) 在讲稿中插入确认型提问",
      });
    }

    previousActions.push(action);
  }

  // ---- 维度 6：理解探针（真实验证：生成探针 → 学生打字回答 → 发送 → 等回复 → 评分）----
  if (hasContent) {
    let probe;
    try {
      probe = await generateProbe(state, [], options);
    } catch {
      console.log("     ⚠ 探针生成失败");
      return {
        moduleId,
        moduleName,
        difficulty,
        reachable,
        hasContent,
        contentLength,
        rounds,
        comprehensionScore,
        cognitiveStateEnd,
        probeScore: null,
        queryRelevanceScore,
        codeReadabilityScore: null,
        imitationGapScore: null,
        hasDemoCode: false,
        hasAssignment: false,
        findings,
      };
    }
    console.log(`     🎯 探针：${probe.question}`);

    const probeAnswer = generateProbeAnswer(probe, cognitiveState);
    console.log(`     ✍ 学生回答：${probeAnswer.slice(0, 60)}...`);

    const answerAction: StudentAction = {
      type: "ask",
      target: "输入框",
      question: probeAnswer,
      hesitationMs: 4000 + Math.floor(Math.random() * 3000),
      cognitiveState,
    };
    await executeAction(page, answerAction, BASE_URL);

    await page
      .waitForSelector('[data-status="done"]', { timeout: 30000 })
      .catch(() => console.log("     ⚠ 导师回复超时"));
    console.log("     ✓ 导师已回复");
    await new Promise((r) => setTimeout(r, 1500));

    let probeResult;
    try {
      probeResult = await evaluateProbeAnswer(probe, probeAnswer, options);
    } catch {
      console.log("     ⚠ 探针评分调用失败");
      probeResult = { score: 0.5, evidence: "VLM调用失败" };
    }
    probeScore = probeResult.score;
    console.log(
      `     📝 探针评分：${(probeScore * 100).toFixed(0)}% — ${probeResult.evidence}`,
    );

    if (probeScore < 0.4) {
      add({
        moduleId,
        moduleName,
        severity: probeScore < 0.2 ? "critical" : "high",
        dimension: "理解度",
        title: `理解探针未通过（${(probeScore * 100).toFixed(0)}%）`,
        evidence: `探针问题："${probe.question}" | 学生回答评分 ${(probeScore * 100).toFixed(0)}% | ${probeResult.evidence}`,
        recommendation:
          "核心概念未被学生掌握。检查讲稿是否：(1) 覆盖了探针涉及的要点；(2) 用了学生能理解的表述方式",
      });
    }

    rounds++;
  }

  cognitiveStateEnd = cognitiveState;

  return {
    moduleId,
    moduleName,
    difficulty,
    reachable,
    hasContent,
    contentLength,
    rounds,
    comprehensionScore,
    cognitiveStateEnd,
    probeScore,
    queryRelevanceScore,
    codeReadabilityScore: null,
    imitationGapScore: null,
    hasDemoCode: false,
    hasAssignment: false,
    findings,
  };
}

// ---- 问题生成器：基于屏幕内容生成零基础学生会问的问题 ----

function generateQuestionsFromContent(content: string): string[] {
  const lower = content.toLowerCase();

  // 通用零基础困惑（不依赖内容）
  const baseline = [
    "这是干什么用的？能不能举个生活中的例子？",
    "我没听懂，可以换个方式解释吗？",
    "这个东西在实际项目中怎么用？",
  ];

  // 基于内容的定向问题
  const specific: string[] = [];
  if (lower.includes("函数") || lower.includes("def")) {
    specific.push("函数是什么？和数学书上的函数是一回事吗？");
    specific.push("为什么要把代码放函数里？直接写不行吗？");
  }
  if (lower.includes("变量") || lower.includes("赋值")) {
    specific.push("变量是干什么用的？为什么要叫变量？");
    specific.push("变量和函数有什么关系？它们是一回事吗？");
  }
  if (lower.includes("任务分解") || lower.includes("拆")) {
    specific.push("任务分解是什么意思？就是分步骤做事吗？");
  }
  if (lower.includes("api") || lower.includes("接口")) {
    specific.push("API 是什么？能不能用简单的词解释一下？");
    specific.push("我还没搞懂 API，和普通的网址有什么区别？");
  }
  if (
    lower.includes("循环") ||
    lower.includes("for") ||
    lower.includes("while")
  ) {
    specific.push("循环是什么？就是不停地做一件事情吗？");
  }
  if (
    lower.includes("提示词") ||
    lower.includes("prompt") ||
    lower.includes("system")
  ) {
    specific.push("提示词和平时说话有什么区别？为什么模型需要提示词？");
  }
  if (lower.includes("agent") || lower.includes("智能体")) {
    specific.push("Agent 到底是什么？就是一个能自己干活的程序吗？");
  }
  if (lower.includes("工具") || lower.includes("tool")) {
    specific.push("工具调用是什么意思？模型自己会找工具吗？");
  }
  if (lower.includes("安全") || lower.includes("攻击")) {
    specific.push("AI 为什么会有安全问题？它不是机器吗？");
  }
  if (lower.includes("mcp") || lower.includes("协议")) {
    specific.push("MCP 是什么？和 API 有什么区别？");
  }
  if (lower.includes("rag") || lower.includes("检索")) {
    specific.push("RAG 是什么？就是让 AI 能查资料吗？");
  }
  if (lower.includes("多") && lower.includes("agent")) {
    specific.push("多个 Agent 怎么互相说话？它们不会吵架吗？");
  }

  // 定向问题优先，不足用通用补
  return [...specific.slice(0, 3), ...baseline.slice(0, 2)].slice(0, 3);
}

function generateProbeAnswer(
  probe: { groundTruth: string },
  cognitiveState: CognitiveState,
): string {
  if (cognitiveState === "confused" || cognitiveState === "stuck") {
    const confusedReplies = [
      "我不太确定……好像是先……不对我忘了",
      "对不起，我没记住。能再讲一遍吗？",
      "我猜应该是和那个有关……但我说不清楚",
    ];
    return confusedReplies[Math.floor(Math.random() * confusedReplies.length)];
  }
  if (probe.groundTruth.length > 20) {
    return `我觉得${probe.groundTruth.slice(0, 120)}……大概就是这样吧`;
  }
  return "我看到的好像是那个内容……对吗？";
}

// ---- 报告生成 ----

function generateReport(results: ModuleAuditResult[]): string {
  const allFindings = results.flatMap((r) => r.findings);

  const lines: string[] = [
    "# 课程设计审计报告",
    "",
    `> 审计时间：${new Date().toISOString()}`,
    `> 审计方式：零基础学生 Agent（认知状态 normal，从零出发逐讲阅读概念讲解）`,
    `> 覆盖模块：${results.length} 讲`,
    `> 审计维度：可达性、可读性、理解度、认知负荷、概念-代码断层、代码-动手断层`,
    "",
    "---",
    "",
    "## 一、总览",
    "",
    `| 模块 | 难度 | 可达 | 内容量 | 理解度 | 探针 | 代码可读 | 动手可及 | 缺陷 | 状态 |`,
    `|------|------|------|--------|--------|------|----------|----------|------|------|`,
    ...results.map((r) => {
      const probeStr =
        r.probeScore != null ? `${(r.probeScore * 100).toFixed(0)}%` : "未跑";
      const readStr =
        r.codeReadabilityScore != null
          ? `${(r.codeReadabilityScore * 10).toFixed(0)}/10`
          : "N/A";
      const imiStr =
        r.imitationGapScore != null
          ? `${(r.imitationGapScore * 10).toFixed(0)}/10`
          : "N/A";
      const reachStr = r.reachable ? "✅" : "❌";
      const contentStr =
        r.contentLength > 0
          ? r.contentLength > 5000
            ? "过长"
            : r.contentLength < 200
              ? "过短"
              : "正常"
          : "❌ 空";
      return `| ${r.moduleName} | ${r.difficulty}/5 | ${reachStr} | ${contentStr}（${r.contentLength}字） | ${(r.comprehensionScore * 100).toFixed(0)}% | ${probeStr} | ${readStr} | ${imiStr} | ${r.findings.length} | ${r.cognitiveStateEnd} |`;
    }),
    "",
    `**缺陷总数：${allFindings.length}**（critical: ${allFindings.filter((f) => f.severity === "critical").length}，high: ${allFindings.filter((f) => f.severity === "high").length}，medium: ${allFindings.filter((f) => f.severity === "medium").length}）`,
    "",
    "---",
    "",
    "## 二、Critical / High 缺陷详情",
    "",
    ...allFindings
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .sort((a, b) => {
        const order: Record<string, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
          info: 4,
        };
        return order[a.severity] - order[b.severity];
      })
      .map(
        (f) =>
          `### 🔴 ${f.severity.toUpperCase()} | ${f.moduleName} | ${f.dimension}\n\n` +
          `**问题**：${f.title}\n\n` +
          `**证据**：${f.evidence}\n\n` +
          `**建议**：${f.recommendation}\n\n---`,
      ),
    "",
    "## 三、系统性缺陷分析",
    "",
    generateSystemicAnalysis(results),
    "",
    "## 四、数据附录",
    "",
    "```json",
    JSON.stringify(
      results.map((r) => ({
        moduleId: r.moduleId,
        moduleName: r.moduleName,
        difficulty: r.difficulty,
        reachable: r.reachable,
        contentLength: r.contentLength,
        roundCount: r.rounds,
        comprehensionScore: r.comprehensionScore,
        cognitiveStateEnd: r.cognitiveStateEnd,
        probeScore: r.probeScore,
        queryRelevanceScore: r.queryRelevanceScore,
        codeReadabilityScore: r.codeReadabilityScore,
        imitationGapScore: r.imitationGapScore,
        hasDemoCode: r.hasDemoCode,
        hasAssignment: r.hasAssignment,
        findingCount: r.findings.length,
      })),
      null,
      2,
    ),
    "```",
  ];

  return lines.join("\n");
}

function generateSystemicAnalysis(results: ModuleAuditResult[]): string {
  const lines: string[] = [];

  // 内容量分析
  const contentStats = results.filter((r) => r.hasContent);
  if (contentStats.length > 0) {
    const avgLen =
      contentStats.reduce((s, r) => s + r.contentLength, 0) /
      contentStats.length;
    const tooShort = contentStats.filter((r) => r.contentLength < 200);
    const tooLong = contentStats.filter((r) => r.contentLength > 5000);

    lines.push(
      `### 内容量分布`,
      "",
      `- 平均讲稿长度：${Math.round(avgLen)} 字符`,
      `- 讲稿过短（<200 字）：${tooShort.length} 讲 ${tooShort.map((r) => r.moduleName).join("、") || "无"}`,
      `- 讲稿过长（>5000 字）：${tooLong.length} 讲 ${tooLong.map((r) => r.moduleName).join("、") || "无"}`,
      "",
    );
  }

  // 理解度分析
  const lowComp = results.filter(
    (r) => r.comprehensionScore > 0 && r.comprehensionScore < 0.5,
  );
  if (lowComp.length > 0) {
    lines.push(
      `### 理解度偏低的模块（<50%）`,
      "",
      ...lowComp.map(
        (r) =>
          `- **${r.moduleName}**：${(r.comprehensionScore * 100).toFixed(0)}%（${r.cognitiveStateEnd}）`,
      ),
      "",
    );
  }

  // 认知状态退化
  const degraded = results.filter((r) => r.cognitiveStateEnd !== "normal");
  if (degraded.length > 0) {
    lines.push(
      `### 认知状态退化的模块`,
      "",
      ...degraded.map(
        (r) => `- **${r.moduleName}**：normal → ${r.cognitiveStateEnd}`,
      ),
      "",
    );
  } else {
    lines.push(
      `### 认知状态`,
      "",
      `所有可访问模块中学生均保持在 normal 状态。`,
      "",
    );
  }

  // 探针分析
  const probeResults = results.filter((r) => r.probeScore != null);
  if (probeResults.length > 0) {
    const avgProbe =
      probeResults.reduce((s, r) => s + (r.probeScore ?? 0), 0) /
      probeResults.length;
    const lowProbe = probeResults.filter((r) => (r.probeScore ?? 0) < 0.4);
    lines.push(
      `### 理解探针分析`,
      "",
      `- 平均探针评分：${(avgProbe * 100).toFixed(0)}%`,
      `- 未通过探针（<40%）：${lowProbe.length} 讲`,
      "",
    );
  }

  // 概念-代码断层分析
  const gapResults = results.filter((r) => r.codeReadabilityScore != null);
  if (gapResults.length > 0) {
    const avgRead =
      gapResults.reduce((s, r) => s + (r.codeReadabilityScore ?? 0), 0) /
      gapResults.length;
    const avgImi =
      gapResults
        .filter((r) => r.imitationGapScore != null)
        .reduce((s, r) => s + (r.imitationGapScore ?? 0), 0) /
        gapResults.filter((r) => r.imitationGapScore != null).length || 0;

    // 概念→代码断层：解释理解度好但代码看不懂
    const conceptCodeGap = results.filter(
      (r) =>
        r.comprehensionScore > 0.5 &&
        r.codeReadabilityScore != null &&
        r.codeReadabilityScore < 0.5,
    );
    // 代码→动手断层：代码能看懂但写不出来
    const codeImitateGap = results.filter(
      (r) =>
        r.codeReadabilityScore != null &&
        r.codeReadabilityScore >= 0.5 &&
        r.imitationGapScore != null &&
        r.imitationGapScore < 0.4,
    );
    // 示范代码缺失
    const noDemo = gapResults.filter((r) => !r.hasDemoCode);
    // 动手任务缺失
    const noAssignment = gapResults.filter((r) => !r.hasAssignment);

    lines.push(
      `### 概念-代码断层分析`,
      "",
      `- 平均代码可读性：${(avgRead * 10).toFixed(1)}/10`,
      `- 平均动手可及性：${(avgImi * 10).toFixed(1)}/10`,
      `- 示范代码缺失：${noDemo.length} 讲 ${noDemo.map((r) => r.moduleName).join("、") || "无"}`,
      `- 动手任务缺失：${noAssignment.length} 讲 ${noAssignment.map((r) => r.moduleName).join("、") || "无"}`,
      "",
    );

    if (conceptCodeGap.length > 0) {
      lines.push(
        `#### 概念→代码断层（理解率>50%但代码可读性<50%）`,
        "",
        "这些模块的解释讲稿学生听懂了，但看到代码仍然无法理解——讲稿和示范之间的桥梁断了。",
        "",
        ...conceptCodeGap.map(
          (r) =>
            `- **${r.moduleName}**：解释 ${(r.comprehensionScore * 100).toFixed(0)}% → 代码 ${((r.codeReadabilityScore ?? 0) * 100).toFixed(0)}%（落差 ${Math.round((r.comprehensionScore - (r.codeReadabilityScore ?? 0)) * 100)}%）`,
        ),
        "",
      );
    }

    if (codeImitateGap.length > 0) {
      lines.push(
        `#### 代码→动手断层（代码可读>50%但动手可及<40%）`,
        "",
        "这些模块的示范代码学生看懂了，但动手任务仍然无法完成——示范与任务之间的难度跳升太大。",
        "",
        ...codeImitateGap.map(
          (r) =>
            `- **${r.moduleName}**：代码 ${((r.codeReadabilityScore ?? 0) * 100).toFixed(0)}% → 动手 ${((r.imitationGapScore ?? 0) * 100).toFixed(0)}%（落差 ${Math.round(((r.codeReadabilityScore ?? 0) - (r.imitationGapScore ?? 0)) * 100)}%）`,
        ),
        "",
      );
    }
  }

  return lines.join("\n");
}

// ---- 概念-代码断层检测 ----

const GAP_PROXY_TIMEOUT_MS = 60000;

/**
 * 通过平台代理端点调用 LLM 评估。
 * 不再直连 Ark API——密钥由服务端注入。
 */
async function gapEvaluate(
  type: "readability" | "doability" | "vision",
  systemPrompt: string,
  userContent: string,
  isVision = false,
): Promise<string | null> {
  try {
    const res = await Promise.race([
      fetch(`${BASE_URL}/api/audit/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, systemPrompt, userContent, isVision }),
      }),
      new Promise<Response>((_, reject) =>
        setTimeout(
          () => reject(new Error("GAP_PROXY_TIMEOUT")),
          GAP_PROXY_TIMEOUT_MS,
        ),
      ),
    ]);
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string };
    return data.content ?? null;
  } catch (err) {
    console.log(`     ⚠ 评估调用失败：${String(err).slice(0, 60)}`);
    return null;
  }
}

/**
 * 分析概念讲解与观察示范之间的断层。
 *
 * 测什么
 * ------
 * 1. 观察示范页的示范代码是否对零基础学生可读
 * 2. 动手模仿页的任务是否基于示范代码可完成
 * 3. 对比解释理解度，检测概念→代码→动手三个环节的断裂点
 */
async function auditCodeGap(
  moduleId: string,
  moduleName: string,
  explainComprehensionScore: number,
  page: Page,
): Promise<CodeGapAnalysis> {
  const findings: AuditFinding[] = [];
  const add = (f: AuditFinding) => findings.push(f);

  let codeReadabilityScore: number | null = null;
  let imitationGapScore: number | null = null;
  let hasDemoCode = false;
  let hasAssignment = false;
  let codeReadabilityReason = "";
  let imitationGapReason = "";
  let observeText = ""; // 供 observe 和 imitate 两阶段共享
  let conceptLeaks: ConceptLeak[] = [];
  let knownTermCount = 0;
  let unknownTermCount = 0;

  // ---- 测 1：观察示范页代码可读性 ----
  const observeUrl = `${BASE_URL}/learn/${moduleId}/observe`;
  console.log(`     🧪 断层检测：观察示范 → ${observeUrl}`);

  try {
    await page.goto(observeUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // 等待观察面板渲染（查找代码块或示范卡标题）
    let observeReady = false;
    for (let i = 0; i < 15; i++) {
      const found = await page.evaluate(() => {
        // ObservePanel 会渲染前导文字 "这些是给本讲准备的示范代码"
        const body = document.body.innerText;
        if (body.includes("示范代码")) return true;
        // 或者代码块已经渲染
        if (document.querySelector("code")) return true;
        // 或者空态提示
        if (body.includes("示范代码准备中")) return true;
        return false;
      });
      if (found) {
        observeReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!observeReady) {
      console.log("     ⚠ 观察示范页未渲染");
      add({
        moduleId,
        moduleName,
        severity: "medium",
        dimension: "代码可读性",
        title: "观察示范页未能渲染",
        evidence: "页面打开后15秒内未检测到示范代码或占位文字",
        recommendation: "检查观察示范页路由和 ObservePanel 组件",
      });
      return {
        codeReadabilityScore: null,
        imitationGapScore: null,
        hasDemoCode: false,
        hasAssignment: false,
        codeReadabilityReason: "页面未渲染",
        imitationGapReason: "",
        conceptLeaks: [],
        knownTermCount: 0,
        unknownTermCount: 0,
        findings,
      };
    }

    // 提取页面上的代码内容
    const pageText = await page.evaluate(() => {
      // 优先提取代码块
      const codeBlocks = Array.from(document.querySelectorAll("code"));
      const codeTexts = codeBlocks
        .map((el) => el.textContent ?? "")
        .join("\n\n");
      if (codeTexts.trim().length > 20) return codeTexts;

      // 回退：提取整个卡片的文本
      const card = document.querySelector(".card");
      if (card?.textContent) return card.textContent;

      return document.body.innerText.slice(0, 3000);
    });
    observeText = pageText.slice(0, 5000);

    // ---- 知识窗检测：概念泄漏（在代码为空和非空情况下都需要运行） ----
    const kw = getKnowledgeWindow();
    let kwReport = kw.analyzeCode(moduleId, observeText);

    const isEmpty =
      observeText.includes("示范代码准备中") || observeText.trim().length < 50;
    hasDemoCode = !isEmpty;

    if (isEmpty) {
      console.log("     ⚠ 观察示范页无代码内容");
      add({
        moduleId,
        moduleName,
        severity: "high",
        dimension: "代码可读性",
        title: "示范代码缺失",
        evidence: "观察示范页显示空态占位，无示范代码",
        recommendation: "在 wiki 页面的「## 示范代码」节中填写示范代码",
      });
    } else {
      console.log(`     📖 示范代码 ${observeText.length} 字符`);

      // ---- 知识窗检测：概念泄漏 ----
      kwReport = kw.analyzeCode(moduleId, observeText);
      conceptLeaks = kwReport.leaks;
      knownTermCount = kwReport.knownTermCount;
      unknownTermCount = kwReport.unknownTermCount;
      if (kwReport.leaks.length > 0) {
        console.log(`     🔍 概念泄漏检测：${kwReport.leaks.length} 个`);
        console.log(`        ${formatLeakReport(kwReport.leaks)}`);
        for (const leak of kwReport.leaks) {
          const severity: Severity = leak.severity;
          add({
            moduleId,
            moduleName,
            severity,
            dimension: "前置知识断层",
            title: `示范代码泄漏了后置概念 \`${leak.term}\`（${kw.findTermOrigin(leak.term) ?? leak.definedIn} 模块才教）`,
            evidence: `代码片段：\`${leak.codeSnippet.trim()}\`。术语 \`${leak.term}\` 在「${leak.definedIn}」模块首次定义，学生在第 ${MODULE_ORDER.indexOf(moduleId) + 1} 讲尚未接触。`,
            recommendation: `将示范代码中的 \`${leak.term}\` 替换为已学模块中的等价表述，或在本讲讲稿中先给出简短解释再展示代码。`,
          });
        }
      }
      // ---- 知识窗检测结束 ----

      // VLM 评估代码可读性
      const readabilityPrompt = `你是一个教学评估专家。下面是一个零基础编程学生刚学完的概念讲解（理解度 ${(explainComprehensionScore * 100).toFixed(0)}%），以及随后在"观察示范"步骤看到的示范代码。

请评估：**这个学生能看懂这段示范代码吗？**

评分标准（1-10）：
- 1-3：完全看不懂。代码里充满了学生未接触过的语法和概念。
- 4-6：能看到一些皮毛。学生能认出少数几个词，但整体读不通。
- 7-8：大部分能懂。有一些不熟悉的语法，但核心逻辑能跟上。
- 9-10：完全能懂。代码与讲稿中的类比呼应，学生能逐句说清楚。

请严格按以下格式回复（每段一行，不要加其他内容）：

总分：X/10
能看懂的：
会被卡住的：
建议：`;

      const result = await gapEvaluate(
        "readability",
        readabilityPrompt,
        `【示范代码】\n${observeText.slice(0, 4000)}`,
      );

      if (result) {
        codeReadabilityReason = result;
        const scoreMatch = result.match(/总分[：:]\s*(\d+)/);
        if (scoreMatch) {
          codeReadabilityScore = parseInt(scoreMatch[1], 10) / 10;
        } else {
          // 尝试从文本推断
          const lowKeywords = ["完全看不懂", "看不懂", "很难看懂"];
          const midKeywords = ["部分能懂", "大概能看懂", "能看到一些"];
          const highKeywords = ["大部分能懂", "基本能懂", "完全能懂"];
          if (lowKeywords.some((k) => result.includes(k))) {
            codeReadabilityScore = 0.3;
          } else if (midKeywords.some((k) => result.includes(k))) {
            codeReadabilityScore = 0.55;
          } else if (highKeywords.some((k) => result.includes(k))) {
            codeReadabilityScore = 0.8;
          } else {
            codeReadabilityScore = 0.5;
          }
        }
        console.log(
          `     📊 代码可读性：${codeReadabilityScore != null ? (codeReadabilityScore * 10).toFixed(1) + "/10" : "N/A"}`,
        );

        if (codeReadabilityScore != null && codeReadabilityScore < 0.4) {
          add({
            moduleId,
            moduleName,
            severity: explainComprehensionScore > 0.6 ? "critical" : "high",
            dimension: "概念-代码断层",
            title: `概念理解 ${(explainComprehensionScore * 100).toFixed(0)}% 但代码可读性仅 ${(codeReadabilityScore * 100).toFixed(0)}%`,
            evidence: `学生理解了概念但看不懂示范代码。${result.slice(0, 200)}`,
            recommendation:
              '示范代码与概念讲解脱节。建议：(1) 在代码旁用注释标注"这就是刚才讲的X"；(2) 把代码拆成 3-5 行的小块；(3) 在每块前加一行「你正在看的这里对应刚才讲的X」',
          });
        } else if (codeReadabilityScore != null && codeReadabilityScore < 0.6) {
          add({
            moduleId,
            moduleName,
            severity: "medium",
            dimension: "代码可读性",
            title: `示范代码可读性偏低（${(codeReadabilityScore * 100).toFixed(0)}%）`,
            evidence: result.slice(0, 200),
            recommendation: "增加代码注释或拆分长代码块，降低阅读门槛",
          });
        }
      } else {
        codeReadabilityScore = null;
        console.log("     ⚠ 代码可读性评估失败");
      }
    }
  } catch (err) {
    console.log(`     ⚠ 观察示范分析出错：${String(err).slice(0, 80)}`);
  }

  // ---- 测 2：动手模仿页任务可及性 ----
  const imitateUrl = `${BASE_URL}/learn/${moduleId}/imitate`;
  console.log(`     🧪 断层检测：动手模仿 → ${imitateUrl}`);

  try {
    await page.goto(imitateUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // 等待模仿页渲染
    let imitateReady = false;
    for (let i = 0; i < 10; i++) {
      const found = await page.evaluate(() => {
        const body = document.body.innerText;
        // AssignmentCard 会渲染 "现在轮到你"
        if (body.includes("现在轮到你")) return true;
        // 或者编辑器已加载
        if (
          document.querySelector("[data-slot]") ||
          document.querySelector("textarea[data-slot]")
        )
          return true;
        // 或者 Composer
        if (document.querySelector("[data-slot='composer']")) return true;
        return false;
      });
      if (found) {
        imitateReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!imitateReady) {
      console.log("     ⚠ 动手模仿页未渲染");
      add({
        moduleId,
        moduleName,
        severity: "medium",
        dimension: "动手可及性",
        title: "动手模仿页未能渲染",
        evidence: "页面打开后未检测到任务卡或编辑器",
        recommendation: "检查动手模仿页路由和组件",
      });
      return {
        codeReadabilityScore,
        imitationGapScore: null,
        hasDemoCode,
        hasAssignment: false,
        codeReadabilityReason,
        imitationGapReason: "页面未渲染",
        conceptLeaks: [],
        knownTermCount: 0,
        unknownTermCount: 0,
        findings,
      };
    }

    // 提取任务文本
    const assignmentText = await page.evaluate(() => {
      // AssignmentCard "现在轮到你" 卡片
      const body = document.body.innerText;
      const idx = body.indexOf("现在轮到你");
      if (idx >= 0) {
        return body.slice(idx, idx + 1500);
      }
      // 回退：编辑区附近的内容
      const editor = document.querySelector("[data-slot]");
      if (editor) {
        const prev = editor.previousElementSibling;
        if (prev?.textContent) return prev.textContent;
      }
      return body.slice(0, 2000);
    });
    const assignment = assignmentText.slice(0, 3000);
    hasAssignment =
      assignment.includes("现在轮到你") || assignment.length > 100;

    if (!hasAssignment) {
      console.log("     ⚠ 动手模仿页无明确任务");
      add({
        moduleId,
        moduleName,
        severity: "high",
        dimension: "动手可及性",
        title: "动手任务缺失",
        evidence: "动手模仿页未检测到「现在轮到你」任务卡",
        recommendation: "在讲稿的「现在轮到你」节中明确写出动手任务",
      });
    } else {
      console.log(`     📋 动手任务 ${assignment.length} 字符`);

      // VLM 评估任务可及性
      const doabilityPrompt = `你是一个教学评估专家。下面是一个零基础学生刚看完的示范代码，以及"现在轮到你"的动手任务。

请评估：**这个学生能独立完成这个任务吗？**

评分标准（1-10）：
- 1-3：完全不能。任务要求的操作在示范里根本没出现，或者使用了学生没见过的概念。
- 4-6：勉强能试。需要大幅提示才能开始，大概率写错。
- 7-8：基本能做。任务是对示范的简单改写，有模板可依。
- 9-10：轻松完成。任务就是"照着示范换个输入"级别的难度。

请严格按以下格式回复（每段一行，不要加其他内容）：

总分：X/10
能独立做的：
需要帮助的：
任务是否匹配示范难度：`;

      const result = await gapEvaluate(
        "doability",
        doabilityPrompt,
        `【示范代码】\n${observeText.slice(0, 2000)}\n\n【动手任务】\n${assignment}`,
      );

      if (result) {
        imitationGapReason = result;
        const scoreMatch = result.match(/总分[：:]\s*(\d+)/);
        if (scoreMatch) {
          imitationGapScore = parseInt(scoreMatch[1], 10) / 10;
        } else {
          const lowKeywords = ["完全不能", "不能", "很难"];
          const midKeywords = ["勉强能", "部分能", "需要帮助"];
          const highKeywords = ["基本能做", "能独立", "轻松"];
          if (lowKeywords.some((k) => result.includes(k))) {
            imitationGapScore = 0.3;
          } else if (midKeywords.some((k) => result.includes(k))) {
            imitationGapScore = 0.55;
          } else if (highKeywords.some((k) => result.includes(k))) {
            imitationGapScore = 0.8;
          } else {
            imitationGapScore = 0.5;
          }
        }
        console.log(
          `     📊 动手可及性：${imitationGapScore != null ? (imitationGapScore * 10).toFixed(1) + "/10" : "N/A"}`,
        );

        if (imitationGapScore != null && imitationGapScore < 0.4) {
          // 如果代码可读性还行但动手做不来 → 代码-动手断层
          const codeReadable = (codeReadabilityScore ?? 0) >= 0.5;
          add({
            moduleId,
            moduleName,
            severity: codeReadable ? "critical" : "high",
            dimension: codeReadable ? "代码-动手断层" : "动手可及性",
            title: codeReadable
              ? `代码能看懂（${((codeReadabilityScore ?? 0) * 100).toFixed(0)}%）但动手做不来（${(imitationGapScore * 100).toFixed(0)}%）——示范与任务的桥梁断了`
              : `动手任务太难（${(imitationGapScore * 100).toFixed(0)}%）`,
            evidence: result.slice(0, 200),
            recommendation:
              "动手任务的难度远高于示范代码。建议：(1) 第一步改为「填空」型任务（给模板补缺）；(2) 第二步再是「改写」型；(3) 第三步才是「从零创建」型",
          });
        } else if (imitationGapScore != null && imitationGapScore < 0.6) {
          add({
            moduleId,
            moduleName,
            severity: "medium",
            dimension: "动手可及性",
            title: `动手任务偏难（${(imitationGapScore * 100).toFixed(0)}%）`,
            evidence: result.slice(0, 200),
            recommendation: "在任务描述中加入分步指引或给出起始模板",
          });
        }
      } else {
        imitationGapScore = null;
        console.log("     ⚠ 动手可及性评估失败");
      }
    }
  } catch (err) {
    console.log(`     ⚠ 动手模仿分析出错：${String(err).slice(0, 80)}`);
  }

  // ---- 交叉分析：概念-代码断层 ----
  if (
    explainComprehensionScore > 0.6 &&
    codeReadabilityScore != null &&
    codeReadabilityScore < 0.4
  ) {
    console.log(
      `     🔴 概念-代码断层：解释理解 ${(explainComprehensionScore * 100).toFixed(0)}% → 代码只懂 ${(codeReadabilityScore * 100).toFixed(0)}%`,
    );
  }
  if (
    codeReadabilityScore != null &&
    codeReadabilityScore >= 0.5 &&
    imitationGapScore != null &&
    imitationGapScore < 0.4
  ) {
    console.log(
      `     🔴 代码-动手断层：代码能看懂 ${(codeReadabilityScore * 100).toFixed(0)}% → 但写不出来 ${(imitationGapScore * 100).toFixed(0)}%`,
    );
  }

  return {
    codeReadabilityScore,
    imitationGapScore,
    hasDemoCode,
    hasAssignment,
    codeReadabilityReason,
    imitationGapReason,
    conceptLeaks,
    knownTermCount,
    unknownTermCount,
    findings,
  };
}

// ---- 主流程 ----

async function main(): Promise<void> {
  // 不再需要 ARK_API_KEY——LLM 调用通过平台代理端点完成

  const options: ScreenDescriberOptions = {
    baseUrl: BASE_URL,
    studentId: STUDENT_ID,
    visionModel: "deepseek-v4.1-flash",
    visionApiKey: "",
    visionBaseUrl: BASE_URL,
    proxyUrl: `${BASE_URL}/api/audit/evaluate`,
  };

  // 从环境变量或硬编码获取模块列表
  const validModuleIds = new Set(getDefaultModuleList().map((m) => m.id));
  const moduleListStr = process.env[AUDIT_MODULES_KEY];
  let moduleList: { id: string; name: string; difficulty: number }[];
  if (moduleListStr) {
    try {
      const parsed = JSON.parse(moduleListStr) as {
        id: string;
        name: string;
        difficulty: number;
      }[];
      // 过滤：只保留实际存在于课程列表中的模块ID
      const filtered = parsed.filter((m) => validModuleIds.has(m.id));
      moduleList = filtered.length > 0 ? filtered : getDefaultModuleList();
    } catch {
      moduleList = getDefaultModuleList();
    }
  } else {
    moduleList = getDefaultModuleList();
  }

  console.log(`📋 审计范围：${moduleList.length} 个模块`);
  console.log(`   模块列表：${moduleList.map((m) => m.id).join("、")}`);
  console.log(`   学生：${STUDENT_ID}`);
  console.log(`   LLM 调用：通过平台代理端点（无需 API Key）\n`);

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

  const results: ModuleAuditResult[] = [];

  for (let i = 0; i < moduleList.length; i++) {
    const mod = moduleList[i];
    console.log(
      `\n━━━ [${i + 1}/${moduleList.length}] ${mod.name}（${mod.id}）━━━`,
    );

    let result: ModuleAuditResult;
    try {
      result = await auditModule(
        mod.id,
        mod.name,
        mod.difficulty,
        page,
        options,
      );
    } catch (err) {
      console.log(`     ❌ 审计崩溃：${String(err)}`);
      result = {
        moduleId: mod.id,
        moduleName: mod.name,
        difficulty: mod.difficulty,
        reachable: false,
        hasContent: false,
        contentLength: 0,
        rounds: 0,
        comprehensionScore: 0,
        cognitiveStateEnd: "giving_up",
        probeScore: null,
        queryRelevanceScore: null,
        codeReadabilityScore: null,
        imitationGapScore: null,
        hasDemoCode: false,
        hasAssignment: false,
        findings: [
          {
            moduleId: mod.id,
            moduleName: mod.name,
            severity: "critical" as Severity,
            dimension: "可达性",
            title: "审计脚本崩溃",
            evidence: String(err),
            recommendation: "检查 dev server 是否在运行、网络是否正常",
          },
        ],
      };
    }

    // ---- 追加：概念-代码断层检测 ----
    if (result.reachable && result.hasContent) {
      try {
        const gap = await auditCodeGap(
          mod.id,
          mod.name,
          result.comprehensionScore,
          page,
        );
        result.codeReadabilityScore = gap.codeReadabilityScore;
        result.imitationGapScore = gap.imitationGapScore;
        result.hasDemoCode = gap.hasDemoCode;
        result.hasAssignment = gap.hasAssignment;
        result.findings.push(...gap.findings);
      } catch (gapErr) {
        console.log(`     ⚠ 断层检测异常：${String(gapErr).slice(0, 80)}`);
        result.codeReadabilityScore = null;
        result.imitationGapScore = null;
        result.hasDemoCode = false;
        result.hasAssignment = false;
      }
    } else {
      result.codeReadabilityScore = null;
      result.imitationGapScore = null;
      result.hasDemoCode = false;
      result.hasAssignment = false;
    }

    results.push(result);

    console.log(
      `   结果：可达=${result.reachable} 内容=${result.contentLength}字 理解=${(result.comprehensionScore * 100).toFixed(0)}% 探针=${result.probeScore != null ? (result.probeScore * 100).toFixed(0) + "%" : "N/A"} 代码可读=${result.codeReadabilityScore != null ? (result.codeReadabilityScore * 10).toFixed(0) + "/10" : "N/A"} 动手可及=${result.imitationGapScore != null ? (result.imitationGapScore * 10).toFixed(0) + "/10" : "N/A"} 缺陷=${result.findings.length}`,
    );
    for (const finding of result.findings) {
      const icon =
        finding.severity === "critical"
          ? "🔴"
          : finding.severity === "high"
            ? "🟠"
            : "🟡";
      console.log(`   ${icon} [${finding.dimension}] ${finding.title}`);
    }
  }

  // 生成报告
  const report = generateReport(results);
  const reportPath = path.join(OUT_DIR, "curriculum-audit-report.md");
  writeFileSync(reportPath, report, "utf-8");
  console.log(`\n📋 报告已生成：${reportPath}`);

  // 也保存 JSON
  writeFileSync(
    path.join(OUT_DIR, "curriculum-audit-data.json"),
    JSON.stringify(results, null, 2),
    "utf-8",
  );

  // 终端摘要
  const criticalCount = results
    .flatMap((r) => r.findings)
    .filter((f) => f.severity === "critical").length;
  const highCount = results
    .flatMap((r) => r.findings)
    .filter((f) => f.severity === "high").length;
  const unreachable = results.filter((r) => !r.reachable);
  const noContent = results.filter((r) => r.reachable && !r.hasContent);
  const lowComprehension = results.filter(
    (r) => r.comprehensionScore > 0 && r.comprehensionScore < 0.5,
  );

  console.log(`\n📊 审计摘要`);
  console.log(`   不可达：${unreachable.length} 讲`);
  console.log(`   无内容：${noContent.length} 讲`);
  console.log(
    `   理解度 < 50%：${lowComprehension.map((r) => r.moduleName).join("、") || "无"}`,
  );

  // 断层摘要
  const gapReadable = results.filter(
    (r) => r.codeReadabilityScore != null && r.codeReadabilityScore < 0.5,
  );
  const gapImitate = results.filter(
    (r) => r.imitationGapScore != null && r.imitationGapScore < 0.4,
  );
  const conceptCodeGap = results.filter(
    (r) =>
      r.comprehensionScore > 0.5 &&
      r.codeReadabilityScore != null &&
      r.codeReadabilityScore < 0.5,
  );
  const codeImitateGap = results.filter(
    (r) =>
      r.codeReadabilityScore != null &&
      r.codeReadabilityScore >= 0.5 &&
      r.imitationGapScore != null &&
      r.imitationGapScore < 0.4,
  );
  console.log(
    `   代码可读性 < 5/10：${gapReadable.map((r) => `${r.moduleName}${r.hasDemoCode ? "" : "(无示范)"}`).join("、") || "无"}`,
  );
  console.log(
    `   动手可及性 < 4/10：${gapImitate.map((r) => `${r.moduleName}${r.hasAssignment ? "" : "(无任务)"}`).join("、") || "无"}`,
  );
  if (conceptCodeGap.length > 0) {
    console.log(
      `   🔴 概念→代码断层：${conceptCodeGap.map((r) => `${r.moduleName}(${(r.comprehensionScore * 100).toFixed(0)}%→${((r.codeReadabilityScore ?? 0) * 100).toFixed(0)}%)`).join("、")}`,
    );
  }
  if (codeImitateGap.length > 0) {
    console.log(
      `   🔴 代码→动手断层：${codeImitateGap.map((r) => `${r.moduleName}(${((r.codeReadabilityScore ?? 0) * 100).toFixed(0)}%→${((r.imitationGapScore ?? 0) * 100).toFixed(0)}%)`).join("、")}`,
    );
  }
  console.log(`   Critical 缺陷：${criticalCount}`);
  console.log(`   High 缺陷：${highCount}`);

  await browser.close();
  await closeBrowser();
}

/** 默认模块列表（按教学顺序排列）。 */
function getDefaultModuleList(): {
  id: string;
  name: string;
  difficulty: number;
}[] {
  return [
    { id: "ts-basics", name: "TypeScript 基础", difficulty: 1 },
    { id: "llm-api", name: "LLM API 入门", difficulty: 1 },
    { id: "system-prompt", name: "系统提示词", difficulty: 2 },
    { id: "agent-loop", name: "Agent 循环", difficulty: 3 },
    { id: "tool-calling", name: "工具调用", difficulty: 3 },
    { id: "rag", name: "RAG 检索增强生成", difficulty: 3 },
    { id: "llm-wiki", name: "LLM Wiki", difficulty: 3 },
    { id: "platform-replica", name: "平台复刻", difficulty: 3 },
    { id: "multi-agent", name: "多 Agent 协作", difficulty: 4 },
    { id: "mcp", name: "MCP 协议", difficulty: 4 },
    { id: "ai-safety", name: "AI 安全", difficulty: 4 },
  ];
}

main().catch((err) => {
  console.error("审计失败：", err);
  process.exit(1);
});
