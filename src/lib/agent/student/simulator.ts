/**
 * 学生模拟器（服务层）—— 教师端「让一个模拟学生把这一讲过一遍」
 *
 * 形态：**服务层模拟**，不启浏览器
 * ---------------------------------
 * 每一轮只做两件事：
 *   1. See —— `buildScreenDigest` 把「学生此刻屏幕上的内容」拼成文本；
 *   2. Act —— 调模型扮演学生说一句话（`action: ask | give_up`）。
 * 导师那一侧**直接调 lib 层**（`buildTeachingScript` + `resolveStepAgent` +
 * `runTextCompletion`），不走 HTTP、不复制 `/api/chat` 路由的拼装逻辑。
 *
 * 为什么不做 Playwright 版
 * ---------------------
 * Playwright 版仍在离线工具里（`screen-describer.ts` / `action-executor.ts`），
 * 它要跑通需要浏览器、水合、SSE 时序全部就绪，失败原因分不清是「内容讲不通」
 * 还是「环境没起来」。教师端要的是**可重复的内容回归**，所以选服务层。
 * 这条边界是公开的：`documentedLimitation` 常量会随运行结果一起回给教师。
 *
 * 数据归属
 * --------
 * 运行记录写 `simulation_runs` / `simulation_turns`，不写 `sessions` / `messages`：
 * 模拟学生不是真实学生，混进学生会话会污染掌握度与报告的所有聚合。
 *
 * 可测试性
 * --------
 * 模型调用、落库都从 `deps` 注入：不传时走真实实现。测试可以用假的 complete
 * 跑完整个循环，断言「第几轮停、为什么停、token 怎么累加」而不花一分钱。
 */

import { z } from "zod";

import { runTextCompletion, extractJson } from "@/lib/agent/runtime";
import { resolveStepAgent } from "@/lib/agent/step-prompt";
import { composeHistory, type AgentHistoryTurn } from "@/lib/agent/loop";
import { simulationDb } from "@/lib/db";
import type {
  SimulationRun,
  SimulationRunStatus,
  SimulationStopReason,
  SimulationTurn,
} from "@/lib/db/types";
import { findModule } from "@/lib/modules";
import { buildTeachingScript } from "@/lib/teaching-script";
import { buildScreenDigest, type DigestTranscriptEntry } from "./screen-digest";
import { budgetToStop, checkTurnBudget, SIMULATION_LIMITS } from "./limits";
import { buildSimulatedStudentPrompt, findPersona } from "./personas";

/**
 * 已知边界：随结果一起显示给教师。
 *
 * 把「测不到什么」写在代码里并回显到界面，而不是留在文档里 ——
 * 教师看到一份「零缺陷」的模拟结果时，必须同时知道它不覆盖交互缺陷。
 */
export const SIMULATED_SCOPE_NOTE =
  "服务层模拟：只覆盖讲解内容是否讲得通与被追问时的回答质量；" +
  "不覆盖按钮点击、输入框校验、页面渲染等交互缺陷（那些走浏览器验收脚本）。";

/** 模拟学生的输出契约。 */
export const simulatedStudentTurnSchema = z.object({
  action: z.enum(["ask", "give_up"]),
  content: z.string().trim().min(1).max(300),
  cognitiveState: z.enum([
    "normal",
    "stuck",
    "confused",
    "overconfident",
    "bored",
    "giving_up",
  ]),
});

export type SimulatedStudentTurn = z.infer<typeof simulatedStudentTurnSchema>;

export type ParsedStudentTurn =
  | { ok: true; data: SimulatedStudentTurn }
  | { ok: false; error: string };

/**
 * 解析模拟学生的输出。
 *
 * 与 `runtime.ts` 的 `executeAgent` 同一套判据（先无损提取、再 JSON、再 Zod），
 * 但**不重试**：模拟学生的输出只是教师看的一段素材，不是要落库的评分结果；
 * 重试会让一次运行的成本悄悄翻倍，而失败时把原文回给教师更诚实。
 */
