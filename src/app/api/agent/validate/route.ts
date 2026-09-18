/**
 * POST /api/agent/validate —— 点评 Agent
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 12 条；八、ValidateSchema。
 * 接入 Phase 4 编排层的 `runValidationLoop`（`orchestrator/validation-loop.ts`）。
 *
 * 这个端点把「学生交作业 → 点评 → 判定是否通过」暴露成 HTTP 接口。
 * 返回的是**点评结果 + 编排层判定**（success / nextAction），而不仅仅是
 * 模型原样输出 —— 通过线是代码里写死的三条硬条件（见 validation-loop 的
 * `isPassing`），不依赖模型措辞，避免「其实没过却被判过」。
 *
 * attemptNumber 取自哪
 * -------------------
 * ValidateSchema 没有这个字段（只给 taskType / content / moduleId）。
 * 编排层的 retry / lower_difficulty 决策依赖它，但「这是第几次提交」是会话
 * 状态，不该由客户端自报（学生可以随便填 1）。这里统一按 1 处理：
 * 真正的尝试计数由教学状态机在跨请求时维护，单端点调用视为「首次提交」。
 * 等教学状态机接入后，这里改为从会话状态读。
 *
 * 副作用（都是「点评之后」的记录，写入裁定见各仓库文件头）
 * ----
 * - validation_results：每次点评一行（含兜底 —— 兜底也是一次真实发生的调用）；
 * - prompt_history：只记真实点评（报告页「Prompt 平均分」的数据源）；
 * - errors：真实点评且不通过时写入（报告页「薄弱点」的数据源）。
 */

import { resolveStudent } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/api-error";
import {
  errorDb,
  promptHistoryDb,
  sessionDb,
  validationResultDb,
} from "@/lib/db";
import { findModule } from "@/lib/modules";
import { runValidationLoop } from "@/lib/agent/orchestrator/validation-loop";
import { ValidateSchema, type ValidateInput } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  // 限流：身份一确定就挡（理由同 explain 路由）。
  const limited = enforceRateLimit(auth.student.id, "validate");
  if (limited) return limited;

  let body: ValidateInput;
  try {
    const parsed = ValidateSchema.safeParse(await request.json());
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

    const targetModule = await findModule(body.moduleId);
    if (!targetModule) {
      return jsonError("NOT_FOUND", `模块 ${body.moduleId} 不存在。`);
    }

    const result = await runValidationLoop({
      taskType: body.taskType,
      studentAnswer: body.content,
      moduleId: body.moduleId,
      conceptId: body.moduleId,
      attemptNumber: 1,
      trace: { studentId: auth.student.id, sessionId: body.sessionId },
    });

    const review = result.review;

    // 持久化点评结果（副作用）：此前 /api/agent/validate 跑完直接丢弃，
    // 导致 validation_results 表在真实库里恒为 0 行。这里补上写入，
    // 使每一次点评被真实记录。单独 try/catch：持久化失败不应阻断给学生的点评反馈。
    try {
      await validationResultDb.create({
        studentId: auth.student.id,
        sessionId: body.sessionId,
        taskType: body.taskType,
        totalScore: review.total_score,
        level: review.level,
        isCorrect: review.is_correct,
        dimensions: review.dimensions,
        issues: review.issues,
        suggestions: review.suggestions,
      });
    } catch (dbError) {
      console.error("[validate] 持久化校验结果失败：", dbError);
    }

    // 以下两笔只在**真实点评**后写：兜底输出是编的（0 分 + 假 issues），
    // 写进 Prompt 历史或错题本，等于让学生为一次系统故障背记录。
    if (!result.usedFallback) {
      try {
        await promptHistoryDb.create({
          studentId: auth.student.id,
          moduleId: body.moduleId,
          taskType: body.taskType,
          content: body.content,
          score: review.total_score,
          dimensions: review.dimensions,
          issues: review.issues.map((i) => ({
            type: i.type,
            detail: i.detail,
            deduction: i.deduction,
            relatedDimension: i.related_dimension,
            relatedAntiPattern: i.related_anti_pattern,
          })),
          suggestions: review.suggestions.map((s) => s.action),
          attemptNumber: 1,
          isPassed: result.success,
        });
      } catch (dbError) {
        console.error("[validate] 持久化 Prompt 历史失败：", dbError);
      }

      if (!result.success) {
        try {
          await errorDb.create({
            studentId: auth.student.id,
            moduleId: body.moduleId,
            // ValidateSchema 没有 conceptId（见上方 attemptNumber 同类问题），
            // 沿用与 validation_results 相同的 moduleId 兜底。
            conceptId: body.moduleId,
            taskType: body.taskType,
            studentAnswer: body.content,
            problems: review.issues.map((i) => `${i.type}：${i.detail}`),
            correctExample: review.suggestions[0]?.example ?? null,
            relatedAntiPattern:
              review.issues.find((i) => i.related_anti_pattern)
                ?.related_anti_pattern ?? null,
          });
        } catch (dbError) {
          console.error("[validate] 持久化错题失败：", dbError);
        }
      }
    }

    return Response.json({
      totalScore: review.total_score,
      level: review.level,
      isCorrect: review.is_correct,
      dimensions: review.dimensions,
      issues: review.issues,
      suggestions: review.suggestions,
      nextAction: result.nextAction,
      success: result.success,
      usedFallback: result.usedFallback,
    });
  } catch (error) {
    return jsonError(
      "LLM_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
