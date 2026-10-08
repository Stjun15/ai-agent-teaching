/**
 * LLM 平台配置（纯逻辑，**不 import SDK**）
 *
 * 平台：商汤日日新（SenseNova）— OpenAI 兼容端点
 * 模型：DeepSeek V4.1 Flash（文本 + 视觉同模，原生多模态）
 *
 * 为什么与 `ark.ts` 分开
 * ---------------------
 * `ark.ts` 为了注册 provider 必须 import `@earendil-works/pi-coding-agent`，
 * 而那是一个体量很大的包（实测：一个只读环境变量的路由，构建产物被追踪到
 * 530 个文件，其中 266 个来自 pi-coding-agent、41 个来自 pi-tui，还带进一个
 * WASM 图像库）。把「读环境变量 + 默认值」这类纯计算放在本文件，需要配置的
 * 地方（如 `/api/health`）就不必为之拖进整个 SDK。
 *
 * 本文件只做三件事：默认值、读环境变量、校验密钥存在。**不碰 SDK，也不碰网络。**
 *
 * 密钥处理：本文件只读不存，任何函数与日志都不回显密钥内容。
 *
 * ⚠️ 关于 reasoning_effort
 * ------------------------
 * SenseNova 的 DeepSeek 模型**默认开启思考模式**。走 SDK 时由
 * `samplingParams` 注入 `reasoning_effort: "none"` 关掉思考
 *（SDK 在所有 thinking 逻辑后 Object.assign，无覆盖风险）。
 * 走 raw fetch 时需手动传该参数，否则 content 为空。
 */

/** provider id。SDK 由它推导环境变量名（`ark` → `ARK_API_KEY`）。内部标识不变。 */
export const ARK_PROVIDER_ID = "ark";

/** 保存密钥的环境变量名。请在 `.env.local` 中设置 `SENSENOVA_API_KEY`。 */
export const ARK_API_KEY_ENV = "SENSENOVA_API_KEY";

/** SenseNova OpenAI 兼容端点；可被 `SENSENOVA_BASE_URL` 覆盖。 */
export const ARK_DEFAULT_BASE_URL = "https://token.sensenova.cn/v1";

/** 主模型（文本推理）— DeepSeek V4 Flash；可被 `SENSENOVA_TEXT_MODEL` 覆盖。 */
export const ARK_DEFAULT_TEXT_MODEL = "deepseek-v4-flash";

/** 多模态模型（视觉理解）— DeepSeek V4 Flash 原生多模态；可被 `SENSENOVA_VISION_MODEL` 覆盖。 */
export const ARK_DEFAULT_VISION_MODEL = "deepseek-v4-flash";

/**
 * 本模块用到的环境变量。
 *
 * 带索引签名是为了能直接传 `process.env`（`ProcessEnv` 是宽松字典类型）；若只声明
 * 几个可选字段，TS 的弱类型检查会报「no properties in common」。
 */
export interface ArkEnv {
  [key: string]: string | undefined;
  SENSENOVA_API_KEY?: string | undefined;
  SENSENOVA_BASE_URL?: string | undefined;
  SENSENOVA_TEXT_MODEL?: string | undefined;
  SENSENOVA_VISION_MODEL?: string | undefined;
}

/** 从环境变量解析出的平台连接参数（不含密钥）。 */
export interface ArkSettings {
  /** OpenAI 兼容端点，例如 `https://token.sensenova.cn/v1` */
  baseUrl: string;
  /** 主模型 id */
  textModel: string;
  /** 多模态模型 id */
  visionModel: string;
}

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

/**
 * 读取连接参数。**不校验密钥**，因此可在没有密钥的环境（如构建期、健康检查）
 * 安全调用。
 */
export function readArkSettings(env: ArkEnv = process.env): ArkSettings {
  return {
    baseUrl: trimmed(env.SENSENOVA_BASE_URL) ?? ARK_DEFAULT_BASE_URL,
    textModel: trimmed(env.SENSENOVA_TEXT_MODEL) ?? ARK_DEFAULT_TEXT_MODEL,
    visionModel:
      trimmed(env.SENSENOVA_VISION_MODEL) ?? ARK_DEFAULT_VISION_MODEL,
  };
}

/** 密钥是否已配置。只返回布尔值，调用方拿不到、也打印不出内容。 */
export function isArkApiKeyConfigured(env: ArkEnv = process.env): boolean {
  return trimmed(env[ARK_API_KEY_ENV]) !== undefined;
}

/**
 * 快速失败：缺少密钥时抛出可读错误。
 *
 * 刻意不给默认值——密钥一旦有默认值，就会有人把真实密钥写进代码。
 * 错误信息里也不会回显密钥内容。
 */
export function assertArkApiKey(env: ArkEnv = process.env): void {
  if (!isArkApiKeyConfigured(env)) {
    throw new Error(
      `缺少环境变量 ${ARK_API_KEY_ENV}。请在本地 .env.local（已被 .gitignore 排除）` +
        `或系统环境变量中设置，不要写进仓库。`,
    );
  }
}
