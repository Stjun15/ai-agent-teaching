/**
 * 最小 Agent Loop
 *
 * 设计依据
 * --------
 * - `06-execution-plan.md` Phase 1：「跑通一个 Agent + 一个工具」「验证 SSE 流式返回」，
 *   提交点 `feat(agent): implement minimal agent loop`。
 * - `references/api-spec.md`：
 *   - 「三、SSE 事件协议完整定义」—— 本文件把 SDK 事件映射为这 10 种协议事件；
 *   - 「五、后端 SSE 服务端工具」—— 用 createSSEStream 产出 Response 的形态；
 *   - 「九、后端处理消息」—— `handleChat` 分支即本文件承担的职责。
 * - `02-agent-system.md` 四条铁律之一「Agent 权限由代码控制」—— 见下方「工具白名单」。
 *
 * 本文件做什么
 * -----------
 * 一次调用 = 一轮完整对话：建方舟模型运行时 → 建 SDK 会话（只挂 calculate）→
 * 把 SDK 事件翻译成项目自定义的 SSE 事件 → 返回可直接交给 Route Handler 的 Response。
 *
 * 本文件刻意不做什么（范围边界，均留给后续 Phase）
 * ---------------------------------------------
 * 1. **不碰数据库**。api-spec 第九节里 `messageDb.create(...)` 是路由层的职责，
 *    本文件只负责「跑一轮对话并吐出流」。数据库与会话的绑定放到 API 层统一做，
 *    避免同一个写入点在两处出现。
 * 2. **不建 Next.js 路由**。Phase 1 的验收项是「SSE 流式返回正常」，这一点用真实
 *    HTTP 套接字即可验证（见验证说明）；路由本身还涉及鉴权与 Zod 校验
 *    （05-data-api.md 验收标准「所有输入输出通过 Zod 校验」），属于 API 层的提交点。
 * 3. **不做多轮记忆**。每轮用一个全新的内存会话（`SessionManager.inMemory()`），
 *    不落会话文件。多轮续聊要走 SessionManager 的会话持久化，属后续 Phase。
 * 4. **不做 Agent 编排**。02-agent-system.md 的 4 个 Agent + 7 个 Skill 是 B 阶段内容，
 *    本文件是它们的公共底座：一次「发给模型 → 可能调工具 → 拿回文本」。
 *
 * 工具白名单（对应铁律「Agent 权限由代码控制」）
 * --------------------------------------------
 * 三层同时收紧，缺一层都可能漏出工具：
 *   1. `tools: ["calculate"]` —— 显式列出唯一授权的工具；
 *   2. `noExtensions: true`   —— 不让 ResourceLoader 从 cwd 或 agentDir 发现扩展，
 *                                否则扩展注册的工具会绕过上面的白名单；
 *   3. `customTools: [calculatorTool]` —— 把该工具注册进会话。
 *
 * ⚠️ 踩过的坑：`tools` 是**总白名单**，同时作用于内置工具与自定义工具。
 * 最初写成 `tools: []` 想表达「不开任何内置工具」，结果把 `calculatorTool` 也一起
 * 挡掉了。症状很隐蔽：模型知道工具参数名（说明工具定义确实参与了提示词构造），
 * 却把调用写成 ```json {"expression":"..."} ``` 这样的**文本**，请求体里根本没有
 * `tools` 字段。根因见 dist/core/sdk.js：`allowedToolNames = options.tools ?? ...`，
 * 该白名单在注册自定义工具之后仍会统一过滤。因此自定义工具必须按名字列进 `tools`。
 * 若确实想「只开自定义工具」，另一种写法是省略 `tools` 而用 `noTools: "builtin"`。
 *
 * 系统提示词是**临时版**
 * ---------------------
 * `01-teaching-system.md` 与 `02-agent-system.md` 的四层架构里，身份层（System Prompt）
 * 的正式内容属 B 阶段，当前文档中还没有权威文本。所以这里的 `PROVISIONAL_SYSTEM_PROMPT`
 * 只保证「不胡说、优先用工具算数、说中文」，不承担任何教学人设。它被替换是预期内的。
 */

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";

