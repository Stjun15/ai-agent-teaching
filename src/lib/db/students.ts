/**
 * 学生与学生画像的数据访问
 *
 * 接口签名来自 agent-prompts/references/data-models.md「四、数据访问层设计」。
 *
 * 两处对文档的偏离（均为可用性所必需，且不改变语义）：
 *   1. 查询方法返回 `T | null` —— 文档写的是 `Promise<Student>`，但未命中
 *      是正常情况（画像尤其如此：学生尚未填写时就没有行），返回 null 比抛异常
 *      让调用方更好区分「没有数据」与「出错了」。
 *   2. `updateProfile` 具备 upsert 语义 —— student_profiles 与 students 是 1:1，
 *      文档未提供创建画像行的方法，若 update 只做 UPDATE，首次设置画像会静默丢失。
 *      行不存在时改为 INSERT（此时 programming_background 是 NOT NULL，必须提供）。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 这是刻意的：
 * 部署期的 PostgreSQL 驱动是异步的，接口形状保持一致才能只换实现、不动调用方。
 */

import { getDb } from "./sqlite";
import {
  asOptionalString,
  asString,
  buildUpdateSet,
  nowIso,
  type Row,
  type UpdateSpec,
} from "./helpers";
import type { Student, StudentProfile } from "./types";

/**
 * 可更新字段白名单 —— 注意 id / createdAt 不在表内：
 * 主键与创建时间不可变，updatedAt 由本层自动刷新，调用方传了也会被忽略。
 */
const STUDENT_UPDATE: UpdateSpec = {
  columns: {
    nickname: "nickname",
    email: "email",
  },
};

const PROFILE_UPDATE: UpdateSpec = {
  columns: {
    programmingBackground: "programming_background",
    learningGoal: "learning_goal",
    preferredLanguage: "preferred_language",
    pace: "pace",
    explanationStyle: "explanation_style",
    hintPreference: "hint_preference",
    feedbackPreference: "feedback_preference",
    visualPreference: "visual_preference",
  },
};

function mapStudent(row: Row): Student {
  return {
    id: asString(row.id),
    nickname: asString(row.nickname),
    email: asOptionalString(row.email),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapProfile(row: Row): StudentProfile {
  return {
    studentId: asString(row.student_id),
    programmingBackground: asString(
      row.programming_background,
    ) as StudentProfile["programmingBackground"],
    learningGoal: asString(row.learning_goal),
    preferredLanguage: asString(
      row.preferred_language,
    ) as StudentProfile["preferredLanguage"],
    pace: asString(row.pace) as StudentProfile["pace"],
    explanationStyle: asString(
      row.explanation_style,
    ) as StudentProfile["explanationStyle"],
    hintPreference: asString(
      row.hint_preference,
    ) as StudentProfile["hintPreference"],
    feedbackPreference: asString(
      row.feedback_preference,
    ) as StudentProfile["feedbackPreference"],
    visualPreference: asString(
      row.visual_preference,
    ) as StudentProfile["visualPreference"],
    updatedAt: asString(row.updated_at),
  };
}

export const studentDb = {
  /** 按 id 取学生；不存在返回 null */
  async get(id: string): Promise<Student | null> {
    const row = getDb().prepare("SELECT * FROM students WHERE id = ?").get(id);
    return row ? mapStudent(row as Row) : null;
  },

  /** 注册：创建学生（含用户名 + 密码哈希）。昵称初始同用户名。 */
  async createWithPassword(
    username: string,
    passwordHash: string,
  ): Promise<Student> {
    const id = crypto.randomUUID();
    const now = nowIso();
    getDb()
      .prepare(
        "INSERT INTO students (id, nickname, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, username, username, passwordHash, now, now);
    return {
      id,
      nickname: username,
      email: undefined,
      createdAt: now,
      updatedAt: now,
    };
  },

  /** 按用户名取密码哈希与 id —— 仅供登录验证使用。 */
  async getPasswordHash(
    username: string,
  ): Promise<{ id: string; passwordHash: string } | null> {
    const row = getDb()
      .prepare("SELECT id, password_hash FROM students WHERE username = ?")
      .get(username);
    if (!row) return null;
    return {
      id: asString((row as Row).id),
      passwordHash: asString((row as Row).password_hash),
    };
  },

  /** 部分更新学生；updatedAt 自动刷新 */
  async update(id: string, data: Partial<Student>): Promise<void> {
    const { assignments, values } = buildUpdateSet(STUDENT_UPDATE, data);
    assignments.push("updated_at = ?");
    values.push(nowIso());

    getDb()
      .prepare(`UPDATE students SET ${assignments.join(", ")} WHERE id = ?`)
      .run(...values, id);
  },

  /** 取学生画像；尚未填写时返回 null */
  async getProfile(studentId: string): Promise<StudentProfile | null> {
    const row = getDb()
      .prepare("SELECT * FROM student_profiles WHERE student_id = ?")
      .get(studentId);
    return row ? mapProfile(row as Row) : null;
  },

  /** 写入学生画像（已有则 UPDATE，否则 INSERT）。 */
  async updateProfile(
    studentId: string,
    data: Partial<StudentProfile>,
  ): Promise<void> {
    const db = getDb();

    const exists = db
      .prepare("SELECT 1 AS present FROM student_profiles WHERE student_id = ?")
      .get(studentId);

    if (exists) {
      const { assignments, values } = buildUpdateSet(PROFILE_UPDATE, data);
      assignments.push("updated_at = ?");
      values.push(nowIso());

      db.prepare(
        `UPDATE student_profiles SET ${assignments.join(", ")} WHERE student_id = ?`,
      ).run(...values, studentId);
      return;
    }

    const background = data.programmingBackground;
    if (!background) {
      throw new Error(
        `updateProfile: 学生 ${studentId} 尚无画像，首次写入必须提供 programmingBackground`,
      );
    }

    const insertedAt = nowIso();
    db.prepare(
      `INSERT INTO student_profiles (
         student_id, programming_background, learning_goal, preferred_language,
         pace, explanation_style, hint_preference, feedback_preference,
         visual_preference, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      studentId,
      background,
      data.learningGoal ?? null,
      data.preferredLanguage ?? "typescript",
      data.pace ?? "normal",
      data.explanationStyle ?? "analogy",
      data.hintPreference ?? "try_first",
      data.feedbackPreference ?? "encouraging",
      data.visualPreference ?? "animation",
      insertedAt,
    );
  },
};
