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
 * agent 字段的来源（2026-09-19 修正：不再一律 "chat"）
 * ---------------------------------------------
 * 原先无论会话停在哪一步，一律用 `DEFAULT_AGENT_ID`（"chat"）配
 * loop.ts 的临时提示词（准则里写着「简洁直接，先给结论再给理由」）。
 * 结果学生在「概念讲解」这一步提问，得到的是答疑口径的一句话 ——
 * 学生原话反馈：「概念讲解就一句话吗？应该先仔细讲讲，然后再给出实例，
 * 之后再让用户模仿。」
 *
 * 现在按 `session.currentStep` 选身份层：讲解三步（explain / observe /
 * imitate）由讲解导师接管，其余步骤仍是通用答疑。
 * 选择与不选的完整理由见 `lib/agent/step-prompt.ts` 头部 —— 尤其是为什么
 * validate / practice 不能走这条路（它们的 Agent 输出是 JSON，上对话流
 * 会让学生看到原始报文）。
 */

import { resolveStudent } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/api-error";
import { messageDb, sessionDb } from "@/lib/db";
import { newId } from "@/lib/db/helpers";
import type { Citation } from "@/lib/db/types";
import { screenInput } from "@/lib/security/input-filter";
import {
  runAgentLoop,
  type AgentHistoryTurn,
  type AgentLoopOptions,
} from "@/lib/agent/loop";
import { resolveStepAgent } from "@/lib/agent/step-prompt";
import { queryWikiTool } from "@/lib/agent/tools/query-wiki";
import {
  DEFAULT_CITATION_COUNT,
  retrieveCitations,
  toCitationEvents,
  type CitationDraft,
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

  // 限流：身份一确定就挡，早于解析请求体与读库。
  // 这一条对 SSE 端点格外重要 —— 一次请求会跑完一整轮 Agent（真花钱），
  // 而且响应头一交出就没法再用状态码拒绝，只能在流开始之前拦。
  const limited = enforceRateLimit(auth.student.id, "message");
  if (limited) return limited;

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

  // 2.5 输入过滤：提示注入拦在模型之前。
  //
  // 为什么只拦「对话路径」，不拦「提交作业路径」（validate / answer-grade）：
  // 那两条是「把内容交给评分器」，而模块 9 的作业本身就是写攻击样例与防护方案，
  // 拦了学生就没法交作业。这里是「把话交给模型执行」，注入才真正有意义。
  //
  // 拦下的输入不落库：否则它会进入历史，之后每一轮都被重新喂给模型。
  const screened = screenInput(body.content);
  if (screened.blocked) {
    return jsonError(
      "FORBIDDEN",
      `输入被安全过滤拦下（命中：${screened.hits.join("、")}），本次未调用模型。规则与模块 9「AI 安全」的演示一致。`,
    );
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

  // 4. 检索引用改为异步回调：不再阻塞 SSE 流建立，
  // 引用检索与会话创建并发，总等待 = max(引用, 会话) 而非 sum。
  let citations: CitationDraft[] = [];
  const preludeEvents = () =>
    retrieveCitations(body.content, DEFAULT_CITATION_COUNT).then((drafts) => {
      citations = drafts;
      return toCitationEvents(drafts);
    });

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
  //
  // 身份层按当前学习步骤选：讲解三步换讲解导师，其余维持通用答疑口径。
  // `systemPrompt` 空串表示「用 loop 自己的默认值」—— 不在这里抄一份文案，
  // 免得两处各自漂移（见 step-prompt.ts 的注释）。
  const stepAgent = resolveStepAgent(session.currentStep);
  const loopOptions: AgentLoopOptions = {
    prompt: body.content,
    code: body.code,
    language: body.language,
    agent: stepAgent.id,
    history,
    preludeEvents,
    signal,
  };
  if (stepAgent.systemPrompt !== "") {
    loopOptions.systemPrompt = stepAgent.systemPrompt;
  }
  // 讲解导师接入 Wiki 知识库：用到哪灌倒哪，不用整篇灌进系统提示词
  if (stepAgent.teaching) {
    loopOptions.extraTools = [queryWikiTool.name];
    loopOptions.extraCustomTools = [queryWikiTool];
  }
  const loop = runAgentLoop(loopOptions);

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
          // 落库的是本轮真正使用的身份，便于回溯「这句话是哪个 Agent 说的」。
          agent: stepAgent.id,
          tokens: summary.tokens,
          duration: Date.now() - startedAt,
          error: summary.ok ? undefined : summary.error,
        },
      });

      // 回填引用：引用必须指向已存在的消息 id
      const withMessageId: Citation[] = citations.map(
        (draft: CitationDraft) => ({
          id: newId(),
          messageId: assistant.id,
          source: draft.source,
          snippet: draft.snippet,
          relevance: draft.relevance,
        }),
      );
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
