/**
 * GET /api/teacher/simulations —— 当前教师的模拟运行列表
 *
 * 只列自己发起的运行（`teacher_id = 当前账号`）。教师之间互不可见：
 * 模拟里有学生人设的「错误理解」，跨教师可见没有业务理由，只会扩大泄露面。
 */

import { requireTeacher } from "@/lib/api-auth";
import { simulationDb } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 列表上限。控制台只展示最近一屏，不需要翻页。 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: Request): Promise<Response> {
  const auth = await requireTeacher(req);
  if (!auth.ok) return auth.response;

  // 列表是轻量查询（不调模型），借 `message` 桶的宽松额度 —— 控制台轮询时
  // 1~2 秒一次，用更紧的桶会把自己锁在门外。
  const limited = enforceRateLimit(auth.student.id, "message");
  if (limited) return limited;

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  // 非法 limit 回落到默认值而不是 400：这是控制台的轮询参数，不是业务输入。
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const runs = await simulationDb.listByTeacher(auth.student.id, limit);
  return Response.json({ runs }, { headers: { "Cache-Control": "no-store" } });
}
