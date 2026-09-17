/**
 * Prompt 历史的数据访问
 *
 * 与 `errors.ts` 同理：签名不在 `data-models.md` 的 repository 清单里，
 * 按同层风格补齐，供 Phase 5 的 `/api/student/prompts` 使用。
 *
 * 同样**只有读**：写入点是点评 Agent 校验通过/未通过之后（编排层，Phase 6）。
 */

import { getDb } from "./sqlite";
import { asNumber, asString, parseJson, type Row } from "./helpers";
import type { PromptDimension, PromptHistory, PromptIssue } from "./types";

function mapPrompt(row: Row): PromptHistory {
  return {
    id: asString(row.id),
    studentId: asString(row.student_id),
    moduleId: asString(row.module_id),
    taskType: asString(row.task_type) as PromptHistory["taskType"],
    content: asString(row.content),
    score: asNumber(row.score),
    dimensions: parseJson<PromptDimension[]>(row.dimensions, []),
    issues: parseJson<PromptIssue[]>(row.issues, []),
    suggestions: parseJson<string[]>(row.suggestions, []),
    attemptNumber: asNumber(row.attempt_number),
    isPassed: asNumber(row.is_passed) === 1,
    createdAt: asString(row.created_at),
  };
}

export const promptHistoryDb = {
  /** 某学生的 Prompt 历史，按时间倒序。 */
  async listByStudent(studentId: string, limit = 50): Promise<PromptHistory[]> {
    const rows = getDb()
      .prepare(
        "SELECT * FROM prompt_history WHERE student_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(studentId, limit);
    return (rows as Row[]).map(mapPrompt);
  },

  /** 某学生在某模块上的 Prompt 历史。 */
  async listByModule(
    studentId: string,
    moduleId: string,
  ): Promise<PromptHistory[]> {
    const rows = getDb()
      .prepare(
        "SELECT * FROM prompt_history WHERE student_id = ? AND module_id = ? ORDER BY created_at DESC",
      )
      .all(studentId, moduleId);
    return (rows as Row[]).map(mapPrompt);
  },

  /**
   * 某学生已评分 Prompt 的平均分。
   *
   * `score IS NOT NULL` 而不是把 NULL 当 0：没评分的记录混进来会把平均分
   * 拉低，报告里的「平均 Prompt 分」就成了假的。
   */
  async averageScore(studentId: string): Promise<number | null> {
    const row = getDb()
      .prepare(
        "SELECT AVG(score) AS avg FROM prompt_history WHERE student_id = ? AND score IS NOT NULL",
      )
      .get(studentId);
    if (!row) return null;
    const value = (row as Row).avg;
    return value === null || value === undefined ? null : asNumber(value);
  },
};
