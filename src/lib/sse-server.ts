/**
 * SSE 服务端工具
 *
 * 依据 agent-prompts/references/api-spec.md：
 *   「三、SSE 事件协议完整定义」—— 10 种事件类型
 *   「五、后端 SSE 服务端工具」—— createSSEStream 的形态
 *
 * ⚠ 文件名冲突说明：api-spec.md 第五节给的是 `src/lib/sse-server.ts`，
 * 而 05-data-api.md 的交付物清单写的是 `src/lib/sse.ts`。此处按 api-spec.md
 * 取名 —— 因为它同时定义了前端客户端（第四节的 handleSSE，也是 sse.ts），
 * 前后端各占一个文件才不打架。若后续要统一，改这一处即可。
 *
 * 协议形态是 `data: <JSON>\n\n`，事件类型在 JSON 的 type 字段里，
 * 不使用 SSE 的 event: 字段 —— 与 api-spec.md 的前端解析代码一致。
 */

import type { ValidationResult } from "@/lib/db";

// ---------------------------------------------------------------------------
// 事件类型（10 种，逐字对应 api-spec.md 第三节）
// ---------------------------------------------------------------------------

export interface TokenEvent {
  type: "token";
  data: {
    content: string;
    messageId: string;
  };
}

export interface ThinkingEvent {
  type: "thinking";
  data: {
    step: string;
    content: string;
    agent: string;
  };
}

export interface ToolCallEvent {
  type: "tool_call";
  data: {
    toolName: string;
    params: object;
    callId: string;
  };
}

export interface ToolResultEvent {
  type: "tool_result";
  data: {
    callId: string;
    result: object;
    duration: number;
  };
}

export interface CitationEvent {
  type: "citation";
  data: {
    source: string;
    page?: number;
    snippet: string;
    relevance: number;
  };
}

export interface UIEvent {
  type: "ui";
  data: {
    component: string;
    props: object;
  };
}

export interface ValidationEvent {
  type: "validation";
  data: ValidationResult;
}

export interface VisualizationEvent {
  type: "visualization";
  data: {
    sceneId: string;
    params: object;
  };
}

export interface ErrorEvent {
  type: "error";
  data: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export interface DoneEvent {
  type: "done";
  data: {
    messageId: string;
    tokens: { input: number; output: number };
  };
}

export type SSEEvent =
  | TokenEvent
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | CitationEvent
  | UIEvent
  | ValidationEvent
  | VisualizationEvent
  | ErrorEvent
  | DoneEvent;

export type SSEEventType = SSEEvent["type"];

// ---------------------------------------------------------------------------
// 流构造
// ---------------------------------------------------------------------------

export interface SSEStream {
  /** 交给 Response 的可读流 */
  stream: ReadableStream<Uint8Array>;
  /** 推入一个事件 */
  send: (event: SSEEvent) => void;
  /** 正常收尾 */
  close: () => void;
}

/**
 * 创建一个 SSE 流。
 *
 * close() 会做幂等保护：调用方常在 finally 里收尾，而错误分支可能已经先关过了，
 * 重复 close 会让 ReadableStream 抛 "already closed" 掩盖真正的错误。
 * close() 之后再 send() 是静默忽略而非抛错 —— 流已断时再抛错没有意义，
 * 只会污染调用栈。
 */
export function createSSEStream(): SSEStream {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      // 消费端取消（浏览器关标签页、fetch abort、中间层断开）时触发。
      // 只置位、不 close：controller 已随流一同失效，再 close 会抛。
      closed = true;
    },
  });

  function send(event: SSEEvent): void {
    if (closed || !controller) return;
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // 客户端断开与 cancel 回调之间存在竞态：enqueue 可能仍撞上「流已失效」。
      // 此时抛错没有意义 —— 只会把一个「客户端主动断开」的正常事件，
      // 伪装成服务端异常，把调用栈污染成不可读的样子。就地置位后静默退出。
      closed = true;
    }
  }

  function close(): void {
    if (closed || !controller) return;
    closed = true;
    try {
      controller.close();
    } catch {
      // 同上：流已随之失效时无需再关。
    }
  }

  return { stream, send, close };
}

/** SSE 响应头，与 api-spec.md 第五节一致 */
export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
