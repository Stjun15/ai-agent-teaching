/**
 * LLM 模型 Provider — 火山方舟（Volcengine Ark）
 *
 * 设计依据
 * --------
 * 方舟提供 OpenAI 兼容端点：
 *   - 平台 = 火山方舟 Volcengine Ark（OpenAI 兼容端点 `/api/v3`）
 *   - 主模型（文本推理）`deepseek-v4-flash-ga-260731`，读环境变量 `ARK_TEXT_MODEL`
 *   - 多模态模型（视觉理解）`doubao-seed-2-1-pro-260915`，读环境变量 `ARK_VISION_MODEL`
 *
 * ⚠️ 模型名与端点均以 `ark-config.ts` 的默认值为准。
 * 约束：「API 密钥绝不进仓库，走环境变量」。
 *
 * 为什么不用 `models.json`
 * -----------------------
 * pi 的 `models.json` 只对 `apiKey` / `headers` 支持环境变量插值，`baseUrl` 与模型 `id`
 * 都不支持（见 `dist/core/model-config.d.ts` 的 schema：三者均为纯 `Type.String()`）。
 * 本项目要求 baseUrl 与模型名同样走环境变量，因此改用 `ModelRuntime.registerProvider()`
 * 直接注册。该方法与 `models.json` 走同一条 provider compose 链路，能力等价。
 *
 * 密钥如何做到「不落盘」
 * ---------------------
 * 1. `apiKey` 传的是**引用** `"$ARK_API_KEY"` 而非密钥值本身；SDK 在每次请求时从
 *    `process.env` 解析。因此这个配置对象里不存在密钥，日志/序列化都不会泄漏。
 * 2. 注入一个**空实现**的凭据存储，使 `ModelRuntime.create()` 不去建 `~/.pi/agent/auth.json`。
 *    实测默认实现即使不做任何登录也会创建该文件（内容为空对象），在只读文件系统上会直接失败。
 *    空实现把「密钥不落盘」从**偶然成立**变成**结构保证**。
 * 3. `modelsPath: null` 切断对 `~/.pi/agent/models.json` 的读取，provider 完全由本文件声明。
 *
 * ⚠️ provider id 仍为 `ark`
 * -------------------------
 * 内部标识保持 `ark` 不变——改名会导致大面积重构且无功能收益。SDK 用 provider id 推导
 * 环境变量名（`ark` → `ARK_API_KEY`），但我们**不依赖这个推导**：`apiKey` 显式传
 * `$ARK_API_KEY`，SDK 优先使用它。
 *
 * ⚠️ 仅服务端可用
 * -------------
 * 本模块读取 `process.env`，只能在服务端代码（Route Handler / Server Component）中导入，
 * 不要被客户端组件引用。
 *
 * ⚠️ 只想读配置的地方请改用 `./ark-config`
 * ---------------------------------------
 * 本文件为注册 provider 必须 import SDK，而该包体量很大。实测：一个只用
 * `readArkSettings()` 读四个环境变量的路由，构建产物被追踪到 530 个文件
 * （266 个来自 pi-coding-agent）。所以纯配置逻辑（默认值、读环境变量、校验密钥）
 * 已拆到 `./ark-config`；只有需要 provider / 模型运行时的代码才应 import 本文件。
 * 本文件仍把那些符号重新导出，仅为兼容既有调用方。
 */

