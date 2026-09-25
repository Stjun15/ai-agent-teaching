/**
 * ExplainColdStart 组件渲染行为
 *
 * 钉什么
 * -----
 * shouldHide 决策：四种场景下组件是否渲染 DOM。
 * 这是纯逻辑级回归 —— 不调模型、不调 API，只测「出现/不出现」。
 *
 * 为什么用组件测试
 * ---------------
 * `parseAxes`、`MODULE_ID_RE` 是纯函数，单测即覆盖；
 * `/api/module-content` 是 HTTP 端点，curl 级覆盖；
 * 但 `shouldHide` 是 React 渲染条件，不渲染就测不到它到底 return null
 * 还是 return JSX。这条回归属于「上次坏的就是这个逻辑」。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createElement } from "react";
import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { ExplainColdStart } from "@/components/learn/explain-cold-start";
import { useSessionStore } from "@/stores";

// ---------------------------------------------------------------------------
// 共享状态复位
// ---------------------------------------------------------------------------

function resetSessionStore() {
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
  localStorage.clear();
  resetSessionStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetSessionStore();
});

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

test("shouldHide：status=idle 且无旧消息时渲染", async () => {
  resetSessionStore();
  useSessionStore.setState({ status: "idle", messages: [] });

  await act(async () => {
    render(
      createElement(ExplainColdStart, {
        moduleId: "python-basics",
        moduleName: "Python 基础速通",
      }),
    );
  });

  // content 渲染出来后至少应有一个包含正文的 DOM 节点
  const el = screen.queryByText("正文内容用于验证渲染。");
  assert.ok(el !== null, "idle 状态应渲染概念页正文");
});

test("shouldHide：status=streaming 时不渲染", async () => {
  resetSessionStore();
  useSessionStore.setState({ status: "streaming", messages: [] });

  await act(async () => {
    const result = render(
      createElement(ExplainColdStart, {
        moduleId: "python-basics",
        moduleName: "Python 基础速通",
      }),
    );
    assert.equal(
      result.container.innerHTML,
      "",
      "streaming 时应返回 null（空 HTML）",
    );
  });
});

test("shouldHide：有旧消息（step=explain）仍渲染（回归：上次因 messages.some 误隐）", async () => {
  resetSessionStore();
  useSessionStore.setState({
    status: "idle",
    messages: [
      {
        id: "msg-1",
        role: "assistant",
        content: "这是旧的 AI 讲稿……",
        status: "done",
        citations: [],
        createdAt: new Date().toISOString(),
        step: "explain",
      },
    ],
  });

  await act(async () => {
    render(
      createElement(ExplainColdStart, {
        moduleId: "ts-basics",
        moduleName: "TypeScript 基础速通",
      }),
    );
  });

  // 即使 messages 里有 step="explain" 的旧消息，仍应渲染（startedRef=false）
  const el = screen.queryByText("正文内容用于验证渲染。");
  assert.ok(
    el !== null,
    "有旧 explain 消息时仍应渲染，不应被 messages.some 误隐",
  );
});

test("shouldHide：status=done 时不渲染（讲稿已出现，不再需要冷启动卡片）", async () => {
  resetSessionStore();
  useSessionStore.setState({ status: "done", messages: [] });

  await act(async () => {
    const result = render(
      createElement(ExplainColdStart, {
        moduleId: "python-basics",
        moduleName: "Python 基础速通",
      }),
    );
    assert.equal(
      result.container.innerHTML,
      "",
      "done 状态应返回 null",
    );
  });
});

test("shouldHide：status=aborted 时不渲染", async () => {
  resetSessionStore();
  useSessionStore.setState({ status: "aborted", messages: [] });

  await act(async () => {
    const result = render(
      createElement(ExplainColdStart, {
        moduleId: "python-basics",
        moduleName: "Python 基础速通",
      }),
    );
    assert.equal(
      result.container.innerHTML,
      "",
      "aborted 状态应返回 null",
    );
  });
});