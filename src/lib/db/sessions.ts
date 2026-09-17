/**
 * 会话的数据访问
 *
 * 接口签名来自 agent-prompts/references/data-models.md「四、数据访问层设计」。
 *
 * 关于 `update` 的语义：totalTokens / totalDuration 按「覆盖」而非「累加」处理。
 * 文档给的是 `Partial<Session>`，覆盖是它字面上的含义；需要累加的调用方
 * 应先读再写。这样本层不持有任何隐含状态，出问题也容易复现。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import {
  asNullableString,
  asNumber,
  asString,
  buildUpdateSet,
  newId,
  nowIso,
  type Row,
  type UpdateSpec,
} from "./helpers";
import type { Session } from "./types";

/**
 * 可更新字段白名单。
 *
 * 不在表内的字段一律忽略：id / studentId / moduleId / startedAt 属于会话身份，
 * 建成后不应改动；endedAt 由 end() 负责，避免与 status 出现不一致的组合
 * （比如 status 还是 active 但 endedAt 已经有值）。
 */
const SESSION_UPDATE: UpdateSpec = {
  columns: {
    currentStep: "current_step",
    status: "status",
    totalTokens: "total_tokens",
    totalDuration: "total_duration",
  },
};

function mapSession(row: Row): Session {
  return {
    id: asString(row.id),
    studentId: asString(row.student_id),
    moduleId: asString(row.module_id),
    currentStep: asString(row.current_step) as Session["currentStep"],
    status: asString(row.status) as Session["status"],
    startedAt: asString(row.started_at),
    endedAt: asNullableString(row.ended_at),
    totalTokens: asNumber(row.total_tokens),
    totalDuration: asNumber(row.total_duration),
  };
}

export const sessionDb = {
  /**
   * 新建会话。
   *
   * 初始 currentStep 为 'explain' —— 七步教学法的第一步，
   * 与 001_init.sql 中该列的默认值一致。
   */
  async create(studentId: string, moduleId: string): Promise<Session> {
    const session: Session = {
      id: newId(),
      studentId,
      moduleId,
      currentStep: "explain",
      status: "active",
      startedAt: nowIso(),
      endedAt: null,
      totalTokens: 0,
      totalDuration: 0,
    };

    getDb()
      .prepare(
        `INSERT INTO sessions (
           id, student_id, module_id, current_step, status,
           started_at, total_tokens, total_duration
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.studentId,
        session.moduleId,
        session.currentStep,
        session.status,
        session.startedAt,
        session.totalTokens,
        session.totalDuration,
      );

    return session;
  },

  /** 按 id 取会话；不存在返回 null */
  async get(id: string): Promise<Session | null> {
    const row = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    return row ? mapSession(row as Row) : null;
  },

  /** 部分更新会话；data 中若无任何可更新字段则不做任何事 */
  async update(id: string, data: Partial<Session>): Promise<void> {
    const { assignments, values } = buildUpdateSet(SESSION_UPDATE, data);
    if (assignments.length === 0) return;

    getDb()
      .prepare(`UPDATE sessions SET ${assignments.join(", ")} WHERE id = ?`)
      .run(...values, id);
  },

  /** 结束会话：置 status 与 endedAt */
  async end(id: string): Promise<void> {
    getDb()
      .prepare(
        "UPDATE sessions SET status = 'completed', ended_at = ? WHERE id = ?",
      )
      .run(nowIso(), id);
  },
};
