/**
 * 火山方舟配置（纯逻辑，**不 import SDK**）
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
 */

/** provider id。SDK 由它推导环境变量名（`ark` → `ARK_API_KEY`），不要改动。 */
export const ARK_PROVIDER_ID = "ark";

/** 保存密钥的环境变量名。`ark.ts` 的 provider 配置以 `$ARK_API_KEY` 形式引用它。 */
export const ARK_API_KEY_ENV = "ARK_API_KEY";

/** 方舟 OpenAI 兼容端点，与 `00-MASTER.md` 一致；可被 `ARK_BASE_URL` 覆盖。 */
export const ARK_DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/** 主模型（文本推理）默认值；可被 `ARK_TEXT_MODEL` 覆盖。 */
export const ARK_DEFAULT_TEXT_MODEL = "deepseek-v4-flash-ga-260731";

/** 多模态模型（视觉理解）默认值；可被 `ARK_VISION_MODEL` 覆盖。 */
export const ARK_DEFAULT_VISION_MODEL = "doubao-seed-2-1-pro-260915";

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
    baseUrl: trimmed(env.ARK_BASE_URL) ?? ARK_DEFAULT_BASE_URL,
    textModel: trimmed(env.ARK_TEXT_MODEL) ?? ARK_DEFAULT_TEXT_MODEL,
    visionModel: trimmed(env.ARK_VISION_MODEL) ?? ARK_DEFAULT_VISION_MODEL,
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