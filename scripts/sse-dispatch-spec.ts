/**
 * SSE dispatch —— 事件到 Store 的翻译器
 *
 * 钉什么
 * -----
 * `dispatch` 是 SSE 字节到达后的第 2 层管线（第 1 层是 schema 校验）。
 * 它把 10 种 SSE 事件类型分给 3 个 Zustand Store：
 * SessionStore / CodeStore / VisualizationStore。
 *
 * 这一层以前完全没测：sse-protocol-spec 只测了 schema 校验
 * （"这一帧的 JSON 合不合法"），不管"这一帧会影响哪个 Store 的哪一段"。
 *
 * 全组不调模型，不依赖 DOM。
 */

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { dispatch } from "@/hooks/useChatStream";
import { useCodeStore } from "@/stores/code";
import { useSessionStore } from "@/stores/session";
import { useVisualizationStore } from "@/stores/visualization";
import type { SSEEventInput } from "@/schemas";

// ---------------------------------------------------------------------------
// 共享状态复位
// ---------------------------------------------------------------------------

function resetAllStores(): void {
  useSessionStore.getState().reset();
  useCodeStore.setState({
    validationStatus: "idle",
    validationResult: null,
    validationError: null,
  });
  useVisualizationStore.setState({ sceneId: null, stepIndex: 0, status: "idle", speed: 1, params: {} });
}

beforeEach(() => {
  resetAllStores();
});

// ---------------------------------------------------------------------------
// SessionStore 事件
// ---------------------------------------------------------------------------

test("token 事件 → 写入 messages（懒创建助手消息）", () => {
  dispatch({
    type: "token",
    data: { content: "你好", messageId: "msg_1" },
  } as SSEEventInput);
  useSessionStore.getState().flushTokenBuffer();

  const state = useSessionStore.getState();
  assert.equal(state.messages.length, 1, "token 应创建一条助手消息");
  assert.equal(state.messages[0].role, "assistant");
  assert.equal(state.messages[0].content, "你好");
  assert.equal(state.messages[0].id, "msg_1");
});

test("token 事件多次调用 → 累积拼接同一条消息", () => {
  dispatch({
    type: "token",
    data: { content: "第一", messageId: "msg_1" },
  } as SSEEventInput);
  dispatch({
    type: "token",
    data: { content: "句", messageId: "msg_1" },
  } as SSEEventInput);
  useSessionStore.getState().flushTokenBuffer();

  const msgs = useSessionStore.getState().messages;
  assert.equal(msgs.length, 1, "同 messageId 应合并为一条消息");
  assert.equal(msgs[0].content, "第一句", "连续 token 应拼接");
});

test("token 事件不同 messageId → 另起新消息", () => {
  dispatch({
    type: "token",
    data: { content: "第一条", messageId: "msg_1" },
  } as SSEEventInput);
  dispatch({
    type: "token",
    data: { content: "第二条", messageId: "msg_2" },
  } as SSEEventInput);
  useSessionStore.getState().flushTokenBuffer();

  const msgs = useSessionStore.getState().messages;
  assert.equal(msgs.length, 2, "不同 messageId 应各起一条消息");
  assert.equal(msgs[0].status, "done", "前一条应标记为 done");
  assert.equal(msgs[1].status, "streaming", "新消息应标记为 streaming");
});

test("thinking 事件 → 写入 thinking[]", () => {
  dispatch({
    type: "thinking",
    data: { step: "分析", content: "正在查看代码…", agent: "reviewer" },
  } as SSEEventInput);

  const state = useSessionStore.getState();
  assert.equal(state.thinking.length, 1);
  assert.equal(state.thinking[0].step, "分析");
  assert.equal(state.thinking[0].content, "正在查看代码…");
});

