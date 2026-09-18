/**
 * POST /api/agent/answer —— 答疑 Agent
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 14 条；八、AnswerSchema。
 *
 * 这是四个 Agent 端点里**唯一没有编排循环包装**的：答疑是「一问一答」，没有
 * 跨请求状态机，直接调 `runAgent`（非流式路径）跑 assistant Agent 的
 * `answer-question` 技能即可。`answer-question` 是 assistant 的 defaultSkill，
 * 且在其 `allowedSkills` 内 —— 越权检查（runtime.ts）会拦住任何越界调用。
 *
 * 为什么不用 SSE
 * ------------
 * 答疑的产出是**单个结构化 JSON**（type / content / related_concepts / hint_level
 * / should_log / log_category），不是逐字流。用 SSE 反而会逼前端把碎片拼回 JSON，
 * 收益为负。需要流式答疑时再另开端点。
 *
 * 输入只给 question + current_module
 * --------------------------------
 * `answer-question` 技能是通用苏格拉底式引导，不依赖学生画像以外的上下文；
 * 会话 id 仅用于归属校验，不进模型输入（避免把无关会话历史污染这一次问答）。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { sessionDb } from "@/lib/db";
import { runAgent } from "@/lib/agent/runtime";
import { assistantFallback } from "@/lib/agent/fallback";
import { AnswerSchema, type AnswerInput } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let body: AnswerInput;
  try {
    const parsed = AnswerSchema.safeParse(await request.json());
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
    const session = await sessionDb.get(body.sessionId);
    if (!session || session.studentId !== auth.student.id) {
      return jsonError("NOT_FOUND", `会话 ${body.sessionId} 不存在。`);
    }

    const result = await runAgent({
      agent: "assistant",
      skill: "answer-question",
      input: {
        question: body.question,
        current_module: body.currentModule,
      },
      fallback: assistantFallback,
      trace: { studentId: auth.student.id, sessionId: body.sessionId },
    });

    const data = result.data;
    if (!data) {
      return jsonError("LLM_ERROR", "答疑生成失败。");
    }

    return Response.json({ ...data, usedFallback: result.usedFallback });
  } catch (error) {
    return jsonError(
      "LLM_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
