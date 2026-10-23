/**
 * API 层的学生身份解析
 *
 * 两条路径（优先令牌）：
 *   1. JWT 鉴权令牌（`x-auth-token` 头 / `token` query）：真鉴权，签名验证 +
 *      过期检查，拿下后查库确认学生存在。登录后走此路径。
 *   2. 旧 student-id 头（`x-student-id` / `studentId` query）：身份识别而非校验，
 *      不挡假冒（任何人知道 UUID 就能假装是该学生）。种子学生与无登录流程走此路径。
 *
 * 为什么接受 header 也接受 query
 * -------------------------
 * `curl` 与浏览器 `EventSource` 加自定义 header 都很麻烦（SSE 尤其：
 * `EventSource` 根本不支持自定义 header）。query 参数是 SSE 那个端点的现实选择。
 * header 优先：它不会出现在访问日志与 Referer 里。
 */

import { jsonError } from "./api-error";
import { verifyToken } from "./auth";
import { studentDb } from "./db";
import type { Student } from "./db/types";
import {
  AUTH_TOKEN_HEADER,
  AUTH_TOKEN_QUERY,
  STUDENT_ID_HEADER,
  STUDENT_ID_QUERY,
} from "./student-id";

/**
 * 身份常量定义在 `student-id.ts`（叶子模块），这里按原样导出。
 *
 * 为什么搬走：本文件 import 了数据层，浏览器组件引用它会拖进 `node:sqlite`。
 * 常量留在叶子模块后，客户端用的是同一份字面量，不存在两处口径漂移的可能。
 */
export {
  AUTH_TOKEN_HEADER,
  AUTH_TOKEN_QUERY,
  STUDENT_ID_HEADER,
  STUDENT_ID_QUERY,
};

/** 解析结果：要么拿到学生，要么拿到一个可以直接返回的响应。 */
export type StudentLookup =
  { ok: true; student: Student } | { ok: false; response: Response };

/**
 * 从请求里解析学生身份。
 *
 * 错误区分两段，语义不同：
 * - **令牌过期/无效** → 401 `UNAUTHORIZED`（「请重新登录」）；
 * - **没给身份** → 401 `UNAUTHORIZED`（「未登录」）；
 * - **给了但库里没有** → 404 `NOT_FOUND`（调用方传错 id，不是没登录）。
 * 合成一个会让前端无法区分「该去登录」和「参数写错了」。
 */
export async function resolveStudent(request: Request): Promise<StudentLookup> {
  const url = new URL(request.url);

  // 路径 1：鉴权令牌（真鉴权）
  const token =
    request.headers.get(AUTH_TOKEN_HEADER) ??
    url.searchParams.get(AUTH_TOKEN_QUERY);
  if (token) {
    const verified = verifyToken(token);
    if (!verified) {
      return {
        ok: false,
        response: jsonError("UNAUTHORIZED", "令牌无效或已过期，请重新登录。"),
      };
    }
    let student: Student | null;
    try {
      student = await studentDb.get(verified.studentId);
    } catch (error) {
      return {
        ok: false,
        response: jsonError(
          "DB_ERROR",
          error instanceof Error ? error.message : String(error),
        ),
      };
    }
    if (!student) {
      return {
        ok: false,
        response: jsonError("NOT_FOUND", "令牌对应的学生不存在。"),
      };
    }
    return { ok: true, student };
  }

  // 路径 2：旧 student-id（身份识别，不挡假冒）
  const studentId =
    request.headers.get(STUDENT_ID_HEADER) ??
    url.searchParams.get(STUDENT_ID_QUERY);

  if (studentId === null || studentId.trim() === "") {
    return {
      ok: false,
      response: jsonError(
        "UNAUTHORIZED",
        "缺少身份：请登录获取令牌，或带 x-student-id 请求头。",
      ),
    };
  }

  let student: Student | null;
  try {
    student = await studentDb.get(studentId.trim());
  } catch (error) {
    return {
      ok: false,
      response: jsonError(
        "DB_ERROR",
        error instanceof Error ? error.message : String(error),
      ),
    };
  }

  if (!student) {
    return {
      ok: false,
      response: jsonError("NOT_FOUND", `学生 ${studentId} 不存在。`),
    };
  }

  return { ok: true, student };
}
