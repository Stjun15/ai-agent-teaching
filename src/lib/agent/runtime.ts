/**
 * Agent 运行时 —— 跑一个 Agent + 一个 Skill，拿到**结构化**输出
 *
 * 与 `loop.ts` 的分工
 * ------------------
 * `loop.ts` 是**流式**路径：把模型输出逐帧翻译成 SSE，给前端边收边显示。
 * 本文件是**非流式**路径：跑完拿整段文本，解析成 JSON 并用 Zod 校验，
 * 交给编排层做决策。两者共用 `session.ts` 的会话工厂，保证资源锁定策略一致。
 *
 * 为什么编排层需要非流式
 * -------------------
 * 编排层拿到输出后要**判断下一步**（通过 / 重试 / 降难度 / 触发可视化），
 * 这些判断依赖完整且合法的 JSON。半成品文本没有意义 —— 这也是
 * `02-agent-system.md` 把「Zod 校验 + 重试 + 兜底」单独列一项的原因。
 *
 * 模型输出不可信（本文件的核心假设）
 * -----------------------------
 * 模型可能在 JSON 前后加寒暄、用 Markdown 代码围栏包起来、把 `null` 写成
 * `"null"`、少给一个字段。所以这里做了三道处理：
 *   1. `extractJson` —— 从任意文本里抠出最可能是 JSON 的那一段；
 *   2. `JSON.parse` 失败 → 把**具体错误**回喂给模型重试；
 *   3. Zod 校验失败 → 把 **Zod 的字段级错误**回喂重试（比只说「格式错了」有效得多）。
 * 重试用尽后才走兜底，且兜底结果会被标记 `usedFallback`，不让调用方误以为
 * 这是模型的真实判断。
 */

import type { z } from "zod";

import type { ArkEnv } from "./ark";
import {
  AGENT_OUTPUT_SCHEMAS,
  type AssistantOutput,
  type ExaminerOutput,
  type ReviewerOutput,
  type TeacherOutput,
} from "./outputs";
import { getAgent } from "./prompts";
import { getSkill } from "./skills";
import { createSession } from "./session";
import {
  recordAgentTrace,
  type TraceContext,
  type TraceRecordResult,
} from "./trace";
import type { AgentId, SkillId } from "./types";
import { redactSecrets } from "@/lib/security/output-filter";
import type { Expect } from "@/lib/type-assert";

/**
 * Agent → 输出类型的映射。
 *
 * 单独声明而不用 `z.infer<typeof AGENT_OUTPUT_SCHEMAS[Id]>`：后者在泛型位置
 * 上推不出精确类型（`AGENT_OUTPUT_SCHEMAS` 的键是联合时会退化）。
 * 用下面两条断言保证它与 schema 表、与 `AgentId` 三者一致。
 */
export interface AgentOutputMap {
  teacher: TeacherOutput;
  reviewer: ReviewerOutput;
  examiner: ExaminerOutput;
  assistant: AssistantOutput;
}

export type __AssertOutputMapCoversAgents = Expect<
  keyof AgentOutputMap extends AgentId ? true : false
>;
export type __AssertAgentsCoveredByOutputMap = Expect<
  AgentId extends keyof AgentOutputMap ? true : false
>;

/**
 * 默认重试次数。
 *
 * 取 2 → 最多 3 次尝试，对应 `02-agent-system.md`「校验不通过 3 次」这条规则。
 * 注意是「尝试 3 次」而不是「重试 3 次」（那会是 4 次）。
 */
export const DEFAULT_MAX_RETRIES = 2;

/** 回喂给模型的原文长度上限。长了既费 token 也会让模型抓不住重点。 */
const RAW_TEXT_FEEDBACK_LIMIT = 800;

/** 一次 Agent 运行的结果。 */
export interface AgentRunResult<T> {
  ok: boolean;
  /** 校验通过的结构化输出。失败且无兜底时不存在。 */
  data?: T;
  /** 模型最后一次返回的原始文本。失败排查的唯一线索，必须留。 */
  rawText: string;
  /** 实际尝试次数（1 = 一次成功）。 */
  attempts: number;
  /** 是否动用了兜底。调用方据此决定是否信任 `data`。 */
  usedFallback: boolean;
  tokens: { input: number; output: number };
  durationMs: number;
  /** 失败原因；ok 为 true 且未兜底时不存在。 */
  error?: string;
  /** Trace 写入结果。只在调用方传了 `trace` 上下文时存在。 */
  trace?: TraceRecordResult;
}

