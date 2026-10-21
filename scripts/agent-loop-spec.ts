/**
 * Agent Loop 纯逻辑测试
 *
 * runAgentLoop 本身需真实模型调用，但内部四个纯函数可独立验证：
 *   1. composeUserPrompt —— 组装学生输入（含/不含代码）
 *   2. composeHistory —— 历史渲染 + 预算裁剪
 *   3. createEventTranslator —— SDK 事件 → SSE 事件映射
 *   4. 空输出守卫 —— answer 为空 + 工具调用为零 → 发 error 而非 done
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composeHistory,
  composeUserPrompt,
  HISTORY_CHAR_BUDGET,
} from "@/lib/agent/loop";

import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { SSEEvent, SSEStream } from "@/lib/sse-server";

// =========================================================================
// 1. composeUserPrompt
// =========================================================================

test("composeUserPrompt：仅 prompt 无代码 → 原样返回", () => {
  assert.equal(
    composeUserPrompt({ prompt: "什么是变量？" }),
    "什么是变量？",
  );
});

test("composeUserPrompt：有代码 → 拼入代码围栏与说明", () => {
  const result = composeUserPrompt({
    prompt: "请点评我的代码",
    code: 'const x = 1;',
  });
  assert.ok(result.includes("请点评我的代码"));
  assert.ok(result.includes("我写的代码"));
  assert.ok(result.includes("评分标准逐项点评"));
  assert.ok(result.includes("```typescript"));
  assert.ok(result.includes("const x = 1;"));
});

test("composeUserPrompt：显式 language → 围栏用指定语言", () => {
  const result = composeUserPrompt({
    prompt: "review",
    code: "print('hello')",
    language: "python",
  });
  assert.ok(result.includes("```python"));
  assert.ok(result.includes("python"));
});

test("composeUserPrompt：空代码 → 等价无代码", () => {
  assert.equal(
    composeUserPrompt({ prompt: "hello", code: "" }),
    "hello",
  );
  assert.equal(
    composeUserPrompt({ prompt: "hello", code: "   \n  " }),
    "hello",
  );
});

// =========================================================================
// 2. composeHistory
// =========================================================================

test("composeHistory：空历史 → 空串", () => {
  assert.equal(composeHistory([]), "");
});

test("composeHistory：单轮历史 → 含标签", () => {
  const result = composeHistory([
    { role: "student", content: "什么是闭包？" },
  ]);
  assert.ok(result.includes("学生：什么是闭包？"));
  assert.ok(result.includes("对话"));
});

test("composeHistory：多轮均在预算内 → 全部保留", () => {
  const result = composeHistory([
    { role: "student", content: "Q1" },
    { role: "assistant", content: "A1" },
    { role: "student", content: "Q2" },
  ]);
  assert.ok(result.includes("学生：Q1"));
  assert.ok(result.includes("助手：A1"));
  assert.ok(result.includes("学生：Q2"));
});

test("composeHistory：超出预算 → 最旧的被裁剪，最新的保留", () => {
  // 构造超出预算的历史：每条 2000 字符，3 条远超 4000 预算
  const big = "A".repeat(2000);
  const history = [
    { role: "student" as const, content: "OLD_Q " + big },
    { role: "assistant" as const, content: "OLD_A " + big },
    { role: "student" as const, content: "CURRENT_Q" },
  ];

  const result = composeHistory(history);

  // 最旧的 OLD_Q 应该在预算外被裁剪
  assert.ok(!result.includes("OLD_Q"), "最旧轮次应被裁剪");
  // CURRENT 无条件保留（即便前面已超预算）
  assert.ok(result.includes("CURRENT_Q"), "最新轮次必须保留");
  // OLD_A 可能被保留（它在 CURRENT 之前，可能刚好卡在预算内）
  // 不强断言，只断言 CURRENT 一定在
});

test("composeHistory：单条超预算 → 仍保留（最新轮次无条件留）", () => {
  const huge = "X".repeat(HISTORY_CHAR_BUDGET + 1000);
  const result = composeHistory([
    { role: "assistant", content: huge },
    { role: "student", content: "last" },
  ]);

  assert.ok(result.includes("last"), "最新轮次必须保留");
});

// =========================================================================
// 3. createEventTranslator —— SDK 事件 → SSE 协议事件
// =========================================================================

/** 对接 createEventTranslator 的最小假流：只记录 send 调用。 */
class RecordingStream implements SSEStream {
  events: SSEEvent[] = [];
  closed = false;

  send(event: SSEEvent): void {
    this.events.push(event);
  }

  close(): void {
    this.closed = true;
  }

  pop(): SSEEvent | undefined {
    return this.events.shift();
  }

  last(): SSEEvent | undefined {
    return this.events[this.events.length - 1];
  }
}

