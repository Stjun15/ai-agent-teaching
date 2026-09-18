/**
 * 项目的数据访问
 *
 * 与 `errors.ts` 同理：签名不在 `data-models.md` 的 repository 清单里，
 * 按同层风格补齐，供 Phase 5 的 `/api/student/projects` 使用。
 *
 * 同样**只有读**：项目的创建与状态推进属于教学集成（Phase 6）。
 */

import { getDb } from "./sqlite";
import { asNullableString, asString, parseJson, type Row } from "./helpers";
import type { ChecklistItem, Project } from "./types";

function mapProject(row: Row): Project {
  return {
    id: asString(row.id),
    studentId: asString(row.student_id),
    projectTemplateId: asString(row.project_template_id),
    name: asString(row.name),
    status: asString(row.status) as Project["status"],
    webAppChecklist: parseJson<ChecklistItem[]>(row.web_app_checklist, []),
    ideChecklist: parseJson<ChecklistItem[]>(row.ide_checklist, []),
    promptRecordIds: parseJson<string[]>(row.prompt_record_ids, []),
    repoUrl: asNullableString(row.repo_url),
    demoUrl: asNullableString(row.demo_url),
    mentorComment: asNullableString(row.mentor_comment),
    startedAt: asString(row.started_at),
    completedAt: asNullableString(row.completed_at),
  };
}

export const projectDb = {
  /** 某学生的全部项目，按开始时间倒序。 */
  async listByStudent(studentId: string): Promise<Project[]> {
    const rows = getDb()
      .prepare(
        "SELECT * FROM projects WHERE student_id = ? ORDER BY started_at DESC",
      )
      .all(studentId);
    return (rows as Row[]).map(mapProject);
  },

  /** 按 id 取单个项目。 */
  async get(id: string): Promise<Project | null> {
    const row = getDb()
      .prepare("SELECT * FROM projects WHERE id = ? LIMIT 1")
      .get(id);
    return row ? mapProject(row as Row) : null;
  },
};
