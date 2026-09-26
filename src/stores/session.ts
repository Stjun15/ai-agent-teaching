"use client";

/**
 * SessionStore —— 会话、消息、Agent 事件、引用、流式状态
 *
 * 依据 `04-frontend.md`「状态管理」表：SessionStore 承载
 * 「会话、消息、Agent 事件、引用、流式状态」五样东西。
 *
 * 为什么标 `"use client"`
 * --------------------
 * 它基于 `useSyncExternalStore`，只能在浏览器里工作。标上 `"use client"`
 * 让误用（从服务端组件直接 import）在构建期就暴露，而不是等到运行时报
 * 「hooks 只能在客户端调用」。
 *
 * 最重要的一处设计：**思考增量必须聚合，不能逐帧进界面**
 * ------------------------------------------------
 * 端到端实测（`/api/chat` 跑 calculate 工具那一次）：整条流 39 帧，
 * 其中 **33 帧是 `thinking`**，只有 3 帧是 `token`。而且
 * `thinking` 的内容是模型原始推理碎片，实测是**英文**
 * （"The user wants me to calculate (1234 * 5678) ..."）。
 *
 * 两件事因此确定：
 * 1. 若把每个 delta 都当一条独立的 Agent 事件渲染，右栏时间线会被 33 条
 *    「思考」刷屏，真正有信息量的 `tool_call` / `done` 被淹没。
 *    所以 `appendThinking` 把**同一阶段**的增量累积成一条记录
 *    （`step` + `agent` 相同即视为同一阶段），遇到别的事件就封口。
 * 2. 原始推理文本不适合直接展示给中文教学场景的学生。界面上它折叠成一个
 *    「思考过程」条目，显示耗时与字数，展开才看原文（见 AgentTimeline）。
 *
 * 数据形状与 `data-models.md` 的关系
 * -------------------------------
 * 这里的 `ChatMessage` / `Citation` **不是** `Message` / `Citation` 的翻版，
 * 而是「流式进行中的界面状态」：它多了 `status`（正在流 / 已完成 / 失败），
 * 少了 `sessionId`（本阶段的 `/api/chat` 刻意不落库、不建会话）。
 * 落库版的形状由 Phase 5 的 `feat(api): add SSE message endpoint` 引入，
 * 届时由它负责把这里的界面状态转成 `Message` 写库 —— 方向是单向的，
 * 不要在两边互相赋值。
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { StepType } from "@/lib/db";
import { TEACHING_AGENT_ID } from "@/lib/agent/prompts/teaching-chat";
import type { ErrorCode, JsonObject } from "@/schemas";

/** 一条对话消息（界面状态，非数据库实体）。 */
export interface ChatMessage {
  /** 学生消息用本地生成的 id；助手消息用服务端 `token` 事件带来的 `messageId`。 */
  id: string;
  role: "student" | "assistant";
  content: string;
  /** 助手消息所属 Agent，来自 `thinking` 事件（`/api/chat` 目前固定为 `chat`）。 */
  agent?: string;
  /**
   * 消息所属的学习步骤（2026-09-19「点开即有」改造新增）。
   *
   * 为什么要有：讲解三步共用**同一个**对话区，而步骤是三条独立路由 ——
   * 讲完概念切到「观察示范」，对话里得能分清哪条消息属于哪一步，
   * LectureLauncher 才能判断「这一步开过场没有」。没有它，讲解步的消息
   * 会把示范步的开场闸门挡死（示范步永远空白）。演练场的消息不带步骤
   * （undefined），其闸门语义是「没有属于本步骤的消息」。
   */
  step?: StepType;
  status: "streaming" | "done" | "error";
  /** 该消息引用的知识来源，来自 `citation` 事件。 */
  citations: Citation[];
  /** 该轮的 token 用量，来自 `done` 事件。 */
  tokens?: { input: number; output: number };
  /** 学生消息附带的截图 data URL，来自 Composer 图片上传。 */
  images?: string[];
  createdAt: string;
  /**
   * 该条助手消息对应的思维链（来自 `thinking` SSE 事件）。
   *
   * 每收到一个 thinking 增量，除了写全局 `thinking[]` 给右栏时间线，
   * 也追加到当前正在流式输出的助手消息里 —— 这样消息气泡上方就能直接
   * 渲染「思考过程」折叠面板，效果对标 DeepSeek 网页端。
   *
   * 学生消息永不为此字段赋值（始终 undefined）。
   */
  thinkingSteps?: ThinkingStep[];
}

