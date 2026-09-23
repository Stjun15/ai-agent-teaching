/**
 * SSE 协议纯函数测试
 *
 * 守的是 10 种 SSE 事件类型的 Zod 校验 —— 铁律 2「Agent 输出必须 JSON + Zod」
 * 在浏览器接收侧的落点。改了 schema 定义或事件字段名，这里立刻红。
 *
 * 运行：
 *   pnpm test:sse
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SSEEventSchema, SSE_EVENT_TYPES, ErrorCodeSchema } from "@/schemas";

// ---------------------------------------------------------------------------
// 事件类型数量
// ---------------------------------------------------------------------------

test("SSE_EVENT_TYPES 包含全部 10 种事件", () => {
  assert.equal(SSE_EVENT_TYPES.length, 10);
});

// ---------------------------------------------------------------------------
// token
// ---------------------------------------------------------------------------

test("token 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "token",
    data: { content: "你好", messageId: "msg_1" },
  });
  assert.equal(result.success, true);
});

test("token 事件：缺失 content 不通过", () => {
  const result = SSEEventSchema.safeParse({
    type: "token",
    data: { messageId: "msg_1" },
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// done
// ---------------------------------------------------------------------------

test("done 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "done",
    data: {
      messageId: "msg_1",
      tokens: { input: 1200, output: 400 },
    },
  });
  assert.equal(result.success, true);
});

test("done 事件：tokens 缺 output 不通过", () => {
  const result = SSEEventSchema.safeParse({
    type: "done",
    data: { messageId: "msg_1", tokens: { input: 1200 } },
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// error
// ---------------------------------------------------------------------------

test("error 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "error",
    data: {
      code: "RATE_LIMIT",
      message: "请求过于频繁",
      recoverable: true,
    },
  });
  assert.equal(result.success, true);
});

test("error 事件：非法 code 不通过", () => {
  const result = SSEEventSchema.safeParse({
    type: "error",
    data: { code: "NOT_A_REAL_CODE", message: "x", recoverable: false },
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// thinking
// ---------------------------------------------------------------------------

test("thinking 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "thinking",
    data: { step: "分析", content: "...", agent: "teacher" },
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// citation
// ---------------------------------------------------------------------------

test("citation 事件：合法帧通过校验（无 page）", () => {
  const result = SSEEventSchema.safeParse({
    type: "citation",
    data: {
      source: "concepts/llm-api.md",
      snippet: "大语言模型是...",
      relevance: 0.85,
    },
  });
  assert.equal(result.success, true);
});

test("citation 事件：relevance 为 0 可通过", () => {
  const result = SSEEventSchema.safeParse({
    type: "citation",
    data: { source: "x", snippet: "y", relevance: 0 },
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// visualization
// ---------------------------------------------------------------------------

test("visualization 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "visualization",
    data: { sceneId: "scene-loop-weather", params: {} },
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

test("validation 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "validation",
    data: {
      id: "vr_1",
      studentId: "student_a",
      sessionId: "session_1",
      taskType: "prompt",
      totalScore: 85,
      level: "良好",
      isCorrect: true,
      dimensions: [
        { name: "角色定义", score: 90, weight: 0.5, comment: "明确" },
        { name: "参数完整", score: 80, weight: 0.5, comment: "合格" },
      ],
      issues: [],
      suggestions: [],
      createdAt: "2026-01-01T00:00:00Z",
    },
  });
  assert.equal(result.success, true);
});

test("validation 事件：维度权重之和不为 1 时仍通过 Zod（.refine 在 ReviewerOutput 层，不在 SSE 层）", () => {
  // SSE 层的 schema 不做权重检查，那是 Agent 输出层的职责
  const result = SSEEventSchema.safeParse({
    type: "validation",
    data: {
      id: "vr_2",
      studentId: "student_a",
      sessionId: "session_2",
      taskType: "code",
      totalScore: 100,
      level: "优秀",
      isCorrect: true,
      dimensions: [{ name: "x", score: 100, weight: 0.3, comment: "" }],
      issues: [],
      suggestions: [],
      createdAt: "2026-01-01T00:00:00Z",
    },
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// tool_call
// ---------------------------------------------------------------------------

test("tool_call 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "tool_call",
    data: {
      toolName: "query_wiki",
      params: { keyword: "ReAct" },
      callId: "call_1",
    },
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// tool_result
// ---------------------------------------------------------------------------

test("tool_result 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "tool_result",
    data: {
      callId: "call_1",
      result: { found: true, pages: ["concepts/agent-loop.md"] },
      duration: 120,
    },
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// ui
// ---------------------------------------------------------------------------

test("ui 事件：合法帧通过校验", () => {
  const result = SSEEventSchema.safeParse({
    type: "ui",
    data: { component: "ScoreCard", props: { score: 85, level: "良好" } },
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// 判别联合
// ---------------------------------------------------------------------------

test("判别联合：未知 type 会被拒", () => {
  const result = SSEEventSchema.safeParse({
    type: "nonexistent",
    data: {},
  });
  assert.equal(result.success, false);
});

test("判别联合：缺少 type 字段不通过", () => {
  const result = SSEEventSchema.safeParse({
    data: { content: "hi", messageId: "m1" },
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 8 个错误码
// ---------------------------------------------------------------------------

test("ErrorCodeSchema：8 个合法错误码全通过", () => {
  const codes = [
    "INVALID_INPUT",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "RATE_LIMIT",
    "LLM_ERROR",
    "DB_ERROR",
    "TIMEOUT",
  ];
  for (const code of codes) {
    assert.equal(
      ErrorCodeSchema.safeParse(code).success,
      true,
      `${code} 应通过`,
    );
  }
});

// ---------------------------------------------------------------------------
// SSE 帧解析：非 JSON data 不会崩（sse.ts 的 onInvalidFrame 路径）
// ---------------------------------------------------------------------------

test("SSEEventSchema：非 JSON 纯文本被拒", () => {
  const result = SSEEventSchema.safeParse("not-json");
  assert.equal(result.success, false);
});
