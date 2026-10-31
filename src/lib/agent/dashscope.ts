/**
 * 百练（DashScope）模型 Provider
 *
 * 设计依据
 * --------
 * 百练是阿里云的模型服务平台，提供 OpenAI 兼容端点 `/compatible-mode/v1`。
 * 当前使用模型 `deepseek-v4.1-flash`，读环境变量 `DASHSCOPE_API_KEY`。
 *
 * 为什么不用 `models.json`
 * -----------------------
 * pi 的 `models.json` 只对 `apiKey` / `headers` 支持环境变量插值，`baseUrl` 与模型 `id`
 * 都不支持。本项目要求 baseUrl 与模型名同样走环境变量，因此改用 `ModelRuntime.registerProvider()`
 * 直接注册。该方法与 `models.json` 走同一条 provider compose 链路，能力等价。
 *
 * 密钥如何做到「不落盘」
 * ---------------------
 * 1. `apiKey` 传的是**引用** `"$DASHSCOPE_API_KEY"` 而非密钥值本身；SDK 在每次请求时从
 *    `process.env` 解析。因此这个配置对象里不存在密钥，日志/序列化都不会泄漏。
 * 2. 注入一个**空实现**的凭据存储，使 `ModelRuntime.create()` 不去建 `~/.pi/agent/auth.json`。
 * 3. `modelsPath: null` 切断对 `~/.pi/agent/models.json` 的读取，provider 完全由本文件声明。
 *
 * ⚠️ 仅服务端可用
 * -------------
 * 本模块读取 `process.env`，只能在服务端代码（Route Handler / Server Component）中导入，
 * 不要被客户端组件引用。
 *
 * ⚠️ 只想读配置的地方请改用 `./dashscope-config`
 * ---------------------------------------------
 * 本文件为注册 provider 必须 import SDK，而该包体量很大。所以纯配置逻辑
 * 已拆到 `./dashscope-config`；只有需要 provider / 模型运行时的代码才应 import 本文件。
 */

import {
  ModelRuntime,
  type ProviderConfig,
  type ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";

import {
  DASHSCOPE_API_KEY_ENV,
  DASHSCOPE_DEFAULT_BASE_URL,
  DASHSCOPE_DEFAULT_TEXT_MODEL,
  DASHSCOPE_DEFAULT_VISION_MODEL,
  DASHSCOPE_PROVIDER_ID,
  TEXT_MAX_TOKENS,
  VISION_MAX_TOKENS,
  assertDashScopeApiKey,
  readDashScopeSettings,
  type DashScopeEnv,
  type DashScopeSettings,
} from "./dashscope-config";

// 纯配置部分在 `./dashscope-config`，本文件负责需要 SDK 的部分（provider 注册、模型运行时）。
export {
  DASHSCOPE_API_KEY_ENV,
  DASHSCOPE_DEFAULT_BASE_URL,
  DASHSCOPE_DEFAULT_TEXT_MODEL,
  DASHSCOPE_DEFAULT_VISION_MODEL,
  DASHSCOPE_PROVIDER_ID,
  assertDashScopeApiKey,
  readDashScopeSettings,
};
export type { DashScopeEnv, DashScopeSettings };

/**
 * 上下文窗口与最大输出 token。
 */
const TEXT_CONTEXT_WINDOW = 128_000;
const VISION_CONTEXT_WINDOW = 256_000;

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;

/** 从 `ModelRuntime["getModel"]` 推导模型类型，避免为取一个类型而引入 `pi-ai` 依赖。 */
export type DashScopeModel = NonNullable<ReturnType<ModelRuntime["getModel"]>>;

/** 一次性拿到运行时与两个模型，供上层直接使用。 */
export interface DashScopeModels {
  /** 已注册好 dashscope provider 的运行时 */
  modelRuntime: ModelRuntime;
  /** 主模型（文本推理） */
  text: DashScopeModel;
  /** 多模态模型（视觉理解） */
  vision: DashScopeModel;
}

/**
 * 构造 dashscope provider 的注册配置。
 */
export function buildDashScopeProviderConfig(
  env: DashScopeEnv = process.env,
): ProviderConfig {
  const { baseUrl, textModel, visionModel } = readDashScopeSettings(env);

  const text: ProviderModelConfig = {
    id: textModel,
    name: "DeepSeek V4 Flash（百练）",
    reasoning: false,
    input: ["text"],
    cost: { ...ZERO_COST },
    contextWindow: TEXT_CONTEXT_WINDOW,
    maxTokens: TEXT_MAX_TOKENS,
  };

  const vision: ProviderModelConfig = {
    id: visionModel,
    name: "DeepSeek V4 Flash（百练-视觉）",
    reasoning: false,
    input: ["text", "image"],
    cost: { ...ZERO_COST },
    contextWindow: VISION_CONTEXT_WINDOW,
    maxTokens: VISION_MAX_TOKENS,
  };

  return {
    name: "DashScope（百练）",
    baseUrl,
    api: "openai-completions",
    apiKey: `$${DASHSCOPE_API_KEY_ENV}`,
    models: [text, vision],
  };
}

/**
 * 创建已注册 dashscope provider 的 `ModelRuntime`。
 */
export async function createDashScopeModelRuntime(
  env: DashScopeEnv = process.env,
): Promise<ModelRuntime> {
  assertDashScopeApiKey(env);

  const modelRuntime = await ModelRuntime.create({
    modelsPath: null,
    credentials: {
      async read() {
        return undefined;
      },
      async list() {
        return [];
      },
      async modify() {
        return undefined;
      },
      async delete() {},
    },
  });

  modelRuntime.registerProvider(
    DASHSCOPE_PROVIDER_ID,
    buildDashScopeProviderConfig(env),
  );

  return modelRuntime;
}

/**
 * 创建运行时并解析出两个模型。解析失败即抛错——模型名写错时应当立刻暴露，
 * 而不是等到实际调用时才发现。
 */
export async function createDashScopeModels(
  env: DashScopeEnv = process.env,
): Promise<DashScopeModels> {
  const modelRuntime = await createDashScopeModelRuntime(env);
  const { textModel, visionModel } = readDashScopeSettings(env);

  const text = modelRuntime.getModel(DASHSCOPE_PROVIDER_ID, textModel);
  if (!text) {
    throw new Error(
      `百练文本模型 "${textModel}" 注册后无法解析，请检查 DASHSCOPE_TEXT_MODEL 的值。`,
    );
  }

  const vision = modelRuntime.getModel(DASHSCOPE_PROVIDER_ID, visionModel);
  if (!vision) {
    throw new Error(
      `百练视觉模型 "${visionModel}" 注册后无法解析，请检查 DASHSCOPE_VISION_MODEL 的值。`,
    );
  }

  return { modelRuntime, text, vision };
}
