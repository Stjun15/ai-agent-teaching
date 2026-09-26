/**
 * useChatStream.send —— silent 与历史构建
 *
 * 钉什么
 * -----
 * 1. `silent: true` 的消息不落库（不插入学生消息、不构建历史）。
 *    冷启动那句「我已阅读完…」就是 silent，它不该出现在对话历史里。
 * 2. 普通消息正常落库。
 * 3. 不带 `silent` 的消息会构建历史（最近 10 条）。
 *
 * 不调模型。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createElement, useEffect, useRef } from "react";
import { act } from "react";
import { cleanup, render } from "@testing-library/react";

import { useChatStream } from "@/hooks/useChatStream";
import { useSessionStore } from "@/stores";

// ---------------------------------------------------------------------------
// 共享状态复位 & fetch 拦截
// ---------------------------------------------------------------------------

let fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

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
// 测试用组件
// ---------------------------------------------------------------------------

type SendFn = ReturnType<typeof useChatStream>["send"];

function TestSender({ onMount }: { onMount: (send: SendFn) => void }) {
  const { send } = useChatStream();
  const called = useRef(false);
  useEffect(() => {
    if (!called.current) {
      called.current = true;
      onMount(send);
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

test("silent:true 的消息不插入学生消息", async () => {
  let capturedSend: SendFn | undefined;

  await act(async () => {
    render(
      createElement(TestSender, {
        onMount: (s) => {
          capturedSend = s;
        },
      }),
    );
  });

  assert.ok(capturedSend);

  await act(async () => {
    await capturedSend!(
      { content: "我已阅读完概念内容", moduleId: "python-basics" },
      { silent: true, moduleId: "python-basics" },
    );
  });

  const state = useSessionStore.getState();
  const studentMsgs = state.messages.filter((m) => m.role === "student");
  assert.equal(studentMsgs.length, 0, "silent:true 不应插入学生消息");
});

test("普通消息（非 silent）正常插入学生消息", async () => {
  let capturedSend: SendFn | undefined;

  await act(async () => {
    render(
      createElement(TestSender, {
        onMount: (s) => {
          capturedSend = s;
        },
      }),
    );
  });

  assert.ok(capturedSend);

  await act(async () => {
    await capturedSend!(
      { content: "偷懒版", step: "explain", moduleId: "python-basics" },
      { moduleId: "python-basics" },
    );
  });

  const state = useSessionStore.getState();
  const studentMsgs = state.messages.filter((m) => m.role === "student");
  assert.equal(studentMsgs.length, 1, "普通消息应插入一条学生消息");
  assert.equal(studentMsgs[0].content, "偷懒版");
});

test("silent:true 不构建历史 / 不发送 history 字段", async () => {
  // 先发一条普通消息建立历史
  let capturedSend: SendFn | undefined;

  await act(async () => {
    render(
      createElement(TestSender, {
        onMount: (s) => {
          capturedSend = s;
        },
      }),
    );
  });

  assert.ok(capturedSend);

  // 第一条：普通消息
  await act(async () => {
    await capturedSend!(
      { content: "你好", moduleId: "python-basics" },
      { moduleId: "python-basics" },
    );
  });

  fetchCalls.length = 0;

  // 第二条：silent
  await act(async () => {
    await capturedSend!(
      { content: "我已阅读完", moduleId: "python-basics" },
      { silent: true, moduleId: "python-basics" },
    );
  });

  assert.equal(fetchCalls.length, 1, "应发送一次请求");
  assert.ok(
    !("history" in (fetchCalls[0].body as Record<string, unknown>)),
    "silent 消息不应携带 history 字段",
  );
});

test("非 silent 消息构建并发送历史", async () => {
  let capturedSend: SendFn | undefined;

  await act(async () => {
    render(
      createElement(TestSender, {
        onMount: (s) => {
          capturedSend = s;
        },
      }),
    );
  });

  assert.ok(capturedSend);

  // 第一条消息（带 step 以便历史过滤匹配）
  await act(async () => {
    await capturedSend!(
      { content: "你好", step: "explain", moduleId: "python-basics" },
      { moduleId: "python-basics" },
    );
  });

  fetchCalls.length = 0;

  // 第二条：非 silent，应带历史（包含上一条 step="explain" 的消息）
  await act(async () => {
    await capturedSend!(
      { content: "什么是变量？", step: "explain", moduleId: "python-basics" },
      { moduleId: "python-basics" },
    );
  });

  assert.equal(fetchCalls.length, 1);
  const body = fetchCalls[0].body as Record<string, unknown>;
  assert.ok("history" in body, "非 silent 消息应带 history");
  const history = body.history as Array<{ role: string; content: string }>;
  assert.ok(history.length >= 1, "历史应至少包含一条");
});
