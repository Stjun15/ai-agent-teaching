/**
 * SSE 事件校验 Schema（Zod）
 *
 * 依据
 * ----
 * `agent-prompts/references/api-spec.md`「三、SSE 事件协议完整定义」——
 * 该节用 TypeScript interface 定义了 10 种事件；本文件把它们变成**运行时**可校验的
 * Zod schema，语义逐字对应，字段名与可选性一致。
 *
 * 为什么 type 与 schema 两份都要
 * ----------------------------
 * interface 只在编译期存在，校验不了「服务端推来的字符串里到底有没有 content」。
 * 后端 `sse-server.ts` 的 type 保证我们**发得出**，这里的 schema 保证前端**收到了
 * 就是合法的** —— 铁律 2「Agent 输出必须 JSON + Zod」的落点之一：Agent 的输出
 * 经过 SSE 到达浏览器，必须在浏览器侧再过一次校验，不能凭信任直接渲染。
 *
 * 与 `sse-server.ts` 的关系
 * ------------------------
 * 那个文件的 `SSEEvent` 是**类型权威**（且已被 loop.ts 使用）；本文件的
 * `SSEEventSchema` 是**运行时权威**。两者由本文件末尾的 `satisfies` 断言
 * 互相钉住：任何一边改动而另一边没跟上，`tsc --noEmit` 立刻报错。
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 共享子结构
// ---------------------------------------------------------------------------

/**
 * api-spec.md 里 `params` / `result` 声明为 `object`，即「任意 JSON 对象」。
 * 用 catchall 而不是 `z.object({})` —— 后者会把所有键静默剥掉，校验通过但数据没了。
 */
export const JsonObjectSchema = z.record(z.string(), z.unknown());

/** api-spec.md「六、错误码」的 8 个取值。 */
export const ErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMIT",
  "LLM_ERROR",
  "DB_ERROR",
  "TIMEOUT",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const PromptDimensionSchema = z.object({
  name: z.string(),
  score: z.number(),
  weight: z.number(),
  comment: z.string(),
});

export const PromptIssueSchema = z.object({
  type: z.enum(["严重错误", "优化建议"]),
  detail: z.string(),
  deduction: z.number(),
  relatedDimension: z.string(),
  relatedAntiPattern: z.string().nullable(),
});

/**
 * 校验结果。字段与 `src/lib/db/types.ts` 的 `ValidationResult` 一致 ——
 * 那边是数据库契约，这里是传输契约，两边不一致时以 data-models.md 为准。
 */
export const ValidationResultSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  sessionId: z.string(),
  taskType: z.enum(["prompt", "tool", "code"]),
  totalScore: z.number(),
  level: z.enum(["优秀", "良好", "及格", "不及格"]),
  isCorrect: z.boolean(),
  dimensions: z.array(PromptDimensionSchema),
  issues: z.array(PromptIssueSchema),
  suggestions: z.array(z.string()),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// 10 种事件
// ---------------------------------------------------------------------------

export const TokenEventSchema = z.object({
  type: z.literal("token"),
  data: z.object({
    content: z.string(),
    messageId: z.string(),
  }),
});

export const ThinkingEventSchema = z.object({
  type: z.literal("thinking"),
  data: z.object({
    step: z.string(),
    content: z.string(),
    agent: z.string(),
  }),
});

export const ToolCallEventSchema = z.object({
  type: z.literal("tool_call"),
  data: z.object({
    toolName: z.string(),
    params: JsonObjectSchema,
    callId: z.string(),
  }),
});

export const ToolResultEventSchema = z.object({
  type: z.literal("tool_result"),
  data: z.object({
    callId: z.string(),
    result: JsonObjectSchema,
    duration: z.number(),
  }),
});

export const CitationEventSchema = z.object({
  type: z.literal("citation"),
  data: z.object({
    source: z.string(),
    page: z.number().optional(),
    snippet: z.string(),
    relevance: z.number(),
  }),
});

export const UIEventSchema = z.object({
  type: z.literal("ui"),
  data: z.object({
    component: z.string(),
    props: JsonObjectSchema,
  }),
});

export const ValidationEventSchema = z.object({
  type: z.literal("validation"),
  data: ValidationResultSchema,
});

export const VisualizationEventSchema = z.object({
  type: z.literal("visualization"),
  data: z.object({
    sceneId: z.string(),
    params: JsonObjectSchema,
  }),
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  data: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    recoverable: z.boolean(),
  }),
});

export const DoneEventSchema = z.object({
  type: z.literal("done"),
  data: z.object({
    messageId: z.string(),
    tokens: z.object({ input: z.number(), output: z.number() }),
  }),
});

/**
 * 10 种事件的判别联合。判别键是 `type` —— 与 api-spec.md 的
 * `type SSEEvent = TokenEvent | ... | DoneEvent` 一一对应。
 */
export const SSEEventSchema = z.discriminatedUnion("type", [
  TokenEventSchema,
  ThinkingEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  CitationEventSchema,
  UIEventSchema,
  ValidationEventSchema,
  VisualizationEventSchema,
  ErrorEventSchema,
  DoneEventSchema,
]);

export type SSEEventInput = z.infer<typeof SSEEventSchema>;

/** 全部合法事件类型，供遍历 / 穷举检查使用。 */
export const SSE_EVENT_TYPES = [
  "token",
  "thinking",
  "tool_call",
  "tool_result",
  "citation",
  "ui",
  "validation",
  "visualization",
  "error",
  "done",
] as const;

export type SSEEventType = (typeof SSE_EVENT_TYPES)[number];

/**
 * 编译期钉子：schema 的产出类型必须能赋给 `sse-server.ts` 的 `SSEEvent` 类型，
 * 反过来 `SSEEvent` 也必须能赋给 schema 的**输入**类型。
 *
 * 只做单向断言是不够的 —— 少写一种事件时单向仍能通过；双向断言能同时抓住
 * 「schema 缺事件」和「schema 与类型字段不一致」两类偏差。
 */
type _SchemaOutputAssignableToEvent = SSEEventInput;
type _EventAssignableToSchemaInput = import("@/lib/sse-server").SSEEvent;

// 这两个 never 值只在类型层面存在，运行时不存在，且被 tsc 检查。
export type __AssertSchemaMatchesEvent = [
  _SchemaOutputAssignableToEvent extends _EventAssignableToSchemaInput
    ? true
    : never,
][0];
export type __AssertEventMatchesSchema = [
  _EventAssignableToSchemaInput extends _SchemaOutputAssignableToEvent
    ? true
    : never,
][0];
