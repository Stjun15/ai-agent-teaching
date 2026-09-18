/**
 * 答题结果的数据访问
 *
 * 与 `errors.ts` / `prompt-history.ts` 同理：签名不在 `data-models.md` 的
 * repository 清单里，按同层风格补齐，供 `/api/report` 聚合使用。
 * 目前只用到「某学生的答题总数」，故只暴露这一个计数方法。
 */

import { getDb } from "./sqlite";

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
};
