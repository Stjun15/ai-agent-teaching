/**
 * Prompt 历史的数据访问
 *
 * 与 `errors.ts` 同理：签名不在 `data-models.md` 的 repository 清单里，
 * 按同层风格补齐，供 Phase 5 的 `/api/student/prompts` 使用。
 *
 * 写入裁定（2026-09-18）
 * --------------------
 * 记录**每一次真实（非兜底）的点评提交**，写入点在 `/api/agent/validate`
 * 路由 —— 学生自主提交作业后点评 Agent 给出的 rubric 评分历史。
 * 两种提交都不丢：tool / code 类作业同样经点评 Agent 评分，表上的
 * `task_type` 列本就为区分它们而设。
 *
 * `answer-grade` 的主观题判分**不写**这张表：那是答题评分，已有
 * `question_results` 记录，混进来会把报告页的「Prompt 平均分」稀释成
 * 「所有提交的平均分」—— 名实不符。
 *
 * **兜底输出不写**：兜底的 0 分是编的，写进去平均分就成了假的 ——
 * 与「兜底不更新掌握度」（`fallback.ts`）是同一条规则。
 *
 * `suggestions` 存 `action` 文本数组（表结构如此）：完整对象
 * （priority / action / example）在 `validation_results.issues` 旁的
 * suggestions 列里另有全文，这里只留学生看得见的行动项。
 */

import { getDb } from "./sqlite";
import { newId, asNumber, asString, parseJson, type Row } from "./helpers";
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
  /** 写入一条点评历史（写入时机与范围见文件头「写入裁定」）。 */
  async create(input: {
    studentId: string;
    moduleId: string;
    taskType: PromptHistory["taskType"];
    content: string;
    score: number;
    dimensions: PromptDimension[];
    issues: PromptIssue[];
    suggestions: string[];
    attemptNumber: number;
    isPassed: boolean;
  }): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO prompt_history (
           id, student_id, module_id, task_type, content, score,
           dimensions, issues, suggestions, attempt_number, is_passed
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId(),
        input.studentId,
        input.moduleId,
        input.taskType,
        input.content,
        input.score,
        JSON.stringify(input.dimensions),
        JSON.stringify(input.issues),
        JSON.stringify(input.suggestions),
        input.attemptNumber,
        input.isPassed ? 1 : 0,
      );
  },

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
