/**
 * GET /api/student/errors —— 错题
 *
 * `api-spec.md` 一、路由清单第 4 条。
 *
 * 查询参数
 * --------
 * - `?uncorrected=1` 只看未订正的：出题 Agent 优先出这些概念
 *   （`02-agent-system.md`「行为准则 1：优先出学生错过的概念」）。
 * - `?due=1` 只看**已到复习档期**的错题（第 1/3/7/14 天，见
 *   `src/lib/review-schedule.ts`）。与 `uncorrected` 互斥，`due` 优先。
 * - `?moduleId=` 按模块筛选（报告页错题本的模块下拉）。
 * - `?offset=` 分页偏移（0 起），与 `limit` 一起做服务端分页。
 * - `?limit=` 每页条数，默认 10，上限 200。
 *
 * 响应
 * ----
 * 始终返回 `{ errors, total, moduleIds, dueCount }`：
 *   - `errors`：当前页的错题列表；
 *   - `total`：满足筛选条件的错题总数（分页控件用）；
 *   - `moduleIds`：该学生所有错题的去重模块 id（下拉选项用）；
 *   - `dueCount`：**不受本次筛选影响**的到期复习条数，错题本用它画筛选角标。
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
    Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

  const moduleId = params.get("moduleId")?.trim() || null;

  const uncorrectedOnly = params.get("uncorrected") === "1";
  const dueOnly = params.get("due") === "1";

  try {
    // 到期复习：独立于 moduleId/offset 之外也能精确计数 —— dueCount 始终算全量。
    if (dueOnly) {
      const [errors, dueCount, moduleIds] = await Promise.all([
        errorDb.listDueForReview(auth.student.id, new Date(), limit),
        errorDb.countDueForReview(auth.student.id),
        errorDb.listDistinctModuleIds(auth.student.id),
      ]);
      // 到期列表按到期时间排序、不分页（待复习的条数天然有限），
      // total 与 dueCount 同值 —— 保持响应形状一致，前端分页控件可直接复用。
      return Response.json({ errors, total: dueCount, moduleIds, dueCount });
    }

    // 未订正筛选保持不变（出题 Agent 用），不接入 moduleId/offset。
    if (uncorrectedOnly) {
      const [errors, total, moduleIds, dueCount] = await Promise.all([
        errorDb.listUncorrected(auth.student.id, limit),
        errorDb.countByStudent(auth.student.id, null),
        errorDb.listDistinctModuleIds(auth.student.id),
        errorDb.countDueForReview(auth.student.id),
      ]);
      return Response.json({ errors, total, moduleIds, dueCount });
    }

    const [errors, total, moduleIds, dueCount] = await Promise.all([
      errorDb.listByStudentFiltered(auth.student.id, moduleId, offset, limit),
      errorDb.countByStudent(auth.student.id, moduleId),
      errorDb.listDistinctModuleIds(auth.student.id),
      errorDb.countDueForReview(auth.student.id),
    ]);

    return Response.json({ errors, total, moduleIds, dueCount });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * PUT /api/student/errors —— 订正 / 复习错题
 *
 * 请求体：{ id: string, correctedAnswer: string }
 * 将错题标记为 is_corrected=1，保存这次提交的答案，并把复习档期推进到
 * 下一个未来档期（第 1/3/7/14 天，四档走完退出队列，规则见
 * `src/lib/review-schedule.ts`）。
 *
 * 为什么已订正的错题也能再提交
 * ------------------------
 * 平台不自动判定订正答案的对错，所以「这次复习算不算过」只能由学生自报；
 * 既然没法区分「订正」与「复习」，就统一成一个动作：**交一次答案 = 完成一档**。
 * 已订正的错题在第 3/7/14 天到期时会再次出现在「待复习」里，正是靠这条路推进。
 *
 * 幂等：同一档期内重复调用只是重写答案、把档期推到同一个未来档期。
 */
export async function PUT(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let body: { id?: string; correctedAnswer?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const { id, correctedAnswer } = body;

  if (!id || typeof id !== "string") {
    return jsonError("INVALID_INPUT", "缺少 id。");
  }
  if (
    !correctedAnswer ||
    typeof correctedAnswer !== "string" ||
    correctedAnswer.trim().length === 0
  ) {
    return jsonError("INVALID_INPUT", "订正答案不能为空。");
  }

  try {
    const trimmed = correctedAnswer.trim();
    const error = errorDb.getById(id.trim());
    if (!error) {
      return jsonError("NOT_FOUND", "该错题不存在。");
    }
    // 归属校验：错题 id 是全局主键，不校验会让学生改到别人的错题。
    if (error.studentId !== auth.student.id) {
      return jsonError("NOT_FOUND", "该错题不存在。");
    }
    // 「不能和原答案一模一样」只约束**首次订正**：那是在核对「有没有真的改」。
    // 之后每次到期复习交的本来就该是同一个正确答案，再拦就成了刁难。
    if (!error.isCorrected && trimmed === error.studentAnswer.trim()) {
      return jsonError(
        "INVALID_INPUT",
        "订正答案不能和原来的错误答案一模一样。",
      );
    }

    errorDb.markCorrected(id.trim(), trimmed);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