/** 引用来源（`citation` 事件）。字段与 `data-models.md` 的 `Citation` 对齐。 */
export interface Citation {
  source: string;
  page?: number;
  snippet: string;
  relevance: number;
}

/**
 * 一段思考过程（由若干 `thinking` 增量聚合而成）。
 *
 * 聚合粒度是「同一 Agent 的同一阶段」：服务端在 `thinking` 事件里带
 * `step` 与 `agent`，两者不变就继续累积，变了或收到别的事件就封口。
 */
export interface ThinkingStep {
  id: string;
  agent: string;
  step: string;
  /** 累积后的推理文本。 */
  content: string;
  /** 收了多少个增量 —— 用于让用户知道「思考了多久」是真实的，不是假的进度条。 */
  deltas: number;
  startedAt: number;
  /** 未封口时为 `undefined`（界面据此显示「思考中…」）。 */
  endedAt?: number;
}

/** 一次工具调用及其结果（`tool_call` + `tool_result` 两个事件合成一条）。 */
export interface ToolActivity {
  callId: string;
  toolName: string;
  params: JsonObject;
  result?: JsonObject;
  durationMs?: number;
  startedAt: number;
}

/** 流式状态机：`idle` → `streaming` →（`done` | `error` | `aborted`）。 */
export type StreamStatus = "idle" | "streaming" | "done" | "error" | "aborted";

export interface SessionError {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
}

export interface SessionState {
  messages: ChatMessage[];
  thinking: ThinkingStep[];
  tools: ToolActivity[];
  citations: Citation[];
  status: StreamStatus;
  error: SessionError | null;
  /** 最近一轮的 token 用量；未收到 `done` 前为 `null`。 */
  tokens: { input: number; output: number } | null;
  /**
   * 收到过多少帧无法通过 Schema 校验的数据。
   *
   * 单独计数而不是丢弃：界面上要能告诉用户「有内容没能解析出来」，
   * 而不是安静地少一段。见 `src/lib/sse.ts` 的 `onInvalidFrame`。
   */
  invalidFrames: number;

  /**
   * 本轮（正在流式输出的那一轮）所属的学习步骤。
   *
   * 助手消息是**懒创建**的（第一个 token 事件才建），创建时要把步骤标签
   * 打上去 —— 标签就存在这里，由 `beginTurn` 写入、`appendToken` 消费。
   * 演练场等无步骤语境为 null。
   */
  turnStep: StepType | null;

  /**
   * 非活动模块的会话缓存（2026-09-20「分桶缓存」改造）。
   *
   * 此前 `ensureModule` 切换模块时把上一条对话**清空**，切回上一个模块时
   * 对话也不回来。现在改成**保存 + 恢复**：切走时把当前 messages/thinking/
   * tools/citations 等快照进 `byModule[from]`，切回时从 `byModule[to]` 还原
   * 并把它移出缓存。等于是按模块分桶，但没有即时对话的模块仍只占静态内存。
   * 瞬时态（status/error）不缓存 —— 每次切桶都重置为 idle。
   */
  byModule: Record<string, SavedSessionBucket>;

  /**
   * 开启一轮对话。
   *
   * `silent`（2026-09-19）：不落学生消息，只进入 streaming 态。给「导师自动
   * 开讲」用 —— 概念讲解步骤学生还没说话，对话里不该冒出一条假的学生提问
   * （「请讲讲…」），那会让人以为是自己点过什么。
   *
   * `step`（同日「点开即有」改造）：本轮所属的学习步骤。落在学生消息上、
   * 记进 `turnStep` 供助手消息继承，让「这一步开过场没有」可按步骤判断。
   */
  beginTurn: (
    content: string,
    options?: { silent?: boolean; step?: StepType; images?: string[] },
  ) => void;
  appendToken: (content: string, messageId: string) => void;
  appendThinking: (input: {
    step: string;
    agent: string;
    content: string;
  }) => void;
  addToolCall: (input: {
    callId: string;
    toolName: string;
    params: JsonObject;
  }) => void;
  addToolResult: (input: {
    callId: string;
    result: JsonObject;
    durationMs: number;
  }) => void;
  addCitation: (citation: Citation) => void;
  completeTurn: (input: {
    messageId: string;
    tokens: { input: number; output: number };
  }) => void;
  failTurn: (error: SessionError) => void;
  abortTurn: () => void;
  noteInvalidFrame: () => void;
  /**
   * 同步排空 token 缓冲区（供测试使用）。
   *
   * 正常情况下 token 按 `requestAnimationFrame` 批量合并写入 Store，
   * 避免每个 token 事件单独触发一次 React 渲染。测试需要同步读取
   * Store 状态，调用此方法可立即应用缓冲区中所有待处理的 token。
   */
  flushTokenBuffer: () => void;
  /**
   * 注入一条预生成讲稿（2026-09-19「点开即有」）。
   *
   * 缓存命中时由 LectureLauncher 调用：讲稿作为**已完成**的助手消息直接
   * 出现在对话里，零等待、零模型调用。该步骤已有消息时是 no-op ——
   * 返回是否真的注入了（调用方无需关心，返回值只为测试）。
   */
  seedLecture: (step: StepType, content: string) => boolean;
  /** 当前会话态所属的模块；null = 尚未进入任何模块页。 */
  activeModuleId: string | null;
  reset: () => void;
  /**
   * 模块会话按需隔离（2026-09-20「分桶缓存」改造）。
   * 此前是"SPA 切换模块时清空上一模块的对话态"（清空式），改成分桶缓存式：
   * 切走时快照进 `byModule`，切回时还原 —— 换模块不会串台，且切回还能看到
   * 上次的对话。同名调用是 no-op —— 模块内逐步切换不受影响。
   */
  ensureModule: (moduleId: string) => void;
}