test("done 事件 → completeTurn 写 done 态 + token 计数", () => {
  useSessionStore.setState({ status: "streaming" });

  dispatch({
    type: "done",
    data: { messageId: "msg_1", tokens: { input: 100, output: 50 } },
  } as SSEEventInput);

  const state = useSessionStore.getState();
  assert.equal(state.status, "done", "done 后 status 应为 done");
  assert.equal(state.tokens?.input, 100, "done 应写入 token 计数");
  assert.equal(state.tokens?.output, 50);
});

test("error 事件 → failTurn 写入错误态", () => {
  useSessionStore.setState({ status: "streaming" });

  dispatch({
    type: "error",
    data: { code: "LLM_ERROR", message: "模型超时", recoverable: true },
  } as SSEEventInput);

  const state = useSessionStore.getState();
  assert.equal(state.status, "error", "error 后 status 应为 error");
  assert.equal(state.error?.code, "LLM_ERROR");
});

// ---------------------------------------------------------------------------
// CodeStore 事件
// ---------------------------------------------------------------------------

test("validation 事件 → CodeStore.resolveValidation", () => {
  dispatch({
    type: "validation",
    data: {
      id: "v1",
      studentId: "s1",
      sessionId: "sess1",
      taskType: "code",
      totalScore: 85,
      level: "good",
      isCorrect: true,
      dimensions: [],
      issues: [],
      suggestions: [],
      createdAt: new Date().toISOString(),
    },
  } as SSEEventInput);

  const state = useCodeStore.getState();
  assert.equal(state.validationResult?.totalScore, 85, "应写入 validationResult");
  assert.equal(state.validationStatus, "done", "validationStatus 应为 done");
});

// ---------------------------------------------------------------------------
// VisualizationStore 事件
// ---------------------------------------------------------------------------

test("visualization 事件 → VisualizationStore.selectScene", () => {
  dispatch({
    type: "visualization",
    data: { sceneId: "scene-request-response" },
  } as SSEEventInput);

  const state = useVisualizationStore.getState();
  assert.equal(state.sceneId, "scene-request-response", "sceneId 应写入 Store");
});

// ---------------------------------------------------------------------------
// ui 事件 → 回调
// ---------------------------------------------------------------------------

test("ui 事件 → 调用 onUiEvent 回调", () => {
  let received: { component: string; props: Record<string, unknown> } | null =
    null;

  dispatch(
    {
      type: "ui",
      data: { component: "ScoreCard", props: { score: 85 } },
    } as SSEEventInput,
    (evt) => {
      received = evt;
    },
  );

  assert.equal(received?.component, "ScoreCard");
  assert.equal(received?.props.score, 85);
});

// ---------------------------------------------------------------------------
// tool_call / tool_result / citation 会话事件
// ---------------------------------------------------------------------------

test("tool_call 事件 → addToolCall", () => {
  dispatch({
    type: "tool_call",
    data: { toolName: "readFile", params: { path: "a.ts" }, callId: "c1" },
  } as SSEEventInput);

  const state = useSessionStore.getState();
  assert.equal(state.tools.length, 1);
  assert.equal(state.tools[0].callId, "c1");
  assert.equal(state.tools[0].toolName, "readFile");
});

test("tool_result 事件 → addToolResult（补进已有 tool_call）", () => {
  dispatch({
    type: "tool_call",
    data: { toolName: "readFile", params: {}, callId: "c1" },
  } as SSEEventInput);

  dispatch({
    type: "tool_result",
    data: { callId: "c1", result: { content: "ok" }, duration: 42 },
  } as SSEEventInput);

  const state = useSessionStore.getState();
  assert.deepEqual(state.tools[0].result, { content: "ok" }, "result 对象原样保存");
  assert.equal(state.tools[0].durationMs, 42);
});

test("citation 事件 → addCitation", () => {
  dispatch({
    type: "citation",
    data: { source: "concepts/llm-api.md", snippet: "...", relevance: 0.9 },
  } as SSEEventInput);

  const state = useSessionStore.getState();
  assert.equal(state.citations.length, 1);
  assert.equal(state.citations[0].source, "concepts/llm-api.md");
  assert.equal(state.citations[0].relevance, 0.9);
});