export interface RunAgentOptions<Id extends AgentId> {
  agent: Id;
  /** 省略时用该 Agent 的 `defaultSkill`。 */
  skill?: SkillId;
  /**
   * 追加在 Skill 内容尾部的模块定制段（如复刻模块的验收清单评分指令，
   * 见 `./skills/module-rubric.ts`）。省略时 prompt 与不传逐字符一致；
   * skill id 不变，`allowedSkills` 白名单照常生效。
   */
  skillSupplement?: string;
  /** 本次输入，会被序列化成 JSON 放进用户消息。 */
  input: unknown;
  /** 校验失败后的重试次数，默认 `DEFAULT_MAX_RETRIES`。 */
  maxRetries?: number;
  /**
   * 兜底输出的构造方式。提供了就一定会用（重试用尽时），
   * 不提供则 `ok` 为 false。
   */
  fallback?: () => AgentOutputMap[Id];
  /**
   * Trace 上下文。传了才写库，探针与回归测试不传。
   * 见 `trace.ts` 文件头：记录失败不阻断主流程，但会把原因带回调用方。
   */
  trace?: TraceContext;
  env?: ArkEnv;
  signal?: AbortSignal;
}

/**
 * 从模型输出里抠出 JSON。
 *
 * 为什么不能直接 `JSON.parse(text)`
 * ------------------------------
 * 实际观察到的三种包装：① 前后有寒暄文字；② 用 ` ```json ` 围栏包住；
 * ③ 围栏里还有嵌套的代码块。直接 parse 全都会失败，而这些失败**不是模型的
 * 格式错误**，重试也未必能改掉 —— 所以先做无损的提取，再判定是否真错。
 *
 * 策略（按优先级）：
 *   1. 有围栏 → 取最外层围栏里的内容（内层 `}` 不会提前截断）；
 *   2. 无围栏 → 取第一个 `{` 到最后一个 `}`（JSON 对象的最外层括号）。
 * 两种都失败就返回 null，由调用方当作「输出不是 JSON」处理。
 */
export function extractJson(text: string): string | null {
  const trimmed = text.trim();

  // 1) Markdown 代码围栏：取第一对围栏之间的内容
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();

  // 2) 裸 JSON：第一个 { 到最后一个 }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);

  return null;
}

/**
 * 把 System Prompt + Skill + 输入组装成会话的 systemPrompt 与用户消息。
 *
 * 为什么 Skill 进 systemPrompt 而不是用户消息
 * -------------------------------------
 * Skill 是**做事方法**（怎么讲、怎么打分），不是这次的材料。放进用户消息
 * 会让它在重试时被重复拼接，也会稀释「输入」的位置。身份层与技能层都属于
 * 「这次任务之前就已确定」的内容，一起放系统侧更合适。
 *
 * 单独导出为纯函数：可以直接断言拼出来的字符串，不用真的调模型。
 */
export function composeAgentPrompt(options: {
  systemPrompt: string;
  skillContent: string;
  input: unknown;
  /** 上一次失败的原因（重试时带上）。 */
  previousError?: string;
  /** 上一次的原始输出（重试时带上，已截断）。 */
  previousRawText?: string;
}): { systemPrompt: string; userMessage: string } {
  const { systemPrompt, skillContent, input, previousError, previousRawText } =
    options;

  const parts = [
    "## 本次输入",
    "",
    "```json",
    JSON.stringify(input, null, 2),
    "```",
    "",
    "## 输出要求",
    "",
    "严格按 System Prompt 里「输出格式」声明的 JSON 返回。",
    "只输出 JSON 本身：不要 Markdown 代码围栏，不要任何解释或寒暄。",
  ];

  if (previousError) {
    parts.push(
      "",
      "## 上一次输出未通过校验",
      "",
      `错误：${previousError}`,
      ...(previousRawText
        ? [
            "",
            "你上一次的输出（已截断）：",
            "",
            previousRawText.slice(0, RAW_TEXT_FEEDBACK_LIMIT),
          ]
        : []),
      "",
      "请修正后重新输出完整 JSON。",
    );
  }

  return {
    systemPrompt: `${systemPrompt}\n\n---\n\n${skillContent}`,
    userMessage: parts.join("\n"),
  };
}

