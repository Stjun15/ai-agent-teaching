/**
 * 学生 Agent 驱动器 —— 以学生身份真实走一个模块的七步教学链路。
 *
 * 走的管线与学生浏览器完全同构（同一批 HTTP 端点、同一套评分、
 * 同一套落库），所以体检结论直接等价于「管线健康」：
 *
 *   explain  GET  /api/lecture-cache          讲稿（缓存路径）
 *            POST /api/chat                   就讲稿里的困惑真实提问（SSE）
 *   observe  读示范代码（复用 readDemoCode，零成本）
 *   imitate  学生 persona 写作业（材料 = 任务卡 + 示范代码）
 *            POST /api/session + /api/agent/validate   真实点评落库
 *   practice POST /api/agent/generate-question → 学生作答 → /api/agent/answer-grade
 *   mastery  GET  /api/student/mastery        掌握度更新与解锁验证
 *
 * 学生身份：`agent-` 前缀的专用学生（写入 students 表），与演示学生隔离。
 * 两种性格：diligent（测课程可达性）/ sloppy（测点评质量），按 --mode 切换。
 *
 * 运行：pnpm simulate:module -- --module=llm-api --mode=diligent
 * 报告：student-agent-output/simulation-<module>-<mode>.md
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DatabaseSync } from "node:sqlite";

import { handleSSE } from "@/lib/sse";
import { readDemoCode } from "@/lib/teaching-script";
import { splitLecture } from "@/lib/lecture-split";
import { findModule } from "@/lib/modules";
import { askStudent } from "./persona";

// ---- 参数 ----
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined =>
  args
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");

const moduleId = getArg("module") ?? "python-basics"; // 默认从教学链起点开始
const mode = (getArg("mode") ?? "diligent") as "diligent" | "sloppy";
const BASE = "http://localhost:3000";
const STUDENT_ID =
  mode === "sloppy"
    ? "a9e70000-0000-4000-8000-0000000000a2"
    : "a9e70000-0000-4000-8000-0000000000a1";
const STUDENT_NICKNAME =
  mode === "sloppy" ? "学生Agent·易错" : "学生Agent·认真";
// ---- 学生身份注册（真实表，agent- 前缀隔离）----
function ensureStudent(): void {
  const db = new DatabaseSync("dev.db");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO students (id, nickname, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
  ).run(STUDENT_ID, STUDENT_NICKNAME, now, now);
  db.close();
}

// ---- 学生头的 HTTP 助手 ----
async function apiPost<T>(
  urlPath: string,
  body: unknown,
): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-student-id": STUDENT_ID,
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => null)) as T | null;
  return { status: res.status, data };
}

async function apiGet<T>(
  urlPath: string,
): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${BASE}${urlPath}`, {
    headers: { "x-student-id": STUDENT_ID },
  });
  const data = (await res.json().catch(() => null)) as T | null;
  return { status: res.status, data };
}

/** 收一条 SSE 回复的全部文本（学生视角的「导师回答」）。 */
async function readChatReply(content: string, step: string): Promise<string> {
  let reply = "";
  await handleSSE(
    `${BASE}/api/chat`,
    { content, step },
    (event) => {
      if (event.type === "token") reply += event.data.content;
    },
    { headers: { "x-student-id": STUDENT_ID } },
  );
  return reply;
}

// ---- 报告骨架 ----
interface StepLog {
  step: string;
  ok: boolean;
  detail: string;
}
const logs: StepLog[] = [];
function log(step: string, ok: boolean, detail: string): void {
  logs.push({ step, ok, detail });
  console.log(`  [${ok ? "✓" : "✗"}] ${step}：${detail}`);
}

