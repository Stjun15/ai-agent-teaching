/**
 * Agent Trace 记录
 *
 * 设计依据
 * --------
 * - `02-agent-system.md`「Trace 记录」：每次 Agent 调用都要记一条。
 * - `data-models.md` 的 `AgentTrace` 与 `agent_traces` 表。
 * - `06-execution-plan.md` Phase 4 验收标准：「Trace 记录写入数据库」。
 *
 * 为什么放在运行时而不是各编排层
 * -------------------------
 * 「每次 Agent 调用记录」里的「每次」必须是**结构上**的每次，而不是
 * 「每个调用点记得写一次」。放在 `runAgent` 里，新增编排流程自动被覆盖；
 * 放在各 loop 里，漏一个就永久少一类数据，且没人会发现。
 *
 * 记录失败为什么不让主流程失败
 * -----------------------
 * Trace 是**观测数据**，不是业务数据。写库失败（库没建、磁盘满）时让学生
 * 继续学习，比让整条教学链路挂掉合理得多。但这里**不静默**：返回
 * `recorded: false` 并把原因带回调用方，由调用方决定是否上报。
 * 静默吞掉错误会让「Trace 表里少了一半数据」这种问题长期不被发现。
 *
 * 谁传上下文
 * ---------
 * 由 HTTP 路由层传（那里才知道学生与会话）。编排层只做透传：
 * `打路由 → 构造 TraceContext → 编排层透传 → runAgent 落库`。
 * 编排层不自己编上下文 —— 它拿不到身份，硬凑就会写出错误归属的观测数据。
 *
 * 逐步事件为什么不落 `agent_events`
 * -----------------------------
 * 本文件记的是**调用级**汇总（一次调用一行）。逐步事件（思考 / 工具调用 /
 * 输出片段）由 SSE 实时推给前端，不落库 —— 表已建但按
 * `data-models.md` 的裁定保持预留，等出现「回放历史会话」这类消费方再写。
 * 现在双写只会多一处需要同步、却没人读的数据。
 */

import { traceDb } from "@/lib/db";

import type { AgentId, SkillId } from "./types";

/** 记录一次调用所需的上下文（不含运行结果，那部分由运行时填）。 */
export interface TraceContext {
  studentId: string;
  /**
   * 会话归属。**模块级调用没有会话，省略即可** —— 如出题（`/api/agent/generate-question`
   * 按模块生成练习，不隶属某个会话，见该路由文件头）。此时写库为 NULL，
   * 表里 `session_id` 本就允许为空；不为了「记录字段齐全」编造一个会话 id，
   * 那会让观测数据指向错误的归属。
   */
  sessionId?: string;
  /** 本次调用读过的 wiki 页面。 */
  wikiReads?: readonly string[];
  /** 本次调用写过的 wiki 页面。 */
  wikiWrites?: readonly string[];
}

export interface RecordTraceOptions extends TraceContext {
  agent: AgentId;
  skill: SkillId;
  input: unknown;
  output: unknown;
  durationMs: number;
  tokens: { input: number; output: number };
  /** 重试次数 = 尝试次数 - 1。 */
  retries: number;
  success: boolean;
  error?: string;
}

export interface TraceRecordResult {
  recorded: boolean;
  traceId: string;
  /** 写入失败的原因；成功时不存在。 */
  error?: string;
}

/** `AgentTrace.input` / `output` 声明为 `object`，非对象值要包一层。 */
function toObject(value: unknown): object {
  if (value !== null && typeof value === "object") return value as object;
  return { value };
}

/**
 * 写一条 Trace。
 *
 * `id` 与 `traceId` 的区别：`id` 是这一行的主键，`traceId` 用于把**同一次
 * 用户操作触发的多个 Agent 调用**串起来（例如一次提交触发点评 + 可视化）。
 * 当前每次调用生成各自的 traceId；等编排层需要跨 Agent 串联时，由调用方传入。
 */
export async function recordAgentTrace(
  options: RecordTraceOptions,
): Promise<TraceRecordResult> {
  const traceId = `trace_${crypto.randomUUID()}`;

  try {
    await traceDb.create({
      id: crypto.randomUUID(),
      traceId,
      // 项目约定：时间统一存 ISO 8601 UTC 字符串（`data-models.md`）。
      timestamp: new Date().toISOString(),
      studentId: options.studentId,
      // 无会话上下文（模块级调用）时写 NULL，不编造会话 id。
      sessionId: options.sessionId ?? null,
      agent: options.agent,
      skill: options.skill,
      input: toObject(options.input),
      output: toObject(options.output),
      wikiReads: [...(options.wikiReads ?? [])],
      wikiWrites: [...(options.wikiWrites ?? [])],
      durationMs: options.durationMs,
      tokens: options.tokens,
      retries: options.retries,
      success: options.success,
      ...(options.error === undefined ? {} : { error: options.error }),
    });

    return { recorded: true, traceId };
  } catch (error) {
    return {
      recorded: false,
      traceId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
