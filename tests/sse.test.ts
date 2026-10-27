import { afterEach, describe, expect, it, vi } from "vitest";

import { handleSSE, isAbortError, SSEHttpError } from "@/lib/sse";

const encoder = new TextEncoder();

/** 把若干字符串/字节块拼成一个只读流，模拟服务端分块下发。 */
function streamOf(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === "string" ? encoder.encode(chunk) : chunk,
        );
      }
      controller.close();
    },
  });
}

/** 用给定响应替换全局 fetch，并返回收集到的事件列表。 */
async function run(
  response: Response,
  options?: Parameters<typeof handleSSE>[3],
): Promise<unknown[]> {
  vi.stubGlobal("fetch", vi.fn(async () => response));
  const events: unknown[] = [];
  await handleSSE("/api/chat", { message: "hi" }, (event) => {
    events.push(event);
  }, options);
  return events;
}

const tokenFrame = (content: string, messageId: string): string =>
  `data: ${JSON.stringify({ type: "token", data: { content, messageId } })}\n\n`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleSSE 帧分发", () => {
  it("逐帧解析并派发合法事件", async () => {
    const events = await run(
      new Response(
        streamOf(["data: ", JSON.stringify({ type: "token", data: { content: "你", messageId: "m1" } }), "\n\n"]),
      ),
    );
    expect(events).toEqual([{ type: "token", data: { content: "你", messageId: "m1" } }]);
  });

  // 一个中文字被两个 chunk 切开时，TextDecoder 必须带 stream:true 才不会乱码。
  it("跨 chunk 切断多字节字符仍能正确解码", async () => {
    const frame = tokenFrame("中文字符", "m2");
    const bytes = encoder.encode(frame);
    const cut = 12; // 落在汉字内部
    const events = await run(
      new Response(streamOf([bytes.slice(0, cut), bytes.slice(cut)])),
    );
    expect(events).toEqual([
      { type: "token", data: { content: "中文字符", messageId: "m2" } },
    ]);
  });

  it("流结束时残留的未收尾帧仍被解析", async () => {
    const events = await run(
      new Response(streamOf([tokenFrame("尾", "m3").trimEnd()])),
    );
    expect(events).toEqual([{ type: "token", data: { content: "尾", messageId: "m3" } }]);
  });

  it("注释行、event:/id:/retry: 与 [DONE] 哨兵一律跳过", async () => {
    const body =
      ": 心跳\n\n" +
      "event: token\nid: 7\nretry: 1000\n\n" +
      "data: [DONE]\n\n" +
      tokenFrame("留下的", "m4");
    const events = await run(new Response(streamOf([body])));
    expect(events).toEqual([
      { type: "token", data: { content: "留下的", messageId: "m4" } },
    ]);
  });

  it("非法 JSON 交给 onInvalidFrame，且不带 ZodError", async () => {
    const invalid: Array<{ raw: string; error?: unknown }> = [];
    const events = await run(
      new Response(streamOf(["data: {坏掉的 JSON\n\n", tokenFrame("后续", "m5")])),
      { onInvalidFrame: (raw, error) => invalid.push({ raw, error }) },
    );
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.raw).toBe("{坏掉的 JSON");
    expect(invalid[0]?.error).toBeUndefined();
    expect(events).toHaveLength(1);
  });

  it("形状不符协议的帧交给 onInvalidFrame 并附 ZodError", async () => {
    const invalid: Array<{ raw: string; error?: { issues?: unknown } }> = [];
    const events = await run(
      new Response(streamOf([`data: ${JSON.stringify({ type: "nope" })}\n\n`])),
      { onInvalidFrame: (raw, error) => invalid.push({ raw, error }) },
    );
    expect(events).toHaveLength(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.error?.issues).toBeDefined();
  });

  it("不传 onInvalidFrame 时静默丢弃损坏帧，不抛异常", async () => {
    const events = await run(
      new Response(streamOf(["data: 坏帧\n\n", tokenFrame("好帧", "m6")])),
    );
    expect(events).toHaveLength(1);
  });
});

describe("handleSSE 失败路径", () => {
  it("非 2xx + 结构化错误体 → 带协议码与可恢复性的 SSEHttpError", async () => {
    const response = new Response(
      JSON.stringify({
        error: { code: "RATE_LIMIT", message: "太快了", recoverable: true },
      }),
      { status: 429 },
    );
    vi.stubGlobal("fetch", vi.fn(async () => response));

    const error = await handleSSE("/api/chat", {}, () => {}).catch((e) => e);
    expect(error).toBeInstanceOf(SSEHttpError);
    expect(error).toMatchObject({
      status: 429,
      code: "RATE_LIMIT",
      message: "太快了",
      recoverable: true,
    });
  });

  it("非 2xx + 非协议形状的正文 → 按状态码兜底并保留截断正文", async () => {
    const raw = "x".repeat(400);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(raw, { status: 504 })),
    );

    const error = await handleSSE("/api/chat", {}, () => {}).catch((e) => e);
    expect(error).toMatchObject({ status: 504, code: "TIMEOUT" });
    expect((error as SSEHttpError).message).toHaveLength(300);
  });

  it("空正文 → 状态码映射到协议表里的码，不自造码", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const error = await handleSSE("/api/chat", {}, () => {}).catch((e) => e);
    expect(error).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("2xx 却没有可读主体 → LLM_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );

    const error = await handleSSE("/api/chat", {}, () => {}).catch((e) => e);
    expect(error).toMatchObject({ code: "LLM_ERROR", recoverable: true });
  });

  it("主动中断的 AbortError 原样抛出，交给调用方判断", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    );

    const error = await handleSSE("/api/chat", {}, () => {}).catch((e) => e);
    expect(isAbortError(error)).toBe(true);
  });
});

describe("isAbortError", () => {
  it("只认 AbortError，普通 Error 不算", () => {
    expect(isAbortError(new DOMException("stop", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });
});