export function parseSimulatedStudentTurn(rawText: string): ParsedStudentTurn {
  const json = extractJson(rawText);
  if (json === null) {
    return { ok: false, error: "输出里找不到 JSON 对象。" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      error: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const result = simulatedStudentTurnSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "(根)"} ${issue.message}`)
        .join("；"),
    };
  }

  return { ok: true, data: result.data };
}

/** 一次模型调用的形状（真实实现是 `runTextCompletion`）。 */
export type SimulationCompletion = (options: {
  systemPrompt: string;
  userMessage: string;
  signal?: AbortSignal;
}) => Promise<{ text: string; tokens: { input: number; output: number } }>;

/** 收尾汇总，与 `simulationDb.finish` 的形状一致。 */
export interface SimulationFinishSummary {
  status: SimulationRunStatus;
  turnsUsed: number;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  stopReason?: SimulationStopReason | null;
  error?: string | null;
}

export interface SimulationDeps {
  /** 模型调用。省略时走真实模型。 */
  complete?: SimulationCompletion;
  /** 逐轮落库。省略时写 `simulation_turns`。 */
  appendTurn?: (turn: SimulationTurn) => Promise<void>;
  /** 收尾落库。省略时写 `simulation_runs`。 */
  finish?: (runId: string, summary: SimulationFinishSummary) => Promise<void>;
  /** 教师取消 / 请求中断。 */
  signal?: AbortSignal;
}

export interface SimulationOutcome {
  status: SimulationRunStatus;
  turnsUsed: number;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  stopReason: SimulationStopReason | null;
  error: string | null;
}

/** 导师侧系统提示词：与 `/api/chat` 相同的拼装顺序（脚本在前、身份在后）。 */
function buildMentorPrompt(moduleId: string, step: SimulationRun["step"]): string {
  const { script } = buildTeachingScript(moduleId, step);
  const spec = resolveStepAgent(step);
  return [script, spec.systemPrompt].filter((part) => part !== "").join("\n\n");
}

/** 把模拟用的对话记录映射成 `composeHistory` 认识的角色。 */
function toHistoryTurns(
  transcript: readonly DigestTranscriptEntry[],
): AgentHistoryTurn[] {
  return transcript.map((entry) => ({
    role: entry.speaker === "student" ? "student" : "assistant",
    content: entry.content,
  }));
}

/**
 * 跑完一次模拟（阻塞到结束，调用方负责把它放进后台任务）。
 *
 * 结束条件（三者都会写 `stopReason`，教师能分辨为什么停）：
 *   - 跑满 `maxTurns`          → `max-turns`
 *   - 模拟学生主动放弃         → `student-gave-up`
 *   - 触发单轮/累计 token 上限 → `token-budget`
 * 只有「人设不存在 / 模块读不到 / 模型报错 / 输出不合法」才算 `failed`。
 */
export async function executeSimulation(
  run: SimulationRun,
  deps: SimulationDeps = {},
): Promise<SimulationOutcome> {
  const complete = deps.complete ?? runTextCompletion;
  const appendTurn = deps.appendTurn ?? ((turn) => simulationDb.appendTurn(turn));
  const finish =
    deps.finish ?? ((runId, summary) => simulationDb.finish(runId, summary));

  const startedMs = Date.parse(run.startedAt) || Date.now();
  const transcript: DigestTranscriptEntry[] = [];
  let turnsUsed = 0;
  let tokensInput = 0;
  let tokensOutput = 0;

  const settle = async (
    summary: Omit<SimulationFinishSummary, "durationMs" | "turnsUsed" | "tokensInput" | "tokensOutput">,
  ): Promise<SimulationOutcome> => {
    const full: SimulationFinishSummary = {
      ...summary,
      turnsUsed,
      tokensInput,
      tokensOutput,
      durationMs: Date.now() - startedMs,
    };
    await finish(run.id, full);
    return {
      status: full.status,
      turnsUsed,
      tokensInput,
      tokensOutput,
      durationMs: full.durationMs,
      stopReason: full.stopReason ?? null,
      error: full.error ?? null,
    };
  };

  const persona = findPersona(run.persona);
  if (!persona) {
    return settle({
      status: "failed",
      stopReason: null,
      error: `未知人设：${run.persona}`,
    });
  }

  const moduleMeta = await findModule(run.moduleId);
  if (!moduleMeta) {
    return settle({
      status: "failed",
      stopReason: null,
      error: `模块不存在：${run.moduleId}`,
    });
  }

  const lectureText = buildTeachingScript(run.moduleId, run.step).script;
  const mentorSystemPrompt = buildMentorPrompt(run.moduleId, run.step);

  for (let turnIndex = 1; turnIndex <= run.maxTurns; turnIndex += 1) {
    if (deps.signal?.aborted) {
      return settle({ status: "aborted", stopReason: null, error: "教师取消" });
    }

    const digest = buildScreenDigest({
      moduleId: run.moduleId,
      moduleName: moduleMeta.name,
      step: run.step,
      lectureText,
      transcript,
    });

    // --- See → Act：模拟学生这一轮说什么 ---
    const studentPrompt = buildSimulatedStudentPrompt({
      persona,
      digest,
      turnIndex,
      maxTurns: run.maxTurns,
    });

    const studentStartedMs = Date.now();
    let studentReply: { text: string; tokens: { input: number; output: number } };
    try {
      studentReply = await complete({
        systemPrompt: studentPrompt.systemPrompt,
        userMessage: studentPrompt.userMessage,
        signal: deps.signal,
      });
    } catch (error) {
      return settle({
        status: "failed",
        stopReason: null,
        error: `第 ${turnIndex} 轮模拟学生调用失败：${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const studentDuration = Date.now() - studentStartedMs;
    tokensInput += studentReply.tokens.input;
    tokensOutput += studentReply.tokens.output;
    turnsUsed += 1;

    const parsed = parseSimulatedStudentTurn(studentReply.text);
    if (!parsed.ok) {
      // 把模型原话留给教师看：只写「解析失败」会让人无从判断是模型跑飞还是判据过严。
      await appendTurn({
        id: crypto.randomUUID(),
        runId: run.id,
        turnIndex,
        speaker: "student",
        content: studentReply.text.slice(0, 2000),
        screenDigest: digest,
        cognitiveState: null,
        actionType: "unparsed",
        tokensInput: studentReply.tokens.input,
        tokensOutput: studentReply.tokens.output,
        durationMs: studentDuration,
        createdAt: new Date().toISOString(),
      });
      return settle({
        status: "failed",
        stopReason: null,
        error: `第 ${turnIndex} 轮模拟学生输出不符合契约：${parsed.error}`,
      });
    }

    const studentTurn: SimulationTurn = {
      id: crypto.randomUUID(),
      runId: run.id,
      turnIndex,
      speaker: "student",
      content: parsed.data.content,
      screenDigest: digest,
      cognitiveState: parsed.data.cognitiveState,
      actionType: parsed.data.action,
      tokensInput: studentReply.tokens.input,
      tokensOutput: studentReply.tokens.output,
      durationMs: studentDuration,
      createdAt: new Date().toISOString(),
    };
    await appendTurn(studentTurn);

    // 成本判定：单轮超限说明这一轮本身失控，直接停整个运行。
    const studentBudget = checkTurnBudget({
      tokensSoFar: tokensInput + tokensOutput,
      turnTokens: studentReply.tokens.input + studentReply.tokens.output,
    });
    if (!studentBudget.allowed) {
      return settle(budgetToStop(studentBudget.message));
    }

    if (parsed.data.action === "give_up") {
      transcript.push({ speaker: "student", content: parsed.data.content });
      return settle({ status: "completed", stopReason: "student-gave-up", error: null });
    }

    // --- 导师回答：直接调 lib 层，走 HTTP 之外的同一条口径 ---
    const mentorUserMessage = [
      composeHistory(toHistoryTurns(transcript)),
      `学生说：${parsed.data.content}`,
    ].join("\n");

    const mentorStartedMs = Date.now();
    let mentorReply: { text: string; tokens: { input: number; output: number } };
    try {
      mentorReply = await complete({
        systemPrompt: mentorSystemPrompt,
        userMessage: mentorUserMessage,
        signal: deps.signal,
      });
    } catch (error) {
      transcript.push({ speaker: "student", content: parsed.data.content });
      return settle({
        status: "failed",
        stopReason: null,
        error: `第 ${turnIndex} 轮导师调用失败：${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const mentorDuration = Date.now() - mentorStartedMs;
    tokensInput += mentorReply.tokens.input;
    tokensOutput += mentorReply.tokens.output;

    const mentorTurn: SimulationTurn = {
      id: crypto.randomUUID(),
      runId: run.id,
      turnIndex,
      speaker: "mentor",
      content: mentorReply.text.trim(),
      screenDigest: "",
      cognitiveState: null,
      actionType: null,
      tokensInput: mentorReply.tokens.input,
      tokensOutput: mentorReply.tokens.output,
      durationMs: mentorDuration,
      createdAt: new Date().toISOString(),
    };
    await appendTurn(mentorTurn);

    transcript.push({ speaker: "student", content: parsed.data.content });
    transcript.push({ speaker: "mentor", content: mentorTurn.content });

    const mentorBudget = checkTurnBudget({
      tokensSoFar: tokensInput + tokensOutput,
      turnTokens: mentorReply.tokens.input + mentorReply.tokens.output,
    });
    if (!mentorBudget.allowed) {
      return settle(budgetToStop(mentorBudget.message));
    }
  }

  return settle({ status: "completed", stopReason: "max-turns", error: null });
}

/** 让 `SIMULATION_LIMITS` 的注释与代码保持在一起可查（供 UI 显示上限）。 */
export { SIMULATION_LIMITS };
