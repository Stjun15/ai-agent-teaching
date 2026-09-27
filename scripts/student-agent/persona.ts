/**
 * 学生 persona 的模型调用层。
 *
 * 为什么不走 runAgent
 * ----------------
 * `runAgent` 的四 Agent 注册是**数据库契约**（AgentEvent/AgentTrace 的
 * agent 字段在 data-models.md 写死四值），学生 Agent 是课程体检工具角色，
 * 不属于教学编排——写进契约语义不对，还要动迁移的 CHECK 约束。
 * 这里复用同一会话工厂（`createSession`，资源策略一致）+ 同一 JSON 提取器
 * （`extractJson`），Zod 校验 + 回喂重试在本地实现 —— 铁律「Agent 输出必须
 * JSON + Zod 校验」逐条满足，只是不进教学轨迹。
 *
 * 工具权限
 * ----
 * 学生**零工具**（不传 tools）——它只读材料、写提交物，铁律「权限由代码
 * 控制」在「不授权」这一侧同样成立。
 */

import { createSession } from "@/lib/agent/session";
import { extractJson } from "@/lib/agent/runtime";
import {
  DILIGENT_TRAIT,
  SLOPPY_TRAIT,
  STUDENT_SYSTEM_PROMPT,
} from "@/lib/agent/prompts/student";
import {
  StudentReportSchema,
  type StudentMode,
  type StudentReport,
} from "./schema";

/** 学生这一步的任务输入。 */
export interface StudentTask {
  /** 模块名（给学生看的，如「LLM API 入门」）。 */
  module: string;
  /** 步骤名（如「动手模仿」）。 */
  step: string;
  /** 教学材料原文（讲稿 / 任务卡 / 示范代码 / 题目）。 */
  material: string;
  /** 这一步要求学生做什么（驱动器的一句话指令）。 */
  instruction: string;
}

const MAX_ATTEMPTS = 3;

function buildSystemPrompt(mode: StudentMode): string {
  const trait = mode === "sloppy" ? SLOPPY_TRAIT : DILIGENT_TRAIT;
  return `${STUDENT_SYSTEM_PROMPT}\n\n${trait}`;
}

function buildUserMessage(
  task: StudentTask,
  previousAttempt: { error: string; rawText: string } | null,
): string {
  const parts = [
    "## 本次输入",
    "",
    `- 模块：${task.module}`,
    `- 步骤：${task.step}`,
    `- 任务：${task.instruction}`,
    "",
    "## 教学材料",
    "",
    task.material,
    "",
    "## 输出要求",
    "",
    "严格按 System Prompt 里「输出格式」声明的 JSON 返回。只输出 JSON 本身。",
  ];
  if (previousAttempt) {
    parts.push(
      "",
      "## 上一次输出未通过校验",
      "",
      `错误：${previousAttempt.error}`,
      "",
      "你上一次的输出（已截断）：",
      "",
      previousAttempt.rawText.slice(0, 800),
      "",
      "请修正后重新输出完整 JSON。",
    );
  }
  return parts.join("\n");
}

/**
 * 让学生完成一步认知任务，返回校验过的结构化报告。
 * JSON 解析 / Zod 校验失败时把**具体错误与上次原文**回喂重试（最多 3 次尝试），
 * 与 runAgent 的重试纪律一致。
 */
export async function askStudent(
  task: StudentTask,
  mode: StudentMode,
): Promise<{
  report: StudentReport;
  tokens: { input: number; output: number };
}> {
  const systemPrompt = buildSystemPrompt(mode);
  const tokens = { input: 0, output: 0 };
  let previousAttempt: { error: string; rawText: string } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let rawText = "";
    const handle = await createSession({
      systemPrompt,
      // 只收文本增量与用量：学生零工具，工具事件不应出现。
      onEvent: (event) => {
        if (event.type === "message_update") {
          const inner = event.assistantMessageEvent;
          if (inner.type === "text_delta") rawText += inner.delta;
          return;
        }
        if (event.type === "turn_end" && event.message.role === "assistant") {
          tokens.input += event.message.usage.input;
          tokens.output += event.message.usage.output;
        }
      },
    });
    try {
      await handle.prompt(buildUserMessage(task, previousAttempt));
    } finally {
      handle.dispose();
    }

    const json = extractJson(rawText);
    if (json === null) {
      previousAttempt = { error: "输出里找不到 JSON 对象。", rawText };
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      previousAttempt = {
        error: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
        rawText,
      };
      continue;
    }
    const result = StudentReportSchema.safeParse(parsed);
    if (result.success) {
      return { report: result.data, tokens };
    }
    previousAttempt = {
      error: result.error.issues
        .map((issue) => `${issue.path.join(".") || "(根)"} ${issue.message}`)
        .join("；"),
      rawText,
    };
  }
  throw new Error(
    `学生 Agent 连续 ${MAX_ATTEMPTS} 次输出不合规，最后一次错误：${previousAttempt?.error ?? "未知"}`,
  );
}
