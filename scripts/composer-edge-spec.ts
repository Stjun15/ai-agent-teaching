/**
 * Composer 边缘用例 —— Enter/Shift-Enter + 空消息阻塞
 *
 * 已有 composer-module-id-spec 覆盖 moduleId/step/发送/流控/Abort，
 * 本组补齐剩余的键盘交互与输入校验。
 *
 * JSDOM 环境，不调模型。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createElement } from "react";
import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

import { Composer } from "@/components/chat/composer";
import { useSessionStore } from "@/stores";

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

  useSessionStore.setState({ messages: [], status: "idle" });
});

afterEach(() => {
  cleanup();
  useSessionStore.setState({ messages: [], status: "idle" });
});

// ---------------------------------------------------------------------------
// Shift+Enter 换行
// ---------------------------------------------------------------------------

test("Shift+Enter → 插入换行，不发送", async () => {
  await act(async () => {
    render(createElement(Composer, { moduleId: "ts-basics", step: "explain" }));
  });

  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  await act(async () => {
    fireEvent.change(textarea, { target: { value: "第一行" } });
  });

  // 模拟三行：光标在末尾，Shift+Enter
  await act(async () => {
    fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
      shiftKey: true,
    });
  });

  // React 的 fireEvent.keyDown 不会自动改 value，但浏览器里 Shift+Enter
  // 被放行后会插入 \n —— 我们手动拼上去模拟浏览器行为
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "第一行\n第二行" } });
  });

  // 断言：没有发出 fetch
  assert.equal(fetchCalls.length, 0, "Shift+Enter 不应触发发送");

  // 再按普通 Enter 发送：先手动拼第三行 \n，再 keyDown Enter
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "第一行\n第二行\n第三行" } });
    fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
      shiftKey: false,
    });
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  assert.equal(fetchCalls.length, 1, "普通 Enter 应触发发送");

  // 校验内容含换行符
  const content = (fetchCalls[0].body as { content: string }).content;
  assert.ok(content.includes("\n"), `发送内容应含换行符，实际: ${JSON.stringify(content)}`);
  assert.ok(content.includes("第一行"), `应含第一行，实际: ${content}`);
});

// ---------------------------------------------------------------------------
// 空消息阻塞
// ---------------------------------------------------------------------------

test("空字符串 → 禁用发送", async () => {
  await act(async () => {
    render(createElement(Composer, { moduleId: "ts-basics", step: "explain" }));
  });

  const sendBtn = screen.getByText("发送").closest("button")!;
  assert.equal(!!sendBtn.disabled, true, "空内容时发送按钮应 disabled");
});

test("仅空格 → 禁用发送", async () => {
  await act(async () => {
    render(createElement(Composer, { moduleId: "ts-basics", step: "explain" }));
  });

  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  await act(async () => {
    fireEvent.change(textarea, { target: { value: "   " } });
  });

  const sendBtn = screen.getByText("发送").closest("button")!;
  assert.equal(!!sendBtn.disabled, true, "仅空格时应 disabled");
});

// ---------------------------------------------------------------------------
// 有内容后可发送
// ---------------------------------------------------------------------------

test("非空白内容 → 启用发送", async () => {
  await act(async () => {
    render(createElement(Composer, { moduleId: "ts-basics", step: "explain" }));
  });

  const textarea = screen.getByPlaceholderText(
    /说说你的思路/,
  ) as HTMLTextAreaElement;

  await act(async () => {
    fireEvent.change(textarea, { target: { value: "你好" } });
  });

  const sendBtn = screen.getByText("发送").closest("button")!;
  assert.equal(!!sendBtn.disabled, false, "有内容时发送按钮应可点击");
});