/**
 * 跑一个 Agent（**唯一对外入口**）。
 *
 * 在 `executeAgent` 外面套一层，只为了做一件事：写 Trace。
 * 「每次 Agent 调用都要记录」必须是**结构上**的每次 —— 放在这里，
 * 新增编排流程自动被覆盖；放在各 loop 里，漏一个就永久少一类数据且无人发现。
 * 传了 `trace` 上下文才写；探针与回归测试不传，避免污染数据库。
 */
export async function runAgent<Id extends AgentId>(
  options: RunAgentOptions<Id>,
): Promise<AgentRunResult<AgentOutputMap[Id]>> {
  const result = redactOutput(await executeAgent(options));
  const traceContext = options.trace;

  if (!traceContext) return result;

  const recorded = await recordAgentTrace({
    ...traceContext,
    agent: options.agent,
    skill: options.skill ?? getAgent(options.agent).defaultSkill,
    input: options.input,
    // 失败且未兜底时没有 data，把原始文本记下来 —— 否则这次失败无法复盘。
    output: result.data ?? { rawText: result.rawText },
    durationMs: result.durationMs,
    tokens: result.tokens,
    retries: result.attempts - 1,
    success: result.ok && !result.usedFallback,
    ...(result.error === undefined ? {} : { error: result.error }),
  });

  return { ...result, trace: recorded };
}

/**
 * 对 Agent 输出做一次深度打码（输出过滤的第二道防线）。
 *
 * 为什么在出口而不是各端点逐字段调用：这里是「每次 Agent 输出」唯一的必经
 * 之处，覆盖面是**结构上**的 —— 而逐字段调用必然漏，漏掉的那个字段照样会
 * 落库、照样会显示给学生。与 trace 记录同一思路（见 trace.ts 文件头）。
 *
 * 打码发生在 trace 之前，所以观测数据里也不留凭据。
 */
function redactOutput<Id extends AgentId>(
  result: AgentRunResult<AgentOutputMap[Id]>,
): AgentRunResult<AgentOutputMap[Id]> {
  if (result.data === undefined) return result;
  return { ...result, data: redactSecrets(result.data) };
}

/**
 * 实际执行（不含 Trace）。仅被 `runAgent` 调用。
 *
 * 不导出：绕过它就能跳过权限检查与 Zod 校验直接调模型。
 *
 * 权限检查在最前面：Skill 不在该 Agent 的 `allowedSkills` 里就直接抛错，
 * 不发给模型。对应铁律「Agent 权限由代码控制」—— 越权不靠模型自觉。
 */
