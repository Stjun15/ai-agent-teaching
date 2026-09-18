/**
 * 校验结果的数据访问
 *
 * 接口签名来自 agent-prompts/references/data-models.md：validation_results 表
 * 存「每次点评 Agent 的输出」（task_type / total_score / level / is_correct /
 * dimensions / issues / suggestions）。此前 src/lib/db **没有**这张表的 repository，
 * 而 /api/agent/validate 跑完点评后直接丢弃结果 —— 这是该表在真实库里恒为 0 行的
 * 真实原因。
 *
 * 本文件补齐写入（create）+ 读取（listByStudent / listBySession / countByStudent），
 * 并把 create 接入 /api/agent/validate，使每一次点评都被真实持久化。
 *
 * 关于 dimensions / issues / suggestions 的类型
 * ------------------------------------------
 * 这三个是 JSON 列，内容来自点评 Agent 的输出（snake_case 结构）。数据访问层只负责
 * 序列化往返，不引入 Agent 层的类型依赖，因此写入入参此处用 `unknown`，
 * 读取时按 ValidationResult 的口径 parseJson 还原。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import {
  asBool,
  asNumber,
  asOptionalString,
  asString,
  newId,
  nowIso,
  parseJson,
  toJson,
  type Row,
} from "./helpers";
import type { ValidationResult } from "./types";

function mapValidationResult(row: Row): ValidationResult {
  return {
    id: asString(row.id),
    studentId: asString(row.student_id),
    sessionId: asString(row.session_id),
    taskType: asString(row.task_type) as ValidationResult["taskType"],
    totalScore: asNumber(row.total_score),
    level: asOptionalString(row.level) as unknown as ValidationResult["level"],
    isCorrect: asBool(row.is_correct),
    dimensions: parseJson<ValidationResult["dimensions"]>(row.dimensions, []),
    issues: parseJson<ValidationResult["issues"]>(row.issues, []),
    suggestions: parseJson<ValidationResult["suggestions"]>(
      row.suggestions,
      [],
    ),
    createdAt: asString(row.created_at),
  };
}

export const validationResultDb = {
  /**
   * 写入一条校验结果。id 缺省时由 newId() 生成（UUID 由应用层生成，
   * 使 SQLite 与 PostgreSQL 行为一致，见 001_init.sql）。
   *
   * 这是关闭「validation_results 恒为 0 行」缺口的关键写入路径。
   */
  async create(input: {
    id?: string;
    studentId: string;
    sessionId: string;
    taskType: ValidationResult["taskType"];
    totalScore: number | null;
    level: ValidationResult["level"] | null;
    isCorrect: boolean;
    dimensions: unknown;
    issues: unknown;
    suggestions: unknown;
  }): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO validation_results (
           id, student_id, session_id, task_type, total_score, level,
           is_correct, dimensions, issues, suggestions, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id ?? newId(),
        input.studentId,
        input.sessionId,
        input.taskType,
        input.totalScore ?? null,
        input.level ?? null,
        input.isCorrect ? 1 : 0,
        toJson(input.dimensions),
        toJson(input.issues),
        toJson(input.suggestions),
        nowIso(),
      );
  },

  /** 列出某学生的校验结果，按时间倒序取最近 limit 条 */
  async listByStudent(
    studentId: string,
    limit: number,
  ): Promise<ValidationResult[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM validation_results
         WHERE student_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(studentId, limit);
    return (rows as Row[]).map(mapValidationResult);
  },

  /** 列出某会话的全部校验结果（一次作业可能经历多轮点评） */
  async listBySession(sessionId: string): Promise<ValidationResult[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM validation_results
         WHERE session_id = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(sessionId);
    return (rows as Row[]).map(mapValidationResult);
  },

  /** 某学生的校验结果总数（用于学习报告的 totalValidations） */
  async countByStudent(studentId: string): Promise<number> {
    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS count FROM validation_results WHERE student_id = ?",
      )
      .get(studentId) as { count: number };
    return row.count;
  },
};
