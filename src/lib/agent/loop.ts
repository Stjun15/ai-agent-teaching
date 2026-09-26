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

import { type AgentSessionEvent } from "@earendil-works/pi-coding-agent";

import type { ArkEnv } from "./ark";
import { calculatorTool } from "./tools/calculator";
import { createSession, type AgentSessionHandle } from "./session";
import {
  createSSEStream,
  sseResponse,
  type SSEEvent,
  type SSEStream,
} from "../sse-server";

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
  "- 思考过程（thinking / reasoning）也必须用中文，" +
    "不要用英文思考。学生能看到你的推理。",
].join("\n");

/** SSE 事件里 `agent` 字段的默认值。编排层接入后由调用方显式传入。 */
export const DEFAULT_AGENT_ID = "chat";

/** `thinking` 事件里 `step` 字段的取值。当前只有「模型在思考」这一种来源。 */
const THINKING_STEP = "思考";

/**
 * 代码语言。与 `SendMessageSchema.language` / `Message.language` 同值域。
 *
 * 为什么这里再写一遍字面量联合，而不是 import `@/schemas`
 * -----------------------------------------------------
 * `src/schemas/index.ts` 头部的约定：Agent 内核不 import schema 出口 ——
 * 内核的进出都是 SDK 类型，把 HTTP 契约塞进内核会让内核多一层依赖。
 *
 * 那重复一遍会不会又埋一个「两处口径不一致」的坑？不会，因为这里没有
 * 任何**无类型**的传输环节：`route.ts` 拿到的是 schema 校验过的值，直接作为
 * 实参传给 `runAgentLoop`。两边字面量联合只要有一个取值对不上，调用处就编译
 * 不过。真正危险的是「值经过 JSON / 数据库再回来」那种边界 —— 那里由 Zod 拦，
 * 与这里无关。
 */
import type { CodeLanguage } from "@/lib/languages";

/**
 * 与 `lib/languages.ts` 的 `CodeLanguage` 同值 —— 历史名字，调用方沿用。
 * 值域收敛后这里只保留别名，不再有第二份字面量联合。
 */
export type AgentCodeLanguage = CodeLanguage;

/**
 * 把「学生说的话」与「学生提交的代码」组装成模型真正读到的用户输入。
 *
 * ⚠️ 这是**第一版**，Phase 5 会替换
 * ---------------------------------
 * 当前 `/api/chat` 刻意不落库、不带历史（见 `route.ts`），所以一轮请求里
 * 只有「这一句 + 这一份代码」。Phase 5 的落库端点要带多轮历史，届时组装逻辑
 * 会整体搬到提示词构造层 —— 所以这里刻意做成**纯函数且单独导出**：
 * 搬运时不用改逻辑，也便于直接断言输出（喂一组输入，比对字符串）。
 *
 * 为什么要一句话说明「这是学生写的代码」
 * ----------------------------------
 * 直接把代码贴在问题后面，模型无法区分「代码是讨论对象」还是「代码是问题的一部分」。
 * 教学场景里这个区别是本质的：第 3 步「动手模仿」学生交代码，第 4 步导师要
 * **按评分标准点评它**，而不是继续写自己的实现。
 *
 * 语言后缀（```typescript）不是装饰：它把语法信息一并给了模型，
 * Python 与 TypeScript 的常见错误模式完全不同。
 */
export function composeUserPrompt(options: {
  prompt: string;
  code?: string;
  /** 省略时按 `StudentProfile.preferredLanguage` 的默认值 `typescript`。 */
  language?: AgentCodeLanguage;
}): string {
  const { prompt, code, language = "typescript" } = options;

  // 空代码等同于没附代码：不要把「```typescript\n\n```」这种空围栏发给模型，
  // 它会浪费 token 还让模型以为学生在提交空实现。
  if (code === undefined || code.trim() === "") return prompt;

  return [
    prompt,
    "",
    `以下是我写的代码（${language}），请按评分标准逐项点评：`,
    "",
    `\`\`\`${language}`,
    code.trim(),
    "```",
  ].join("\n");
}

