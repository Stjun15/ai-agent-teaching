/**
 * useChatStream —— abort / reset / 并发防护
 *
 * 三个行为在一个 Hook 实例中按序测试，避免模块级 activeController
 * 单例在 Node 测试 runner 的串行执行中产生跨用例污染。
 *
 * 需要 JSDOM（useChatStream 内部依赖 React hooks）。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement, useEffect, useRef } from "react";
import { act } from "react";
import { cleanup, render } from "@testing-library/react";

import { useChatStream } from "@/hooks/useChatStream";
import { useSessionStore } from "@/stores";

type Ctrl = ReturnType<typeof useChatStream>;

function TestHook({ onMount }: { onMount: (c: Ctrl) => void }) {
  const ctrl = useChatStream();
  const called = useRef(false);
  useEffect(() => {
    if (!called.current) {
      called.current = true;
      onMount(ctrl);
    }
  });
  return null;
}

/** 可控制的 fetch mock：pending 不 resolve 则 fetch 永远卡住。
 *  监听 AbortSignal，支持 abort 中断。 */
function makeBlockingFetch() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const pending = new Promise<void>((res, rej) => { resolve = res; reject = rej; });

  return {
    fetch: ((_url: unknown, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
      if (signal) {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }
      return pending.then(
        () =>
          new Response(
            'data: {"type":"done","data":{"messageId":"test","tokens":{"input":0,"output":0}}}\n\n',
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          ),
      );
    }) as typeof globalThis.fetch,
    release: resolve,
  };
}

/** 快速 resolve 的 fetch mock */
function makeFastFetch() {
  return (async () => {
    return new Response(
      'data: {"type":"done","data":{"messageId":"test","tokens":{"input":0,"output":0}}}\n\n',
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }) as typeof globalThis.fetch;
}

function initStore() {
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
    activeModuleId: "ts-basics",
    byModule: {},
  });
}

test("useChatStream 控制器：abort / 并发防护 / reset", async () => {
  let ctrl: Ctrl;

  // ── 挂载 Hook ──────────────────────────────────────────
  await act(async () => {
    render(
      createElement(TestHook, {
        onMount: (c) => {
          ctrl = c;
        },
      }),
    );
  });
  assert.ok(ctrl!);
  const { send, abort, reset } = ctrl!;

  // ── 1. abort 中断在途流 ─────────────────────────────────
  {
    initStore();

    const { fetch: blockFn, release } = makeBlockingFetch();
    globalThis.fetch = blockFn;

    // 发起 send（startSend() 坑：send 内部 setState 依赖 rAF，需 act 包裹）
    const sendP = act(() =>
      send(
        { content: "你好", moduleId: "ts-basics" },
        { moduleId: "ts-basics" },
      ).catch(() => undefined),
    );

    // 等 send 进入 streaming 态
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(
      useSessionStore.getState().status,
      "streaming",
      "send 后应进入 streaming",
    );

    // 触发 abort
    await act(async () => {
      abort();
    });

    // 等 abort 传播（fetch 被 reject → handleSSE 抛 → send 的 catch 块跑）
    await new Promise((r) => setTimeout(r, 200));

    const state = useSessionStore.getState();
    assert.ok(
      state.status === "aborted" || state.status === "idle",
      `abort 后 status 应为 aborted/idle，实际 ${state.status}`,
    );

    release();
    await sendP;
  }

  // ── 2. 并发 send 闸门 ──────────────────────────────────
  {
    initStore();

    const { fetch: blockFn, release } = makeBlockingFetch();
    globalThis.fetch = blockFn;

    // 第一条 send 卡住（保存 promise 等完成后释放 activeController）
    const firstSendP = act(() =>
      send(
        { content: "第一条", moduleId: "ts-basics" },
        { moduleId: "ts-basics" },
      ).catch(() => undefined),
    );

    await new Promise((r) => setTimeout(r, 200));
    assert.equal(
      useSessionStore.getState().status,
      "streaming",
      "第一条 send 后 streaming",
    );

    // 第二条 send 应被闸门挡住
    await act(async () => {
      await send(
        { content: "第二条", moduleId: "ts-basics" },
        { moduleId: "ts-basics" },
      );
    });

    const studentMsgs = useSessionStore
      .getState()
      .messages.filter((m) => m.role === "student");
    assert.equal(
      studentMsgs.length,
      1,
      `应仅 1 条学生消息，实际 ${studentMsgs.length}`,
    );

    release();
    // 等待第一条 send 完成，释放 activeController
    await firstSendP;
  }

  // ── 3. reset 清理消息 ──────────────────────────────────
  {
    initStore();

    globalThis.fetch = makeFastFetch();

    // 先正常发一条消息累积历史
    await act(async () => {
      await send(
        { content: "测试消息", moduleId: "ts-basics" },
        { moduleId: "ts-basics" },
      );
    });

    assert.ok(
      useSessionStore.getState().messages.length > 0,
      "send 后应有消息",
    );

    // reset
    await act(async () => {
      reset();
    });

    assert.equal(
      useSessionStore.getState().messages.length,
      0,
      "reset 后消息清空",
    );
    assert.equal(useSessionStore.getState().status, "idle");
  }

  await act(async () => {
    cleanup();
  });
});