/**
 * FloatingChatStore —— 悬浮球对话的状态操作
 *
 * 纯 Zustand store，不调模型、不碰 DOM。
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { useFloatingChatStore } from "@/stores/floating-chat";

function reset() {
  useFloatingChatStore.setState({
    sessions: {},
    sessionOrder: [],
    activeSessionId: null,
    status: "idle",
    errorMessage: null,
  });
}

afterEach(reset);

// ── createSession ──────────────────────────────────────

test("createSession → 新建会话 + 设为活跃", () => {
  const id = useFloatingChatStore.getState().createSession();
  const state = useFloatingChatStore.getState();

  assert.equal(state.activeSessionId, id);
  assert.ok(state.sessions[id]);
  assert.equal(state.sessions[id].title, "新对话");
  assert.deepEqual(state.sessions[id].messages, []);
  assert.equal(state.sessionOrder[0], id);
});

// ── ensureSession ─────────────────────────────────────

test("ensureSession：已有活跃会话 → 复用", () => {
  const first = useFloatingChatStore.getState().createSession();
  const second = useFloatingChatStore.getState().ensureSession();

  assert.equal(second, first);
});

test("ensureSession：无活跃会话 → 自动创建", () => {
  const id = useFloatingChatStore.getState().ensureSession();
  assert.ok(id);
  assert.ok(useFloatingChatStore.getState().sessions[id]);
});

// ── switchSession ─────────────────────────────────────

test("switchSession → 切换活跃会话并重置状态", () => {
  const s1 = useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().createSession();

  useFloatingChatStore.setState({ status: "error", errorMessage: "oops" });
  useFloatingChatStore.getState().switchSession(s1);

  const state = useFloatingChatStore.getState();
  assert.equal(state.activeSessionId, s1);
  assert.equal(state.status, "idle");
  assert.equal(state.errorMessage, null);
});

test("switchSession：不存在的 id → 不动", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().switchSession("nonexistent");

  assert.ok(useFloatingChatStore.getState().activeSessionId);
});

// ── deleteSession ─────────────────────────────────────

test("deleteSession → 删除会话 + 清理顺序列表", () => {
  const s1 = useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().createSession();

  useFloatingChatStore.getState().deleteSession(s1);

  const state = useFloatingChatStore.getState();
  assert.equal(state.sessions[s1], undefined);
  assert.ok(!state.sessionOrder.includes(s1));
});

test("删除的是活跃会话 → activeSessionId 顺延到下一个", () => {
  const s1 = useFloatingChatStore.getState().createSession();
  const s2 = useFloatingChatStore.getState().createSession();

  // s2 当前活跃，删掉它 → 应回到 s1
  useFloatingChatStore.getState().deleteSession(s2);

  assert.equal(useFloatingChatStore.getState().activeSessionId, s1);
});

test("删掉唯一的会话 → activeSessionId 为 null", () => {
  const s1 = useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().deleteSession(s1);

  assert.equal(useFloatingChatStore.getState().activeSessionId, null);
});

// ── beginTurn ─────────────────────────────────────────

test("beginTurn → 插入学生消息 + 状态转 streaming", () => {
  useFloatingChatStore.getState().createSession();
  const msgId = useFloatingChatStore.getState().beginTurn("什么是闭包？");

  const state = useFloatingChatStore.getState();
  assert.equal(state.status, "streaming");

  const messages = state.sessions[state.activeSessionId!].messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, msgId);
  assert.equal(messages[0].role, "student");
  assert.equal(messages[0].content, "什么是闭包？");
  assert.equal(messages[0].status, "done");
});

test("第一条 beginTurn 自动生成标题（取前 30 字）", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");

  const session = useFloatingChatStore
    .getState()
    .sessions[useFloatingChatStore.getState().activeSessionId!];
  assert.equal(session.title.length, 30);
});

test("非第一条 beginTurn 不覆盖标题", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("第一句标题");
  useFloatingChatStore.getState().completeTurn("ignored");

  const titleBefore = useFloatingChatStore
    .getState()
    .sessions[useFloatingChatStore.getState().activeSessionId!].title;

  useFloatingChatStore.getState().beginTurn("第二句不应改标题");
  const titleAfter = useFloatingChatStore
    .getState()
    .sessions[useFloatingChatStore.getState().activeSessionId!].title;

  assert.equal(titleAfter, titleBefore);
});

// ── appendToken ───────────────────────────────────────

test("appendToken：存在流式助手 → 追加到现有消息", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("Q");

  // 手动插入一个流式助手（模拟 dispatch 在 beginTurn 后创建）
  const sessionId = useFloatingChatStore.getState().activeSessionId!;
  const streamingMsgId = "assist_1";
  useFloatingChatStore.setState((s) => ({
    sessions: {
      ...s.sessions,
      [sessionId]: {
        ...s.sessions[sessionId],
        messages: [
          ...s.sessions[sessionId].messages,
          { id: streamingMsgId, role: "assistant" as const, content: "", status: "streaming" as const, createdAt: new Date().toISOString() },
        ],
      },
    },
  }));

  useFloatingChatStore.getState().appendToken("你好", "ignored");
  useFloatingChatStore.getState().appendToken("世界", "ignored");

  const messages = useFloatingChatStore
    .getState()
    .sessions[sessionId].messages;
  const assistant = messages.find((m) => m.id === streamingMsgId);
  assert.ok(assistant);
  assert.equal(assistant.content, "你好世界");
});

test("appendToken：无流式助手 → 新建一条流式消息", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("Q");

  // 先结束流（清掉流式助手）
  useFloatingChatStore.setState({ status: "idle" });

  useFloatingChatStore.getState().appendToken("新内容", "msg_new");

  const session = useFloatingChatStore
    .getState()
    .sessions[useFloatingChatStore.getState().activeSessionId!];
  const last = session.messages[session.messages.length - 1];
  assert.ok(last);
  assert.equal(last.role, "assistant");
  assert.equal(last.status, "streaming");
  assert.equal(last.content, "新内容");
});

// ── completeTurn ──────────────────────────────────────

test("completeTurn → 流式助手转 done，状态回 idle", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("Q");

  const sessionId = useFloatingChatStore.getState().activeSessionId!;
  useFloatingChatStore.setState((s) => ({
    sessions: {
      ...s.sessions,
      [sessionId]: {
        ...s.sessions[sessionId],
        messages: [
          ...s.sessions[sessionId].messages,
          { id: "a1", role: "assistant" as const, content: "答案", status: "streaming" as const, createdAt: new Date().toISOString() },
        ],
      },
    },
  }));

  useFloatingChatStore.getState().completeTurn("a1");

  const messages = useFloatingChatStore
    .getState()
    .sessions[sessionId].messages;
  const assistant = messages.find((m) => m.id === "a1");
  assert.ok(assistant);
  assert.equal(assistant.status, "done");
  assert.equal(useFloatingChatStore.getState().status, "idle");
});

// ── failTurn ──────────────────────────────────────────

test("failTurn → 流式助手转 error，记录错误信息", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("Q");

  const sessionId = useFloatingChatStore.getState().activeSessionId!;
  useFloatingChatStore.setState((s) => ({
    sessions: {
      ...s.sessions,
      [sessionId]: {
        ...s.sessions[sessionId],
        messages: [
          ...s.sessions[sessionId].messages,
          { id: "a1", role: "assistant" as const, content: "部分", status: "streaming" as const, createdAt: new Date().toISOString() },
        ],
      },
    },
  }));

  useFloatingChatStore.getState().failTurn("模型超时");

  const state = useFloatingChatStore.getState();
  assert.equal(state.status, "error");
  assert.equal(state.errorMessage, "模型超时");

  const messages = state.sessions[sessionId].messages;
  const assistant = messages.find((m) => m.id === "a1");
  assert.ok(assistant);
  assert.equal(assistant.status, "error");
});

// ── abortTurn ─────────────────────────────────────────

test("abortTurn → 流式助手转 done（非 error），状态回 idle", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("Q");

  const sessionId = useFloatingChatStore.getState().activeSessionId!;
  useFloatingChatStore.setState((s) => ({
    sessions: {
      ...s.sessions,
      [sessionId]: {
        ...s.sessions[sessionId],
        messages: [
          ...s.sessions[sessionId].messages,
          { id: "a1", role: "assistant" as const, content: "中", status: "streaming" as const, createdAt: new Date().toISOString() },
        ],
      },
    },
  }));

  useFloatingChatStore.getState().abortTurn();

  const state = useFloatingChatStore.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.errorMessage, null);

  const messages = state.sessions[sessionId].messages;
  const assistant = messages.find((m) => m.id === "a1");
  assert.ok(assistant);
  assert.equal(assistant.status, "done", "中断的流应标记为 done 而非 error");
});

// ── reset ─────────────────────────────────────────────

test("reset → 清空所有会话与状态", () => {
  useFloatingChatStore.getState().createSession();
  useFloatingChatStore.getState().beginTurn("Q");

  useFloatingChatStore.getState().reset();

  const state = useFloatingChatStore.getState();
  assert.deepEqual(state.sessions, {});
  assert.deepEqual(state.sessionOrder, []);
  assert.equal(state.activeSessionId, null);
  assert.equal(state.status, "idle");
  assert.equal(state.errorMessage, null);
});