/** 会话快照（非活动模块的分桶缓存内容）。 */
export interface SavedSessionBucket {
  messages: ChatMessage[];
  thinking: ThinkingStep[];
  tools: ToolActivity[];
  citations: Citation[];
  tokens: SessionState["tokens"];
  invalidFrames: number;
  turnStep: StepType | null;
}

/** 从当前会话态抓快照（用于切桶时保存）。 */
function snapshotBucket(state: SessionState): SavedSessionBucket {
  return {
    messages: state.messages,
    thinking: state.thinking,
    tools: state.tools,
    citations: state.citations,
    tokens: state.tokens,
    invalidFrames: state.invalidFrames,
    turnStep: state.turnStep,
  };
}

/** 把（缓存的）快照铺回当前会话态；没有快照就用空初值。 */
function applyBucket(saved?: SavedSessionBucket): Partial<SessionState> {
  return {
    messages: saved?.messages ?? [],
    thinking: saved?.thinking ?? [],
    tools: saved?.tools ?? [],
    citations: saved?.citations ?? [],
    tokens: saved?.tokens ?? null,
    invalidFrames: saved?.invalidFrames ?? 0,
    turnStep: saved?.turnStep ?? null,
    status: "idle",
    error: null,
  };
}

function newId(): string {
  return crypto.randomUUID();
}

/** 找到正在流式输出的那条助手消息。 */
function findStreamingAssistant(
  messages: ChatMessage[],
): ChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "assistant" && message.status === "streaming") {
      return message;
    }
  }
  return undefined;
}

/** 不可变替换某条消息；找不到就原样返回（避免无意义的状态更新）。 */
function replaceMessage(
  messages: ChatMessage[],
  id: string,
  patch: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === id);
  if (index === -1) return messages;
  const next = messages.slice();
  next[index] = patch(messages[index]);
  return next;
}

/**
 * Token 批量合并：避免每个 SSE token 事件单独触发一次 React 渲染。
 *
 * 模型每秒可产 30~80 个 token，如果每个 token 都走一次 `set()` →
 * ChatPanel 重渲染 → MarkdownView 重解析全文 → scrollTop 设置，
 * 产生的「卡」不是因为渲染一帧慢，而是 500 帧挤在同一秒里互相阻塞。
 *
 * 这里把同一条流式消息收到的连续 token 按 `setTimeout(0)` 合并：
 * 每个 task 周期只写一次 Store，其余 token 只进缓冲区。
 */
const tokenBuffer = new Map<
  string,
  { content: string; flushScheduled: boolean }
>();

