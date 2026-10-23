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
 * 模型原样输出 —— 通过线是代码里写死的硬条件（见 validation-loop 的
 * `isPassing`），不依赖模型措辞，避免「其实没过却被判过」。
 *
 * attemptNumber 取自哪（2026-10-21 修正）
 * ----------------------------------
 * 此前硬编码为 1（注释说"等教学状态机接入后改"）。现在改从当前会话的
 * 校验结果记录数反推：listBySession 的 length 就是历史提交次数，
 * 当前提交的 attemptNumber = length + 1。会话重置 = 计数归零，
 * 与 reviewer prompt「连续 3 次未通过 → 降难度」的语义一致。
 *
 * questionText 来自哪（2026-10-21 修正）
 * -----------------------------------
 * 此前只在复刻模块注入题面（`readPracticeTask` 仅对 platform-replica 调用）。
 * 普通模块的 reviewer 收不到题面 → rubric 扣分规则里的"核对题面要求了什么
 * 产出"条款不起作用 → 实测会把「答自己组织语言」误判成跑题。
 * 现在对所有模块调用 readPracticeTask：概念页有「实践任务」节时注入题面，
 * 没有时传 undefined（reviewer prompt 的诚实条款会让它按通用 rubric 评）。
 *
 * 副作用（都是「点评之后」的记录，写入裁定见各仓库文件头）
 * ----
 * - validation_results：每次点评一行（含兜底 —— 兜底也是一次真实发生的调用）；
 * - prompt_history：只记真实点评（报告页「Prompt 平均分」的数据源）；
 * - errors：真实点评且不通过时写入（报告页「薄弱点」的数据源）；
 * - mastery：真实点评后更新（过与不过都是当前能力的最新测量）。设计文档
 *   `02-agent-system.md`「数据职责」约定点评 Agent 写 prompts / errors /
 *   mastery 三张表，前两条此前已接线，mastery 是最后一条 —— 没有它，
 *   点评通过也抬不动掌握度，前置门槛永远停在种子分，掌握式学习的
 *   「测评 → 解锁」循环走不动。
 */

import { resolveStudent } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/api-error";
import {
  errorDb,
  learningPathDb,
  masteryDb,
  promptHistoryDb,
  sessionDb,
  validationResultDb,
} from "@/lib/db";
import { analyzePath, writeAdjustments } from "@/lib/agent/path-adjuster";
import { findModule } from "@/lib/modules";
import { masteryScoreFromPromptScore } from "@/lib/scores";
import { runValidationLoop } from "@/lib/agent/orchestrator/validation-loop";
import { readPracticeTask, readDemoContent } from "@/lib/teaching-script";
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

    // 题面：从概念页「实践任务」节现读（wiki 唯一事实源）。
    // 所有模块均尝试读取 —— 有则注入题面供 reviewer 按清单评分，
    // 无则传 undefined（reviewer prompt 的诚实条款会注明"未取得题面"）。
    const taskText = readPracticeTask(body.moduleId);
    const questionText = taskText || undefined;

    // 尝试次数：从当前会话的校验结果记录数反推。
    // 会话 = 一次连续的学习过程，同一题在同一会话里的第 N 次提交
    // 就是第 N 次尝试。会话重置 → 计数归零，与 reviewer prompt
    // 「连续 3 次未通过 → 降难度」的语义一致。
    const existingResults = await validationResultDb.listBySession(body.sessionId);
    const attemptNumber = existingResults.length + 1;

    // 示范代码：code / tool 类任务注入 demo（来自概念页"示范代码"节）。
    // 让 reviewer 有参考答案可对照，而不是仅靠 module_context 盲评。
    // qa 类不注入（逐字比对会破坏"用自己的话"的教学目标）。
    const demoText =
      body.taskType === "code" || body.taskType === "tool"
        ? readDemoContent(body.moduleId) || undefined
        : undefined;

    const result = await runValidationLoop({
      taskType: body.taskType,
      studentAnswer: body.content,
      moduleId: body.moduleId,
      conceptId: body.moduleId,
      ...(questionText === undefined ? {} : { questionText }),
      ...(demoText === undefined ? {} : { demoContent: demoText }),
      attemptNumber,
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

    // 以下几笔只在**真实点评**后写：兜底输出是编的（0 分 + 假 issues），
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
          attemptNumber,
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

      // 掌握度更新（不区分过与不过 —— 点评是能力的最新测量）。持久化失败
      // 同样不阻断点评反馈，但掌握度不动会让前置门槛读旧值，先记下日志。
      try {
        await masteryDb.update(
          auth.student.id,
          body.moduleId,
          masteryScoreFromPromptScore(review.total_score),
        );
      } catch (dbError) {
        console.error("[validate] 更新掌握度失败：", dbError);
      }

      // ---- 学习路径自动调整（Ploy 闭环） ----
      //
      // 在所有副作用落库后运行：此时 mastery、errors 都已是最新数据。
      // 调整器读取快照 → 判定阈值 → 写入 adjustments。
      // 单独 try/catch：这个模块是新增的，失败绝不能阻断点评返回。
      try {
        const [allMastery, allErrors, path] = await Promise.all([
          masteryDb.get(auth.student.id),
          errorDb.listByStudent(auth.student.id),
          learningPathDb.get(auth.student.id),
        ]);

        if (path) {
          const decisions = analyzePath({
            studentId: auth.student.id,
            conceptId: body.moduleId,
            mastery: allMastery,
            errors: allErrors,
            path,
          });
          await writeAdjustments(auth.student.id, decisions);
        }
      } catch (adjusterError) {
        console.error("[validate] 路径调整失败：", adjusterError);
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