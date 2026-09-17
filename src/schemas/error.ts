/**
 * HTTP 错误响应体契约
 *
 * 为什么单独一个文件
 * ----------------
 * SSE 端点**在流开始之前**失败时，不能再用 `error` 事件通知前端（那时还没有流），
 * 只能回一个普通 JSON + 非 2xx 状态码。前端必须能分辨这两种失败：
 * 流内 `error` 事件（可恢复，连接还在）与流外 JSON 错误（本次请求根本没用上）。
 * 于是需要一个统一的错误响应体形状 —— 就是本文件。
 *
 * 依据：`api-spec.md`「六、错误码」的 8 个取值，以及「九、API 调用示例」中
 * 前端对非 2xx 的处理（`throw new Error(\`SSE failed: ${response.status}\`)`）。
 * 前端据此把状态码升级成可读信息。
 */

import { z } from "zod";

import { ErrorCodeSchema } from "./sse";

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    recoverable: z.boolean(),
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