async function executeAgent<Id extends AgentId>(
  options: RunAgentOptions<Id>,
): Promise<AgentRunResult<AgentOutputMap[Id]>> {
  const {
    agent: agentId,
    skill: skillId,
    skillSupplement,
    input,
    maxRetries = DEFAULT_MAX_RETRIES,
    fallback,
    env,
    signal,
  } = options;

  const agent = getAgent(agentId);
  const skillIdToUse = skillId ?? agent.defaultSkill;

  if (!agent.allowedSkills.includes(skillIdToUse)) {
    throw new Error(
      `Agent「${agentId}」未获授权使用 Skill「${skillIdToUse}」；` +
        `可用：${agent.allowedSkills.join("、")}。`,
    );
  }
  const baseSkill = getSkill(skillIdToUse);
  const skill =
    skillSupplement === undefined
      ? baseSkill
      : { ...baseSkill, content: `${baseSkill.content}\n\n${skillSupplement}` };

  // 泛型 `Id` 尚未实例化时，TS 把 `AgentOutputMap[Id]` 解析成各分支的**交集**
  // （TeacherOutput & ReviewerOutput & …），而它们的 `type` 字段互斥 → 交集退化成
  // never，于是任何具体 schema 都被判为「不足以重叠」。
  // 这次转换的正确性由 `outputs.ts` 里的两条断言保证：schema 表的键与
  // `AgentId`、与 `AgentOutputMap` 的键三者必须完全一致。
  const schema = AGENT_OUTPUT_SCHEMAS[agentId] as unknown as z.ZodType<
    AgentOutputMap[Id]
  >;

  const startedAt = Date.now();
  let attempts = 0;
  let rawText = "";
  let tokens = { input: 0, output: 0 };
  let lastError = "";

  for (let i = 0; i <= maxRetries; i++) {
    attempts += 1;

    const { systemPrompt, userMessage } = composeAgentPrompt({
      systemPrompt: agent.systemPrompt,
      skillContent: skill.content,
      input,
      ...(lastError
        ? { previousError: lastError, previousRawText: rawText }
        : {}),
    });

    const turn = await runTextCompletion({
      systemPrompt,
      userMessage,
      env,
      signal,
    });
    rawText = turn.text;
    // token 按尝试累加：重试是真实成本，Trace 里要能看到「这次花了三次才过」。
    tokens = {
      input: tokens.input + turn.tokens.input,
      output: tokens.output + turn.tokens.output,
    };

    const json = extractJson(turn.text);
    if (json === null) {
      lastError = "输出里找不到 JSON 对象。";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      // 把 JSON.parse 的原文错误回喂：它通常带出行列位置，比自己描述更准。
      lastError = `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`;
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return {
        ok: true,
        data: result.data,
        rawText,
        attempts,
        usedFallback: false,
        tokens,
        durationMs: Date.now() - startedAt,
      };
    }

    // Zod 的字段级错误回喂 —— 只说「格式错了」模型往往原样再错一遍。
    lastError = `Zod 校验失败：${result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(根)"} ${issue.message}`)
      .join("；")}`;
  }

  const durationMs = Date.now() - startedAt;

  if (fallback) {
    return {
      ok: true,
      data: fallback(),
      rawText,
      attempts,
      usedFallback: true,
      tokens,
      durationMs,
      error: lastError,
    };
  }

  return {
    ok: false,
    rawText,
    attempts,
    usedFallback: false,
    tokens,
    durationMs,
    error: lastError,
  };
}

/**
 * 跑一轮非流式对话，收集文本与 token 用量。
 *
 * 为什么导出：教师端「学生模拟」需要一段**纯文本**回复（不是结构化 JSON，
 * 也不是 SSE 流）。它和 `runAgent` 用的是同一个会话工厂与同一条收集逻辑，
 * 复制一份会让「事件解析口径」出现第二处实现 —— token 统计最容易在复制时漂移。
 *
 * 调用方**必须**自己给出完整的 systemPrompt：本函数不做身份层/技能层拼装、
 * 不做 Zod 校验、不写 trace。它不是绕过 `runAgent` 的捷径，而是「本就没有
 * 结构化输出契约」的那一类调用的公共底座。
 */
export async function runTextCompletion(options: {
  systemPrompt: string;
  userMessage: string;
  env?: ArkEnv;
  signal?: AbortSignal;
}): Promise<{ text: string; tokens: { input: number; output: number } }> {
  const { systemPrompt, userMessage, env, signal } = options;

  let text = "";
  const tokens = { input: 0, output: 0 };

  const handle = await createSession({
    systemPrompt,
    onEvent: (event) => {
      // 只关心文本增量与用量：思考增量（方舟无条件返回）对结构化输出无用，
      // 工具事件在本路径下不该出现（Agent 默认不授权任何工具）。
      if (event.type === "message_update") {
        const inner = event.assistantMessageEvent;
        if (inner.type === "text_delta") text += inner.delta;
        return;
      }
      if (event.type === "turn_end" && event.message.role === "assistant") {
        tokens.input += event.message.usage.input;
        tokens.output += event.message.usage.output;
      }
    },
    env,
    signal,
  });

  try {
    await handle.prompt(userMessage);
  } finally {
    handle.dispose();
  }

  return { text, tokens };
}