import {
  ModelRuntime,
  type ProviderConfig,
  type ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";

import {
  ARK_API_KEY_ENV,
  ARK_DEFAULT_BASE_URL,
  ARK_DEFAULT_TEXT_MODEL,
  ARK_DEFAULT_VISION_MODEL,
  ARK_PROVIDER_ID,
  TEXT_MAX_TOKENS,
  VISION_MAX_TOKENS,
  assertArkApiKey,
  readArkSettings,
  type ArkEnv,
  type ArkSettings,
} from "./ark-config";

// 纯配置部分（默认值、环境变量读取、密钥校验）在 `./ark-config`，本文件负责需要
// SDK 的部分（provider 注册、模型运行时）。把它们一起重新导出，调用方只需认
// `./ark` 这一个入口即可，不必关心内部如何切分。
export {
  ARK_API_KEY_ENV,
  ARK_DEFAULT_BASE_URL,
  ARK_DEFAULT_TEXT_MODEL,
  ARK_DEFAULT_VISION_MODEL,
  ARK_PROVIDER_ID,
  assertArkApiKey,
  readArkSettings,
};
export type { ArkEnv, ArkSettings };

/**
 * 上下文窗口与最大输出 token。
 *
 * `contextWindow` 只影响 pi 内部的上下文占用估算与自动压缩阈值，取保守值。
 * `maxTokens` **参与请求构造**（传入 `max_tokens`），与模型实际输出上限一致。
 *
 * DeepSeek V4 Flash（方舟）：上下文 128K，输出上限按方舟文档取 16K。
 *
 * ⚠️ 上限常量本身定义在 `ark-config.ts`（纯逻辑、不 import SDK），这里只转出：
 * `generate-lecture-cache.ts` 的截断守卫要用它，而那个脚本不该为了一个数字
 * 把整个 pi-coding-agent 拖进来（理由见 ark-config 文件头）。
 */
const TEXT_CONTEXT_WINDOW = 128_000;
const VISION_CONTEXT_WINDOW = 256_000;

/**
 * 计费单价（美元 / 百万 token）。
 *
 * 暂全部取 0：本项目不依赖 pi 的成本统计。方舟模型
 * 目前免费（500 次 / 5 小时），具体额度见平台控制台。
 */
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;

/** 从 `ModelRuntime["getModel"]` 推导模型类型，避免为取一个类型而引入 `pi-ai` 依赖。 */
export type ArkModel = NonNullable<ReturnType<ModelRuntime["getModel"]>>;

/** 一次性拿到运行时与两个模型，供上层直接使用。 */
export interface ArkModels {
  /** 已注册好 ark provider 的运行时 */
  modelRuntime: ModelRuntime;
  /** 主模型（文本推理） */
  text: ArkModel;
  /** 多模态模型（视觉理解） */
  vision: ArkModel;
}

/**
 * 构造 ark provider 的注册配置。
 *
 * 抽成纯函数便于单独校验：给定环境变量 → 得到确定的配置对象，可断言其中不含密钥。
 */
export function buildArkProviderConfig(
  env: ArkEnv = process.env,
): ProviderConfig {
  const { baseUrl, textModel, visionModel } = readArkSettings(env);

  const text: ProviderModelConfig = {
    id: textModel,
    name: "DeepSeek V4 Flash（火山方舟）",
    reasoning: false,
    input: ["text"],
    cost: { ...ZERO_COST },
    contextWindow: TEXT_CONTEXT_WINDOW,
    maxTokens: TEXT_MAX_TOKENS,
  };

  const vision: ProviderModelConfig = {
    id: visionModel,
    name: "Doubao Seed 2.1 Pro（火山方舟）",
    reasoning: false,
    input: ["text", "image"],
    cost: { ...ZERO_COST },
    contextWindow: VISION_CONTEXT_WINDOW,
    maxTokens: VISION_MAX_TOKENS,
  };

  return {
    name: "Ark",
    baseUrl,
    // 方舟走 OpenAI 兼容协议，用 openai-completions 即可
    api: "openai-completions",
    // 传引用不传值：请求时由 SDK 从 process.env 解析，密钥不会出现在本对象中
    apiKey: `$${ARK_API_KEY_ENV}`,
    models: [text, vision],
  };
}

/**
 * 创建已注册 ark provider 的 `ModelRuntime`。
 *
 * - `modelsPath: null`：不读 `~/.pi/agent/models.json`
 * - `credentials`：空实现，杜绝 SDK 创建 `auth.json`
 */
export async function createArkModelRuntime(
  env: ArkEnv = process.env,
): Promise<ModelRuntime> {
  assertArkApiKey(env);

  const modelRuntime = await ModelRuntime.create({
    modelsPath: null,
    credentials: {
      // 本应用只用环境变量里的密钥，不做登录，因此凭据存储恒定为空。
      // 返回 undefined / [] 即表示「没有已存储的凭据」，SDK 会回落到环境变量。
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

  modelRuntime.registerProvider(ARK_PROVIDER_ID, buildArkProviderConfig(env));

  return modelRuntime;
}

/**
 * ModelRuntime 单例缓存。
 *
 * 为什么需要缓存
 * -------------
 * 首 token 延迟实测瓶颈之一是 `ModelRuntime.create()` + `registerProvider()`，
 * 每次请求各做一遍浪费启动时间。环境变量在进程运行期不变，ModelRuntime 内部
 * 也不持任何请求级状态，因此一份单例可跨请求复用。只在模型名变更（`ARK_TEXT_MODEL` /
 * `ARK_VISION_MODEL` 中途换过）时才重建。
 */
let cachedArkModels: Promise<ArkModels> | undefined;

/**
 * 创建运行时并解析出两个模型。解析失败即抛错——模型名写错时应当立刻暴露，
 * 而不是等到第一次请求才报 404。
 *
 * 首次调用走完整的 `ModelRuntime.create()` + `registerProvider()`；
 * 后续调用复用缓存的运行时（按模型名做 key，模型名不变就不重建）。
 */
export async function createArkModels(
  env: ArkEnv = process.env,
): Promise<ArkModels> {
  const { textModel, visionModel } = readArkSettings(env);
  const cacheKey = `${textModel}|${visionModel}`;

  if (cachedArkModels && cacheKey === createArkModels._cacheKey) {
    return cachedArkModels;
  }

  cachedArkModels = (async (): Promise<ArkModels> => {
    const modelRuntime = await createArkModelRuntime(env);

    const text = modelRuntime.getModel(ARK_PROVIDER_ID, textModel);
    if (!text) {
      throw new Error(
        `方舟主模型 ${textModel} 注册后无法解析，请检查 ARK_TEXT_MODEL 的值。`,
      );
    }

    const vision = modelRuntime.getModel(ARK_PROVIDER_ID, visionModel);
    if (!vision) {
      throw new Error(
        `方舟视觉模型 ${visionModel} 注册后无法解析，请检查 ARK_VISION_MODEL 的值。`,
      );
    }

    return { modelRuntime, text, vision };
  })();

  createArkModels._cacheKey = cacheKey;
  return cachedArkModels;
}

/** 只在模块闭包内使用；TS 不关心。 */
createArkModels._cacheKey = "";