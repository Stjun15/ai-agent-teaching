/**
 * dispatch 事件分发器全量测试
 *
 * 覆盖 10 种 SSE 事件到 3 个 Store 的映射：
 *   SessionStore: token / thinking / tool_call / tool_result / citation / done / error
 *   CodeStore: validation
 *   VisualizationStore: visualization
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { dispatch } from "@/hooks/useChatStream";
import { useSessionStore } from "@/stores/session";
import { useCodeStore } from "@/stores/code";
import { useVisualizationStore } from "@/stores/visualization";

// 每个用例后恢复初始化状态
afterEach(() => {
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
  useCodeStore.setState({ validationResult: null });
  useVisualizationStore.setState({ sceneId: null });
});

test("token 事件 → appendToken，追加到临时助手消息", () => {
  // 模拟流式中的状态：需要先有一条正在构建的助手消息
  useSessionStore.setState({
    status: "streaming",
    messages: [
      {
        id: "m1",
        role: "assistant",
        content: "",
        status: "streaming" as const,
        citations: [],
        createdAt: new Date().toISOString(),
      },
    ],
  });

  dispatch({ type: "token", data: { content: "你好", messageId: "m1" } });
  // token 经 rAF 缓冲写入，测试需同步排空
  useSessionStore.getState().flushTokenBuffer();

  const msgs = useSessionStore.getState().messages;
  const last = msgs[msgs.length - 1];
  assert.equal(last.content, "你好");
});

test("thinking 事件 → appendThinking 聚合到 thinking[]", () => {
  dispatch({
    type: "thinking",
    data: { step: "analyze", agent: "teacher", content: "让我想想…" },
  });

  const { thinking } = useSessionStore.getState();
  assert.equal(thinking.length, 1);
  assert.equal(thinking[0].content, "让我想想…");
  assert.equal(thinking[0].agent, "teacher");
});

test("tool_call 事件 → addToolCall", () => {
  dispatch({
    type: "tool_call",
    data: { callId: "c1", toolName: "calculator", params: { expr: "1+1" } },
  });

  const calls = useSessionStore.getState().tools;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].callId, "c1");
  assert.equal(calls[0].toolName, "calculator");
});

test("tool_result 事件 → addToolResult 补齐结果与耗时", () => {
  // 先插入 tool_call 让 store 维护好工具调用列表
  dispatch({
    type: "tool_call",
    data: { callId: "c1", toolName: "calculator", params: {} },
  });

  dispatch({
    type: "tool_result",
    data: { callId: "c1", result: { text: "42" }, duration: 100 },
  });

  const calls = useSessionStore.getState().tools;
  const call = calls.find((c) => c.callId === "c1");
  assert.ok(call);
  assert.deepEqual(call.result, { text: "42" });
  assert.equal(call.durationMs, 100);
});

test("citation 事件 → addCitation", () => {
  dispatch({
    type: "citation",
    data: { source: "concepts/types.md", snippet: "变量声明", relevance: 0.8 },
  });

  const refs = useSessionStore.getState().citations;
  assert.equal(refs.length, 1);
  assert.equal(refs[0].source, "concepts/types.md");
});

test("validation 事件 → CodeStore.resolveValidation", () => {
  // `validation` 事件的 data 就是完整的 `ValidationResult`（11 个字段），
  // 少字段在传输契约里不合法，因此 fixture 必须写全。
  dispatch({
    type: "validation",
    data: {
      id: "vr-1",
      studentId: "00000000-0000-4000-8000-000000000001",
      sessionId: "00000000-0000-4000-8000-000000000002",
      taskType: "code",
      totalScore: 85,
      level: "良好",
      isCorrect: true,
      dimensions: [],
      issues: [],
      suggestions: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  });

  const v = useCodeStore.getState().validationResult;
  assert.ok(v);
  assert.equal(v.totalScore, 85);
  assert.equal(v.isCorrect, true);
});

test("visualization 事件 → VisualizationStore.selectScene", () => {
  dispatch({
    type: "visualization",
    data: { sceneId: "scene-loop-weather", params: {} },
  });

  assert.equal(useVisualizationStore.getState().sceneId, "scene-loop-weather");
});

test("done 事件 → completeTurn 收尾，status 转 done", () => {
  useSessionStore.setState({
    status: "streaming",
    messages: [
      {
        id: "m1",
        role: "assistant",
        content: "已完成",
        status: "streaming" as const,
        citations: [],
        createdAt: new Date().toISOString(),
        tokens: { input: 5, output: 3 },
      },
    ],
    tokens: { input: 5, output: 3 },
  });

  dispatch({
    type: "done",
    data: { messageId: "m1", tokens: { input: 5, output: 3 } },
  });

  const state = useSessionStore.getState();
  assert.equal(state.status, "done");
});

test("error 事件 → failTurn，status 转 error", () => {
  dispatch({
    type: "error",
    data: {
      code: "LLM_ERROR",
      message: "模型超时",
      recoverable: true,
    },
  });

  const state = useSessionStore.getState();
  assert.equal(state.status, "error");
  assert.ok(state.error?.message.includes("模型超时"));
});

test("ui 事件 → 调用 onUiEvent 回调", () => {
  let received: unknown = null;
  dispatch(
    { type: "ui", data: { component: "CodeDiff", props: { a: "1" } } },
    (event) => {
      received = event;
    },
  );

  assert.ok(received);
  assert.equal((received as Record<string, unknown>).component, "CodeDiff");
});

test("ui 事件 无 onUiEvent 回调 → 不抛错", () => {
  assert.doesNotThrow(() =>
    dispatch({
      type: "ui",
      data: { component: "Foo", props: {} },
    }),
  );
});