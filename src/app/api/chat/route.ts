/**
 * POST /api/chat —— 一轮对话（SSE 流式）
 *
 * 依据
 * ----
 * - `06-execution-plan.md` Phase 3 首个提交点 `feat(api): add chat sse endpoint`：
 *   「把 Phase 1 已跑通的 Agent 循环接入 HTTP 层 —— 一个提交点即可让前端对接」。
 * - `api-spec.md`「五、后端 SSE 服务端工具」的响应形态；
 *   「六、错误码」的状态码约定；「八、API 输入输出 Zod 校验」的输入校验要求。
 *
 * 本端点做什么
 * -----------
 * 校验请求体（Zod）→ 检查模型可用性 → 交给 `runAgentLoop` 跑一轮 → 返回 SSE 响应。
 * 就这三步。**它刻意是最小的**：
 *
 * - **不落库**。会话与消息的持久化是 Phase 5 的 `feat(api): add SSE message endpoint`。
 *   `06-execution-plan.md` 明确写了这条边界。这里不建 session、不写 message，
 *   否则 Phase 5 会变成「再实现一遍同样的落库逻辑」。
 * - **不做鉴权**。`api-spec.md` 的鉴权列标的是「是」，但本项目还没有登录体系；
 *   强行加一个假鉴权只会污染后续设计。属于后续 Phase（Phase 5 的 API 层）。
 * - **不 import SDK**。本文件只依赖 `runAgentLoop` 与纯逻辑模块 —— 与 `/api/health`
 *   同一个理由：路由层的依赖图越窄，构建产物越干净。
 *
 * 错误分两类，前端要知道区别
 * ------------------------
 * 1. **流开始之前失败**（请求体非法 / 没配密钥）→ 普通 JSON + 非 2xx 状态码，
 *    由 `jsonError` 产出。此时还没推过任何字节，回 JSON 才符合 HTTP 语义。
 * 2. **流开始之后失败**（模型报错、网络中断）→ 流内 `error` 事件，
 *    HTTP 状态码仍是 200（响应头早就发出去了，改不了）。这类失败在 loop.ts 里
 *    统一映射为 `LLM_ERROR`。
 *
 * 前端两种都要处理 —— 见 `src/lib/sse.ts`。
 */

import { ARK_API_KEY_ENV, isArkApiKeyConfigured } from "@/lib/agent/ark-config";
import { runAgentLoop, type AgentLoopOptions } from "@/lib/agent/loop";
import { resolveStepAgent } from "@/lib/agent/step-prompt";
import { jsonError } from "@/lib/api-error";
import { clientKeyFrom, enforceRateLimit } from "@/lib/security/rate-limit";
import { ChatRequestSchema } from "@/schemas";

// Agent 内核依赖 node:sqlite 与 pi SDK，不能跑在 Edge Runtime。
export const runtime = "nodejs";

// 流式接口不能被静态化或缓存。
export const dynamic = "force-dynamic";

/** 把 Zod 的 issue 列表压成一行可读文本，避免把整个 issue 对象丢给前端。 */
function describeIssues(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function POST(req: Request): Promise<Response> {
  // 限流放在第一行：本端点没有身份（见文件头「不做鉴权」），只能按客户端 IP
  // 计数，所以它是整条路由里唯一必须在「知道这是谁」之前就拦的地方。
  // 取不到转发头时会归入同一个桶 —— 那是刻意的降级，理由见 rate-limit.ts。
  const limited = enforceRateLimit(clientKeyFrom(req), "chat");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "INVALID_INPUT",
      `请求体不符合 ChatRequestSchema：${describeIssues(parsed.error)}`,
    );
  }

  // 提前失败，而不是让 loop 在流里抛错。理由：这里能给出「去配哪个环境变量」的
  // 可操作提示，而流内的 LLM_ERROR 只能给出 SDK 的原始报错。
  if (!isArkApiKeyConfigured()) {
    return jsonError(
      "LLM_ERROR",
      `缺少环境变量 ${ARK_API_KEY_ENV}，无法调用模型。请在 .env.local（已被 .gitignore 排除）或系统环境变量中设置，不要写进仓库。`,
    );
  }

  // 身份层按学习步骤选（2026-09-19 修正）。与落库端点
  // `/api/session/[id]/message` 共用同一张表（`resolveStepAgent`）——
  // 两条管道、一份口径。这里曾经只给 loop 的临时答疑提示词，学生在
  // 「概念讲解」步骤得到的也是答疑口径的一句话（学生反馈：「概念讲解就
  // 一句话吗？」）。为什么 validate / practice 不在这张表里、为什么教学
  // 提示词必须是 Markdown 而非 JSON，见 step-prompt.ts 与
  // prompts/teaching-chat.ts 的头部注释。
  const stepAgent = resolveStepAgent(parsed.data.step);
  const loopOptions: AgentLoopOptions = {
    prompt: parsed.data.content,
    // 学生附带的代码。⚠️ 这两行是后补的：schema 首版没这两个字段时，
    // 前端「附带代码」按钮发出去的内容会被 Zod 静默剥离（详见
    // ChatRequestSchema 上方的注释）。组装成模型可见输入在 loop.ts 的
    // composeUserPrompt；Phase 5 换成落库端点后由提示词构造层统一组装。
    code: parsed.data.code,
    language: parsed.data.language,
    agent: parsed.data.agent ?? stepAgent.id,
    // 浏览器关闭标签页 / 前端点「停止」时，让 SSE 的取消动作一路传到 SDK 的 abort()。
    signal: req.signal,
  };
  if (stepAgent.systemPrompt !== "") {
    loopOptions.systemPrompt = stepAgent.systemPrompt;
  }
  const { response } = runAgentLoop(loopOptions);

  return response;
}
