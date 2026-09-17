/**
 * API 层的学生身份解析
 *
 * ⚠️ 这不是真正的鉴权
 * ---------------
 * `api-spec.md`「一、API 路由清单」把大部分路由的「认证」列标为「是」，
 * 但文档**没有定义任何鉴权机制**（没有登录接口、没有 token 格式、没有会话 Cookie），
 * `data-models.md` 里也没有账号/凭据相关的表。
 *
 * 本文件提供的是**身份识别**，不是**身份校验**：从请求里拿到「你是哪个学生」，
 * 并确认这个学生存在。它挡不住「假冒成另一个学生」—— 挡住那个需要真正的
 * 登录体系，属于 Phase 7「打磨与提交」（含安全加固）。
 *
 * 为什么仍然要写这一层
 * -----------------
 * 因为「认证：是」这个标记会渗进每个路由的判断里。若各路由自己解析
 * `studentId`，很快会出现三种写法（header / query / body），而调用方无法知道
 * 该用哪种。集中在这一处，将来换成真正的鉴权时**只改这一个文件**。
 *
 * 为什么接受 header 也接受 query
 * -------------------------
 * `curl` 与浏览器 `EventSource` 加自定义 header 都很麻烦（SSE 尤其：
 * `EventSource` 根本不支持自定义 header）。query 参数是 SSE 那个端点的现实选择。
 * header 优先：它不会出现在访问日志与 Referer 里。
 */

import { jsonError } from "./api-error";
import { studentDb } from "./db";
import type { Student } from "./db/types";

/** 学生身份的请求头。 */
export const STUDENT_ID_HEADER = "x-student-id";

/** query 参数名（SSE 端点用，因为 `EventSource` 发不出自定义 header）。 */
export const STUDENT_ID_QUERY = "studentId";

/** 解析结果：要么拿到学生，要么拿到一个可以直接返回的响应。 */
export type StudentLookup =
  { ok: true; student: Student } | { ok: false; response: Response };

/**
 * 从请求里解析学生身份。
 *
 * 错误区分两段，语义不同：
 * - **没给身份** → 401 `UNAUTHORIZED`（「未登录」）；
 * - **给了但库里没有** → 404 `NOT_FOUND`（调用方传错 id，不是没登录）。
 * 合成一个会让前端无法区分「该去登录」和「参数写错了」。
 */
export async function resolveStudent(request: Request): Promise<StudentLookup> {
  const url = new URL(request.url);
  const studentId =
    request.headers.get(STUDENT_ID_HEADER) ??
    url.searchParams.get(STUDENT_ID_QUERY);

  if (studentId === null || studentId.trim() === "") {
    return {
      ok: false,
      response: jsonError(
        "UNAUTHORIZED",
        `缺少学生身份：请带 ${STUDENT_ID_HEADER} 请求头或 ?${STUDENT_ID_QUERY}= 参数。`,
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
