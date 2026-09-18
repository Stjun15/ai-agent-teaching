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

export const AnswerGradeSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  questionId: z.string().min(1),
  studentAnswer: z.string().min(1).max(10000),
  moduleId: z.string().min(1),
  conceptId: z.string().min(1).optional(),
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

/**
 * `SendMessageSchema` 去掉 `taskType` 后的子集，加 `agent`。
 *
 * ⚠️ `code` / `language` 是补进来的，起因是一个**实测到的静默失败**
 * --------------------------------------------------------------
 * 首版这里只有 `content` + `agent`，理由写的是「只取 SendMessage 的子集」。
 * 但输入区（`composer.tsx`）有「附带代码」按钮，它发出去的请求体里带着
 * `code` / `language` —— 而 `z.object` **默认剥离未知键**（不是报错、不是
 * 保留）。于是链路是这样断的：
 *
 * 1. 前端发 `{ content, code, language }`；
 * 2. 手写的 `ChatRequest` 接口只声明了 `content` / `agent`，但调用处用的是
 *    对象展开（`{ content, ...(code ? {code, language} : {}) }`）——
 *    对象展开会**抹掉字面量的 freshness**，多余属性检查失效 →
 *    `tsc --noEmit` 全绿（已实测，exit 0）；
 * 3. `ChatRequestSchema` 静默丢掉 `code` / `language`；
 * 4. `runAgentLoop` 当时也只收 `prompt`，就算不丢也传不进去。
 *
 * 结果：「附带代码」是个**看起来能用、点了没反应**的按钮 —— 正是本项目
 * 反复要避免的那种东西。`taskType` 仍然不加：它属于 `/api/validate`
 * （`ValidateSchema`），当前没有任何调用方会发它，留着只会是死字段。
 *
 * 为什么不改成 `.strict()`：那会把「客户端多带一个字段」从静默忽略变成
 * 整个请求 400，将来加字段时先炸的是线上而不是类型检查。真正的防线是
 * **前端的 `ChatRequest` 类型直接由本 schema 推导**（见 `useChatStream.ts`），
 * 两边不可能各写一份然后悄悄漂移。
 */
export const ChatRequestSchema = z.object({
  content: z.string().min(1).max(5000),
  /** 与 `SendMessageSchema.code` 同值域：学生提交的待点评内容。 */
  code: z.string().max(10000).optional(),
  /** 与 `SendMessageSchema.language` 同值域，理由见 `code`。 */
  language: z.enum(["typescript", "python"]).optional(),
  /** 对应 loop.ts 的 `AgentLoopOptions.agent`，进 SSE 的 thinking 事件。 */
  agent: z.string().min(1).max(64).optional(),
});

/**
 * `PUT /api/student/profile` 的请求体。
 *
 * 全部字段可选（这是 PATCH 语义，但文档给的方法是 PUT）——
 * 学生画像的每一列都有库里的默认值，第一次填写时通常只给一两项
 * （例如只有 `programmingBackground` 与 `learningGoal`）。
 * 要求全填会让「先填一部分、以后再补」这个真实用法直接 400。
 *
 * 取值与 `StudentProfile` 的联合一一对应，不在这里放宽成 `string`：
 * 这些枚举会被 Agent 读进提示词（讲解风格、提示偏好等），
 * 一个库里不存在的取值会让提示词拼出无效指令。
 */
export const UpdateProfileSchema = z.object({
  programmingBackground: z
    .enum(["zero", "beginner", "intermediate"])
    .optional(),
  learningGoal: z.string().max(500).optional(),
  preferredLanguage: z.enum(["typescript", "python"]).optional(),
  pace: z.enum(["slow", "normal", "fast"]).optional(),
  explanationStyle: z.enum(["analogy", "example", "theory"]).optional(),
  hintPreference: z.enum(["try_first", "hint_early", "direct"]).optional(),
  feedbackPreference: z.enum(["encouraging", "strict", "neutral"]).optional(),
  visualPreference: z.enum(["animation", "static", "text"]).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ValidateInput = z.infer<typeof ValidateSchema>;
export type ExplainInput = z.infer<typeof ExplainSchema>;
export type GenerateQuestionInput = z.infer<typeof GenerateQuestionSchema>;
export type AnswerInput = z.infer<typeof AnswerSchema>;
export type AnswerGradeInput = z.infer<typeof AnswerGradeSchema>;
export type WikiQueryInput = z.infer<typeof WikiQuerySchema>;