function flushTokenBufferImpl(
  set: any,
): void {
  const toFlush = new Map(tokenBuffer);
  tokenBuffer.clear();
  set((state: SessionState) => {
    let messages = state.messages;
    let changed = false;
    for (const [messageId, buf] of toFlush) {
      const streaming = findStreamingAssistant(messages);
      if (streaming === undefined) {
        messages = [
          ...messages,
          {
            id: messageId,
            role: "assistant" as const,
            content: buf.content,
            status: "streaming" as const,
            citations: [],
            createdAt: new Date().toISOString(),
            ...(state.turnStep !== null ? { step: state.turnStep } : {}),
            // 首个 token 到达时才创建助手消息，此前可能已有若干思考段
            // 落在全局 thinking[] 里 —— 把它们关联到新消息上。
            thinkingSteps:
              state.thinking.length > 0 ? [...state.thinking] : undefined,
          },
        ];
        changed = true;
        continue;
      }
      if (streaming.id !== messageId) {
        messages = [
          ...messages.map((m) =>
            m.id === streaming.id ? { ...m, status: "done" as const } : m,
          ),
          {
            id: messageId,
            role: "assistant" as const,
            content: buf.content,
            status: "streaming" as const,
            citations: [],
            createdAt: new Date().toISOString(),
            ...(state.turnStep !== null ? { step: state.turnStep } : {}),
            thinkingSteps:
              state.thinking.length > 0 ? [...state.thinking] : undefined,
          },
        ];
        changed = true;
        continue;
      }
      messages = replaceMessage(messages, messageId, (m) => ({
        ...m,
        content: m.content + buf.content,
      }));
      changed = true;
    }
    if (!changed) return state;
    return {
      messages,
      thinking: closeThinking(state.thinking),
    };
  });
}

/**
 * 同步排空 token 缓冲区，返回应用了所有缓存内容的消息数组。
 *
 * 在 `completeTurn` / `failTurn` / `abortTurn` 这些收尾动作里调用：
 * `done` 事件到达时可能还有没被 rAF 刷掉的 token，不先排空就会丢失
 * 最后一段内容。
 */
