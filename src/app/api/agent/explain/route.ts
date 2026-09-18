/**
 * POST /api/agent/explain —— 讲解 Agent
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 11 条；八、ExplainSchema。
 * 接入 Phase 4 编排层的 `runExplainStep`（`orchestrator/teaching-loop.ts`）。
 *
 * 这个端点把「讲解」这一教学步骤暴露成 HTTP 接口：鉴权 → 校验会话归属 →
 * 校验模块存在 → 读前置掌握度 → 跑讲解 Agent → 返回结构化讲解。
 *
 * conceptId 的取值（推断，需你知悉）
 * -------------------------------
 * `runExplainStep` 需要 `conceptId`，但 ExplainSchema 只有 `moduleId`。
 * 本项目的数据模型里「模块」与「概念页」是同一标识 —— `modules.ts` 的
 * `TeachingModule.id` 直接取自 `concepts/{id}.md` 的 frontmatter.id，二者同源。
 * 所以 `conceptId` 直接等于 `moduleId`，无需在请求里多传一个字段。
 * 若将来模块拆成「一模块多概念」，这里要改成「取模块首要概念」。
 *
 * 前置掌握度
 * ---------
 * 只取 `module.prerequisites` 的第一个作为「前置」去读学生掌握度。多前置时
 * 只回退第一个是务实简化：讲解 Agent 的 `prerequisite_mastery` 字段是单值，
 * 多前置的加权/最差策略留给后续。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { masteryDb, sessionDb } from "@/lib/db";
import { findModule } from "@/lib/modules";
import {
  runExplainStep,
  type TeachingState,
} from "@/lib/agent/orchestrator/teaching-loop";
import { ExplainSchema, type ExplainInput } from "@/schemas";

export const runtime = "nodejs";
// 讲解依赖模型调用与数据库读取，必须动态。
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let body: ExplainInput;
  try {
    const parsed = ExplainSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(
        "INVALID_INPUT",
        `请求体不合法：${parsed.error.issues
          .map((i) => `${i.path.join(".") || "<root>"} ${i.message}`)
          .join("；")}`,
      );
    }
    body = parsed.data;
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  // 请求体里的 studentId 必须与请求身份一致（身份由代码控制）。
  if (body.studentId !== auth.student.id) {
    return jsonError("INVALID_INPUT", "studentId 与请求身份不一致。");
  }

  try {
    const session = await sessionDb.get(body.sessionId);
    if (!session || session.studentId !== auth.student.id) {
      return jsonError("NOT_FOUND", `会话 ${body.sessionId} 不存在。`);
    }

    const targetModule = await findModule(body.moduleId);
    if (!targetModule) {
      return jsonError("NOT_FOUND", `模块 ${body.moduleId} 不存在。`);
    }

    // 前置掌握度（仅取第一个前置）。
    let prerequisiteMastery: number | null | undefined;
    const prerequisite = targetModule.prerequisites[0];
    if (prerequisite) {
      const record = await masteryDb.getByConcept(
        auth.student.id,
        prerequisite,
      );
      prerequisiteMastery = record?.score ?? null;
    }

    const state: TeachingState = {
      moduleId: body.moduleId,
      conceptId: body.moduleId,
      phase: "explain",
      attemptNumber: 1,
    };

    const result = await runExplainStep({
      state,
      prerequisiteMastery,
      // 身份只有路由层知道，在这里构造 TraceContext；编排层只透传。
      trace: { studentId: auth.student.id, sessionId: body.sessionId },
    });

    const teaching = result.teaching;
    if (!teaching) {
      return jsonError("LLM_ERROR", "讲解生成失败。");
    }

    return Response.json({ ...teaching, usedFallback: result.usedFallback });
  } catch (error) {
    return jsonError(
      "LLM_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
