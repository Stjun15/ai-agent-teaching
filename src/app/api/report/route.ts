/**
 * GET /api/report —— 学习报告
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 17 条；八、Report 响应形状。
 *
 * 从真实数据聚合一份学习报告：掌握度、错题、Prompt 历史、答题数。
 * 全部字段都来自数据库里**真实存在**的表，不编造。
 *
 * subAbilities 的处理（推断，需你知悉）
 * ------------------------------------
 * api-spec 的 subAbilities 列了 6 个分项能力（意图表达 / 任务分解 / 上下文管理 /
 * 质量判断 / 迭代优化 / 理解 AI）。本项目**没有把掌握度按这 6 项建模** ——
 * `mastery` 表是「概念 → 分数」，不是「能力 → 分数」。所以这里暂时用
 * 「总体平均掌握度」填充这 6 项，作为占位。等 Phase 6 把分项能力建模出来，
 * 只需替换这一段映射，其余聚合不动。前端拿到相同数值时应理解为「暂无分项数据」。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import {
  errorDb,
  learningPathDb,
  masteryDb,
  promptHistoryDb,
  questionResultDb,
} from "@/lib/db";
import { summarizeDimensions } from "@/lib/report-dimensions";
import type { ReportResponse } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 把一组分数四舍五入到 2 位小数，避免浮点噪音。 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const studentId = auth.student.id;

  try {
    const [mastery, errors, prompts, totalQuestions, learningPath] =
      await Promise.all([
        masteryDb.get(studentId),
        errorDb.listByStudent(studentId),
        promptHistoryDb.listByStudent(studentId),
        questionResultDb.countByStudent(studentId),
        learningPathDb.get(studentId),
      ]);

    const averageMastery = mastery.length
      ? round2(
          mastery.reduce((sum, record) => sum + record.score, 0) /
            mastery.length,
        )
      : 0;
    const completedModules = mastery.filter(
      (record) => record.score >= 4,
    ).length;
    const averagePromptScore = prompts.length
      ? round2(
          prompts.reduce((sum, record) => sum + (record.score ?? 0), 0) /
            prompts.length,
        )
      : 0;

    // 分项能力：暂无分维度建模，暂以总体平均掌握度近似（见文件头）。
    const subAbilities = {
      intentExpression: averageMastery,
      taskDecomposition: averageMastery,
      contextManagement: averageMastery,
      qualityJudgment: averageMastery,
      iterativeOptimization: averageMastery,
      understandingAI: averageMastery,
    };

    // 掌握度趋势：按日期聚合「当天平均分」。
    const byDate = new Map<string, { sum: number; count: number }>();
    for (const record of mastery) {
      const date = (record.updatedAt ?? "").slice(0, 10);
      if (!date) continue;
      const bucket = byDate.get(date) ?? { sum: 0, count: 0 };
      bucket.sum += record.score;
      bucket.count += 1;
      byDate.set(date, bucket);
    }
    const masteryTrend = [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, bucket]) => ({
        date,
        score: round2(bucket.sum / bucket.count),
      }));

    // 薄弱点：按概念统计错题数，取前 5。
    const errorCounts = new Map<string, number>();
    for (const error of errors) {
      errorCounts.set(
        error.conceptId,
        (errorCounts.get(error.conceptId) ?? 0) + 1,
      );
    }
    const weaknesses = [...errorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([concept, count]) => ({
        concept,
        issue: `错题 ${count} 次`,
      }));

    // 真实评分维度：从历次点评的 dimensions 汇总（见 `report-dimensions.ts`
    // 文件头，这里不做「维度名 → 六项子能力」的映射，映射就是编数据）。
    const promptDimensions = summarizeDimensions(prompts);

    const recommendations = weaknesses.length
      ? weaknesses.map(
          (weak) =>
            `建议复习「${weak.concept}」：${weak.issue}，先巩固基础再进入下一模块。`,
        )
      : ["保持当前节奏，继续完成下一模块的学习与练习。"];

    // 路径调整：取最近 3 条，按日期降序（与 PathAdjustmentList 组件口径一致）
    const adjustments = (learningPath?.adjustments ?? [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);

    // 返回体用 `ReportResponse` 标注：报告页消费的就是这个类型，
    // 字段名或层级写错会在这里编译报错，而不是变成页面上的一块空白。
    const payload: ReportResponse = {
      overview: {
        completedModules,
        averageMastery,
        totalQuestions,
        averagePromptScore,
      },
      subAbilities,
      promptDimensions,
      masteryTrend,
      weaknesses,
      recommendations,
      adjustments,
    };

    return Response.json(payload);
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
