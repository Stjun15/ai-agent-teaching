/**
 * 消息的数据访问
 *
 * 接口签名来自 agent-prompts/references/data-models.md「四、数据访问层设计」。
 *
 * 引用（Citation）的存储裁定（2026-09-18）
 * -------------------------------------
 * 数据模型里引用有两种存法：messages 表的 citations JSON 列，以及独立的
 * citations 表。**已裁定：以 messages.citations 为唯一存储，独立表保持预留。**
 * 理由：同一份数据写两处而不定义同步规则，比只写一处更危险；而
 * messages.citations 是 Message 类型的直接组成部分，读取不需要额外 join。
 * 独立 citations 表留作「跨消息检索引用来源」的预留，出现明确消费方时再补写入。
 * 该裁定已同步到 `data-models.md`（Citation 接口与 citations 建表 SQL 两处注释），
 * 避免「表在却永不写入」被读成疏漏。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import {
  asNumber,
  asOptionalNumber,
  asOptionalString,
  asString,
  newId,
  nowIso,
  parseJson,
  toJson,
  type Row,
} from "./helpers";
import type { Citation, Message, MessageMetadata } from "./types";

function mapCitation(raw: unknown): Citation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  return {
    id: asString(item.id),
    messageId: asString(item.messageId),
    source: asString(item.source),
    page: asOptionalNumber(item.page),
    snippet: asString(item.snippet),
    relevance: asNumber(item.relevance),
  };
}

function mapMessage(row: Row): Message {
  const citations = parseJson<unknown[]>(row.citations, []);
  const language = asOptionalString(row.language);

  return {
    id: asString(row.id),
    sessionId: asString(row.session_id),
    role: asString(row.role) as Message["role"],
    content: asString(row.content),
    code: asOptionalString(row.code),
    language: language as Message["language"],
    citations: citations
      .map(mapCitation)
      .filter((c): c is Citation => c !== null),
    metadata: parseJson<MessageMetadata>(row.metadata, {}),
    createdAt: asString(row.created_at),
  };
}

/** 提取 SELECT 后的行映射所需的列清单，避免两处 SQL 不一致 */
const SELECT_COLUMNS = `id, session_id, role, content, code, language,
   citations, metadata, created_at`;

export const messageDb = {
  /** 新建消息；id 与 createdAt 由本层生成 */
  async create(data: Omit<Message, "id" | "createdAt">): Promise<Message> {
    const message: Message = {
      ...data,
      id: newId(),
      createdAt: nowIso(),
    };

    getDb()
      .prepare(
        `INSERT INTO messages (
           id, session_id, role, content, code, language,
           citations, metadata, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.code ?? null,
        message.language ?? null,
        toJson(message.citations),
        toJson(message.metadata),
        message.createdAt,
      );

    return message;
  },

  /**
   * 列出某会话的全部消息，按时间升序。
   *
   * 以 rowid 作为排序的次级键：created_at 只有毫秒精度，
   * 同一毫秒内连续写入的消息（流式回复的场景）否则顺序不稳定。
   */
  async listBySession(sessionId: string): Promise<Message[]> {
    const rows = getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM messages
         WHERE session_id = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(sessionId);
    return (rows as Row[]).map(mapMessage);
  },

  /**
   * 回填某条消息的引用。
   *
   * 为什么不在 `create` 里一起写
   * -------------------------
   * 引用的 `messageId` 必须指向已存在的消息，而 `create` 在插入前才会生成
   * id。先建消息拿到 id、再回填，是这条依赖顺序的唯一干净写法 —— 也避免了
   * 让 `create` 接受「还没 id 的引用」这种半成品入参。
   */
  async updateCitations(
    messageId: string,
    citations: Citation[],
  ): Promise<void> {
    getDb()
      .prepare("UPDATE messages SET citations = ? WHERE id = ?")
      .run(toJson(citations), messageId);
  },
};
