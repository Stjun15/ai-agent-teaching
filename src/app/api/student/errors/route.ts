/**
 * GET /api/student/errors —— 错题
 *
 * `api-spec.md` 一、路由清单第 4 条。
 *
 * 查询参数
 * --------
 * - `?uncorrected=1` 只看未订正的：出题 Agent 优先出这些概念
 *   （`02-agent-system.md`「行为准则 1：优先出学生错过的概念」）。
 * - `?moduleId=` 按模块筛选（报告页错题本的模块下拉）。
 * - `?offset=` 分页偏移（0 起），与 `limit` 一起做服务端分页。
 * - `?limit=` 每页条数，默认 10，上限 200。
 *
 * 响应
 * ----
 * 始终返回 `{ errors, total, moduleIds }`：
 *   - `errors`：当前页的错题列表；
 *   - `total`：满足筛选条件的错题总数（分页控件用）；
 *   - `moduleIds`：该学生所有错题的去重模块 id（下拉选项用）。
 *
 * 旧调用方（只传 `limit`、不传 `moduleId`/`offset`）仍然兼容：
 * `total` 会等于该次查询的总命中数，`moduleIds` 始终给全量。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { errorDb } from "@/lib/db";

export const runtime = "nodejs";

/** limit 的上限。防止一次拉走整张表。 */
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 10;

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const rawOffset = Number(params.get("offset"));
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.floor(rawOffset)
      : 0;

  const moduleId =
    params.get("moduleId")?.trim() || null;

  const uncorrectedOnly = params.get("uncorrected") === "1";

  try {
    // 未订正筛选保持不变（出题 Agent 用），不接入 moduleId/offset。
    if (uncorrectedOnly) {
      const errors = await errorDb.listUncorrected(auth.student.id, limit);
      const total = await errorDb.countByStudent(auth.student.id, null);
      const moduleIds = await errorDb.listDistinctModuleIds(auth.student.id);
      return Response.json({ errors, total, moduleIds });
    }

    const [errors, total, moduleIds] = await Promise.all([
      errorDb.listByStudentFiltered(
        auth.student.id,
        moduleId,
        offset,
        limit,
      ),
      errorDb.countByStudent(auth.student.id, moduleId),
      errorDb.listDistinctModuleIds(auth.student.id),
    ]);

    return Response.json({ errors, total, moduleIds });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}