function drainTokenBuffer(messages: ChatMessage[]): ChatMessage[] {
  const toFlush = new Map(tokenBuffer);
  tokenBuffer.clear();
  let result = messages;
  for (const [messageId, buf] of toFlush) {
    const streaming = findStreamingAssistant(result);
    if (streaming === undefined) {
      result = [
        ...result,
        {
          id: messageId,
          role: "assistant" as const,
          content: buf.content,
          status: "streaming" as const,
          citations: [],
          createdAt: new Date().toISOString(),
        },
      ];
    } else if (streaming.id !== messageId) {
      result = [
        ...result.map((m) =>
          m.id === streaming.id ? { ...m, status: "done" as const } : m,
        ),
        {
          id: messageId,
          role: "assistant" as const,
          content: buf.content,
          status: "streaming" as const,
          citations: [],
          createdAt: new Date().toISOString(),
        },
      ];
    } else {
      result = replaceMessage(result, messageId, (m) => ({
        ...m,
        content: m.content + buf.content,
      }));
    }
  }
  return result;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      messages: [],
      thinking: [],
      tools: [],
      citations: [],
      activeModuleId: null as string | null,
      byModule: {},
      status: "idle",
      error: null,
      tokens: null,
      invalidFrames: 0,
      /** 本轮所属的学习步骤；演练场（无步骤语境）为 null。助手消息据此继承 step。 */
      turnStep: null,

      beginTurn: (content, options) => {
        tokenBuffer.clear();
        return set((state) => ({
          messages:
            options?.silent === true
              ? state.messages
              : [
                  ...state.messages,
                  {
                    id: newId(),
                    role: "student",
                    content,
                    status: "done",
                    citations: [],
                    createdAt: new Date().toISOString(),
                    ...(options?.step !== undefined
                      ? { step: options.step }
                      : {}),
                    ...(options?.images !== undefined && options.images.length > 0
                      ? { images: options.images }
                      : {}),
                  },
                ],
          // 新的一轮清掉上一轮的错误与用量，但不清消息本身 ——
          // 对话是累积的，学生要能往上翻。
          status: "streaming",
          error: null,
          tokens: null,
          turnStep: options?.step ?? null,
        }));
      },

      appendToken: (content, messageId) => {
        const existing = tokenBuffer.get(messageId);
        if (existing !== undefined) {
          existing.content += content;
          return;
        }
        tokenBuffer.set(messageId, { content, flushScheduled: true });
        setTimeout(() => {
          const buf = tokenBuffer.get(messageId);
          if (buf === undefined) return;
          flushTokenBufferImpl(set);
        }, 0);
      },

      appendThinking: ({ step, agent, content }) =>
        set((state) => {
          const prev = state.thinking;
          const streaming = findStreamingAssistant(state.messages);
          let next: ThinkingStep[];
          let newStep: ThinkingStep | undefined;

          const last = prev[prev.length - 1];
          if (
            last !== undefined &&
            last.endedAt === undefined &&
            last.step === step &&
            last.agent === agent
          ) {
            next = prev.slice();
            next[next.length - 1] = {
              ...last,
              content: last.content + content,
              deltas: last.deltas + 1,
            };
          } else {
            newStep = {
              id: newId(),
              agent,
              step,
              content,
              deltas: 1,
              startedAt: Date.now(),
            };
            next = [...prev, newStep];
          }

          if (streaming === undefined) return { thinking: next };

          const linked = newStep ?? next[next.length - 1];
          return {
            thinking: next,
            messages: replaceMessage(
              state.messages,
              streaming.id,
              (message) => ({
                ...message,
                thinkingSteps: upsertThinkingStep(
                  message.thinkingSteps ?? [],
                  linked,
                ),
              }),
            ),
          };
        }),

      addToolCall: ({ callId, toolName, params }) =>
        set((state) => ({
          tools: [
            ...state.tools,
            { callId, toolName, params, startedAt: Date.now() },
          ],
          thinking: closeThinking(state.thinking),
        })),

      addToolResult: ({ callId, result, durationMs }) =>
        set((state) => ({
          // 结果到达时补进对应的那条调用记录。找不到（例如调用帧被丢弃）就忽略，
          // 不新建一条没有参数的孤儿记录。
          tools: state.tools.map((tool) =>
            tool.callId === callId ? { ...tool, result, durationMs } : tool,
          ),
          thinking: closeThinking(state.thinking),
        })),

      addCitation: (citation) =>
        set((state) => {
          const streaming = findStreamingAssistant(state.messages);
          return {
            citations: [...state.citations, citation],
            messages:
              streaming === undefined
                ? state.messages
                : replaceMessage(state.messages, streaming.id, (message) => ({
                    ...message,
                    citations: [...message.citations, citation],
                  })),
          };
        }),

      completeTurn: ({ messageId, tokens }) =>
        set((state) => {
          const messages = drainTokenBuffer(state.messages);
          const streaming = findStreamingAssistant(messages);
          const targetId = streaming?.id ?? messageId;
          return {
            messages: replaceMessage(messages, targetId, (message) => ({
              ...message,
              status: "done",
              tokens,
            })),
            status: "done",
            tokens,
            thinking: closeThinking(state.thinking),
          };
        }),

      failTurn: (error) =>
        set((state) => {
          const messages = drainTokenBuffer(state.messages);
          const streaming = findStreamingAssistant(messages);
          return {
            messages:
              streaming === undefined
                ? messages
                : replaceMessage(messages, streaming.id, (message) => ({
                    ...message,
                    status: "error",
                  })),
            status: "error",
            error,
            thinking: closeThinking(state.thinking),
          };
        }),

      abortTurn: () =>
        set((state) => {
          const messages = drainTokenBuffer(state.messages);
          const streaming = findStreamingAssistant(messages);
          return {
            // 中断不是错误：已收到的内容保留下来，标成 done 让它可以被复制。
            // 用户自己按的「停止」，不该看到一条红色报错。
            messages:
              streaming === undefined
                ? messages
                : replaceMessage(messages, streaming.id, (message) => ({
                    ...message,
                    status: "done",
                  })),
            status: "aborted",
            thinking: closeThinking(state.thinking),
          };
        }),

      noteInvalidFrame: () =>
        set((state) => ({ invalidFrames: state.invalidFrames + 1 })),

      flushTokenBuffer: () => {
        const hasData = tokenBuffer.size > 0;
        if (!hasData) return;
        flushTokenBufferImpl(set);
      },

      seedLecture: (step, content) => {
        let seeded = false;
        set((state) => {
          // 该步骤已经有消息（学生问过 / 已注入过）就不动 —— 讲稿只负责开场。
          if (state.messages.some((message) => message.step === step)) {
            return state;
          }
          seeded = true;
          return {
            messages: [
              ...state.messages,
              {
                id: newId(),
                role: "assistant" as const,
                content,
                // 与实时路径的 agent 标识同源（SSE thinking 事件里就是它），
                // 时间线与消息徽标两种来源显示一致。
                agent: TEACHING_AGENT_ID,
                status: "done" as const,
                citations: [],
                createdAt: new Date().toISOString(),
                step,
              },
            ],
          };
        });
        return seeded;
      },

      ensureModule: (moduleId) =>
        set((state) => {
          if (state.activeModuleId === moduleId) return state;
          // 切走：把当前模块的会话态快照进缓存（首次进入 activeModuleId 为 null 不用存）。
          const nextByModule = { ...state.byModule };
          if (state.activeModuleId !== null) {
            nextByModule[state.activeModuleId] = snapshotBucket(state);
          }
          // 切回：取缓存（取到就移出，避免下次来是幽灵快照），铺回当前会话态。
          const saved = nextByModule[moduleId];
          delete nextByModule[moduleId];
          return {
            activeModuleId: moduleId,
            byModule: nextByModule,
            ...applyBucket(saved),
          };
        }),
      reset: () => {
        tokenBuffer.clear();
        set({
          messages: [],
          thinking: [],
          tools: [],
          citations: [],
          status: "idle",
          error: null,
          tokens: null,
          invalidFrames: 0,
          turnStep: null,
          byModule: {},
        });
      },
    }),
    {
      name: "sso.conversations",
      // 只持久化对话数据，函数与瞬时态（status/error）不落盘。
      // 一次性把「当前激活桶 + 各模块缓存桶」都存在 localStorage：
      // 刷新后 rehydrate 回内存，切回来还能看到上次对话。
      partialize: (state: SessionState) => ({
        messages: state.messages,
        thinking: state.thinking,
        tools: state.tools,
        citations: state.citations,
        tokens: state.tokens,
        invalidFrames: state.invalidFrames,
        turnStep: state.turnStep,
        activeModuleId: state.activeModuleId,
        byModule: state.byModule,
      }),
    },
  ),
);
/**
 * 向消息的 thinkingSteps 数组中追加或更新一条思维链记录。
 *
 * 如果最后一条记录 id 相同（同一阶段的增量），只更新它的 content/deltas；
 * 否则追加新条目。用于 `appendThinking` 把思维链片段同时写进消息气泡。
 */
