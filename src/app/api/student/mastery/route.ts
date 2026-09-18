/**
 * GET /api/student/mastery —— 掌握度
 *
 * `api-spec.md` 一、路由清单第 2 条。
 *
 * 返回**数组**而不是按概念 id 索引的对象：前端要按学习路径的顺序展示，
 * 数组拿回来直接排序即可；对象还要再 `Object.values()` 一次，且顺序不可控。
 *
 * `studentId` 不使用路径参数（路由是固定的 `/api/student/mastery`）：
 * 身份由 `resolveStudent` 从 header / query 解析，见 `src/lib/api-auth.ts`。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { masteryDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const mastery = await masteryDb.get(auth.student.id);
    return Response.json({ mastery });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
