/**
 * POST /api/agent/answer-grade —— 练习作答评分
 *
 * 教学七步「练习 → 作答 → 评分」的收口端点：
 *   1. 校验学生身份与会话归属；
 *   2. 从题库读取题目（question_id 外键必须存在，否则无法评分）；
 *   3. 评分（客观题规则 / 主观题复用 reviewer）；
 *   4. 写入 question_results（这是该表落库的唯一 HTTP 触发点）；
 *   5. 返回评分结论与已持久化的结果 id。
 *
 * 设计依据 api-spec.md 同类端点（validate / generate-question）的边界约定：
 * - 校验发生在路由层（AnswerGradeSchema），内核不碰 HTTP 契约；
 * - 与 validate 一致：持久化失败不阻断给学生的评分反馈（独立 try/catch），
 *   但评分本身（模型兜底）仍返回兜底结论。
 *
 * 兜底时写不写库
 * ------------
 * 不写。兜底结论的 0 分是编的（`fallback.ts`：没有分数，不是 0 分），
 * 写进 question_results 会虚增「累计答题」并记一次学生没犯的错，
 * 写进 errors 同理 —— 两者都在「兜底不更新掌握度」的同一条规则之内。
 * 此时返回体带 `usedFallback: true`（resultId 为 null），学生可重交。
 */

import { resolveStudent } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/api-error";
import { errorDb, questionDb, questionResultDb, sessionDb } from "@/lib/db";
import { newId } from "@/lib/db/helpers";
import { runAssessLoop } from "@/lib/agent/orchestrator/assess-loop";
import { AnswerGradeSchema, type AnswerGradeInput } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  // 限流：身份一确定就挡（理由同 explain 路由）。本端点额度更宽 ——
  // 客观题走规则判分、不消耗 token。
  const limited = enforceRateLimit(auth.student.id, "answer-grade");
  if (limited) return limited;

  let body: AnswerGradeInput;
  try {
    const parsed = AnswerGradeSchema.safeParse(await request.json());
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

    const question = await questionDb.get(body.questionId);
    if (!question) {
      return jsonError(
        "NOT_FOUND",
        `题目 ${body.questionId} 不存在：请先调用出题接口生成题目。`,
      );
    }

    const assessment = await runAssessLoop({
      question: {
        type: question.type,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      },
      studentAnswer: body.studentAnswer,
      moduleId: body.moduleId,
      conceptId: body.conceptId,
      // 客观题走规则判分、不调模型，此时不会产生 trace；主观题透传给点评 Agent。
      trace: { studentId: body.studentId, sessionId: body.sessionId },
    });

    // 持久化答题结果。持久化失败不应阻断给学生的评分反馈：
    // 评分本身已经完成，结果仍返回，仅记录失败由后台观察。
    // 兜底时不写（理由见文件头）—— 学生没犯的错不记。
    let resultId: string | null = null;
    if (!assessment.usedFallback) {
      resultId = newId();
      try {
        await questionResultDb.create({
          id: resultId,
          studentId: body.studentId,
          questionId: body.questionId,
          sessionId: body.sessionId,
          studentAnswer: body.studentAnswer,
          isCorrect: assessment.isCorrect,
          score: assessment.score,
        });
      } catch (error) {
        console.error("[answer-grade] 答题结果持久化失败：", error);
      }

      // 主观题判分不通过 → 记入错题本（报告页「薄弱点」的数据源）。
      // problems / correct_example 只有点评输出里有，客观题走规则、产不出
      // 这些字段，不写这张表。conceptId 取题库行的 —— 题目比请求体更可信。
      const review = assessment.review;
      if (!assessment.isCorrect && review) {
        try {
          await errorDb.create({
            studentId: body.studentId,
            moduleId: body.moduleId,
            conceptId: question.conceptId,
            taskType: review.taskType,
            question: question.question,
            studentAnswer: body.studentAnswer,
            problems: review.output.issues.map((i) => `${i.type}：${i.detail}`),
            correctExample: review.output.suggestions[0]?.example ?? null,
            relatedAntiPattern:
              review.output.issues.find((i) => i.related_anti_pattern)
                ?.related_anti_pattern ?? null,
          });
        } catch (error) {
          console.error("[answer-grade] 错题持久化失败：", error);
        }
      }
    }

    return Response.json({
      isCorrect: assessment.isCorrect,
      score: assessment.score,
      feedback: assessment.feedback,
      gradedBy: assessment.gradedBy,
      resultId,
      usedFallback: assessment.usedFallback,
    });
  } catch (error) {
    return jsonError(
      "LLM_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