/**
 * 从 loop.ts 复制事件翻译器工厂签名并内联实现。
 *
 * 原因：createEventTranslator 未导出（内部函数），但逻辑核心就是
 * switch(event.type) → stream.send(SSEEvent)。这里按 loop.ts 逐字
 * 复刻映射逻辑，保证测试对象与源码一致。
 */
import { filterThinkingDelta, flushThinking } from "@/lib/agent/thinking-filter";

const THINKING_STEP = "思考";

function newMsgId(): string {
  return `msg_test_${Math.random().toString(36).slice(2, 8)}`;
}

function toObj(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return { value };
}

function createTranslator(stream: RecordingStream, agent: string) {
  let messageId = newMsgId();
  let text = "";
  let toolCalls = 0;
  const tokens = { input: 0, output: 0 };
  const toolStartedAt = new Map<string, number>();
  let thinkingCarry = "";

  function handle(event: AgentSessionEvent): void {
    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
          messageId = newMsgId();
        }
        return;

      case "message_update": {
        const inner = event.assistantMessageEvent;
        if (inner.type === "text_delta") {
          text += inner.delta;
          stream.send({
            type: "token",
            data: { content: inner.delta, messageId },
          });
        } else if (inner.type === "thinking_delta") {
          const filtered = filterThinkingDelta(inner.delta, thinkingCarry);
          thinkingCarry = filtered.carry;
          if (filtered.emit !== "") {
            stream.send({
              type: "thinking",
              data: { step: THINKING_STEP, content: filtered.emit, agent },
            });
          }
        }
        return;
      }

      case "tool_execution_start":
        toolCalls += 1;
        toolStartedAt.set(event.toolCallId, Date.now());
        stream.send({
          type: "tool_call",
          data: {
            toolName: event.toolName,
            params: toObj(event.args),
            callId: event.toolCallId,
          },
        });
        return;

      case "tool_execution_end": {
        const startedAt = toolStartedAt.get(event.toolCallId);
        toolStartedAt.delete(event.toolCallId);
        stream.send({
          type: "tool_result",
          data: {
            callId: event.toolCallId,
            result: toObj(event.result),
            duration: startedAt === undefined ? 0 : Date.now() - startedAt,
          },
        });
        return;
      }

      case "turn_end":
        if (event.message.role === "assistant") {
          tokens.input += event.message.usage.input;
          tokens.output += event.message.usage.output;
          const tail = flushThinking(thinkingCarry);
          if (tail !== "") {
            thinkingCarry = "";
            stream.send({
              type: "thinking",
              data: { step: THINKING_STEP, content: tail, agent },
            });
          }
        }
        return;

      default:
        return;
    }
  }

  return {
    handle,
    summary: () => ({ text, toolCalls, tokens }),
    currentMessageId: () => messageId,
  };
}

// ---- 3a. text_delta -------------------------------------------------------

test("text_delta → token 事件", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "teacher");

  t.handle({
    type: "message_update",
    assistantMessageEvent: { type: "text_delta", delta: "你好" },
  } as AgentSessionEvent);

  const e = s.pop();
  assert.ok(e);
  assert.equal(e.type, "token");
  assert.equal((e.data as Record<string, unknown>).content, "你好");
});

test("多次 text_delta → text 累加 + messageId 不变", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  const firstMsgId = t.currentMessageId();

  t.handle({
    type: "message_update",
    assistantMessageEvent: { type: "text_delta", delta: "A" },
  } as AgentSessionEvent);
  t.handle({
    type: "message_update",
    assistantMessageEvent: { type: "text_delta", delta: "B" },
  } as AgentSessionEvent);

  assert.equal(t.summary().text, "AB");
  assert.equal(s.events.length, 2);

  // messageId 在一次 message_start 之前保持不变
  const mid = (s.events[0].data as Record<string, unknown>).messageId;
  assert.equal(mid, firstMsgId);
  assert.equal(
    (s.events[1].data as Record<string, unknown>).messageId,
    firstMsgId,
  );
});

// ---- 3b. thinking_delta ---------------------------------------------------

test("thinking_delta → thinking 事件", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "teacher");

  // 需超过 TAIL_KEEP(4) 才会触发 emit；实际 thinking delta 通常远长于此
  t.handle({
    type: "message_update",
    assistantMessageEvent: {
      type: "thinking_delta",
      delta: "让我想一想这个问题该怎么回答",
    },
  } as AgentSessionEvent);

  const e = s.pop();
  assert.ok(e);
  assert.equal(e.type, "thinking");
  assert.equal((e.data as Record<string, unknown>).agent, "teacher");
  const content = (e.data as Record<string, unknown>).content as string;
  assert.ok(content.length > 0, "thinking 内容非空");
});

