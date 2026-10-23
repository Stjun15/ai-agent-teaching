/**
 * GET /api/teacher/simulations/[id] —— 一次运行的明细（含逐轮对话）
 *
 * 不存在的 id 与「别人的运行」都回 404：返回 403 等于告诉调用方
 * 「这个 id 是存在的」，属于不必要的信息泄露。
 */

import { requireTeacher } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { SIMULATED_SCOPE_NOTE } from "@/lib/agent/student/simulator";
import { simulationDb } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await requireTeacher(req);
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(auth.student.id, "message");
  if (limited) return limited;

  const { id } = await context.params;
  const run = await simulationDb.get(id);

  if (!run || run.teacherId !== auth.student.id) {
    return jsonError("NOT_FOUND", `模拟运行 ${id} 不存在。`);
  }

  const turns = await simulationDb.listTurns(run.id);
  return Response.json(
    { run, turns, scopeNote: SIMULATED_SCOPE_NOTE },
    { headers: { "Cache-Control": "no-store" } },
  );
}
