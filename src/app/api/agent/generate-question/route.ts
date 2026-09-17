/**
 * POST /api/agent/generate-question —— 出题 Agent
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 13 条；八、GenerateQuestionSchema。
 * 接入 Phase 4 编排层的 `runQuestionLoop`（`orchestrator/question-loop.ts`）。
 *
 * 这个端点把「按模块出 N 道练习题」暴露成 HTTP 接口。
 * 与 explain / validate 不同，**它没有 sessionId**：出题是模块级的练习生成，
 * 不绑定到某一次会话，因此 AuthSchema 里也没有它。
 *
 * difficulty → mastery 的映射（推断）
 * ---------------------------------
 * GenerateQuestionSchema 的 `difficulty` 是 1~5 的题面难度；
 * `runQuestionLoop` 的 `mastery` 是学生对概念 0~5 的掌握度，出题 Agent 据其定难度。
 * 两者量纲一致，这里直接把 `difficulty` 当作 `mastery` 传入。
 * 不传时出题 Agent 按默认难度出。
 *
 * conceptId 同样等于 moduleId（见 explain 路由的同名说明）。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { findModule } from "@/lib/modules";
import { runQuestionLoop } from "@/lib/agent/orchestrator/question-loop";
import { GenerateQuestionSchema, type GenerateQuestionInput } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let body: GenerateQuestionInput;
  try {
    const parsed = GenerateQuestionSchema.safeParse(await request.json());
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

  if (body.studentId !== auth.student.id) {
    return jsonError("INVALID_INPUT", "studentId 与请求身份不一致。");
  }

  try {
    const targetModule = await findModule(body.moduleId);
    if (!targetModule) {
      return jsonError("NOT_FOUND", `模块 ${body.moduleId} 不存在。`);
    }

    const result = await runQuestionLoop({
      moduleId: body.moduleId,
      conceptId: body.moduleId,
      count: body.count,
      ...(body.difficulty === undefined ? {} : { mastery: body.difficulty }),
    });

    return Response.json({
      questions: result.questions,
      totalCount: result.questions.length,
      estimatedTime: result.estimatedTime,
      duplicatesRemoved: result.duplicatesRemoved,
      usedFallback: result.usedFallback,
    });
  } catch (error) {
    return jsonError(
      "LLM_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
