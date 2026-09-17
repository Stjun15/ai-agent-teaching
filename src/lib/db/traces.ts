/**
 * Agent Trace 的数据访问
 *
 * 接口签名来自 agent-prompts/references/data-models.md「四、数据访问层设计」。
 *
 * 与其它 repository 的一处差异：`create` 接收完整的 AgentTrace（含 id 与 timestamp），
 * 不自行生成。这是按文档签名实现的 —— Trace 通常由调用链的上游（Agent 运行时）
 * 创建并已经持有 id，本层再生成一个会造成两份 id 不一致。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import {
  asBool,
  asNumber,
  asOptionalString,
  asString,
  fromBool,
  parseJson,
  toJson,
  type Row,
} from "./helpers";
import type { AgentTrace } from "./types";

function mapTrace(row: Row): AgentTrace {
  return {
    id: asString(row.id),
    traceId: asString(row.trace_id),
    timestamp: asString(row.timestamp),
    studentId: asString(row.student_id),
    sessionId: asString(row.session_id),
    agent: asString(row.agent) as AgentTrace["agent"],
    skill: asString(row.skill),
    input: parseJson<object>(row.input, {}),
    output: parseJson<object>(row.output, {}),
    wikiReads: parseJson<string[]>(row.wiki_reads, []),
    wikiWrites: parseJson<string[]>(row.wiki_writes, []),
    durationMs: asNumber(row.duration_ms),
    tokens: parseJson<AgentTrace["tokens"]>(row.tokens, {
      input: 0,
      output: 0,
    }),
    retries: asNumber(row.retries),
    success: asBool(row.success),
    error: asOptionalString(row.error),
  };
}

export const traceDb = {
  /** 写入一条 trace */
  async create(trace: AgentTrace): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO agent_traces (
           id, trace_id, timestamp, student_id, session_id, agent, skill,
           input, output, wiki_reads, wiki_writes,
           duration_ms, tokens, retries, success, error
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trace.id,
        trace.traceId,
        trace.timestamp,
        trace.studentId,
        trace.sessionId,
        trace.agent,
        trace.skill,
        toJson(trace.input),
        toJson(trace.output),
        toJson(trace.wikiReads),
        toJson(trace.wikiWrites),
        trace.durationMs,
        toJson(trace.tokens),
        trace.retries,
        fromBool(trace.success),
        trace.error ?? null,
      );
  },

  /** 列出某学生的 trace，按时间倒序取最近 limit 条 */
  async listByStudent(studentId: string, limit: number): Promise<AgentTrace[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM agent_traces
         WHERE student_id = ?
         ORDER BY timestamp DESC, rowid DESC
         LIMIT ?`,
      )
      .all(studentId, limit);
    return (rows as Row[]).map(mapTrace);
  },
};