async function main(): Promise<void> {
  ensureStudent();
  const mod = await findModule(moduleId);
  if (!mod) throw new Error(`模块 ${moduleId} 不存在`);

  console.log(`学生 Agent 模拟开始：${mod.name}（${mode}）`);

  // ---- ① explain：讲稿 + 困惑提问 ----
  const cache = await apiGet<{ found: boolean; content: string }>(
    `/api/lecture-cache?moduleId=${moduleId}&step=explain`,
  );
  const lecture = cache.data?.found ? cache.data.content : "";
  log(
    "explain·讲稿",
    lecture !== "",
    lecture ? `${lecture.length} 字（缓存）` : "缓存未命中",
  );
  if (lecture === "")
    throw new Error("没有讲稿缓存，请先跑 generate-lecture-cache");

  const { report: readReport } = await askStudent(
    {
      module: mod.name,
      step: "概念讲解",
      material: splitLecture(lecture).teaching,
      instruction: "读完这篇讲稿，报告你的理解与还没搞懂的点。",
    },
    mode,
  );
  let confusionDetail = "没有困惑";
  if (readReport.confusions.length > 0) {
    const q = readReport.confusions[0];
    const reply = await readChatReply(q, "explain");
    confusionDetail = `困惑「${q}」→ 导师回复 ${reply.length} 字`;
  }
  log("explain·提问", true, confusionDetail);

  // ---- ② observe：示范代码（wiki 直读，零成本）----
  const demoCode = readDemoCode(moduleId);
  log(
    "observe·示范代码",
    demoCode !== "",
    demoCode ? `${demoCode.length} 字` : "缺失（体检器 WARN 已覆盖）",
  );

  // ---- ③④ imitate + validate：写作业 + 真实点评 ----
  const assignment = splitLecture(lecture).assignment ?? "（讲稿没有任务节）";
  const { report: submissionReport } = await askStudent(
    {
      module: mod.name,
      step: "动手模仿",
      material: `${assignment}\n\n---\n示范代码（参考）：\n${demoCode}`,
      instruction:
        "完成任务卡里布置的作业，把要提交的内容完整写进 submission。",
    },
    mode,
  );

  const session = await apiPost<{ sessionId: string }>("/api/session", {
    studentId: STUDENT_ID,
    moduleId,
  });
  if (session.status !== 200 || !session.data) {
    throw new Error(`建会话失败：${session.status}`);
  }
  const review = await apiPost<{
    totalScore: number;
    isCorrect: boolean;
    success: boolean;
    usedFallback: boolean;
  }>("/api/agent/validate", {
    studentId: STUDENT_ID,
    sessionId: session.data.sessionId,
    moduleId,
    taskType: "code",
    content: submissionReport.submission,
  });
  const reviewData = review.data;
  log(
    "validate·点评",
    review.status === 200 && reviewData !== null && !reviewData.usedFallback,
    reviewData
      ? `${reviewData.totalScore}/100，${reviewData.isCorrect ? "通过" : "未通过"}${reviewData.usedFallback ? "（兜底）" : ""}`
      : `HTTP ${review.status}`,
  );

  // ---- ⑥ practice：出题 + 作答 + 真实判分 ----
  const gen = await apiPost<{
    questions: {
      id: string;
      type: string;
      question: string;
      options?: string[];
    }[];
    usedFallback: boolean;
  }>("/api/agent/generate-question", {
    studentId: STUDENT_ID,
    moduleId,
    count: 3,
  });
  const questions = gen.data?.questions ?? [];
  log(
    "practice·出题",
    gen.status === 200 && questions.length > 0 && !gen.data?.usedFallback,
    `${questions.length} 题`,
  );

  let graded = 0;
  let correct = 0;
  const detail = await apiPost<{ sessionId: string }>("/api/session", {
    studentId: STUDENT_ID,
    moduleId,
  });
  for (const question of questions) {
    const { report: answerReport } = await askStudent(
      {
        module: mod.name,
        step: "变式练习",
        material: `${question.question}${question.options ? `\n选项：\n${question.options.join("\n")}` : ""}`,
        instruction: "直接回答这道题。答案写进 submission，不要解释。",
      },
      mode,
    );
    const grade = await apiPost<{
      isCorrect: boolean;
      score: number;
      usedFallback: boolean;
    }>("/api/agent/answer-grade", {
      studentId: STUDENT_ID,
      sessionId: detail.data?.sessionId,
      moduleId,
      conceptId: moduleId,
      questionId: question.id,
      studentAnswer: answerReport.submission,
    });
    if (grade.status === 200 && !grade.data?.usedFallback) {
      graded += 1;
      if (grade.data?.isCorrect) correct += 1;
    }
  }
  log(
    "practice·判分",
    questions.length > 0 && graded === questions.length,
    `判分 ${graded}/${questions.length}，答对 ${correct}`,
  );

  // ---- ⑦ mastery：掌握度更新验证 ----
  // 端点返回 { mastery: [...] } 包一层：解包后再找当前模块。
  const mastery = await apiGet<{
    mastery: { conceptId: string; score: number; updatedAt: string }[];
  }>("/api/student/mastery");
  const mine = mastery.data?.mastery.find((m) => m.conceptId === moduleId);
  log(
    "mastery·掌握度",
    mastery.status === 200,
    mine
      ? `${mine.conceptId} = ${mine.score}/5（更新于 ${mine.updatedAt}）`
      : "无记录",
  );

  // ---- 报告 ----
  const failed = logs.filter((l) => !l.ok);
  const report = [
    `# 学生 Agent 模拟报告`,
    "",
    `- 模块：${mod.name}（${moduleId}）`,
    `- 性格：${mode === "sloppy" ? "sloppy（易错学生）" : "diligent（认真学习）"}`,
    `- 学生身份：${STUDENT_ID}`,
    `- 生成时间：${new Date().toISOString()}`,
    `- 结论：${failed.length === 0 ? "全链路通过" : `${failed.length} 步未通过`}`,
    "",
    `## 学生理解自述`,
    "",
    readReport.understanding,
    readReport.confusions.length > 0
      ? `\n**困惑**：${readReport.confusions.join("；")}`
      : "",
    "",
    `## 逐步记录`,
    "",
    ...logs.map((l) => `- **[${l.ok ? "✓" : "✗"} ${l.step}]** ${l.detail}`),
    "",
    `## 提交的作业（原文）`,
    "",
    "```",
    submissionReport.submission,
    "```",
    "",
    reviewData
      ? `## 点评结论：${reviewData.totalScore}/100，${reviewData.isCorrect ? "通过" : "未通过"}`
      : "",
  ].join("\n");

  const outDir = path.resolve("student-agent-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `simulation-${moduleId}-${mode}.md`);
  writeFileSync(outPath, report, "utf8");
  console.log(`报告：${outPath}`);
}

main().catch((error) => {
  console.error("模拟失败：", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
