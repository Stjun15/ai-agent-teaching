/**
 * GET /api/student/errors —— 错题
 *
 * `api-spec.md` 一、路由清单第 4 条。
 *
 * 支持 `?uncorrected=1` 只看未订正的：出题 Agent 优先出这些概念
 * （`02-agent-system.md`「行为准则 1：优先出学生错过的概念」），
 * 这个筛选条件迟早要传，放在查询参数里比让前端拉全量再过滤省一次全表传输。
 *
 * `?limit=` 有上限（默认 50、最大 200）：错题表只增不减，
 * 不设上限时一个老学生的首次请求就会拖出几千行。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { errorDb } from "@/lib/db";

export const runtime = "nodejs";

/** limit 的上限。防止一次拉走整张表。 */
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const uncorrectedOnly = params.get("uncorrected") === "1";

  try {
    const errors = uncorrectedOnly
      ? await errorDb.listUncorrected(auth.student.id, limit)
      : await errorDb.listByStudent(auth.student.id, limit);
    return Response.json({ errors });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
