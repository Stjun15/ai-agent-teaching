/**
 * 思维链归属 —— 新消息只带本轮思维段
 *
 * 钉什么
 * -----
 * 全局 thinking[] 跨轮累积（Agent 时间线要展示历史），但消息的
 * thinkingSteps 只属于当前这一轮。2026-10-07 审计实测：第 2 轮回复的
 * thinkingSteps 逐字包含第 1 轮的完整思维链（6079 字符英文内心戏），
 * 学生每条消息都要重读全部历史。修复后建消息点只取「尚未封口」的段落
 * （`inFlightThinking`）——历史轮次的思维段在 completeTurn 里已封口，
 * 用 endedAt 区分。
 *
 * 不调模型：SSE 事件用 dispatch 直接喂 store。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { dispatch } from "@/hooks/useChatStream";
import { useSessionStore } from "@/stores";

function resetStore(): void {
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
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test("首轮：思维段完整关联到本轮消息", async () => {
  const store = useSessionStore.getState();
  store.beginTurn("第一问", { step: "explain" });
  dispatch({
    type: "thinking",
    data: { step: "explain", agent: "teaching", content: "第一轮的思考" },
  });
  dispatch({
    type: "token",
    data: { content: "第一轮回复", messageId: "m1" },
  });
  await flush();

  const messages = useSessionStore.getState().messages;
  const first = messages.find((m) => m.id === "m1");
  assert.ok(first);
  const steps = first.thinkingSteps ?? [];
  assert.equal(steps.length, 1);
  assert.ok(steps[0].content.includes("第一轮的思考"));
});

test("次轮：消息不得再携带上一轮的思维链（跨轮串台回归）", async () => {
  // 第 1 轮完整走完（completeTurn 会把思维段封口）
  const store = useSessionStore.getState();
  store.beginTurn("第一问", { step: "explain" });
  dispatch({
    type: "thinking",
    data: { step: "explain", agent: "teaching", content: "第一轮的思考" },
  });
  dispatch({
    type: "token",
    data: { content: "第一轮回复", messageId: "m1" },
  });
  dispatch({
    type: "done",
    data: { messageId: "m1", tokens: { input: 1, output: 1 } },
  });
  await flush();

  // 第 2 轮：新的思维段 + 新的 token
  const store2 = useSessionStore.getState();
  store2.beginTurn("第二问", { step: "observe" });
  dispatch({
    type: "thinking",
    data: { step: "observe", agent: "teaching", content: "第二轮的思考" },
  });
  dispatch({
    type: "token",
    data: { content: "第二轮回复", messageId: "m2" },
  });
  await flush();

  const messages = useSessionStore.getState().messages;
  const second = messages.find((m) => m.id === "m2");
  assert.ok(second);
  const steps = second.thinkingSteps ?? [];
  assert.equal(
    steps.length,
    1,
    `第 2 条消息只应带本轮思维段，实际 ${steps.length} 段`,
  );
  assert.ok(steps[0].content.includes("第二轮的思考"));
  assert.ok(!steps.some((s) => s.content.includes("第一轮")));

  // 全局时间线不受影响：两轮思维都在（Agent 时间线要展示历史）
  assert.equal(useSessionStore.getState().thinking.length, 2);
});
