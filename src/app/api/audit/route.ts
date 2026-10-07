/**
 * GET  /api/audit —— 读取课程审计结果（报告页用）
 * POST /api/audit —— 触发一次全量审计并落库
 *
 * 鉴权
 * ----
 * 要登录。审计结果是课程质量的内部结论，含「哪一讲有缺陷、缺陷在哪」这类
 * 信息 —— 对外暴露等于自曝短板。GET 也走鉴权：报告本身是评审要看的交付物，
 * 但不该匿名可读。
 *
 * 与 `/api/audit/evaluate` 的分工
 * -----------------------------
 * evaluate 是给开发期审计脚本用的 LLM 代理（无鉴权、按 IP 限流）；
 * 本端点是产品内的审计员，读写自己的库。
 *
 * 为什么没有 DELETE
 * -----------------
 * 审计结果没有「作废」的语义 —— 它是从内容现算出来的，重跑就覆盖。
 * 提供删除只会让人手动制造「报告空了」的假象，而 POST 本身已是全量重扫。
 *
 * 限流分两个桶：POST 用 curriculum-audit（3 次/分，单次很重），
 * GET 用 audit（10 次/分）。
 */

import { auditAllModules } from "@/lib/audit/orchestrator";
import { resolveStudent } from "@/lib/api-auth";
import { auditDb } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const auth = await resolveStudent(req);
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(auth.student.id, "audit");
  if (limited) return limited;

  const moduleId = new URL(req.url).searchParams.get("moduleId");
  if (moduleId !== null) {
    const findings = auditDb.listByModule(moduleId);
    const [summary] = auditDb
      .listModuleAudits()
      .filter((record) => record.moduleId === moduleId);
    return Response.json({ findings, summary: summary ?? null });
  }

  return Response.json({
    findings: auditDb.listAll(),
    summaries: auditDb.listModuleAudits(),
  });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await resolveStudent(req);
  if (!auth.ok) return auth.response;

  // 单次最重的读操作：读 11 讲概念页 + 讲稿缓存 + 写库，额度压到 3 次/分。
  const limited = enforceRateLimit(auth.student.id, "curriculum-audit");
  if (limited) return limited;

  // 支持只审一讲，便于「改完这一讲就验一下」；body 为空则全量。
  let onlyModuleIds: string[] | undefined;
  try {
    const body = (await req.json()) as { moduleIds?: unknown };
    if (Array.isArray(body.moduleIds)) {
      const ids = body.moduleIds.filter(
        (id): id is string => typeof id === "string" && id !== "",
      );
      if (ids.length > 0) onlyModuleIds = ids;
    }
  } catch {
    // 空 body 是合法请求（全量审计），不当作错误。
  }

  const outcomes = await auditAllModules(
    onlyModuleIds === undefined ? undefined : { onlyModuleIds },
  );

  return Response.json({
    auditedModules: outcomes.length,
    cleanModules: outcomes.filter((outcome) => outcome.clean).length,
    findings: auditDb.listAll(),
    summaries: auditDb.listModuleAudits(),
  });
}
