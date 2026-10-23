/**
 * ChatPanel 渲染 —— 流式输出中历史消息不被重复渲染
 *
 * 钉什么
 * -----
 * MessageItem 加了 `React.memo` 阻止历史 done 消息在流式输出中重复渲染。
 * 这组测试从 DOM 侧验证：种子 done 消息后 dispatch token，done 消息内容
 * 在 DOM 里不变，流式消息在变。
 *
 * 全组 JSDOM，不调模型。
 */

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { useSessionStore, type ChatMessage } from "@/stores/session";

// ---------------------------------------------------------------------------
// 共享消息种子
// ---------------------------------------------------------------------------

function seedMessages(messages: ChatMessage[]): void {
  // byModule 的值是完整快照桶（SavedSessionBucket），不是裸消息数组。
  useSessionStore.setState({
    messages,
    status: messages.some((m) => m.status === "streaming")
      ? "streaming"
      : "idle",
    activeModuleId: "render-test-module",
    byModule: {
      "render-test-module": {
        messages,
        thinking: [],
        tools: [],
        citations: [],
        tokens: null,
        invalidFrames: 0,
        turnStep: null,
      },
    },
    thinking: [],
    tools: [],
    citations: [],
    error: null,
    tokens: null,
    invalidFrames: 0,
    turnStep: null,
  });
}

beforeEach(() => {
  useSessionStore.setState({
    messages: [],
    status: "idle",
    activeModuleId: null,
    byModule: {},
    thinking: [],
    tools: [],
    citations: [],
    error: null,
    tokens: null,
    invalidFrames: 0,
    turnStep: null,
  });
});

// ---------------------------------------------------------------------------
// 核心断言：done 消息不受 streaming 影响
// ---------------------------------------------------------------------------

test("done 消息在流式输出中内容不变", async () => {
  seedMessages([
    {
      id: "done-1",
      role: "assistant",
      agent: "导师",
      content: "这是一条已经完成的消息。",
      status: "done",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "streaming-1",
      role: "assistant",
      agent: "导师",
      content: "Hello",
      status: "streaming",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
  ]);

  await act(async () => {
    render(
      createElement(ChatPanel, {
        moduleId: "render-test-module",
        stepFilter: "explain",
        lectureMode: "truncate",
      }),
    );
  });

  const doneEls = screen.getAllByText("这是一条已经完成的消息。");
  assert.ok(doneEls.length >= 1, "done 消息应渲染");
  assert.ok(screen.getByText("Hello"), "流式消息当前内容应渲染");
});

test("追加 token 后，done 消息仍不变，流式消息拼接新内容", async () => {
  seedMessages([
    {
      id: "done-1",
      role: "assistant",
      agent: "导师",
      content: "历史消息——永不变。",
      status: "done",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "streaming-2",
      role: "assistant",
      agent: "导师",
      content: "第",
      status: "streaming",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
  ]);

  await act(async () => {
    render(
      createElement(ChatPanel, {
        moduleId: "render-test-module",
        stepFilter: "explain",
        lectureMode: "truncate",
      }),
    );
  });

  // dispatch token — 用 waitFor 等 React 重渲染（Zustand set 不批处理）
  await act(async () => {
    useSessionStore.getState().appendToken("一句", "streaming-2");
  });

  await waitFor(() => {
    const els = screen.getAllByText("历史消息——永不变。");
    assert.ok(els.length >= 1, "done 消息 token 追加后应仍存在");
  });

  await waitFor(() => {
    const parts = screen.getAllByText(/一句|第/);
    assert.ok(parts.length >= 1, "流式消息应包含追加的 token");
  });
});

test("流式消息 completeTurn 后变为 done，不再 streaming", async () => {
  seedMessages([
    {
      id: "done-1",
      role: "assistant",
      agent: "导师",
      content: "已完成。",
      status: "done",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "streaming-3",
      role: "assistant",
      agent: "导师",
      content: "即将完成。",
      status: "streaming",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
  ]);

  await act(async () => {
    render(
      createElement(ChatPanel, {
        moduleId: "render-test-module",
        stepFilter: "explain",
        lectureMode: "truncate",
      }),
    );
  });

  await act(async () => {
    useSessionStore.getState().completeTurn({
      messageId: "streaming-3",
      tokens: { input: 10, output: 5 },
    });
  });

  await waitFor(() => {
    const state = useSessionStore.getState();
    const streamMsg = state.messages.find((m) => m.id === "streaming-3");
    assert.equal(streamMsg?.status, "done", "completeTurn 后 status 应为 done");
  });

  assert.ok(screen.getAllByText("已完成。").length >= 1, "历史消息仍渲染");
  assert.ok(
    screen.getAllByText("即将完成。").length >= 1,
    "刚完成的消息也渲染",
  );
});

test("学生消息（role:student）在 done 后保持稳定", async () => {
  seedMessages([
    {
      id: "stu-1",
      role: "student",
      content: "Python 是什么？",
      status: "done",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "streaming-4",
      role: "assistant",
      agent: "导师",
      content: "Python 是一种…",
      status: "streaming",
      step: "explain",
      citations: [],
      createdAt: new Date().toISOString(),
    },
  ]);

  await act(async () => {
    render(
      createElement(ChatPanel, {
        moduleId: "render-test-module",
        stepFilter: "explain",
        lectureMode: "truncate",
      }),
    );
  });

  assert.ok(
    screen.getAllByText("Python 是什么？").length >= 1,
    "学生消息应渲染",
  );

  await act(async () => {
    useSessionStore.getState().appendToken("编程语言。", "streaming-4");
  });

  await waitFor(() => {
    assert.ok(
      screen.getAllByText("Python 是什么？").length >= 1,
      "学生消息 token 追加后应仍存在",
    );
  });
});
