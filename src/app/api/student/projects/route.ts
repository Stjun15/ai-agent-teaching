/**
 * GET /api/student/projects —— 项目
 *
 * `api-spec.md` 一、路由清单第 6 条。
 *
 * 项目数量天然有限（一个模块一个），不分页。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { projectDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const projects = await projectDb.listByStudent(auth.student.id);
    return Response.json({ projects });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
