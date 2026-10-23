/**
 * 模块会话隔离 —— ensureModule
 *
 * 钉什么
 * -----
 * 切换模块时 `ensureModule` 必须清空上一模块的对话消息。
 * 跨模块的讲稿/问答不允许串台：从 rag 切到 ts-basics
 * 时，学生不该看到上一模块的讲稿。
 *
 * 全组不调模型。
 */

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

/** 测试种子用的消息工厂：补齐 ChatMessage 的必填字段。 */
function msg(
  overrides: Partial<ChatMessage> &
    Pick<ChatMessage, "role" | "content" | "step">,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    status: "done",
    citations: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

import type { ChatMessage } from "@/stores";
import { useSessionStore } from "@/stores";

// ---------------------------------------------------------------------------
// 共享状态复位
// ---------------------------------------------------------------------------

function resetSessionStore(): void {
  useSessionStore.setState({
    messages: [],
    thinking: [],
    tools: [],
    citations: [],
    status: "idle",
    error: null,
    tokens: null,
    invalidFrames: 0,
    turnStep: null,
    activeModuleId: null,
    byModule: {},
  });
}

beforeEach(() => {
  resetSessionStore();
});

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

test("ensureModule：首次进入模块，清空消息", () => {
  useSessionStore.setState({
    messages: [
      msg({ role: "student", content: "你好", step: "explain" }),
      msg({ role: "assistant", content: "你好！", step: "explain" }),
    ],
  });

  useSessionStore.getState().ensureModule("ts-basics");

  const state = useSessionStore.getState();
  assert.equal(state.activeModuleId, "ts-basics");
  assert.equal(state.messages.length, 0, "进入新模块应清空消息");
});

test("ensureModule：切换到不同模块，清空旧模块消息", () => {
  useSessionStore.setState({
    messages: [
      msg({ role: "student", content: "RAG 是什么？", step: "explain" }),
      msg({
        role: "assistant",
        content: "RAG 是检索增强生成",
        step: "explain",
      }),
    ],
    activeModuleId: "rag",
  });

  useSessionStore.getState().ensureModule("ts-basics");

  const state = useSessionStore.getState();
  assert.equal(state.activeModuleId, "ts-basics");
  assert.equal(state.messages.length, 0, "切到不同模块应清空消息");
});

test("ensureModule：重复进入同一模块，不清空消息", () => {
  const msgs = [
    msg({ role: "student", content: "你好", step: "explain" }),
    msg({ role: "assistant", content: "你好！", step: "explain" }),
  ];

  useSessionStore.setState({
    messages: msgs,
    activeModuleId: "ts-basics",
  });

  useSessionStore.getState().ensureModule("ts-basics");

  const state = useSessionStore.getState();
  assert.equal(state.activeModuleId, "ts-basics");
  assert.equal(state.messages.length, 2, "重复进入同一模块应保留消息");
});

test("ensureModule：无 moduleId 时清空隔离态（演练场）", () => {
  useSessionStore.setState({
    messages: [
      msg({ role: "student", content: "你好", step: "explain" }),
      msg({ role: "assistant", content: "你好！", step: "explain" }),
    ],
    activeModuleId: "ts-basics",
  });

  // null = 退出模块，进入演练场
  useSessionStore.getState().ensureModule(null as unknown as string);

  const state = useSessionStore.getState();
  assert.equal(state.activeModuleId, null);
  assert.equal(state.messages.length, 0);
});