function upsertThinkingStep(
  steps: ThinkingStep[],
  step: ThinkingStep,
): ThinkingStep[] {
  const last = steps[steps.length - 1];
  if (last !== undefined && last.id === step.id) {
    const next = steps.slice();
    next[next.length - 1] = step;
    return next;
  }
  return [...steps, step];
}

/** 封口最后一条思考记录（若它还开着）。 */
function closeThinking(thinking: ThinkingStep[]): ThinkingStep[] {
  const last = thinking[thinking.length - 1];
  if (last === undefined || last.endedAt !== undefined) return thinking;
  const next = thinking.slice();
  next[next.length - 1] = { ...last, endedAt: Date.now() };
  return next;
}

// ---------------------------------------------------------------------------
// 派生数据的读取辅助
//
// 放在 store 文件里而不是各组件里现算：Agent 时间线的排序、Token 计数的累加
// 这类口径只应有一处。都是纯函数，可以直接在测试里断言。
//
// ⚠️ 调用方式（踩过坑）：这些选择器**接收原始切片**，不要把「返回新对象/
// 新数组」的选择器直接传给 hook。zustand v5 的 hook 基于 useSyncExternalStore，
// React 每次渲染都会调 selector 并用 Object.is 比较快照 —— 快照每次都是新的
// （比如这里曾经接收整个 state 再 return 一个新数组）就会无限重渲染，
// React #185（Maximum update depth exceeded）→ 整棵树被卸载，落到 Next 内置
// 的 global-error 页。实测于 Edge 有头模式：页面只剩「This page couldn't load」。
// 正确姿势：hook 里只订阅原始切片（引用稳定），派生计算放 useMemo。
// ---------------------------------------------------------------------------

/** 右栏时间线的条目：思考段与工具调用按时间交错。 */
export type TimelineEntry =
  | { kind: "thinking"; at: number; step: ThinkingStep }
  | { kind: "tool"; at: number; tool: ToolActivity };

/** 把思考段与工具调用按发生时间合并成一条时间线。 */
export function selectTimeline(
  thinking: readonly ThinkingStep[],
  tools: readonly ToolActivity[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...thinking.map((step): TimelineEntry => ({
      kind: "thinking",
      at: step.startedAt,
      step,
    })),
    ...tools.map((tool): TimelineEntry => ({
      kind: "tool",
      at: tool.startedAt,
      tool,
    })),
  ];
  return entries.sort((a, b) => a.at - b.at);
}

/** 累计 token 用量：所有轮次相加，而不是只显示最近一轮。 */
export function selectTotalTokens(messages: readonly ChatMessage[]): {
  input: number;
  output: number;
} {
  let input = 0;
  let output = 0;
  for (const message of messages) {
    if (message.tokens === undefined) continue;
    input += message.tokens.input;
    output += message.tokens.output;
  }
  return { input, output };
}