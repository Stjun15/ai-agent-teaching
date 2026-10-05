/**
 * 文本向量（embedding）客户端
 *
 * 为什么走百炼（DashScope）而不是方舟
 * --------------------------------
 * 2026-10-05 实测裁定：方舟侧 4 个文本 embedding 型号全部 Retiring 且调用
 * NotFound（不接受新开通），唯一可访问的 `doubao-embedding-vision-251215`
 * 走多模态端点、无批量、且服务端 InternalServiceError 高频（13 发 9 挂），
 * 不适合做索引底座。百炼的 `text-embedding-v4` 则因免费额度耗尽
 * （AllocationQuota.FreeTierOnly）不可用——换 **`qwen3.7-text-embedding`**
 * （同端点同形状，1024 维，额度独立）。curl 实测三连：中文 9 字 = 21 tokens。
 * 端点与调用方完全没动，只换模型名 —— `embedTexts` 的调用方不感知平台。
 *
 * 请求形态：OpenAI 兼容 `/embeddings`，`input` 为字符串数组，批量发送
 * （每批 10 条，DashScope 的单请求上限内）。密钥只读不存、任何日志不回显。
 */

import {
  DASHSCOPE_API_KEY_ENV,
  readDashScopeSettings,
} from "./dashscope-config";

export const DEFAULT_EMBEDDING_MODEL = "qwen3.7-text-embedding";

/** 单请求最大条数。DashScope embedding 接口的批量上限内，留了余量。 */
const BATCH_SIZE = 10;

export interface EmbeddingSettings {
  baseUrl: string;
  model: string;
}

export function readEmbeddingSettings(
  env: Record<string, string | undefined> = process.env,
): EmbeddingSettings {
  const dashscope = readDashScopeSettings(env);
  return {
    baseUrl: dashscope.baseUrl,
    model: env.DASHSCOPE_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

interface EmbeddingsResponse {
  data?: { embedding: number[]; index: number }[];
  error?: { message?: string };
}

/** 批量向量化。失败抛错 —— 调用方（检索层）负责降级，这里不吞。 */
export async function embedTexts(
  texts: readonly string[],
  settings: EmbeddingSettings = readEmbeddingSettings(),
  apiKey: string | undefined = process.env[DASHSCOPE_API_KEY_ENV],
): Promise<Float32Array[]> {
  if (!apiKey) {
    throw new Error("缺少环境变量 DASHSCOPE_API_KEY，无法调用向量接口。");
  }

  const vectors: Float32Array[] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const response = await fetch(`${settings.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: settings.model, input: batch }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `向量接口 HTTP ${response.status}（模型 ${settings.model}，第 ${start} 条起）`,
      );
    }
    const payload = (await response.json()) as EmbeddingsResponse;
    if (payload.error || !payload.data) {
      throw new Error(
        `向量接口返回错误：${payload.error?.message ?? "无 data 字段"}`,
      );
    }
    // 按 index 归位：兼容端点不保证数组顺序与请求一致
    const ordered = [...payload.data].sort((a, b) => a.index - b.index);
    if (ordered.length !== batch.length) {
      throw new Error(
        `向量接口返回 ${ordered.length} 条，请求 ${batch.length} 条。`,
      );
    }
    for (const item of ordered) {
      vectors.push(Float32Array.from(item.embedding));
    }
  }
  return vectors;
}

/** 余弦相似度。零向量按 0 处理（没有方向的嵌入没有相似度可言）。 */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}
