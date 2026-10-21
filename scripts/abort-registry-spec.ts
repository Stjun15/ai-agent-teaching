/**
 * abort-registry 全链路测试
 *
 * 覆盖 4 个导出函数：registerStream / abortStream / unregisterStream / activeStreamCount。
 * 按 sessionId 粒度的注册-中止-注销-计数四个生命周期。
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  abortStream,
  activeStreamCount,
  registerStream,
  unregisterStream,
} from "@/lib/agent/abort-registry";

// 每个用例结束时强行清空全局 Map，避免跨用例污染。
afterEach(() => {
  // 无法直接访问私有 controllers Map，但可以通过不断 abortStream
  // 来清空已知的残留。更可靠的手段：每个用例内自己清理自己创建的。
  // 这里做二道防线：连调用方的清理遗漏也能兜住。
  // 由于不知道所有 sessionId，逐个尝试会导致无限循环。
  // 因此要求每个测试用例必须自行清理：用例结束时 activeStreamCount 应为 0。
  const leftover = activeStreamCount();
  if (leftover > 0) {
    // 尽力清理：如果是已知的测试 sessionId 残留
    // （测试用例使用了 afterEach 后仍泄漏的情况），这里无法枚举。
    // 所以选择 assert 让泄漏的测试显式失败。
    assert.equal(leftover, 0, `测试泄漏：${leftover} 条流未清理。`);
  }
});

/** 等待一个微任务，让 abort 事件有机会触发。 */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

test("registerStream 返回未中止的 signal，且计数 +1", () => {
  const signal = registerStream("s1");
  assert.equal(signal.aborted, false);
  assert.equal(activeStreamCount(), 1);
  unregisterStream("s1");
});

test("registerStream 同 sessionId 再注册 → 旧 signal 中止，计数不变", async () => {
  const sig1 = registerStream("s1");
  assert.equal(activeStreamCount(), 1);

  // 监听旧 signal 的中止事件
  let aborted = false;
  sig1.addEventListener("abort", () => {
    aborted = true;
  });

  const sig2 = registerStream("s1");
  await tick();

  assert.equal(aborted, true, "旧 signal 应被中止");
  assert.equal(sig2.aborted, false, "新 signal 未被中止");
  assert.equal(activeStreamCount(), 1, "同 sessionId 不增长计数");
  unregisterStream("s1");
});

test("不同 sessionId 各自独立计数", () => {
  registerStream("a");
  registerStream("b");
  registerStream("c");
  assert.equal(activeStreamCount(), 3);
  unregisterStream("a");
  unregisterStream("b");
  unregisterStream("c");
});

test("abortStream 成功 → 返回 true，signal 中止，移除计数", async () => {
  const signal = registerStream("s1");

  let aborted = false;
  signal.addEventListener("abort", () => {
    aborted = true;
  });

  const result = abortStream("s1");
  await tick();

  assert.equal(result, true);
  assert.equal(aborted, true);
  assert.equal(signal.aborted, true);
  assert.equal(activeStreamCount(), 0);
});

test("abortStream 不存在的 sessionId → 返回 false，计数不变", () => {
  assert.equal(activeStreamCount(), 0);
  const result = abortStream("no-such");
  assert.equal(result, false);
  assert.equal(activeStreamCount(), 0);
});

test("abortStream 后重复 abort 同一个 id → 第二次返回 false", () => {
  registerStream("s1");
  assert.equal(abortStream("s1"), true);
  assert.equal(abortStream("s1"), false);
  assert.equal(activeStreamCount(), 0);
});

test("unregisterStream 不移除前不清零，移除后正确清零（不触发 abort）", async () => {
  const signal = registerStream("s1");

  let aborted = false;
  signal.addEventListener("abort", () => {
    aborted = true;
  });

  assert.equal(activeStreamCount(), 1);
  unregisterStream("s1");
  await tick();

  assert.equal(activeStreamCount(), 0);
  assert.equal(aborted, false, "unregister 不应触发 abort");
  assert.equal(signal.aborted, false, "unregister 后 signal 仍为未中止");
});

test("unregisterStream 不存在的 id → 不抛错，计数不变", () => {
  assert.equal(activeStreamCount(), 0);
  assert.doesNotThrow(() => unregisterStream("ghost"));
  assert.equal(activeStreamCount(), 0);
});

test("abort 后 unregister → 不抛错（幂等清理）", () => {
  registerStream("s1");
  abortStream("s1");
  assert.equal(activeStreamCount(), 0);
  assert.doesNotThrow(() => unregisterStream("s1"));
  assert.equal(activeStreamCount(), 0);
});

test("activeStreamCount：初始为 0，注册后递增，清理后归零", () => {
  assert.equal(activeStreamCount(), 0);

  registerStream("x");
  assert.equal(activeStreamCount(), 1);

  registerStream("y");
  assert.equal(activeStreamCount(), 2);

  unregisterStream("x");
  assert.equal(activeStreamCount(), 1);

  abortStream("y");
  assert.equal(activeStreamCount(), 0);
});