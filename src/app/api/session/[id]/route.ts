/**
 * GET / DELETE /api/session/[id] —— 会话详情
 *
 * `api-spec.md` 一、路由清单第 8 条。
 *
 * 归属检查失败时返回 **404 而不是 403**
 * -------------------------------
 * 403 会确认「这个会话确实存在，只是不属于你」—— 会话 id 是 UUID，
 * 本来不可猜，但没必要主动泄露。返回 404 让「不存在」与「不是你的」
 * 对外表现一致，是更安全也够用的选择。
 *
 * DELETE 是**软结束**而不是物理删除
 * ---------------------------
 * `sessionDb` 只提供 `end()`（写 `ended_at`、置 `status = 'completed'`），
 * 没有 delete。这是有道理的：会话连着 messages 与 traces，物理删除会把
 * 学生的学习记录一起抹掉，而「结束会话」才是用户真正的意图。
 * 所以这里调 `end()` 并在响应里说明是软结束 —— **不假装删了**。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { sessionDb } from "@/lib/db";

export const runtime = "nodejs";

/** Next 16 的路由参数是个 Promise，必须 await。 */
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const session = await sessionDb.get(id);
    if (!session || session.studentId !== auth.student.id) {
      return jsonError("NOT_FOUND", `会话 ${id} 不存在。`);
    }
    return Response.json({ session });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const session = await sessionDb.get(id);
    if (!session || session.studentId !== auth.student.id) {
      return jsonError("NOT_FOUND", `会话 ${id} 不存在。`);
    }
    await sessionDb.end(id);
    return Response.json({ sessionId: id, deleted: false, ended: true });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