/**
 * 多轮历史里的一轮。
 *
 * 只用 `student` / `assistant` 两种角色：`Message.role` 还有 teacher /
 * reviewer / examiner 等，但那些是**编排层**里多个 Agent 各说各话时才出现的；
 * 到了模型眼里它们都是「助手说过的话」，区分开只会让模型以为有四个说话人。
 */
export interface AgentHistoryTurn {
  role: "student" | "assistant";
  content: string;
}

/**
 * 把历史轮次渲染成模型能读到的文本块。历史为空时返回空串，调用方直接拼接即可。
 *
 * 为什么是「塞进 prompt」而不是用 SDK 的多轮消息
 * ---------------------------------------
 * `session.ts` 用的是 `SessionManager.inMemory()`，一轮一建，本来就不保留上下文。
 * 要真多轮得改会话持久化（并顺带处理压缩 / token 上限 / 工具调用在历史里的表示），
 * 那是另一个量级的改动。教学场景一轮对话通常十几条消息以内，拼文本够用且可解释：
 * 「模型看到了什么」就是这段字符串，出问题能直接打出来看。
 *
 * 边界：调用方（`/api/session/[id]/message`）先截到最近 N 条，本函数再按
 * `HISTORY_CHAR_BUDGET` 从最旧整条丢弃。**两层都必要** —— token 成本同时受
 * 「条数」与「单条长度」影响：只限条数时，20 条长讲解（每条数千字）仍能撑到
 * 十万字符量级，而它们会**每一轮**重复进 prompt。
 */

/**
 * 历史块的总字符预算（约合数千 token）。
 *
 * 取 4000 的依据：一轮正常教学对话（学生几百字 + 助手数千字讲解）大致就是
 * 1~3 轮的量；再往前的内容，对「理解刚才在说什么」的边际价值下降很快。
 * 这是**保守**的初始值 —— 宁可少带历史，也不要让每轮 prompt 随会话长度膨胀。
 */
export const HISTORY_CHAR_BUDGET = 4000;

/**
 * 按预算从最新往回保留历史。
 *
 * 为什么整条丢、而不是把某一条截断：截断会让模型看到半句话，它无法区分
 * 「学生没说完」与「系统截的」，可能据此做出错误推断。整条丢弃的语义是
 * 「这段我不记得了」，干净且可解释。
 *
 * 为什么最新一轮无条件保留：它就是「刚才在说什么」，丢了模型会答非所问；
 * 即便这一轮自身超出预算也留 —— 超长单条应当由调用方的输入长度上限约束，
 * 不该由「历史裁剪」来承担。
 */
function keepRecentWithinBudget(
  history: readonly AgentHistoryTurn[],
): AgentHistoryTurn[] {
  const kept: AgentHistoryTurn[] = [];
  let used = 0;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (kept.length > 0 && used + turn.content.length > HISTORY_CHAR_BUDGET) {
      break;
    }
    kept.unshift(turn);
    used += turn.content.length;
  }

  return kept;
}

export function composeHistory(history: readonly AgentHistoryTurn[]): string {
  if (history.length === 0) return "";

  const lines = keepRecentWithinBudget(history).map((turn) => {
    const label = turn.role === "student" ? "学生" : "助手";
    return `${label}：${turn.content}`;
  });

  return [
    "以下是本次会话此前的对话，用于理解上下文，不要在回答里复述它：",
    "",
    ...lines,
    "",
    "---",
    "",
  ].join("\n");
}

