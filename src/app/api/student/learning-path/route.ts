/**
 * GET /api/student/learning-path —— 学习路径
 *
 * `api-spec.md` 一、路由清单第 3 条。
 *
 * 路径不存在时返回 `null`：**没有路径**是合法的初始状态，
 * 由前端引导学生选第一个模块。返回 404 会让它分不清「还没生成」
 * 与「请求失败」—— 与 `profile` 那个端点是同一个取舍。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { learningPathDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const learningPath = await learningPathDb.get(auth.student.id);
    return Response.json({ learningPath });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
