/**
 * API 错误响应的构造工具
 *
 * 依据 `agent-prompts/references/api-spec.md`「六、错误码」表格：
 *
 * | 错误码        | HTTP | 可恢复 |
 * |--------------|------|--------|
 * | INVALID_INPUT | 400 | 否 |
 * | UNAUTHORIZED  | 401 | 否 |
 * | FORBIDDEN     | 403 | 否 |
 * | NOT_FOUND     | 404 | 否 |
 * | RATE_LIMIT    | 429 | 是 |
 * | LLM_ERROR     | 500 | 是 |
 * | DB_ERROR      | 500 | 是 |
 * | TIMEOUT       | 504 | 是 |
 *
 * 「可恢复」的含义是**客户端可以原样重试**（限流退避后重试、LLM 抖动重试），
 * 而不是「错误不严重」。输入格式错、鉴权失败这类重试多少次都一样，故为否。
 *
 * 把状态码与可恢复性做成查表而不是散落在各路由的 if 里 —— 一处定义，
 * 前端也能据此判断「要不要给重试按钮」。
 */

import type { ErrorCode } from "@/schemas";
import type { ApiErrorResponse } from "@/schemas";

interface ErrorCodeMeta {
  status: number;
  recoverable: boolean;
}

export const ERROR_CODE_META: Record<ErrorCode, ErrorCodeMeta> = {
  INVALID_INPUT: { status: 400, recoverable: false },
  UNAUTHORIZED: { status: 401, recoverable: false },
  FORBIDDEN: { status: 403, recoverable: false },
  NOT_FOUND: { status: 404, recoverable: false },
  RATE_LIMIT: { status: 429, recoverable: true },
  LLM_ERROR: { status: 500, recoverable: true },
  DB_ERROR: { status: 500, recoverable: true },
  TIMEOUT: { status: 504, recoverable: true },
};

/**
 * 构造 JSON 错误响应。
 *
 * `message` 会原样发给前端并可能被显示 —— **不要**把环境变量值、堆栈、文件路径
 * 拼进去。api-spec「十一、部署检查清单」要求「日志脱敏（不含密钥、用户隐私）」，
 * 响应体同理。
 */
export function jsonError(
  code: ErrorCode,
  message: string,
  overrides?: Partial<ErrorCodeMeta>,
): Response {
  const meta = { ...ERROR_CODE_META[code], ...overrides };
  const body: ApiErrorResponse = {
    error: { code, message, recoverable: meta.recoverable },
  };

  return Response.json(body, {
    status: meta.status,
    headers: { "Cache-Control": "no-store" },
  });
}
