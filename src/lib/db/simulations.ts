/**
 * 学生模拟运行的数据访问（教师端控制台）
 *
 * 两张表见 `migrations/006_teacher_simulation.sql`：汇总在 simulation_runs，
 * 逐轮明细在 simulation_turns。
 *
 * 为什么单独建表而不是复用 sessions / messages
 * ---------------------------------------
 * 模拟运行**不是**学生的学习会话：它由教师发起、模拟身份不存在于 students 表、
 * 也不应该出现在学生的报告/掌握度统计里。混进 sessions 会让「某个学生的会话数」
 * 凭空变大，污染所有按 student_id 聚合的读路径。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 与其他 repository 同理，
 * 接口形状保持一致才能在切 PostgreSQL 时只换实现。
 */

import { getDb } from "./sqlite";
import {
  asNullableString,
  asNumber,
  asString,
  nowIso,
  type Row,
} from "./helpers";
import type {
  SimulationRun,
  SimulationRunStatus,
  SimulationSpeaker,
  SimulationStopReason,
  SimulationTurn,
  StepType,
} from "./types";

function mapRun(row: Row): SimulationRun {
  return {
    id: asString(row.id),
    teacherId: asString(row.teacher_id),
    moduleId: asString(row.module_id),
    step: asString(row.step) as StepType,
    persona: asString(row.persona),
    status: asString(row.status) as SimulationRunStatus,
    maxTurns: asNumber(row.max_turns),
    turnsUsed: asNumber(row.turns_used),
    tokensInput: asNumber(row.tokens_input),
    tokensOutput: asNumber(row.tokens_output),
    durationMs: asNumber(row.duration_ms),
    stopReason: asNullableString(row.stop_reason) as SimulationStopReason | null,
    error: asNullableString(row.error),
    startedAt: asString(row.started_at),
    endedAt: asNullableString(row.ended_at),
  };
}

function mapTurn(row: Row): SimulationTurn {
  return {
    id: asString(row.id),
    runId: asString(row.run_id),
    turnIndex: asNumber(row.turn_index),
    speaker: asString(row.speaker) as SimulationSpeaker,
    content: asString(row.content),
    screenDigest: asString(row.screen_digest),
    cognitiveState: asNullableString(row.cognitive_state),
    actionType: asNullableString(row.action_type),
    tokensInput: asNumber(row.tokens_input),
    tokensOutput: asNumber(row.tokens_output),
    durationMs: asNumber(row.duration_ms),
    createdAt: asString(row.created_at),
  };
}

export const simulationDb = {
  /** 建一条 running 状态的运行记录。 */
  async create(run: SimulationRun): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO simulation_runs (
           id, teacher_id, module_id, step, persona, status, max_turns,
           started_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.teacherId,
        run.moduleId,
        run.step,
        run.persona,
        run.status,
        run.maxTurns,
        run.startedAt,
      );
  },

  /** 按 id 取运行；不存在返回 null。 */
  async get(id: string): Promise<SimulationRun | null> {
    const row = getDb()
      .prepare("SELECT * FROM simulation_runs WHERE id = ?")
      .get(id);
    return row ? mapRun(row as Row) : null;
  },

  /** 某教师最近的运行，按开始时间倒序。 */
  async listByTeacher(teacherId: string, limit: number): Promise<SimulationRun[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM simulation_runs
         WHERE teacher_id = ?
         ORDER BY started_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(teacherId, limit);
    return (rows as Row[]).map(mapRun);
  },

  /**
   * 统计某教师在 `sinceIso` 之后发起的运行数 —— 每日额度的判据。
   *
   * 用数据库计数而不是内存窗口：额度是按「自然日/24 小时成本」算的，
   * 进程重启后清零会让额度变成摆设。内存窗口只负责挡瞬时爆发（见 rate-limit.ts）。
   */
  async countByTeacherSince(teacherId: string, sinceIso: string): Promise<number> {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM simulation_runs
         WHERE teacher_id = ? AND started_at >= ?`,
      )
      .get(teacherId, sinceIso) as Row | undefined;
    return row ? asNumber(row.n) : 0;
  },

  /** 追加一轮明细。 */
  async appendTurn(turn: SimulationTurn): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO simulation_turns (
           id, run_id, turn_index, speaker, content, screen_digest,
           cognitive_state, action_type, tokens_input, tokens_output,
           duration_ms, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        turn.id,
        turn.runId,
        turn.turnIndex,
        turn.speaker,
        turn.content,
        turn.screenDigest,
        turn.cognitiveState,
        turn.actionType,
        turn.tokensInput,
        turn.tokensOutput,
        turn.durationMs,
        turn.createdAt,
      );
  },

  /** 按轮次顺序取明细。 */
  async listTurns(runId: string): Promise<SimulationTurn[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM simulation_turns
         WHERE run_id = ?
         ORDER BY turn_index ASC, rowid ASC`,
      )
      .all(runId);
    return (rows as Row[]).map(mapTurn);
  },

  /**
   * 收尾：写入最终状态与成本汇总。
   *
   * 逐轮累加的数字由调用方（模拟器）在结束时一次性传入，而不是每轮 UPDATE 一行 ——
   * 一次运行只有一次收尾，中途的中间值对教师没有意义。
   */
  async finish(
    id: string,
    summary: {
      status: SimulationRunStatus;
      turnsUsed: number;
      tokensInput: number;
      tokensOutput: number;
      durationMs: number;
      stopReason?: SimulationStopReason | null;
      error?: string | null;
    },
  ): Promise<void> {
    getDb()
      .prepare(
        `UPDATE simulation_runs
         SET status = ?, turns_used = ?, tokens_input = ?, tokens_output = ?,
             duration_ms = ?, stop_reason = ?, error = ?, ended_at = ?
         WHERE id = ?`,
      )
      .run(
        summary.status,
        summary.turnsUsed,
        summary.tokensInput,
        summary.tokensOutput,
        summary.durationMs,
        summary.stopReason ?? null,
        summary.error ?? null,
        nowIso(),
        id,
      );
  },
};
