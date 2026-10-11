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
import { runVisionReview } from "@/lib/agent/vision-review";
import { jsonError } from "@/lib/api-error";
import { clientKeyFrom, enforceRateLimit } from "@/lib/security/rate-limit";
import { buildTeachingScript } from "@/lib/teaching-script";
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

  // 图片评审分支：学生提交了截图 → 走多模态视觉模型独立管线，
  // 不经过 loop.ts 的 pi SDK 文本管线。
  if (parsed.data.images && parsed.data.images.length > 0) {
    const visionImages = parsed.data.images.map((dataUrl, i) => ({
      data: dataUrl,
      name: `screenshot-${i + 1}`,
    }));
    return runVisionReview(parsed.data.content, visionImages, req.signal);
  }

  // 身份层按学习步骤选（2026-09-19 修正）。与落库端点
  // `/api/session/[id]/message` 共用同一张表（`resolveStepAgent`）——
  // 两条管道、一份口径。这里曾经只给 loop 的临时答疑提示词，学生在
  // 「概念讲解」步骤得到的也是答疑口径的一句话（学生反馈：「概念讲解就
  // 一句话吗？」）。为什么 validate / practice 不在这张表里、为什么教学
  // 提示词必须是 Markdown 而非 JSON，见 step-prompt.ts 与
  // prompts/teaching-chat.ts 的头部注释。
  const stepAgent = resolveStepAgent(parsed.data.step);

  // 读概念页作为教学脚本注入系统提示词。
  // 不靠前端把数千字的内容硬塞进 `content`：那样会突破 5000 字限制，
  // 并且内容类数据不该挤在用户消息里。有 moduleId 才会读；读不到不报错
  //（可能该模块没有概念页），静默回退到纯身份层提示词。
  //
  // 2026-09-24 重构：不再用 `readFileSync` 裸读文件，改走 `@/wiki` 引擎 +
  // `buildTeachingScript` 按教学步骤裁剪段落。裸读绕过了 schema 校验
  //（frontmatter 缺字段不报错），而且全文注入浪费 token：
  // explain 阶段不需要"动手任务"，imitate 阶段不需要"定义"。
  let conceptScript = "";
  if (parsed.data.moduleId && parsed.data.step) {
    const result = buildTeachingScript(parsed.data.moduleId, parsed.data.step);
    if (result.sectionCount === 0 && result.script === "") {
      // 页面不存在或步骤无匹配段落：静默回退到纯身份层。
    } else {
      conceptScript = result.script;
    }
  }

  const loopOptions: AgentLoopOptions = {
    prompt: parsed.data.content,
    code: parsed.data.code,
    language: parsed.data.language,
    agent: parsed.data.agent ?? stepAgent.id,
    signal: req.signal,
    history: parsed.data.history,
  };
  // 身份层系统提示词 + 概念页教学脚本拼接。
  // 概念脚本在前：让模型先看到「怎么教」，再看「身份是什么」。
  const parts = [conceptScript, stepAgent.systemPrompt].filter((p) => p !== "");
  // 复刻项目的阶段上下文（可选）：让学生不必重复描述自己卡在哪一步。
  // 只注入位置，不注入教材 —— 教材已随 moduleId 的概念页进来。
  if (parsed.data.phaseContext) {
    parts.push(
      "## 学生当前所处位置（复刻项目实时上下文）\n" +
        parsed.data.phaseContext +
        "\n回答时默认学生就停在这一步，直接针对它给指导，不要反问「你做到哪一步了」。",
    );
  }
  if (parts.length > 0) {
    loopOptions.systemPrompt = parts.join("\n\n");
  }
  const { response } = runAgentLoop(loopOptions);

  return response;
}
