/**
 * API 输入校验 Schema（Zod）
 *
 * 依据
 * ----
 * `agent-prompts/references/api-spec.md`「八、API 输入输出 Zod 校验」——
 * 该节给出 7 个 schema（CreateSession / SendMessage / Validate / Explain /
 * GenerateQuestion / Answer / WikiQuery），本文件逐字实现，仅补 `export`。
 *
 * 铁律 2「Agent 输出必须 JSON + Zod」的输入侧一半：所有进入 API 的请求体
 * 必须先过这里，路由里不允许直接读 `await req.json()` 的字段。
 *
 * 本文件刻意不做什么
 * ----------------
 * 不 import 任何运行时依赖（除 zod）。schema 要能被 Route Handler、Agent 内核、
 * 探针脚本同时引用，混入数据库或 SDK 会把无关依赖拖进各自的产物图。
 *
 * ChatRequestSchema 是新增的
 * -------------------------
 * `api-spec.md` 没有 `/api/chat` 这个路由（它的清单里是
 * `POST /api/session/[id]/message`）。`/api/chat` 是 `06-execution-plan.md`
 * Phase 3 的**最小不落库端点**，让前端在会话持久化（Phase 5）之前就能对话，
 * 所以它的请求体只取 SendMessage 的子集，另加一个 `agent` 字段。
 * Phase 5 的落库端点仍应使用 SendMessageSchema。
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// api-spec.md 第八节：逐字实现
// ---------------------------------------------------------------------------

export const CreateSessionSchema = z.object({
  studentId: z.string().uuid(),
  moduleId: z.string().min(1),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  taskType: z.enum(["prompt", "tool", "code"]).optional(),
  code: z.string().max(10000).optional(),
  language: z.enum(["typescript", "python"]).optional(),
});

export const ValidateSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  taskType: z.enum(["prompt", "tool", "code"]),
  content: z.string().min(1).max(10000),
  moduleId: z.string().min(1),
});

export const ExplainSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  moduleId: z.string().min(1),
  mode: z.enum(["normal", "remedial"]).default("normal"),
});

export const GenerateQuestionSchema = z.object({
  studentId: z.string().uuid(),
  moduleId: z.string().min(1),
  count: z.number().min(1).max(10).default(3),
  difficulty: z.number().min(1).max(5).optional(),
});

export const AnswerSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  question: z.string().min(1).max(2000),
  currentModule: z.string().min(1),
});

export const WikiQuerySchema = z.object({
  query: z.string().min(1).max(500),
  options: z
    .object({
      related: z.string().optional(),
      topK: z.number().min(1).max(20).default(3),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Phase 3 最小端点：POST /api/chat
// ---------------------------------------------------------------------------

/** `SendMessageSchema` 去掉 taskType / code / language 后的子集，加 `agent`。 */
export const ChatRequestSchema = z.object({
  content: z.string().min(1).max(5000),
  /** 对应 loop.ts 的 `AgentLoopOptions.agent`，进 SSE 的 thinking 事件。 */
  agent: z.string().min(1).max(64).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ValidateInput = z.infer<typeof ValidateSchema>;
export type ExplainInput = z.infer<typeof ExplainSchema>;
export type GenerateQuestionInput = z.infer<typeof GenerateQuestionSchema>;
export type AnswerInput = z.infer<typeof AnswerSchema>;
export type WikiQueryInput = z.infer<typeof WikiQuerySchema>;
