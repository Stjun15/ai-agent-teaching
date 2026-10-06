/**
 * POST /api/audit/evaluate —— 审计评估代理端点
 *
 * 审计脚本（curriculum-audit.ts）需要调用 LLM 做三类评估：
 *   1. 代码可读性评估
 *   2. 动手可及性评估
 *   3. 屏幕视觉描述
 *
 * 为什么需要这个端点
 * -----------------
 * 审计脚本是独立 Node 进程，无法读取服务端的 ARK_API_KEY。
 * 此前它直连 Ark API，要求用户额外配置密钥。
 * 本端点让审计脚本复用平台已有的 LLM 基础设施——
 * 审计脚本只需发 HTTP 请求，密钥由服务端注入。
 *
 * 安全
 * ----
 * 本端点不做鉴权——审计脚本是本地开发工具，不暴露给外部。
 * 但做了限流（audit 桶），防止误用刷爆 token。
 */

import { ARK_API_KEY_ENV, isArkApiKeyConfigured } from "@/lib/agent/ark-config";
import {
  ARK_DEFAULT_BASE_URL,
  ARK_DEFAULT_TEXT_MODEL,
  ARK_DEFAULT_VISION_MODEL,
} from "@/lib/agent/ark-config";
import { jsonError } from "@/lib/api-error";
import { clientKeyFrom, enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 评估请求体 */
interface EvaluateRequest {
  /** 评估类型：readability | doability | vision */
  type: "readability" | "doability" | "vision";
  /** 系统提示词 */
  systemPrompt: string;
  /** 用户消息（纯文本） */
  userContent: string;
  /** base64 图片（vision 类型需要） */
  imageBase64?: string;
  /** 模型名（可选，默认 deepseek-v4-flash-ga-260731） */
  model?: string;
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(clientKeyFrom(req), "audit");
  if (limited) return limited;

  if (!isArkApiKeyConfigured()) {
    return jsonError("LLM_ERROR", "LLM 服务未配置密钥。");
  }

  let body: EvaluateRequest;
  try {
    body = (await req.json()) as EvaluateRequest;
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  if (!body || !body.type || !body.systemPrompt || !body.userContent) {
    return jsonError(
      "INVALID_INPUT",
      "缺少 type / systemPrompt / userContent。",
    );
  }

  const apiKey = process.env[ARK_API_KEY_ENV];
  const baseUrl = process.env.ARK_BASE_URL ?? ARK_DEFAULT_BASE_URL;
  const model =
    body.model ??
    (body.type === "vision"
      ? ARK_DEFAULT_VISION_MODEL
      : ARK_DEFAULT_TEXT_MODEL);

  // 构建消息体
  let messages: Array<{ role: string; content: unknown }>;

  if (body.type === "vision" && body.imageBase64) {
    // 多模态：用户消息包含 base64 图片
    messages = [
      { role: "system", content: body.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: body.userContent },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${body.imageBase64}`,
              detail: "auto" as const,
            },
          },
        ],
      },
    ];
  } else {
    // 纯文本
    messages = [
      { role: "system", content: body.systemPrompt },
      { role: "user", content: body.userContent },
    ];
  }

  // 调用 Ark API
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: body.type === "vision" ? 512 : 600,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return jsonError(
        "LLM_ERROR",
        `LLM 请求失败 (${res.status}): ${errText.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError("LLM_ERROR", `LLM 调用异常: ${String(err).slice(0, 200)}`);
  }
}
