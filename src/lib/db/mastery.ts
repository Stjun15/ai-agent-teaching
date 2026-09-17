/**
 * 掌握度的数据访问
 *
 * 接口签名来自 agent-prompts/references/data-models.md「四、数据访问层设计」。
 *
 * 两处实现说明：
 *   1. `update` / `incrementError` 都是 upsert —— 主键是 (student_id, concept_id)，
 *      学生的某个知识点可能还没有记录行，第一次写入必须能建行。
 *   2. 两个方法都不改 `status` —— 文档没有规定 score 与 status 之间的迁移规则
 *      （比如多少分算 mastered、errorCount 高到多少算 needs_review）。
 *      与其擅自推断一套阈值，不如留空由上层显式决定；需要时会有单独的方法来做。
 *      新建行的 status 取数据库默认值 'not_started'。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import {
  asNullableString,
  asNumber,
  asString,
  nowIso,
  type Row,
} from "./helpers";
import type { Mastery } from "./types";

function mapMastery(row: Row): Mastery {
  return {
    studentId: asString(row.student_id),
    conceptId: asString(row.concept_id),
    score: asNumber(row.score),
    lastReviewedAt: asNullableString(row.last_reviewed_at),
    errorCount: asNumber(row.error_count),
    status: asString(row.status) as Mastery["status"],
    updatedAt: asString(row.updated_at),
  };
}

export const masteryDb = {
  /** 取某学生的全部掌握度记录 */
  async get(studentId: string): Promise<Mastery[]> {
    const rows = getDb()
      .prepare("SELECT * FROM mastery WHERE student_id = ? ORDER BY concept_id")
      .all(studentId);
    return (rows as Row[]).map(mapMastery);
  },

  /** 取某学生在某知识点上的掌握度；无记录返回 null */
  async getByConcept(
    studentId: string,
    conceptId: string,
  ): Promise<Mastery | null> {
    const row = getDb()
      .prepare(
        "SELECT * FROM mastery WHERE student_id = ? AND concept_id = ? LIMIT 1",
      )
      .get(studentId, conceptId);
    return row ? mapMastery(row as Row) : null;
  },

  /**
   * 写入掌握度分数（upsert）。
   *
   * score 的取值范围由数据库的 CHECK (score >= 0 AND score <= 5) 保证：
   * 越界会直接抛约束错误，不在此处做重复校验。
   */
  async update(
    studentId: string,
    conceptId: string,
    score: number,
  ): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO mastery (student_id, concept_id, score, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (student_id, concept_id) DO UPDATE SET
           score = excluded.score,
           updated_at = excluded.updated_at`,
      )
      .run(studentId, conceptId, score, nowIso());
  },

  /** 错误计数 +1（upsert）；新建行时 error_count 从 1 起算 */
  async incrementError(studentId: string, conceptId: string): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO mastery (student_id, concept_id, error_count, updated_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT (student_id, concept_id) DO UPDATE SET
           error_count = error_count + 1,
           updated_at = excluded.updated_at`,
      )
      .run(studentId, conceptId, nowIso());
  },
};
