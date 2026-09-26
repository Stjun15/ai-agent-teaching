/**
 * Composer 发送链路 —— moduleId 携带断言
 *
 * 钉什么
 * -----
 * 学生通过输入框发送的每一轮消息（不仅是「开始对聊」那条），
 * 请求体里都必须携带 `moduleId`。丢失它会导致后端读不到概念页，
 * AI 失去教学脚本上下文 —— 对话断片。
 *
 * 方式
 * ----
 * Mock `fetch`，渲染 Composer，模拟打字 + 点击发送，
 * 断言 fetch 收到的请求体含 `moduleId` 与 `step`。
 *
 * 不调模型。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createElement } from "react";
import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

import { Composer } from "@/components/chat/composer";
import { useSessionStore } from "@/stores";

// ---------------------------------------------------------------------------
// 共享状态复位 & fetch 拦截
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  body: Record<string, unknown>;
}

let fetchCalls: FetchCall[] = [];

beforeEach(() => {
  fetchCalls = [];

  globalThis.fetch = (async (url, init) => {
    const body = init?.body
      ? (JSON.parse(init.body as string) as Record<string, unknown>)
      : {};
    fetchCalls.push({ url: String(url), body });

    return new Response(
      'data: {"type":"done","data":{"messageId":"test","tokens":{"input":0,"output":0}}}\n\n',
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }) as typeof globalThis.fetch;

  useSessionStore.setState({
    messages: [],
    status: "idle",
    activeModuleId: "python-basics",
  });
});

afterEach(() => {
  cleanup();
  useSessionStore.setState({ messages: [], status: "idle" });
});

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

test("发送消息时请求体携带 moduleId 与 step", async () => {
  await act(async () => {
    render(
      createElement(Composer, {
        moduleId: "python-basics",
        step: "explain",
      }),
    );
  });

  // 找到输入框并键入内容
  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  await act(async () => {
    fireEvent.change(textarea, { target: { value: "偷懒版" } });
  });

  // 点击发送按钮
  const sendBtn = screen.getByText("发送").closest("button");
  assert.ok(sendBtn, "发送按钮应存在");

  await act(async () => {
    fireEvent.click(sendBtn);
  });

  // 等待异步 send 返回
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  assert.equal(fetchCalls.length, 1, "应发送一次请求");
  assert.equal(
    fetchCalls[0].body.moduleId,
    "python-basics",
    "请求体应含 moduleId",
  );
  assert.equal(fetchCalls[0].body.step, "explain", "请求体应含 step");
  assert.equal(fetchCalls[0].body.content, "偷懒版", "请求体应含用户输入");
});

test("不带 moduleId 的 Composer 不发送该字段", async () => {
  await act(async () => {
    render(createElement(Composer, {}));
  });

  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  await act(async () => {
    fireEvent.change(textarea, { target: { value: "你好" } });
  });

  const sendBtn = screen.getByText("发送").closest("button");
  assert.ok(sendBtn, "发送按钮应存在");

  await act(async () => {
    fireEvent.click(sendBtn);
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  assert.equal(fetchCalls.length, 1);
  assert.ok(
    !("moduleId" in (fetchCalls[0].body as Record<string, unknown>)),
    "不带 moduleId 的 Composer 不应发送该字段",
  );
});

// ---------------------------------------------------------------------------
// ② Enter 键发送
// ---------------------------------------------------------------------------

test("按 Enter 键（不含 Shift）发送消息，请求体携带 moduleId 与 step", async () => {
  await act(async () => {
    render(
      createElement(Composer, {
        moduleId: "python-basics",
        step: "explain",
      }),
    );
  });

  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  await act(async () => {
    fireEvent.change(textarea, { target: { value: "偷懒版" } });
    fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
      shiftKey: false,
    });
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  assert.equal(fetchCalls.length, 1, "Enter 应触发一次发送");
  assert.equal(fetchCalls[0].body.moduleId, "python-basics");
  assert.equal(fetchCalls[0].body.step, "explain");
  assert.equal(fetchCalls[0].body.content, "偷懒版");
});

// ---------------------------------------------------------------------------
// ③ 流控 —— 发送中不可重复
// ---------------------------------------------------------------------------

test("流控：发送中重复点击不会发出第二次请求", async () => {
  // 替换 fetch 为永不 resolve 的版本，让第一次 send 一直「在路上」
  let resolveFetch: () => void = () => {};
  const hangingFetch = (async (url: unknown, init: unknown) => {
    const body =
      init && typeof init === "object" && "body" in init
        ? (JSON.parse((init as RequestInit).body as string) as Record<
            string,
            unknown
          >)
        : {};
    fetchCalls.push({ url: String(url), body });
    const signal = (init as RequestInit)?.signal;
    return new Promise<Response>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      signal?.addEventListener("abort", onAbort);
      resolveFetch = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve(
          new Response(
            'data: {"type":"done","data":{"messageId":"test","tokens":{"input":0,"output":0}}}\n\n',
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          ),
        );
      };
    });
  }) as typeof globalThis.fetch;

  globalThis.fetch = hangingFetch;

  await act(async () => {
    render(
      createElement(Composer, {
        moduleId: "python-basics",
        step: "explain",
      }),
    );
  });

  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  // 第一次发送
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "第一条" } });
  });

  const sendBtn = screen.getByText("发送").closest("button")!;

  await act(async () => {
    fireEvent.click(sendBtn);
  });

  // 第二次：重新输入并再次点击（仍在流中）
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "第二条" } });
    fireEvent.click(sendBtn);
  });

  // 释放 fetch，让第一次 send 完成
  resolveFetch();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  assert.equal(fetchCalls.length, 1, "发送中重复点击不应发出第二次请求");
});

// ---------------------------------------------------------------------------
// ⑦ Abort —— 停止后可再次发送
// ---------------------------------------------------------------------------

test("点击停止后可再次发送消息", async () => {
  // 替换 fetch 为信号感知的悬挂版本（本用例只测「停止后可再发」，
  // 不需要手动放行悬挂请求，故不保留 resolveFetch 句柄。

  const abortableFetch = (async (url: unknown, init: unknown) => {
    const body =
      init && typeof init === "object" && "body" in init
        ? (JSON.parse((init as RequestInit).body as string) as Record<
            string,
            unknown
          >)
        : {};
    fetchCalls.push({ url: String(url), body });
    const signal = (init as RequestInit)?.signal;

    return new Promise<Response>((_resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      signal?.addEventListener("abort", onAbort);
      // 悬挂 Promise 不 resolve：本用例靠「停止」按钮的 abort 走
      // reject 路径收尾（句柄已按上方注释移除）。
    });
  }) as typeof globalThis.fetch;

  globalThis.fetch = abortableFetch;

  await act(async () => {
    render(
      createElement(Composer, {
        moduleId: "python-basics",
        step: "explain",
      }),
    );
  });

  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  // 第一次发送
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "第一条" } });
  });

  const sendBtn = screen.getByText("发送").closest("button")!;
  await act(async () => {
    fireEvent.click(sendBtn);
  });

  // 等待 streaming 开始，"发送"变成"停止"
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  // 点击停止（此时按钮文字是"停止"）
  const stopBtn = screen.getByText("停止").closest("button");
  assert.ok(stopBtn, "流式输出中应显示停止按钮");

  await act(async () => {
    fireEvent.click(stopBtn);
  });

  // 等待 abort 处理完（failTurn + activeController 归零）
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  // 恢复正常 fetch，准备第二次发送
  fetchCalls.length = 0;
  globalThis.fetch = (async (url, init) => {
    const body = init?.body
      ? (JSON.parse(init.body as string) as Record<string, unknown>)
      : {};
    fetchCalls.push({ url: String(url), body });
    return new Response(
      'data: {"type":"done","data":{"messageId":"test","tokens":{"input":0,"output":0}}}\n\n',
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }) as typeof globalThis.fetch;

  // 第二次发送
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "第二条" } });
  });

  const sendBtn2 = screen.getByText("发送").closest("button")!;
  await act(async () => {
    fireEvent.click(sendBtn2);
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  assert.equal(fetchCalls.length, 1, "停止后第二次发送应成功");
  assert.equal(fetchCalls[0].body.content, "第二条");
  assert.equal(fetchCalls[0].body.moduleId, "python-basics");
});