import { createArkModels, type ArkEnv } from "./ark";
import { calculatorTool } from "./tools/calculator";
import { createSSEStream, sseResponse, type SSEStream } from "../sse-server";

/**
 * 临时系统提示词。见文件头「系统提示词是临时版」。身份层的正式内容在 B 阶段补。
 */
const PROVISIONAL_SYSTEM_PROMPT = [
  "你是「AI Native 编程教学助手」的对话内核，面向正在学习 AI 编程的学生。",
  "",
  "准则：",
  "- 只讲你能确认的内容。不确定就直说，不要编造，也不要假装运行过代码。",
  "- 涉及算术时调用 calculate 工具，不要心算。",
  "- 用简体中文回答，简洁直接，先给结论再给理由。",
].join("\n");

/** SSE 事件里 `agent` 字段的默认值。编排层接入后由调用方显式传入。 */
export const DEFAULT_AGENT_ID = "chat";

/** `thinking` 事件里 `step` 字段的取值。当前只有「模型在思考」这一种来源。 */
const THINKING_STEP = "思考";

export interface AgentLoopOptions {
  /** 学生输入的一轮内容 */
  prompt: string;
  /** Agent 标识，用于 SSE 的 thinking 事件。默认 `DEFAULT_AGENT_ID`。 */
  agent?: string;
  /** 环境变量来源。默认 `process.env`；显式传入便于测试。 */
  env?: ArkEnv;
  /** 客户端断开时中止。Route Handler 可传 `req.signal`。 */
  signal?: AbortSignal;
}

/** 一轮运行的汇总，供调用方断言与记录。 */
export interface AgentLoopSummary {
  ok: boolean;
  /** 本轮流式输出的助手文本（所有 text_delta 拼接） */
  text: string;
  /** 工具调用次数 */
  toolCalls: number;
  tokens: { input: number; output: number };
  /** 失败时的原因；ok 为 true 时不存在 */
  error?: string;
}

export interface AgentLoop {
  /** SSE 响应，直接交给 Route Handler 返回 */
  response: Response;
  /** 整轮结束（done / error 事件已发出、流已关闭）后 resolve */
  completed: Promise<AgentLoopSummary>;
}

function newMessageId(): string {
  return `msg_${crypto.randomUUID()}`;
}

/** SSE 协议里 `params` / `result` 都声明为 object，此处把 SDK 的 any 收敛成对象。 */
function toObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return { value };
}

/**
 * 把 SDK 事件翻译成 SSE 事件并推入流。
 *
 * 抽成独立函数是为了能脱离网络单独验证映射是否正确（喂合成事件、断言产出的 SSE 帧），
 * 也避免把翻译逻辑埋在闭包里。
 */
function createEventTranslator(
  stream: SSEStream,
  agent: string,
): {
  handle: (event: AgentSessionEvent) => void;
  summary: () => {
    text: string;
    toolCalls: number;
    tokens: { input: number; output: number };
  };
  currentMessageId: () => string;
} {
  let messageId = newMessageId();
  let text = "";
  let toolCalls = 0;
  const tokens = { input: 0, output: 0 };
  const toolStartedAt = new Map<string, number>();

  function handle(event: AgentSessionEvent): void {
    switch (event.type) {
      // 一条新助手消息开始 → 换一个新的 messageId，让 token 与 done 事件能对上
      case "message_start":
        if (event.message.role === "assistant") {
          messageId = newMessageId();
        }
        return;

      case "message_update": {
        const inner = event.assistantMessageEvent;
        if (inner.type === "text_delta") {
          text += inner.delta;
          stream.send({
            type: "token",
            data: { content: inner.delta, messageId },
          });
        } else if (inner.type === "thinking_delta") {
          stream.send({
            type: "thinking",
            data: { step: THINKING_STEP, content: inner.delta, agent },
          });
        }
        return;
      }

      case "tool_execution_start":
        toolCalls += 1;
        toolStartedAt.set(event.toolCallId, Date.now());
        stream.send({
          type: "tool_call",
          data: {
            toolName: event.toolName,
            params: toObject(event.args),
            callId: event.toolCallId,
          },
        });
        return;

      case "tool_execution_end": {
        // duration 由本文件测量：SDK 事件里没有耗时字段。
        const startedAt = toolStartedAt.get(event.toolCallId);
        toolStartedAt.delete(event.toolCallId);
        stream.send({
          type: "tool_result",
          data: {
            callId: event.toolCallId,
            result: toObject(event.result),
            duration: startedAt === undefined ? 0 : Date.now() - startedAt,
          },
        });
        return;
      }

      // usage 按「助手消息」累加：一次运行可能有多条助手消息（工具调用前后各一条）
      case "turn_end":
        if (event.message.role === "assistant") {
          tokens.input += event.message.usage.input;
          tokens.output += event.message.usage.output;
        }
        return;

      default:
        // 其余 SDK 事件（queue_update、compaction_*、auto_retry_* 等）当前不映射到
        // SSE 协议里的任何事件类型，直接忽略。需要时再补映射。
        return;
    }
  }

  return {
    handle,
    summary: () => ({ text, toolCalls, tokens }),
    currentMessageId: () => messageId,
  };
}

