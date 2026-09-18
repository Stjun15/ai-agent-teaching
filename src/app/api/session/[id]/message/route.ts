/**
 * POST /api/session/[id]/message —— 发送消息（SSE 流式）
 *
 * 依据
 * ----
 * - `api-spec.md` 一、路由清单第 9 条；八、SendMessageSchema；九、后端处理消息。
 * - `06-execution-plan.md` Phase 5 提交点 3：「把会话持久化与 Agent 流式循环接起来」。
 *
 * 本端点是 Phase 5 提交点 3 的核心：一次请求 = 鉴权 → 读历史 → 检索引用 →
 * 跑一轮 Agent → 把学生消息与助手消息都落库。它把 Phase 1/3 的 Agent 循环
 * 与提交点 1/2 的会话持久化真正接上了。
 *
 * 与 /api/chat 的区别
 * ----------------
 * `/api/chat` 是 Phase 3 的「最小不落库」端点；这里才真正：
 *   - 写 message 表（学生消息立即写、助手消息流式结束后写）；
 *   - 带多轮历史（`composeHistory`）；
 *   - 在模型输出前先发 `citation` 事件（`retrieveCitations`）；
 *   - 支持按会话中止（abort-registry）。
 *
 * 为什么助手消息要等流结束才写
 * ------------------------
 * 助手消息的内容是流式拼接出来的，拿到完整文本之前没法写。但 SSE 响应头必须
 * 先发（流式接口的固有形态），所以写库发生在「返回响应之后」的后台：
 * 用 `loop.completed` 串起来，不阻塞响应本身。如果整轮失败（ok:false），
 * 仍写一条 content 为空的助手消息，`metadata.error` 记录原因以便复现。
 *
 * 历史截断
 * -------
 * `listBySession` 返回全部；这里只取最近 `HISTORY_LIMIT` 条塞进 prompt。
 * `composeHistory` 是全文进 prompt，长会话会线性吃 token —— 截断是 Phase 5
 * 务实的边界，真要长会话得上摘要压缩（另一个量级，留给后续）。
 *
 * 角色归并
 * -------
 * `Message.role` 有 student/teacher/reviewer/examiner/assistant/system 六种，
 * 但喂给模型的历史只有 student/assistant 两种（见 loop.ts 的 `AgentHistoryTurn`
 * 注释）：到了模型眼里 teacher/reviewer/examiner 都是「助手说过的话」，
 * 区分开只会让它以为有多个说话人。system 消息不进历史。
 *
 * agent 字段的来源（刻意的简化）
 * ---------------------------
 * `SendMessageSchema` 不含 agent，会话的 `currentStep` 也不直接对应四 Agent
 * 架构里的 teacher/reviewer/examiner。本端点统一用 `DEFAULT_AGENT_ID`（"chat"），
 * 把「按 step 选 agent」留给 `/api/agent/*` 那组编排端点（后续提交点）。
 * thinking 事件里 agent 因此固定为 "chat" —— 这是已知简化，不是 bug。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { messageDb, sessionDb } from "@/lib/db";
import { newId } from "@/lib/db/helpers";
import type { Citation } from "@/lib/db/types";
import {
  DEFAULT_AGENT_ID,
  runAgentLoop,
  type AgentHistoryTurn,
} from "@/lib/agent/loop";
import {
  DEFAULT_CITATION_COUNT,
  retrieveCitations,
  toCitationEvents,
} from "@/lib/agent/citations";
import {
  registerStream,
  abortStream,
  unregisterStream,
} from "@/lib/agent/abort-registry";
import { SendMessageSchema, type SendMessageInput } from "@/schemas";

export const runtime = "nodejs";
// SSE 不能被静态优化，也不能被缓存。
export const dynamic = "force-dynamic";

/** 喂给模型的近期历史条数上限。 */
const HISTORY_LIMIT = 20;

/** Next 16 的路由参数是个 Promise，必须 await。 */
type RouteContext = { params: Promise<{ id: string }> };

/** 把落库消息归并成模型能读的两种历史角色。 */
function toHistoryTurns(
  messages: { role: string; content: string }[],
): AgentHistoryTurn[] {
  const turns: AgentHistoryTurn[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    turns.push({
      role: message.role === "student" ? "student" : "assistant",
      content: message.content,
    });
  }
  return turns;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  // 1. 解析并校验请求体（流开始前失败才能回 JSON 而非污染流）
  let body: SendMessageInput;
  try {
    const raw = await request.json();
    const parsed = SendMessageSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"} ${issue.message}`)
        .join("；");
      return jsonError("INVALID_INPUT", `请求体不合法：${detail}`);
    }
    body = parsed.data;
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  // 2. 载入会话并校验归属（与 GET/DELETE 一致的 404 语义）
  let session;
  try {
    session = await sessionDb.get(id);
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!session || session.studentId !== auth.student.id) {
    return jsonError("NOT_FOUND", `会话 ${id} 不存在。`);
  }

  // 3. 读历史（最近 N 条，跳过系统消息）
  let history: AgentHistoryTurn[] = [];
  try {
    const messages = await messageDb.listBySession(id);
    history = toHistoryTurns(messages.slice(-HISTORY_LIMIT));
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 4. 检索引用（失败不影响主流程：retrieveCitations 内部已吞错返回 []）
  const citations = await retrieveCitations(
    body.content,
    DEFAULT_CITATION_COUNT,
  );
  const preludeEvents = toCitationEvents(citations);

  // 5. 学生消息立即落库（先于流式，保证历史连续）
  try {
    await messageDb.create({
      sessionId: id,
      role: "student",
      content: body.content,
      code: body.code,
      language: body.language,
      citations: [],
      metadata: {},
    });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 6. 注册中止句柄：合并客户端断流（req.signal）与主动中止（/abort）
  const signal = registerStream(id);
  request.signal.addEventListener("abort", () => abortStream(id));

  // 7. 起一轮 Agent（SSE 响应头随之交出，运行在后台）
  const agent = DEFAULT_AGENT_ID;
  const loop = runAgentLoop({
    prompt: body.content,
    code: body.code,
    language: body.language,
    agent,
    history,
    preludeEvents,
    signal,
  });

  // 8. 后台落库助手消息（不阻塞 SSE 响应）
  const startedAt = Date.now();
  void loop.completed
    .then(async (summary) => {
      const assistant = await messageDb.create({
        sessionId: id,
        role: "assistant",
        content: summary.text,
        citations: [],
        metadata: {
          agent,
          tokens: summary.tokens,
          duration: Date.now() - startedAt,
          error: summary.ok ? undefined : summary.error,
        },
      });

      // 回填引用：引用必须指向已存在的消息 id
      const withMessageId: Citation[] = citations.map((draft) => ({
        id: newId(),
        messageId: assistant.id,
        source: draft.source,
        snippet: draft.snippet,
        relevance: draft.relevance,
      }));
      if (withMessageId.length > 0) {
        await messageDb.updateCitations(assistant.id, withMessageId);
      }

      // 累加会话 token / 时长（读最新值，避免与并发消息互相覆盖）
      const fresh = await sessionDb.get(id);
      if (fresh) {
        await sessionDb.update(id, {
          totalTokens:
            fresh.totalTokens + summary.tokens.input + summary.tokens.output,
          totalDuration: fresh.totalDuration + (Date.now() - startedAt),
        });
      }
    })
    .catch((error) => {
      // 落库失败不应影响已经发出去的流；记日志即可。
      console.error("[message] 助手消息落库失败", error);
    })
    .finally(() => {
      unregisterStream(id);
    });

  // 9. 返回 SSE 响应（流在后台推进）
  return loop.response;
}