export interface AgentLoopOptions {
  /** 学生输入的一轮内容 */
  prompt: string;
  /** 学生提交的待点评代码。与 `prompt` 一起组装成模型读到的输入。 */
  code?: string;
  /** 代码语言；只在与 `code` 同时出现时有意义。 */
  language?: AgentCodeLanguage;
  /** Agent 标识，用于 SSE 的 thinking 事件。默认 `DEFAULT_AGENT_ID`。 */
  agent?: string;
  /**
   * 身份层提示词。默认 `PROVISIONAL_SYSTEM_PROMPT`（通用答疑口径）。
   *
   * 需要传入的场景：学习页处在讲解类步骤时要换成
   * `TEACHING_CHAT_SYSTEM_PROMPT`（见 `prompts/teaching-chat.ts` 头部，
   * 那里说明了为什么不能复用讲解 Agent 的 JSON 版提示词）。
   * 默认留在 loop 内部，是为了让「没传」的调用方行为与改造前完全一致。
   */
  systemPrompt?: string;
  /**
   * 本轮之前的历史，按时间升序。会在模型调用前拼进 prompt（见 `composeHistory`），
   * **不参与** token 统计里的「本轮输入」概念 —— 计费口径由调用方自行决定。
   */
  history?: readonly AgentHistoryTurn[];
  /**
   * 流建立后、模型调用前先发出的事件。
   *
   * 给「检索到的引用」这类**先于模型输出就该到达前端**的事件用：学生在等答案时
   * 就能看到「本次参考了哪几页」。放在这里而不是让调用方自己再建一条流，
   * 是为了保证事件顺序严格 —— 两条流在浏览器侧的到达顺序是没有保证的。
   */
  preludeEvents?: readonly SSEEvent[] | (() => Promise<readonly SSEEvent[]>);
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
/** 解析异步前置事件：支持数组、异步函数或空值。 */
async function resolvePreludeEvents(
  source: AgentLoopOptions["preludeEvents"],
): Promise<readonly SSEEvent[]> {
  if (!source) return [];
  if (typeof source === "function") return source();
  return source;
}

export function runAgentLoop(options: AgentLoopOptions): AgentLoop {
  const {
    prompt,
    code,
    language,
    agent = DEFAULT_AGENT_ID,
    systemPrompt = PROVISIONAL_SYSTEM_PROMPT,
    history,
    preludeEvents,
    env,
    signal,
  } = options;
  // 组装一次、全程用组装后的值：后续若要记录「模型到底看到了什么」（审计、
  // 复现一次失败），必须能拿到同一个字符串，不能在两处各拼一次。
  const userMessage =
    composeHistory(history ?? []) +
    composeUserPrompt({ prompt, code, language });
  const stream = createSSEStream();
  const translator = createEventTranslator(stream, agent);

  const completed = (async (): Promise<AgentLoopSummary> => {
    let handle: AgentSessionHandle | undefined;

    try {
      // 流建立后立即并发：引用检索与模型会话创建同时进行，
      // 总等待 = max(引用, 会话) 而非 sum。
      const preludeReady = resolvePreludeEvents(preludeEvents);
      void preludeReady.then((events) => {
        for (const evt of events ?? []) stream.send(evt);
      });

      // 会话一律走 `session.ts` 的工厂：资源锁定策略（关掉扩展/技能/提示词模板
      // /上下文文件）只在那儿定义一次，避免流式与非流式两条路径悄悄漂移。
      handle = await createSession({
        systemPrompt,
        // 工具白名单。注意 `tools` 是总白名单，自定义工具必须按名字列进来，
        // 写成空数组会把 calculate 一起挡掉（见文件头「工具白名单」的踩坑记录）。
        tools: [calculatorTool.name],
        customTools: [calculatorTool],
        onEvent: translator.handle,
        env,
        signal,
      });

      await handle.prompt(userMessage);

      const { text: answer, toolCalls, tokens } = translator.summary();
      stream.send({
        type: "done",
        data: { messageId: translator.currentMessageId(), tokens },
      });

      return { ok: true, text: answer, toolCalls, tokens };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 错误码取 LLM_ERROR 而非自造的 INTERNAL：本 catch 能覆盖的范围就是
      // 「建模型运行时 / 建会话 / 执行一轮 prompt」，全部属于 `api-spec.md`
      // 「六、错误码」里 LLM_ERROR 的定义（LLM 调用失败）。自造码不在协议表里，
      // 前端按表查不到状态码与可恢复性，只能当未知错误处理。
      stream.send({
        type: "error",
        data: { code: "LLM_ERROR", message, recoverable: true },
      });
      const { text: answer, toolCalls, tokens } = translator.summary();
      return { ok: false, text: answer, toolCalls, tokens, error: message };
    } finally {
      stream.close();
      handle?.dispose();
    }
  })();

  return { response: sseResponse(stream.stream), completed };
}
