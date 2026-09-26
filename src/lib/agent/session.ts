/**
 * 会话工厂 —— 建方舟模型运行时与 SDK 会话的**唯一**入口
 *
 * 为什么抽出来
 * -----------
 * 「建运行时 → 关掉资源发现 → 建会话 → 订阅事件 → 发 prompt」这段逻辑，
 * 流式路径（`loop.ts`，给 SSE 用）与非流式路径（`runtime.ts`，给 Agent 结构化
 * 输出用）都要做。各写一份会让两边的**资源锁定策略**悄悄漂移：某天只在一边
 * 加了个 `noSkills: false`，另一个 Agent 就突然能读到本地文件了 ——
 * 而这类差异在开发期完全看不出来。
 *
 * 「Agent 权限由代码控制」这条铁律要求的正是：**所有 Agent 走同一道门**。
 *
 * 资源发现为什么全部关掉
 * -------------------
 * `cwd` 与 `agentDir` 里出现的任何文件都会悄悄改变 Agent 行为。本项目用
 * System Prompt 常量（见 `prompts/`）与 Skill 常量（见 `skills/`）显式提供
 * 身份层与技能层，不需要、也不允许 SDK 再从磁盘发现任何东西。
 */

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";

import { createArkModels, type ArkEnv } from "./ark";

/** `createAgentSession` 的参数类型，用于推导下面两个工具类型而不引入新依赖。 */
type CreateAgentSessionParams = NonNullable<
  Parameters<typeof createAgentSession>[0]
>;

/** 自定义工具的类型（从 SDK 参数反推，避免手写一份会和 SDK 漂移的结构）。 */
export type AgentCustomTool = NonNullable<
  CreateAgentSessionParams["customTools"]
>[number];

/**
 * ⚠️ `tools` 是**总白名单**，同时作用于内置工具与自定义工具。
 *
 * 写成 `[]` 想表达「不开内置工具」时，如果同时传了 `customTools`，
 * 自定义工具也会被一起挡掉 —— 症状极隐蔽：模型知道工具参数名（说明工具定义
 * 参与了提示词构造），却把调用写成 ```json {"expression":"..."} ``` 这样的纯文本，
 * 请求体里根本没有 `tools` 字段。
 * 依据 `dist/core/sdk.js`：`allowedToolNames = options.tools ?? ...`，
 * 该白名单在注册自定义工具之后仍统一过滤。
 * 结论：**传了自定义工具就必须按名字列进 `tools`**；确实一个工具都不要时，
 * 空数组是安全的（本文件默认即此）。
 */
export interface CreateSessionOptions {
  /** 身份层 + 技能层拼好的系统提示词。 */
  systemPrompt: string;
  /** 授权的工具名。默认空 —— 教学类 Agent 不需要任何工具。 */
  tools?: readonly string[];
  /** 自定义工具实现；传了就必须同时把名字列进 `tools`。 */
  customTools?: readonly AgentCustomTool[];
  /** 每个 SDK 事件的回调。流式路径把它接到 SSE 翻译器上。 */
  onEvent?: (event: AgentSessionEvent) => void;
  /** 环境变量来源，便于测试。 */
  env?: ArkEnv;
  /** 客户端断开或调用方中止时，一路传到 SDK 的 abort()。 */
  signal?: AbortSignal;
}

/** 建好的会话句柄。 */
export interface AgentSessionHandle {
  /** 发一轮 prompt。resolve 时该轮已完成。 */
  prompt: (text: string) => Promise<void>;
  /** 释放会话。必须调用，否则 SDK 资源不回收。 */
  dispose: () => void;
}

/**
 * 建会话。调用方负责用 `try/finally` 保证 `dispose()` 被调用。
 *
 * 返回句柄而不是裸 `session`：把「释放」与「发 prompt」绑在一起，
 * 调用方想漏掉 dispose 都难（拿到手就这两件事）。
 */
export async function createSession(
  options: CreateSessionOptions,
): Promise<AgentSessionHandle> {
  const {
    systemPrompt,
    tools = [],
    customTools,
    onEvent,
    env,
    signal,
  } = options;

  const { modelRuntime, text } = await createArkModels(env);

  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: process.cwd(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt,
  });
  await resourceLoader.reload();

  const created = await createAgentSession({
    cwd: process.cwd(),
    agentDir: process.cwd(),
    modelRuntime,
    model: text,
    // 已在 ark.ts 把该模型声明为 reasoning: false，这里同步关掉思考档位，
    // 避免发出未经验证的 thinking 参数（方舟仍会附带返回推理内容，关不掉也不需要）。
    thinkingLevel: "off",
    tools: [...tools],
    ...(customTools ? { customTools: [...customTools] } : {}),
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    // 单轮对话不需要压缩；429 退避重试按 02-agent-system.md 异常处理表开启。
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 2 },
    }),
  });

  const { session } = created;

  if (onEvent) session.subscribe(onEvent);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    session.dispose();
  };

  if (signal) {
    if (signal.aborted) {
      void session.abort();
    } else {
      signal.addEventListener("abort", () => void session.abort(), {
        once: true,
      });
    }
  }

  return {
    prompt: (userText: string) => session.prompt(userText),
    dispose,
  };
}
