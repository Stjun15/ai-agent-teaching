/**
 * GET /api/student/prompts —— Prompt 历史
 *
 * `api-spec.md` 一、路由清单第 5 条。
 *
 * 查询参数
 * --------
 * - `?moduleId=` 按模块筛选（报告页 Prompt 历史的模块下拉）。
 * - `?offset=` 分页偏移（0 起），与 `limit` 一起做服务端分页。
 * - `?limit=` 每页条数，默认 10，上限 200。
 *
 * 响应
 * ----
 * 始终返回 `{ history, total, moduleIds }`：
 *   - `history`：当前页的 Prompt 提交记录；
 *   - `total`：满足筛选条件的记录总数（分页控件用）；
 *   - `moduleIds`：该学生所有 Prompt 历史的去重模块 id（下拉选项用）。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { promptHistoryDb } from "@/lib/db";

export const runtime = "nodejs";

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

  try {
    const [history, total, moduleIds] = await Promise.all([
      promptHistoryDb.listByStudentFiltered(
        auth.student.id,
        moduleId,
        offset,
        limit,
      ),
      promptHistoryDb.countByStudent(auth.student.id, moduleId),
      promptHistoryDb.listDistinctModuleIds(auth.student.id),
    ]);

    return Response.json({ history, total, moduleIds });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}