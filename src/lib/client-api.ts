"use client";

/**
 * 浏览器侧的 JSON API 客户端
 *
 * 解决的是两个重复问题
 * ------------------
 * 1. **身份头**：`api-spec.md` 把 18 个路由里的 13 个标为「认证：是」，
 *    服务端从 `x-student-id` 认人。每个调用方各写一遍请求头，迟早出现
 *    某一处漏加 —— 现象是那个页面所有请求都 401，看起来像「后端挂了」。
 * 2. **错误封套**：所有失败响应都是 `{ error: { code, message, recoverable } }`
 *    （见 `api-error.ts` 的错误码表）。调用方各自 `res.json()` 再猜字段，
 *    结果就是每个页面各有一套「读不到 message 就显示 Request failed」。
 *
 * 为什么错误里要保留 `recoverable`
 * -----------------------------
 * 它不是「严重程度」，而是**客户端可以原样重试**的意思（限流退避、LLM 抖动
 * 可以重试；输入格式错重试多少次都一样）。界面据此决定要不要给「重试」按钮 ——
 * 把重试按钮给到 `INVALID_INPUT` 上是纯粹的误导，所以这个信息必须一路上浮到这里。
 *
 * 计时为什么在这一层
 * ----------------
 * 沙箱要显示「这次调用花了多久」，而 `performance.now()` 是**不纯函数**：
 * 在组件体内调用会被 `react-hooks/purity` 拦下（已实测）。这不是规则找麻烦 ——
 * 渲染期读时钟确实会让渲染结果不可预测。计时属于「这次请求发生了什么」，
 * 与 HTTP 调用同层，所以放在这里，组件只消费结果。
 *
 * 为什么不是 Server Action
 * ----------------------
 * 这些调用发生在客户端组件的 effect / 事件里（沙箱点「运行」、报告进页面拉数据），
 * 用 Server Action 会把数据请求和渲染生命周期绑在一起，且拿不到 `AbortSignal`。
 */

import { currentStudentId, studentHeaders } from "./client-identity";
import { isAbortError } from "./sse";

/** 服务端错误码，与 `api-error.ts` 的表一一对应。 */
export type ClientApiErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "LLM_ERROR"
  | "DB_ERROR"
  | "TIMEOUT";

/** 网络层就断了（DNS、离线、被 CORS 拦下）时的错误码，服务端不会返回它。 */
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";

/** 一次失败的 API 调用。 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** 是否可以原样重试（见文件头）。 */
  readonly recoverable: boolean;
  /** 从发出到失败经过的毫秒数；非请求阶段产生的错误为 `null`。 */
  readonly durationMs: number | null;

  constructor(
    status: number,
    code: string,
    message: string,
    recoverable: boolean,
    durationMs: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.recoverable = recoverable;
    this.durationMs = durationMs;
  }
}

/** 带耗时的调用结果。 */
export interface TimedResult<T> {
  data: T;
  /** 毫秒。 */
  ms: number;
}

/**
 * 带身份头发一次请求。
 *
 * `signal` 由调用方传入并在组件卸载时 abort：一个已经离开页面的请求还在
 * 占着连接、等模型返回，是白白烧 token。
 */
async function request<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<TimedResult<T>> {
  const headers: Record<string, string> = studentHeaders(currentStudentId());
  if (body !== undefined) headers["content-type"] = "application/json";

  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    // 调用方主动 abort 时**原样抛出**，让它自己识别（`isAbortError`）——
    // 包成 ApiError 会被当成真失败，在界面上闪一个「请求失败」，
    // 而用户只是换了页面。
    if (isAbortError(error)) throw error;
    throw new ApiError(
      0,
      NETWORK_ERROR_CODE,
      error instanceof Error ? error.message : String(error),
      true,
      elapsed(),
    );
  }

  if (!response.ok) throw await toApiError(response, elapsed());
  const ms = elapsed();
  if (response.status === 204) return { data: undefined as T, ms };
  return { data: (await response.json()) as T, ms };
}

/** 把失败响应解成 `ApiError`。响应体不是 JSON（网关返回 HTML 等）时兜底。 */
async function toApiError(
  response: Response,
  durationMs: number,
): Promise<ApiError> {
  let code = NETWORK_ERROR_CODE;
  let message = `HTTP ${response.status}`;
  let recoverable = response.status >= 500 || response.status === 429;

  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; recoverable?: boolean };
    };
    if (payload.error) {
      code = payload.error.code ?? code;
      message = payload.error.message ?? message;
      recoverable = payload.error.recoverable ?? recoverable;
    }
  } catch {
    // 保持上面的兜底值：至少状态码是对的，比抛一个解析错误更有用。
  }

  return new ApiError(response.status, code, message, recoverable, durationMs);
}

export async function apiGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return (await request<T>("GET", path, undefined, signal)).data;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return (await request<T>("POST", path, body, signal)).data;
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return (await request<T>("PUT", path, body, signal)).data;
}

/**
 * 同 `apiPost`，但把耗时一并返回。
 *
 * 只有需要向学生展示「这次调用花了多久」的地方用它（沙箱实验室）。
 * 其余调用方拿一个数字也没处用，反而多一层解构。
 */
export function apiPostTimed<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<TimedResult<T>> {
  return request<T>("POST", path, body, signal);
}
