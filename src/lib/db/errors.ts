/**
 * 错题的数据访问
 *
 * 接口签名不在 `data-models.md`「四、数据访问层设计」里（文档只定义了 7 张表
 * 的 repository），本文件按同层既有风格补齐 —— Phase 5 的
 * `/api/student/errors` 需要它。
 *
 * 写入裁定（2026-09-18）
 * --------------------
 * 写入点是**判为不通过时**（`02-agent-system.md` 异常处理：
 * 「校验不通过 3 次 → 降难度 + 记录 errors」；`fallback.ts` 同一段落），
 * 落在 HTTP 路由层：`/api/agent/validate`（自主提交不通过）与
 * `/api/agent/answer-grade`（作答判分不通过）。
 *
 * 客观题也写（2026-09-18 改）
 * ------------------------
 * 原先只写主观题，理由是「客观题走规则判分、产不出 problems /
 * correct_example」。但题库行**自带** `explanation` 与 `correctAnswer`，
 * 足以填上这两个字段 —— 不写的实际后果是：客观题答错只进
 * `question_results`，报告页「薄弱点」与「错题本」永远缺这一类错误，
 * 学生做得最多的那类练习反而在报告里看不见。
 * 现在两路都写，但**文本上必须分得清**：客观题的 problems 带「解析：」前缀，
 * 标明它来自题库作者而不是点评 Agent（路由里有同样一段说明）。
 *
 * **兜底输出不写**：兜底的 0 分是编的，编的失败不是学生的失败 ——
 * 与「兜底不更新掌握度」（`fallback.ts`）是同一条规则。
 */

import { getDb } from "./sqlite";
import {
  newId,
  asNullableString,
  asNumber,
  asString,
  type Row,
} from "./helpers";
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
  /**
   * 写入一条错题（点评判为不通过时，见文件头「写入裁定」）。
   *
   * `question` 可空：`/api/agent/validate` 是学生自主提交，没有题面；
   * `answer-grade` 从题库行带入。`is_corrected` / `variant_questions_generated` /
   * `next_review_at` 固定写初始值 —— 订正与复习调度还没有实现路径，写假状态
   * 等于谎报。
   */
  async create(input: {
    studentId: string;
    moduleId: string;
    conceptId: string;
    taskType: ErrorRecord["taskType"];
    question?: string | null;
    studentAnswer: string;
    problems: string[];
    correctExample?: string | null;
    relatedAntiPattern?: string | null;
  }): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO errors (
           id, student_id, module_id, concept_id, task_type, question,
           student_answer, problems, correct_example, related_anti_pattern,
           is_corrected, variant_questions_generated, next_review_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL)`,
      )
      .run(
        newId(),
        input.studentId,
        input.moduleId,
        input.conceptId,
        input.taskType,
        input.question ?? null,
        input.studentAnswer,
        JSON.stringify(input.problems),
        input.correctExample ?? null,
        input.relatedAntiPattern ?? null,
      );
  },

  /** 某学生的全部错题，按时间倒序。 */
  async listByStudent(studentId: string, limit = 50): Promise<ErrorRecord[]> {
    const rows = getDb()
      .prepare(
        "SELECT * FROM errors WHERE student_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(studentId, limit);
    return (rows as Row[]).map(mapError);
  },

  /**
   * 按模块筛选 + 分页的错题列表。
   *
   * moduleId 为空/null 时返回全量（所有模块）；offset/limit 做真正的
   * 服务端分页 —— 错题表只增不减，不做分页时一次拖出几百行没必要。
   */
  async listByStudentFiltered(
    studentId: string,
    moduleId: string | null,
    offset: number,
    limit: number,
  ): Promise<ErrorRecord[]> {
    const where = moduleId
      ? "WHERE student_id = ? AND module_id = ?"
      : "WHERE student_id = ?";
    const params: (string | number)[] = moduleId
      ? [studentId, moduleId, limit, offset]
      : [studentId, limit, offset];
    const sql = `SELECT * FROM errors ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const rows = getDb().prepare(sql).all(...params);
    return (rows as Row[]).map(mapError);
  },

  /**
   * 按模块筛选的错题总数（分页用）。
   *
   * moduleId 为空/null 时不筛选，返回该学生全部错题的总数。
   */
  async countByStudent(
    studentId: string,
    moduleId: string | null,
  ): Promise<number> {
    const where = moduleId
      ? "WHERE student_id = ? AND module_id = ?"
      : "WHERE student_id = ?";
    const params: string[] = moduleId
      ? [studentId, moduleId]
      : [studentId];
    const sql = `SELECT COUNT(*) as cnt FROM errors ${where}`;
    const row = getDb().prepare(sql).get(...params) as Row | undefined;
    return asNumber(row?.cnt ?? 0);
  },

  /**
   * 某学生所有错题涉及的去重模块 id（下拉选项用）。
   *
   * 按模块名排序而不是按最近出错时间：下拉列表是给人选的，
   * 稳定的字母序比「最近出错的模块飘在最上面」更容易定位。
   */
  async listDistinctModuleIds(studentId: string): Promise<string[]> {
    const rows = getDb()
      .prepare(
        "SELECT DISTINCT module_id FROM errors WHERE student_id = ? ORDER BY module_id ASC",
      )
      .all(studentId);
    return (rows as Row[]).map((row) => asString(row.module_id));
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