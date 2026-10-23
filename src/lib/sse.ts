/**
 * 前端 SSE 客户端
 *
 * 依据 `api-spec.md`「四、前端 SSE 客户端」的 `handleSSE` 签名 ——
 * 函数名、参数顺序、返回时机都照它实现，调用侧写法与文档一致。
 *
 * 与文档那版相比多做了三件事（都是文档版本的真实缺口）
 * ------------------------------------------------
 * 1. **读结构化错误体**。文档版是 `throw new Error(\`SSE failed: ${status}\`)`，
 *    只留一个状态码。而后端在流开始之前失败时返回的是
 *    `{ error: { code, message, recoverable } }`（见 `src/lib/api-error.ts`），
 *    里面带着「为什么失败、要不要重试」。丢掉它，前端只能显示「503」这种
 *    对用户毫无意义的信息。这里解析后包成 `SSEHttpError`。
 * 2. **逐帧过 Zod 校验**。铁律 2「Agent 输出必须 JSON + Zod」的接收侧落点：
 *    `JSON.parse` 成功只说明它是 JSON，不说明它是协议里的事件。
 *    文档版把解析失败吞进 `console.error`，等于把损坏的帧静默丢掉 ——
 *    界面会安静地少一段内容，没人知道为什么。这里交给 `onInvalidFrame` 回调，
 *    由调用方决定是提示还是计数。
 * 3. **区分「用户主动中断」与「真的出错」**。关标签页 / 点停止会让 fetch 抛
 *    `AbortError`，那是正常操作，不是异常。`isAbortError` 供调用方判断，
 *    避免把用户自己点的「停止」渲染成一条红色错误。
 *
 * 只支持单行 `data:`（本项目的协议形态）
 * ------------------------------------
 * SSE 规范允许一个事件拆成多行 `data:`，由客户端拼接。本项目的服务端
 * （`src/lib/sse-server.ts`）固定发 `data: <单行 JSON>\n\n`，
 * 而 `JSON.stringify` 不会产生裸换行，所以不存在多行 `data` 的情况。
 * 这里对 `event:` / `id:` / 注释行（`:` 开头）一律跳过而非报错 ——
 * 将来接入第三方 SSE 源时不会被这些字段绊倒。
 */

import type { ZodError } from "zod";

import { ApiErrorResponseSchema } from "@/schemas";
import { SSEEventSchema, type ErrorCode, type SSEEventInput } from "@/schemas";

/** 流开始之前失败时抛出的错误，带协议里的错误码与可恢复性。 */
export class SSEHttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly recoverable: boolean;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    recoverable: boolean,
  ) {
    super(message);
    this.name = "SSEHttpError";
    this.status = status;
    this.code = code;
    this.recoverable = recoverable;
  }
}

/** 判断是否为「调用方主动中断」（AbortController.abort / 组件卸载）。 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export interface SSEOptions {
  signal?: AbortSignal;
  /** 额外请求头（如学生 Agent 的 x-student-id 身份头）。 */
  headers?: Record<string, string>;
  /**
   * 收到一帧无法通过 Zod 校验的数据时调用。
   *
   * 单独给回调而不是就地 `console.error`：损坏的帧应当**对用户可见**
   * （或至少被计数），否则界面会无声地少一段内容。回调为空时退化为忽略，
   * 但那时是调用方**显式选择**忽略，而不是被库偷偷吞掉。
   */
  onInvalidFrame?: (raw: string, error?: ZodError) => void;
}

/**
 * 发起一次 SSE 请求，逐帧回调。
 *
 * 正常结束（服务端关闭流）时 resolve；流开始前失败抛 `SSEHttpError`；
 * 主动中断抛 `AbortError`（用 `isAbortError` 判断）。
 */
export async function handleSSE(
  url: string,
  body: object,
  onEvent: (event: SSEEventInput) => void,
  options: SSEOptions = {},
): Promise<void> {
  const { signal, onInvalidFrame, headers } = options;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw await toHttpError(response);
  }

  if (response.body === null) {
    throw new SSEHttpError(
      response.status,
      "LLM_ERROR",
      "响应没有可读的流式主体。",
      true,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // `stream: true` 让解码器跨 chunk 保留不完整的多字节字符 ——
      // 一个中文字被两个 chunk 切开时，不加这个参数会得到乱码。
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        dispatchFrame(frame, onEvent, onInvalidFrame);
        boundary = buffer.indexOf("\n\n");
      }
    }

    // 流结束时还剩下内容，说明服务端没按 `\n\n` 收尾。仍然尝试解析 ——
    // 丢掉的可能是最后一段内容，而这往往正是最要紧的那段。
    if (buffer.trim() !== "") {
      dispatchFrame(buffer, onEvent, onInvalidFrame);
    }
  } finally {
    // 主动中断时 cancel 会抛（流已失效），此时无意义。
    await reader.cancel().catch(() => undefined);
  }
}

/** 解析单个 SSE 帧并分发给调用方。 */
function dispatchFrame(
  frame: string,
  onEvent: (event: SSEEventInput) => void,
  onInvalidFrame?: (raw: string, error?: ZodError) => void,
): void {
  for (const line of frame.split("\n")) {
    // 注释行（以 `:` 开头）与 `event:` / `id:` / `retry:` 字段：本项目不使用。
    if (line === "" || line.startsWith(":")) continue;
    if (!line.startsWith("data:")) continue;

    const payload = line.slice("data:".length).trimStart();
    if (payload === "") continue;
    // SSE 的 `[DONE]` 哨兵：本项目用 done 事件表达结束，不认这个约定。
    if (payload === "[DONE]") continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      onInvalidFrame?.(payload);
      continue;
    }

    const result = SSEEventSchema.safeParse(parsed);
    if (!result.success) {
      onInvalidFrame?.(payload, result.error);
      continue;
    }

    onEvent(result.data);
  }
}

/** 把非 2xx 响应转成带协议信息的错误；响应体不是预期形状时退化到状态码。 */
async function toHttpError(response: Response): Promise<SSEHttpError> {
  let raw: string | undefined;
  try {
    raw = await response.text();
  } catch {
    raw = undefined;
  }

  if (raw !== undefined && raw !== "") {
    try {
      const parsed = ApiErrorResponseSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        return new SSEHttpError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.recoverable,
        );
      }
    } catch {
      // 落到下面的兜底
    }
    // 不是 JSON 或形状不符：把原文截断后带上，至少比只有状态码有用。
    return new SSEHttpError(
      response.status,
      codeForStatus(response.status),
      raw.slice(0, 300),
      true,
    );
  }

  return new SSEHttpError(
    response.status,
    codeForStatus(response.status),
    `请求失败（HTTP ${response.status}）。`,
    true,
  );
}

/**
 * 响应体不可用时的错误码兜底。
 *
 * 只做粗粒度映射，且**只用协议表里已有的码** —— 自造码会让前端查不到
 * 状态码与可恢复性（上一轮 `loop.ts` 发 `INTERNAL` 就是这个错误）。
 */
function codeForStatus(status: number): ErrorCode {
  if (status === 400) return "INVALID_INPUT";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMIT";
  if (status === 504) return "TIMEOUT";
  return "LLM_ERROR";
}