/**
 * 跑一轮最小对话，返回 SSE 响应。
 *
 * 同步返回 Response，实际运行在后台进行 —— 这是 SSE 接口的固有形态：
 * 必须先交出响应头，才能开始推流（与 api-spec 第九节的写法一致）。
 * 想等整轮结束的调用方 await `completed`。
 */
export function runAgentLoop(options: AgentLoopOptions): AgentLoop {
  const { prompt, agent = DEFAULT_AGENT_ID, env, signal } = options;
  const stream = createSSEStream();
  const translator = createEventTranslator(stream, agent);

  const completed = (async (): Promise<AgentLoopSummary> => {
    let session:
      Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;

    try {
      const { modelRuntime, text } = await createArkModels(env);

      // 关掉全部资源发现：Phase 1 不需要扩展 / 技能 / 提示词模板 / 上下文文件，
      // 开着会让 cwd 与 agentDir 里出现的任何文件悄悄改变 Agent 行为。
      const resourceLoader = new DefaultResourceLoader({
        cwd: process.cwd(),
        agentDir: process.cwd(),
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        systemPrompt: PROVISIONAL_SYSTEM_PROMPT,
      });
      await resourceLoader.reload();

      const created = await createAgentSession({
        cwd: process.cwd(),
        agentDir: process.cwd(),
        modelRuntime,
        model: text,
        // 已在 ark.ts 里把该模型声明为 reasoning: false，这里同步关掉思考档位，
        // 避免发出未经验证的 thinking 参数。
        thinkingLevel: "off",
        // 工具白名单。注意 `tools` 是总白名单，自定义工具必须按名字列进来，
        // 写成空数组会把 calculate 一起挡掉（见文件头「工具白名单」的踩坑记录）。
        tools: [calculatorTool.name],
        customTools: [calculatorTool],
        resourceLoader,
        sessionManager: SessionManager.inMemory(),
        // 单轮对话不需要压缩；429 退避重试按 02-agent-system.md 的异常处理表开启。
        settingsManager: SettingsManager.inMemory({
          compaction: { enabled: false },
          retry: { enabled: true, maxRetries: 2 },
        }),
      });
      session = created.session;

      session.subscribe(translator.handle);

      if (signal) {
        if (signal.aborted) {
          await session.abort();
        } else {
          signal.addEventListener("abort", () => void session?.abort(), {
            once: true,
          });
        }
      }

      await session.prompt(prompt);

      const { text: answer, toolCalls, tokens } = translator.summary();
      stream.send({
        type: "done",
        data: { messageId: translator.currentMessageId(), tokens },
      });

      return { ok: true, text: answer, toolCalls, tokens };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stream.send({
        type: "error",
        data: { code: "INTERNAL", message, recoverable: false },
      });
      const { text: answer, toolCalls, tokens } = translator.summary();
      return { ok: false, text: answer, toolCalls, tokens, error: message };
    } finally {
      stream.close();
      session?.dispose();
    }
  })();

  return { response: sseResponse(stream.stream), completed };
}
