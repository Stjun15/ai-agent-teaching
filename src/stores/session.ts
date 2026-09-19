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

import type { ErrorCode, JsonObject } from "@/schemas";

/** 一条对话消息（界面状态，非数据库实体）。 */
export interface ChatMessage {
  /** 学生消息用本地生成的 id；助手消息用服务端 `token` 事件带来的 `messageId`。 */
  id: string;
  role: "student" | "assistant";
  content: string;
  /** 助手消息所属 Agent，来自 `thinking` 事件（`/api/chat` 目前固定为 `chat`）。 */
  agent?: string;
  status: "streaming" | "done" | "error";
  /** 该消息引用的知识来源，来自 `citation` 事件。 */
  citations: Citation[];
  /** 该轮的 token 用量，来自 `done` 事件。 */
  tokens?: { input: number; output: number };
  createdAt: string;
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
   * 开启一轮对话。
   *
   * `silent`（2026-09-19）：不落学生消息，只进入 streaming 态。给「导师自动
   * 开讲」用 —— 概念讲解步骤学生还没说话，对话里不该冒出一条假的学生提问
   * （「请讲讲…」），那会让人以为是自己点过什么。
   */
  beginTurn: (content: string, options?: { silent?: boolean }) => void;
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
  reset: () => void;
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

export const useSessionStore = create<SessionState>((set) => ({
  messages: [],
  thinking: [],
  tools: [],
  citations: [],
  status: "idle",
  error: null,
  tokens: null,
  invalidFrames: 0,

  beginTurn: (content, options) =>
    set((state) => ({
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
              },
            ],
      // 新的一轮清掉上一轮的错误与用量，但不清消息本身 ——
      // 对话是累积的，学生要能往上翻。
      status: "streaming",
      error: null,
      tokens: null,
    })),

  appendToken: (content, messageId) =>
    set((state) => {
      const streaming = findStreamingAssistant(state.messages);
      // 助手消息**懒创建**：它的 id 必须等于服务端给的 `messageId`，
      // 而那个值要等第一个 token 事件才拿到。提前建会得到一个对不上的 id，
      // 后续 `done` 事件的归属就无从判断。
      if (streaming === undefined) {
        return {
          messages: [
            ...state.messages,
            {
              id: messageId,
              role: "assistant" as const,
              content,
              status: "streaming" as const,
              citations: [],
              createdAt: new Date().toISOString(),
            },
          ],
          thinking: closeThinking(state.thinking),
        };
      }

      if (streaming.id !== messageId) {
        // 服务端在一条助手消息内换了 id（例如中间插了工具调用）——
        // 按新 id 另起一条，而不是把内容混进旧消息。
        return {
          messages: [
            ...state.messages.map((message) =>
              message.id === streaming.id
                ? { ...message, status: "done" as const }
                : message,
            ),
            {
              id: messageId,
              role: "assistant" as const,
              content,
              status: "streaming" as const,
              citations: [],
              createdAt: new Date().toISOString(),
            },
          ],
          thinking: closeThinking(state.thinking),
        };
      }

      return {
        messages: replaceMessage(state.messages, messageId, (message) => ({
          ...message,
          content: message.content + content,
        })),
        thinking: closeThinking(state.thinking),
      };
    }),

  appendThinking: ({ step, agent, content }) =>
    set((state) => {
      const last = state.thinking[state.thinking.length - 1];
      if (
        last !== undefined &&
        last.endedAt === undefined &&
        last.step === step &&
        last.agent === agent
      ) {
        const next = state.thinking.slice();
        next[next.length - 1] = {
          ...last,
          content: last.content + content,
          deltas: last.deltas + 1,
        };
        return { thinking: next };
      }

      return {
        thinking: [
          ...state.thinking,
          {
            id: newId(),
            agent,
            step,
            content,
            deltas: 1,
            startedAt: Date.now(),
          },
        ],
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
      const streaming = findStreamingAssistant(state.messages);
      const targetId = streaming?.id ?? messageId;
      return {
        messages: replaceMessage(state.messages, targetId, (message) => ({
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
      const streaming = findStreamingAssistant(state.messages);
      return {
        messages:
          streaming === undefined
            ? state.messages
            : replaceMessage(state.messages, streaming.id, (message) => ({
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
      const streaming = findStreamingAssistant(state.messages);
      return {
        // 中断不是错误：已收到的内容保留下来，标成 done 让它可以被复制。
        // 用户自己按的「停止」，不该看到一条红色报错。
        messages:
          streaming === undefined
            ? state.messages
            : replaceMessage(state.messages, streaming.id, (message) => ({
                ...message,
                status: "done",
              })),
        status: "aborted",
        thinking: closeThinking(state.thinking),
      };
    }),

  noteInvalidFrame: () =>
    set((state) => ({ invalidFrames: state.invalidFrames + 1 })),

  reset: () =>
    set({
      messages: [],
      thinking: [],
      tools: [],
      citations: [],
      status: "idle",
      error: null,
      tokens: null,
      invalidFrames: 0,
    }),
}));

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
