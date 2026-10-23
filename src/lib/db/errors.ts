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
 *
 * 复习调度（2026-10-24 接线）
 * ------------------------
 * `next_review_at` 此前恒为 NULL，注释写着「复习调度还没有实现路径」——
 * 「第 1/3/7/14 天复习」这个教学承诺因此推不动。现在两处写：
 *   1. `create()` 按创建时间排**第 1 天**首次复习；
 *   2. `markCorrected()`（学生提交订正答案 = 完成一次复习）把档期推到
 *      下一个未来档期，四档走完置 NULL 退出队列。
 * 排期规则本身在 `src/lib/review-schedule.ts`（纯函数，有单测），本文件只负责落库。
 */

import { getDb } from "./sqlite";
import {
  newId,
  asNullableString,
  asNumber,
  asString,
  nowIso,
  type Row,
} from "./helpers";
import type { ErrorRecord } from "./types";
import { nextReviewAt } from "../review-schedule";

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
   * `answer-grade` 从题库行带入。`variant_questions_generated` 仍是初始值
   * （变式出题还没接这条线，不编）；`next_review_at` 按创建时间排第 1 天
   * 复习，规则见 `src/lib/review-schedule.ts`。
   *
   * 订正路径：错题本页面提交订正答案 → `errorDb.markCorrected()`。 */
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
    const createdAt = nowIso();
    // 刚创建时 elapsed = 0，第一个未到的档期就是第 1 天。
    const firstReview = nextReviewAt(createdAt, new Date(createdAt));

    getDb()
      .prepare(
        `INSERT INTO errors (
           id, student_id, module_id, concept_id, task_type, question,
           student_answer, problems, correct_example, related_anti_pattern,
           is_corrected, variant_questions_generated, next_review_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
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
        firstReview,
        createdAt,
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
    const rows = getDb()
      .prepare(sql)
      .all(...params);
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
    const params: string[] = moduleId ? [studentId, moduleId] : [studentId];
    const sql = `SELECT COUNT(*) as cnt FROM errors ${where}`;
    const row = getDb()
      .prepare(sql)
      .get(...params) as Row | undefined;
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

  /** 将指定错题标记为已订正/已复习，保存这次提交的答案，并推进复习档期。 */
  markCorrected(
    id: string,
    correctedAnswer: string,
    now: Date = new Date(),
  ): void {
    const row = getDb()
      .prepare("SELECT created_at FROM errors WHERE id = ?")
      .get(id) as Row | undefined;
    if (!row) return;

    // 已订正过的错题再次提交 = 又完成一次复习，档期同样要往后推。
    const next = nextReviewAt(asString(row.created_at), now);

    getDb()
      .prepare(
        "UPDATE errors SET is_corrected = 1, student_answer = ?, next_review_at = ? WHERE id = ?",
      )
      .run(correctedAnswer, next, id);
  },

  /**
   * 到期待复习的错题（`next_review_at <= now`），按到期时间升序。
   *
   * `next_review_at` 为 NULL 的不算到期 —— 那是「四档走完退出队列」的标记，
   * 不是「从没排过期」（历史行由 `006_review_schedule.sql` 回填过）。
   */
  async listDueForReview(
    studentId: string,
    now: Date = new Date(),
    limit = 20,
  ): Promise<ErrorRecord[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM errors
         WHERE student_id = ? AND next_review_at IS NOT NULL AND next_review_at <= ?
         ORDER BY next_review_at ASC LIMIT ?`,
      )
      .all(studentId, now.toISOString(), limit);
    return (rows as Row[]).map(mapError);
  },

  /** 到期待复习的错题总数（错题本「待复习」筛选角标用）。 */
  async countDueForReview(
    studentId: string,
    now: Date = new Date(),
  ): Promise<number> {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS cnt FROM errors
         WHERE student_id = ? AND next_review_at IS NOT NULL AND next_review_at <= ?`,
      )
      .get(studentId, now.toISOString()) as Row | undefined;
    return asNumber(row?.cnt ?? 0);
  },

  /** 按 id 获取单条错题。 */
  getById(id: string): ErrorRecord | null {
    const row = getDb().prepare("SELECT * FROM errors WHERE id = ?").get(id) as
      Row | undefined;
    return row ? mapError(row) : null;
  },
};
