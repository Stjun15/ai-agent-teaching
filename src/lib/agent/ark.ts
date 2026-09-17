/**
 * 火山方舟（Volcengine Ark）模型 Provider
 *
 * 设计依据
 * --------
 * `00-MASTER.md` 技术栈表：
 *   - 模型平台 = 火山方舟 Ark（OpenAI 兼容端点 `/api/v3`）
 *   - 主模型（文本推理）`deepseek-v4-flash-ga-260731`，读环境变量 `ARK_TEXT_MODEL`
 *   - 多模态模型（视觉理解）`doubao-seed-2-1-pro-260915`，读环境变量 `ARK_VISION_MODEL`
 * `00-MASTER.md` 约束：「API 密钥绝不进仓库，走环境变量」。
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
 * ⚠️ provider id 必须是 `ark`
 * -------------------------
 * SDK 由 provider id 推导环境变量名（`ark` → `ARK_API_KEY`）。改名会导致密钥解析不到，
 * 且表现为「模型存在但不可用」，不易排查。实测 `getProviderAuthStatus("ark")` 返回
 * `{ configured: true, source: "environment", label: "ARK_API_KEY" }`。
 *
 * ⚠️ 仅服务端可用
 * -------------
 * 本模块读取 `process.env`，只能在服务端代码（Route Handler / Server Component）中导入，
 * 不要被客户端组件引用。
 */

import {
  ModelRuntime,
  type ProviderConfig,
  type ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";

/** provider id。见文件头「provider id 必须是 ark」说明，不要改动。 */
export const ARK_PROVIDER_ID = "ark";

/** 保存密钥的环境变量名。`apiKey` 以 `$ARK_API_KEY` 形式引用它。 */
export const ARK_API_KEY_ENV = "ARK_API_KEY";

/** 方舟 OpenAI 兼容端点，与 `00-MASTER.md` 一致；可被 `ARK_BASE_URL` 覆盖。 */
export const ARK_DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/** 主模型（文本推理）默认值；可被 `ARK_TEXT_MODEL` 覆盖。 */
export const ARK_DEFAULT_TEXT_MODEL = "deepseek-v4-flash-ga-260731";

/** 多模态模型（视觉理解）默认值；可被 `ARK_VISION_MODEL` 覆盖。 */
export const ARK_DEFAULT_VISION_MODEL = "doubao-seed-2-1-pro-260915";

/**
 * 上下文窗口与最大输出 token 的保守取值。
 *
 * 这两个数字**不参与请求构造**，只影响 pi 内部的上下文占用估算与自动压缩阈值，
 * 因此取保守值（宁可早压缩，也不要超出真实窗口）。待方舟控制台确认实际参数后对齐。
 */
const TEXT_CONTEXT_WINDOW = 128_000;
const TEXT_MAX_TOKENS = 8_192;
const VISION_CONTEXT_WINDOW = 256_000;
const VISION_MAX_TOKENS = 8_192;

/**
 * 方舟计费单价（美元 / 百万 token）。
 *
 * 暂全部取 0：本项目不依赖 pi 的成本统计，且单价会随方舟价格调整变化。
 * 保持 0 好过填一个会悄悄算错的数字——用途仅限于展示时，0 会明确显示为「未计费」。
 */
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;

/**
 * 本模块用到的环境变量。
 *
 * 带索引签名是为了能直接传 `process.env`（`ProcessEnv` 是宽松字典类型）；若只声明
 * 几个可选字段，TS 的弱类型检查会报「no properties in common」。
 */
export interface ArkEnv {
  [key: string]: string | undefined;
  ARK_API_KEY?: string | undefined;
  ARK_BASE_URL?: string | undefined;
  ARK_TEXT_MODEL?: string | undefined;
  ARK_VISION_MODEL?: string | undefined;
}

/** 从环境变量解析出的方舟连接参数（不含密钥）。 */
export interface ArkSettings {
  /** OpenAI 兼容端点，例如 `https://ark.cn-beijing.volces.com/api/v3` */
  baseUrl: string;
  /** 主模型 id */
  textModel: string;
  /** 多模态模型 id */
  visionModel: string;
}

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

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

/**
 * 读取连接参数。**不校验密钥**，因此可在没有密钥的环境（如构建期、前端展示配置）
 * 安全调用。
 */
export function readArkSettings(env: ArkEnv = process.env): ArkSettings {
  return {
    baseUrl: trimmed(env.ARK_BASE_URL) ?? ARK_DEFAULT_BASE_URL,
    textModel: trimmed(env.ARK_TEXT_MODEL) ?? ARK_DEFAULT_TEXT_MODEL,
    visionModel: trimmed(env.ARK_VISION_MODEL) ?? ARK_DEFAULT_VISION_MODEL,
  };
}

/**
 * 快速失败：缺少密钥时抛出可读错误。
 *
 * 刻意不给默认值——密钥一旦有默认值，就会有人把真实密钥写进代码。
 * 错误信息里也不会回显密钥内容。
 */
export function assertArkApiKey(env: ArkEnv = process.env): void {
  if (!trimmed(env[ARK_API_KEY_ENV])) {
    throw new Error(
      `缺少环境变量 ${ARK_API_KEY_ENV}。请在本地 .env.local（已被 .gitignore 排除）` +
        `或系统环境变量中设置，不要写进仓库。`,
    );
  }
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
    name: "DeepSeek V4 Flash（方舟）",
    // 声明为 false 的理由是「thinking 参数是否被支持尚未确认」，声明为 true 会让 pi
    // 发出未经验证的思考参数（如 reasoning_effort / thinking.type）。
    // 注意这不代表模型不思考：实测即使 `thinkingLevel: "off"`，方舟仍会流式返回
    // `reasoning_content`，pi 也会照常把它转成 thinking 增量。也就是说思考是「附带的」，
    // 关不掉也不需要额外参数。链路已能正常承载（见 loop.ts 的 thinking 事件映射）。
    reasoning: false,
    input: ["text"],
    cost: { ...ZERO_COST },
    contextWindow: TEXT_CONTEXT_WINDOW,
    maxTokens: TEXT_MAX_TOKENS,
  };

  const vision: ProviderModelConfig = {
    id: visionModel,
    name: "Doubao Seed 2.1 Pro（方舟）",
    reasoning: false,
    input: ["text", "image"],
    cost: { ...ZERO_COST },
    contextWindow: VISION_CONTEXT_WINDOW,
    maxTokens: VISION_MAX_TOKENS,
  };

  return {
    name: "Volcengine Ark",
    baseUrl,
    // 方舟走 OpenAI 兼容协议，用 openai-completions 即可，无需自定义 streamSimple
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
 * 创建运行时并解析出两个模型。解析失败即抛错——模型名写错时应当立刻暴露，
 * 而不是等到第一次请求才报 404。
 */
export async function createArkModels(
  env: ArkEnv = process.env,
): Promise<ArkModels> {
  const modelRuntime = await createArkModelRuntime(env);
  const { textModel, visionModel } = readArkSettings(env);

  const text = modelRuntime.getModel(ARK_PROVIDER_ID, textModel);
  if (!text) {
    throw new Error(
      `方舟主模型 ${textModel} 注册后无法解析，请检查 ARK_TEXT_MODEL 的值。`,
    );
  }

  const vision = modelRuntime.getModel(ARK_PROVIDER_ID, visionModel);
  if (!vision) {
    throw new Error(
      `方舟多模态模型 ${visionModel} 注册后无法解析，请检查 ARK_VISION_MODEL 的值。`,
    );
  }

  return { modelRuntime, text, vision };
}
