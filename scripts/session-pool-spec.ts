/**
 * session-pool 完整测试
 *
 * 覆盖 getOrCreateHandle / evictSession / poolSize / resetPool / dumpPool。
 * 使用依赖注入 _createSession 绕过真实 Ark SDK。
 */

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  dumpPool,
  evictSession,
  getOrCreateHandle,
  poolSize,
  resetPool,
} from "@/lib/agent/session-pool";
import type { AgentSessionHandle } from "@/lib/agent/session";

// 每个用例前清空全局池。
beforeEach(() => {
  resetPool();
  MockHandle.instances = 0;
  MockHandle.disposed.length = 0;
});

// 最小 mock：所有方法无副作用，统计创建/注销次数。
class MockHandle implements AgentSessionHandle {
  static instances = 0;
  static disposed: string[] = [];

  private listeners: Array<(event: unknown) => void> = [];
  readonly tag: string;

  constructor(tag: string) {
    this.tag = tag;
    MockHandle.instances++;
  }

  prompt = async (_text: string): Promise<void> => {};
  dispose = (): void => {
    MockHandle.disposed.push(this.tag);
  };
  abort = async (): Promise<void> => {};
  subscribe = (listener: (event: unknown) => void): (() => void) => {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  };

  listenerCount(): number {
    return this.listeners.length;
  }
}

function stubFactory(tag: string) {
  return async () => new MockHandle(tag);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function noopListener(_event: any): void {}

test("poolSize → 初始 0，resetPool 后仍为 0", () => {
  assert.equal(poolSize(), 0);
  resetPool();
  assert.equal(poolSize(), 0);
});

test("getOrCreateHandle 首次调用 → 调用 factory，poolSize=1", async () => {
  const handle = await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是助教" },
    noopListener,
    stubFactory("A"),
  );
  assert.equal(poolSize(), 1);
  assert.equal(MockHandle.instances, 1);
  assert.ok(handle instanceof MockHandle);
});

test("同 sessionId 且 systemPrompt 与 tools 无变化 → 复用，不再调用 factory", async () => {
  const opts = { systemPrompt: "你是助教", tools: ["calc"] };
  const h1 = await getOrCreateHandle("s1", opts, noopListener, stubFactory("A"));
  const h2 = await getOrCreateHandle("s1", opts, noopListener, stubFactory("B"));
  assert.equal(poolSize(), 1);
  assert.equal(MockHandle.instances, 1, "复用 handle，factory 不重复调用");
  assert.equal(h1, h2, "同一 handle 对象");
});

test("systemPrompt 改变 → 销毁旧 handle，建新的", async () => {
  const h1 = await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是助教" },
    noopListener,
    stubFactory("A"),
  );
  const h2 = await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是讲师" },
    noopListener,
    stubFactory("B"),
  );
  assert.equal(poolSize(), 1);
  assert.equal(MockHandle.instances, 2);
  assert.ok(h1 !== h2);
  assert.ok(MockHandle.disposed.includes("A"), "旧 handle 应被 dispose");
});

test("tools 改变 → 销毁旧 handle，建新的", async () => {
  const h1 = await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是助教", tools: ["calc"] },
    noopListener,
    stubFactory("A"),
  );
  const h2 = await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是助教", tools: ["calc", "search"] },
    noopListener,
    stubFactory("B"),
  );
  assert.equal(poolSize(), 1);
  assert.equal(MockHandle.instances, 2);
  assert.ok(MockHandle.disposed.includes("A"));
});

test("不同 sessionId → 各自独立，不互相销毁", async () => {
  await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是助教" },
    noopListener,
    stubFactory("A"),
  );
  await getOrCreateHandle(
    "s2",
    { systemPrompt: "你是助教" },
    noopListener,
    stubFactory("B"),
  );
  assert.equal(poolSize(), 2);
  assert.equal(MockHandle.instances, 2);
  assert.equal(MockHandle.disposed.length, 0, "不同 sessionId 不互相销毁");
});

test("复用场景下 → 换绑订阅", async () => {
  const opts = { systemPrompt: "你是助教" };
  const h1 = await getOrCreateHandle("s1", opts, noopListener, stubFactory("A"));

  // 模拟上一轮订阅过一个真实 listener
  const mock1 = h1 as MockHandle;
  const secondListener = () => {};
  mock1.subscribe(secondListener);
  assert.equal(mock1.listenerCount(), 2, "noopListener + secondListener");

  // 新请求换绑 listener
  const thirdListener = () => {};
  await getOrCreateHandle("s1", opts, thirdListener, stubFactory("B"));

  // noopListener 已注销，thirdListener 挂上，secondListener 仍在（外部订阅）
  assert.equal(mock1.listenerCount(), 2, "secondListener + thirdListener");
});

test("evictSession → 调用 dispose，poolSize 减 1", async () => {
  await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是助教" },
    noopListener,
    stubFactory("A"),
  );
  assert.equal(poolSize(), 1);

  evictSession("s1");
  assert.equal(poolSize(), 0);
  assert.ok(MockHandle.disposed.includes("A"));
});

test("evictSession 不存在的 id → 不抛错", () => {
  assert.doesNotThrow(() => evictSession("ghost"));
  assert.equal(poolSize(), 0);
});

test("resetPool → 销毁所有条目", async () => {
  await getOrCreateHandle(
    "s1",
    { systemPrompt: "P1" },
    noopListener,
    stubFactory("A"),
  );
  await getOrCreateHandle(
    "s2",
    { systemPrompt: "P2" },
    noopListener,
    stubFactory("B"),
  );
  assert.equal(poolSize(), 2);

  resetPool();
  assert.equal(poolSize(), 0);
  assert.equal(MockHandle.disposed.length, 2);
});

test("dumpPool → 返回内部状态快照", async () => {
  await getOrCreateHandle(
    "s1",
    { systemPrompt: "你是助教", tools: ["calc"] },
    noopListener,
    stubFactory("A"),
  );
  const snaps = dumpPool();
  assert.equal(snaps.length, 1);
  assert.equal(snaps[0].sessionId, "s1");
  assert.equal(snaps[0].systemPrompt, "你是助教");
  assert.equal(snaps[0].toolNames, "calc");
  assert.ok(typeof snaps[0].lastUsed === "number" && snaps[0].lastUsed > 0);
});