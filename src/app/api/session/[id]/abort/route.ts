/**
 * POST /api/session/[id]/abort —— 中断流式
 *
 * `api-spec.md` 一、路由清单第 10 条。
 *
 * 依赖 `src/lib/agent/abort-registry.ts` 的进程内注册表：SSE 流属于**那一条**
 * HTTP 请求，中止请求是另一条，必须有个跨请求的把手。
 *
 * 幂等
 * ----
 * 没有流在跑时返回 `aborted: false` 而不是 404/409 —— 前端点「停止」时
 * 流可能正好刚结束，那是成功而不是错误。返回布尔值让它能自行判断，
 * 不必 catch 一个其实正常的失败。
 */

import { resolveStudent } from "@/lib/api-auth";
import { abortStream } from "@/lib/agent/abort-registry";
import { jsonError } from "@/lib/api-error";
import { sessionDb } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const session = await sessionDb.get(id);
    // 与 GET /api/session/[id] 同一取舍：归属不符报 404，不确认会话是否存在。
    if (!session || session.studentId !== auth.student.id) {
      return jsonError("NOT_FOUND", `会话 ${id} 不存在。`);
    }
    return Response.json({ sessionId: id, aborted: abortStream(id) });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
