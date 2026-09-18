/**
 * 错题的数据访问
 *
 * 接口签名不在 `data-models.md`「四、数据访问层设计」里（文档只定义了 7 张表
 * 的 repository），本文件按同层既有风格补齐 —— Phase 5 的
 * `/api/student/errors` 需要它。
 *
 * 只有**读**：错题由点评 Agent 在校验不通过时写入，那个写入点是编排层
 * （`validation-loop`），属 Phase 6 的教学集成。这里不提前发明写入接口 ——
 * 没有调用方的写入方法等于把「谁负责写」这个决定推迟到看不出问题的时候。
 */

import { getDb } from "./sqlite";
import { asNullableString, asNumber, asString, type Row } from "./helpers";
import type { ErrorRecord } from "./types";

function mapError(row: Row): ErrorRecord {
  return {
    id: asString(row.id),
    studentId: asString(row.student_id),
    moduleId: asString(row.module_id),
    conceptId: asString(row.concept_id),
    taskType: asString(row.task_type) as ErrorRecord["taskType"],
    question: asString(row.question),
    studentAnswer: asString(row.student_answer),
    problems: JSON.parse(asString(row.problems) || "[]") as string[],
    correctExample: asString(row.correct_example),
    relatedAntiPattern: asNullableString(row.related_anti_pattern),
    isCorrected: asNumber(row.is_corrected) === 1,
    variantQuestionsGenerated: asNumber(row.variant_questions_generated),
    nextReviewAt: asNullableString(row.next_review_at),
    createdAt: asString(row.created_at),
  };
}

export const errorDb = {
  /** 某学生的全部错题，按时间倒序。 */
  async listByStudent(studentId: string, limit = 50): Promise<ErrorRecord[]> {
    const rows = getDb()
      .prepare(
        "SELECT * FROM errors WHERE student_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(studentId, limit);
    return (rows as Row[]).map(mapError);
  },

  /** 某学生**尚未订正**的错题。出题 Agent 优先出这些概念。 */
  async listUncorrected(studentId: string, limit = 20): Promise<ErrorRecord[]> {
    const rows = getDb()
      .prepare(
        "SELECT * FROM errors WHERE student_id = ? AND is_corrected = 0 ORDER BY created_at DESC LIMIT ?",
      )
      .all(studentId, limit);
    return (rows as Row[]).map(mapError);
  },

  /** 某学生最近涉及的知识点（去重）。报告与出题都要用。 */
  async listRecentConcepts(studentId: string, limit = 10): Promise<string[]> {
    const rows = getDb()
      .prepare(
        "SELECT DISTINCT concept_id FROM errors WHERE student_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(studentId, limit);
    return (rows as Row[]).map((row) => asString(row.concept_id));
  },
};
