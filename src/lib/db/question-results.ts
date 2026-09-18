/**
 * 答题结果的数据访问
 *
 * 与 `errors.ts` / `prompt-history.ts` 同理：签名不在 `data-models.md` 的
 * repository 清单里，按同层风格补齐。
 *
 * 此前只有 `countByStudent`（供 /api/report 聚合），**没有写入路径**，
 * 导致 question_results 表在真实库里恒为 0 行 —— 这是 Phase 7 收口时钉死的结构缺口。
 * 本文件补齐 create（写入）+ listByStudent / get（读取）。
 *
 * 写入触发点（学生作答步骤）随教学状态机 HTTP 化补齐；这里先把 repository 层
 * 的写入能力就位，并由 scripts/teaching-results-spec.ts 在真实 dev.db 上验证闭环。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import { asBool, asNumber, asString, newId, nowIso, type Row } from "./helpers";
import type { QuestionResult } from "./types";

function mapQuestionResult(row: Row): QuestionResult {
  return {
    id: asString(row.id),
    studentId: asString(row.student_id),
    questionId: asString(row.question_id),
    sessionId: asString(row.session_id),
    studentAnswer: asString(row.student_answer),
    isCorrect: asBool(row.is_correct),
    score: asNumber(row.score),
    attempts: asNumber(row.attempts),
    createdAt: asString(row.created_at),
  };
}

export const questionResultDb = {
  /** 某学生答过的题目总数（用于学习报告的 totalQuestions）。 */
  async countByStudent(studentId: string): Promise<number> {
    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS count FROM question_results WHERE student_id = ?",
      )
      .get(studentId) as { count: number };
    return row.count;
  },

  /**
   * 写入一条答题结果（每次作答都是独立新行，id 自生成，不使用 upsert）。
   *
   * 这是关闭「question_results 恒为 0 行」缺口的关键写入路径。question_id 外键到
   * questions(id) 且非空，调用方须传入一个真实存在的题库 id。
   */
  async create(input: {
    id?: string;
    studentId: string;
    questionId: string;
    sessionId: string;
    studentAnswer: string;
    isCorrect: boolean;
    score: number;
    attempts?: number;
  }): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO question_results (
           id, student_id, question_id, session_id, student_answer,
           is_correct, score, attempts, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id ?? newId(),
        input.studentId,
        input.questionId,
        input.sessionId,
        input.studentAnswer,
        input.isCorrect ? 1 : 0,
        input.score,
        input.attempts ?? 1,
        nowIso(),
      );
  },

  /** 列出某学生的答题结果，按时间倒序取最近 limit 条 */
  async listByStudent(
    studentId: string,
    limit: number,
  ): Promise<QuestionResult[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM question_results
         WHERE student_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(studentId, limit);
    return (rows as Row[]).map(mapQuestionResult);
  },

  /** 取单条答题结果；无记录返回 null */
  async get(id: string): Promise<QuestionResult | null> {
    const row = getDb()
      .prepare("SELECT * FROM question_results WHERE id = ? LIMIT 1")
      .get(id);
    return row ? mapQuestionResult(row as Row) : null;
  },
};
