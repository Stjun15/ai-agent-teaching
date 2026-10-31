/**
 * 图片评审管线 —— 截图/作品 → 多模态模型 → SSE 流
 *
 * 为什么独立于 loop.ts
 * -------------------
 * pi SDK 的 `session.prompt(text: string)` 只接受纯文本字符串，无法直接
 * 传递多模态 content array。即使 SDK 已在 `dashscope.ts` 注册了 `input: ["text", "image"]`
 * 的视觉模型，prompt 入口仍是文本型。
 *
 * 因此图片路径走独立管线：直接 HTTP fetch 调百练（DashScope）的多模态模型（OpenAI 兼容协议），
 * 把返回的 OpenAI SSE chunk 翻译成项目自己的 10 种 SSE 事件。
 * 两条管线的「流结构」完全一致 —— 前端不需要知道这次用的是文本模型还是视觉模型。
 *
 * 篇幅控制
 * -------
 * 教学场景的代码截图评审，500 字内足以覆盖核心问题。过长回复会稀释重点。
 */

import { DASHSCOPE_API_KEY_ENV, readDashScopeSettings } from "./dashscope-config";
import { createSSEStream, sseResponse } from "../sse-server";

/** 图片点评的系统提示词。只做教学点评，不做通用图片描述。 */
const VISION_SYSTEM_PROMPT = [
  "你是教学平台的代码截图 / 作品截图点评导师。",
  "学生可能发来代码截图、终端输出截图、UI 界面截图或项目作品截图，",
  "你需要以教学视角点评，而非简单地描述图片内容。",
  "",
  "准则：",
  "- 先判断截图类型：代码？终端？UI？作品？然后在点评开头明说。",
  "- 代码截图：指出可读性问题（命名、缩进、注释）、潜在 bug、优化建议。",
  "- 终端截图：解读报错信息，告诉学生错在哪里、为什么、怎么修。",
  "- UI 界面截图：点评布局、交互、视觉一致性，给具体改进建议。",
  "- 作品截图：先肯定完成度，再逐项给出进阶建议。",
  "- 用简体中文，语气亲切但专业，不嘲讽、不空洞夸赞。",
  "- 每个问题给出「怎么改」的具体方向，而非只说「这里有问题」。",
  "- 控制在 500 字以内，重点突出，不说废话。",
].join("\n");

/** 单张图片的展示格式。输入接受 data URL 或纯 base64。 */
export interface VisionImage {
  /** data URL（如 `data:image/png;base64,...`）或纯 base64。 */
  data: string;
  /** 可选的文件名，仅用于日志/调试。 */
  name?: string;
}

/** 把图片转成 OpenAI vision content block。 */
function toImageContentBlock(image: VisionImage): {
  type: "image_url";
  image_url: { url: string; detail?: "auto" };
} {
  const url = image.data.startsWith("data:")
    ? image.data
    : `data:image/png;base64,${image.data}`;
  return { type: "image_url", image_url: { url, detail: "auto" } };
}

/**
 * 跑一轮图片评审。
 *
 * @param prompt 学生随图片一同发送的文字说明。
 * @param images 图片列表（最多 3 张）。
 * @param signal 客户端断开时中止。
 * @returns 可直接交给 Route Handler 的 SSE Response。
 */
export async function runVisionReview(
  prompt: string,
  images: readonly VisionImage[],
  signal?: AbortSignal,
): Promise<Response> {
  const { baseUrl, visionModel } = readDashScopeSettings();
  const apiKey = process.env[DASHSCOPE_API_KEY_ENV];

  if (!apiKey) {
    return jsonErrorResponse("LLM_ERROR", "视觉模型密钥未配置。");
  }

  const sse = createSSEStream();

  const messageId = crypto.randomUUID();
  const contentBlocks: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "auto" } }
  > = [{ type: "text", text: prompt }];

  for (const image of images) {
    contentBlocks.push(toImageContentBlock(image));
  }

  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) {
      sse.send({
        type: "error",
        data: {
          code: "LLM_ERROR",
          message: "请求已被客户端中止。",
          recoverable: true,
        },
      });
      sse.close();
      return sseResponse(sse.stream);
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  void (async () => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            { role: "system", content: VISION_SYSTEM_PROMPT },
            { role: "user", content: contentBlocks },
          ],
          stream: true,
          // 百炼的 deepseek-v4.1-flash 会先吐一段 reasoning_content 再吐正文，
          // 上限给得太紧时推理可能把额度吃光、正文一个字都不剩（1024 与 2048 都实测出现过空回复）。
          // 4096 留足推理 + 500 字点评的空间；上限不决定实际输出长度，只抬高天花板。
          max_tokens: 4096,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        sse.close();
        return;
      }
      sse.send({
        type: "error",
        data: {
          code: "LLM_ERROR",
          message:
            error instanceof Error ? error.message : "视觉模型请求失败。",
          recoverable: true,
        },
      });
      sse.close();
      return;
    }

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as Record<string, unknown>;
        detail =
          typeof body.error === "object" && body.error !== null
            ? String(
                (body.error as Record<string, unknown>).message ??
                  JSON.stringify(body.error),
              )
            : JSON.stringify(body);
      } catch {
        detail = `HTTP ${response.status}`;
      }
      sse.send({
        type: "error",
        data: {
          code: "LLM_ERROR",
          message: `视觉模型返回错误：${detail}`,
          recoverable: true,
        },
      });
      sse.close();
      return;
    }

    try {
      const reader = response.body?.getReader();
      if (!reader) {
        sse.send({
          type: "error",
          data: {
            code: "LLM_ERROR",
            message: "视觉模型返回了空响应体。",
            recoverable: true,
          },
        });
        sse.close();
        return;
      }

      const decoder = new TextDecoder();
      let totalText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens: number; completion_tokens: number };
            };

            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              totalText += delta;
              sse.send({
                type: "token",
                data: { content: delta, messageId },
              });
            }
          } catch {
            // 畸形的帧跳过，不影响整体流。
          }
        }
      }

      sse.send({
        type: "done",
        data: {
          messageId,
          tokens: { input: 0, output: 0 },
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        sse.close();
        return;
      }
      sse.send({
        type: "error",
        data: {
          code: "LLM_ERROR",
          message:
            error instanceof Error ? error.message : "视觉模型流读取失败。",
          recoverable: true,
        },
      });
    } finally {
      sse.close();
    }
  })();

  return sseResponse(sse.stream);
}

/** 非流式场景下的错误响应。 */
function jsonErrorResponse(code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message, recoverable: true }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