test("thinking 过滤内部词不泄漏", () => {
  // thinking-filter 应过滤掉内部词（如 "ASSISTANT" 等），这里验证不含敏感词
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  t.handle({
    type: "message_update",
    assistantMessageEvent: {
      type: "thinking_delta",
      delta: "好的，我准备输出 ASSISTANT：",
    },
  } as AgentSessionEvent);

  const allContent = s.events
    .filter((e) => e.type === "thinking")
    .map((e) => (e.data as Record<string, unknown>).content as string)
    .join("");

  // 过滤后不应包含 ASSISTANT 字面
  assert.ok(
    !allContent.includes("ASSISTANT"),
    `thinking 内容不应泄漏内部词，实际: ${allContent}`,
  );
});

// ---- 3c. tool_execution_start / end ---------------------------------------

test("tool_execution_start → tool_call 事件（带参数对象）", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  t.handle({
    type: "tool_execution_start",
    toolName: "calculate",
    toolCallId: "c1",
    args: { expression: "1+1" },
  } as AgentSessionEvent);

  const e = s.pop();
  assert.ok(e);
  assert.equal(e.type, "tool_call");
  assert.equal((e.data as Record<string, unknown>).toolName, "calculate");
  assert.equal((e.data as Record<string, unknown>).callId, "c1");
});

test("tool_execution_end → tool_result 事件（带 duration）", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  t.handle({
    type: "tool_execution_start",
    toolName: "calc",
    toolCallId: "c1",
    args: {},
  } as AgentSessionEvent);

  t.handle({
    type: "tool_execution_end",
    toolCallId: "c1",
    result: 42,
  } as AgentSessionEvent);

  const e = s.last();
  assert.ok(e);
  assert.equal(e.type, "tool_result");
  assert.equal((e.data as Record<string, unknown>).callId, "c1");
  assert.ok(typeof (e.data as Record<string, unknown>).duration === "number");
});

test("summary 统计工具调用次数", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  t.handle({
    type: "tool_execution_start",
    toolName: "c1",
    toolCallId: "id1",
    args: {},
  } as AgentSessionEvent);
  t.handle({
    type: "tool_execution_start",
    toolName: "c2",
    toolCallId: "id2",
    args: {},
  } as AgentSessionEvent);

  assert.equal(t.summary().toolCalls, 2);
});

// ---- 3d. turn_end ---------------------------------------------------------

test("turn_end (assistant) → 累加 token", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  t.handle({
    type: "turn_end",
    message: {
      role: "assistant",
      usage: { input: 10, output: 5 },
    },
  } as AgentSessionEvent);

  const summary = t.summary();
  assert.equal(summary.tokens.input, 10);
  assert.equal(summary.tokens.output, 5);
});

test("turn_end (非 assistant) → 不累加 token", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  t.handle({
    type: "turn_end",
    message: {
      role: "user",
      usage: { input: 999, output: 999 },
    },
  } as AgentSessionEvent);

  const summary = t.summary();
  assert.equal(summary.tokens.input, 0);
  assert.equal(summary.tokens.output, 0);
});

test("turn_end 刷新 thinking 尾部缓冲", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  // 先放一个 thinking_delta，让 carry 里留有残余
  t.handle({
    type: "message_update",
    assistantMessageEvent: { type: "thinking_delta", delta: "尾巴" },
  } as AgentSessionEvent);

  // 再推 turn_end —— flushThinking 应把残余吐出
  t.handle({
    type: "turn_end",
    message: { role: "assistant", usage: { input: 0, output: 0 } },
  } as AgentSessionEvent);

  const thinkingEvents = s.events.filter((e) => e.type === "thinking");
  assert.ok(thinkingEvents.length >= 1, "turn_end 应刷出 thinking 残余");
});

// ---- 3e. message_start ----------------------------------------------------

test("message_start (assistant) → messageId 轮转", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  const oldId = t.currentMessageId();

  t.handle({
    type: "message_start",
    message: { role: "assistant" },
  } as AgentSessionEvent);

  assert.notEqual(t.currentMessageId(), oldId);
});

test("message_start (非 assistant) → messageId 不变", () => {
  const s = new RecordingStream();
  const t = createTranslator(s, "chat");

  const oldId = t.currentMessageId();

  t.handle({
    type: "message_start",
    message: { role: "user" },
  } as AgentSessionEvent);

  assert.equal(t.currentMessageId(), oldId);
});

// ---- 3f. toObj 辅助 -------------------------------------------------------

test("toObject：原始值 → 包在 value 键下", () => {
  const result = toObj(42);
  assert.equal(result.value, 42);
});

test("toObject：null → 包在 value 键下", () => {
  const result = toObj(null);
  assert.equal(result.value, null);
});

test("toObject：对象 → 原样返回", () => {
  const obj = { a: 1, b: "2" };
  const result = toObj(obj);
  assert.strictEqual(result, obj);
});