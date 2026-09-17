/**
 * GET /api/student/prompts —— Prompt 历史
 *
 * `api-spec.md` 一、路由清单第 5 条。
 *
 * `?moduleId=` 可选：模块页只需要本模块的提交记录，
 * 而报告页需要全量。与其加一个新路由，不如一个查询参数。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { promptHistoryDb } from "@/lib/db";

export const runtime = "nodejs";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const moduleId = params.get("moduleId");

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    // 指定了模块就按模块取（该分支不分页：一个模块下的提交数量有限）
    const history = moduleId
      ? await promptHistoryDb.listByModule(auth.student.id, moduleId)
      : await promptHistoryDb.listByStudent(auth.student.id, limit);
    return Response.json({ history });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
