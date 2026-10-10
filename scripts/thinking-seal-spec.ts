/**
 * 思维链封口时序 —— 收尾后消息快照不再显示「进行中」
 *
 * 钉什么
 * -----
 * 2026-10-07 扇出审计（10/10 讲复现）：消息已 `done`、流式早已停止，
 * 思维链折叠区标题仍显示「进行中」徽标。
 *
 * 根因：消息的 thinkingSteps 是**建消息那一刻**从全局 thinking[] 拷进去
 * 的快照（`inFlightThinking`），而 `closeThinking` 封口的是全局数组 ——
 * 两者不是同一份对象。收尾动作跑完，全局段有了 endedAt，快照里那段仍
 * 没有，`message-item.tsx` 的
 * `isStreaming = steps.some((s) => s.endedAt === undefined)` 永远为真。
 *
 * 与 `thinking-attribution-spec.ts` 的分工：那份钉「快照只取本轮」，
 * 这份钉「收尾时快照也被封口」。两者是不同的失效模式，回归要分别钉。
 *
 * 不调模型：SSE 事件用 dispatch 直接喂 store。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { dispatch } from "@/hooks/useChatStream";
import {
  settleStreamingMessages,
  useSessionStore,
  type ChatMessage,
} from "@/stores";

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

/** message-item.tsx 判定「进行中」徽标的同一个表达式。 */
function showsStreamingBadge(message: {
  thinkingSteps?: readonly { endedAt?: number }[];
}): boolean {
  return (message.thinkingSteps ?? []).some((s) => s.endedAt === undefined);
}

test("completeTurn：消息快照的思维段被封口，徽标不再显示「进行中」", () => {
  const store = useSessionStore.getState();
  store.beginTurn("第一问", { step: "explain" });
  dispatch({
    type: "thinking",
    data: { step: "explain", agent: "teaching", content: "思考中" },
  });
  dispatch({
    type: "token",
    data: { content: "回复正文", messageId: "m1" },
  });
  store.flushTokenBuffer();

  const during = useSessionStore.getState().messages.find((m) => m.id === "m1");
  assert.ok(during);
  assert.equal(
    showsStreamingBadge(during),
    true,
    "流式期间应显示「进行中」——这是正确行为，不是缺陷",
  );

  store.completeTurn({ messageId: "m1", tokens: { input: 1, output: 2 } });

  const after = useSessionStore.getState().messages.find((m) => m.id === "m1");
  assert.ok(after);
  assert.equal(after.status, "done");
  assert.equal(
    showsStreamingBadge(after),
    false,
    "done 之后仍显示「进行中」——这就是扇出审计抓到的缺陷",
  );
  const step = (after.thinkingSteps ?? [])[0];
  assert.ok(step);
  assert.equal(typeof step.endedAt, "number", "快照末段应拿到 endedAt");
});

test("failTurn：error 收尾同样封口快照", () => {
  const store = useSessionStore.getState();
  store.beginTurn("第一问", { step: "explain" });
  dispatch({
    type: "thinking",
    data: { step: "explain", agent: "teaching", content: "思考中" },
  });
  dispatch({
    type: "token",
    data: { content: "半截回复", messageId: "m1" },
  });
  store.flushTokenBuffer();
  store.failTurn({ code: "LLM_ERROR", message: "上游断开", recoverable: true });

  const after = useSessionStore.getState().messages.find((m) => m.id === "m1");
  assert.ok(after);
  assert.equal(after.status, "error");
  assert.equal(
    showsStreamingBadge(after),
    false,
    "error 收尾后不该继续显示「进行中」",
  );
});

test("abortTurn：中断同样封口快照（中断不是错误）", () => {
  const store = useSessionStore.getState();
  store.beginTurn("第一问", { step: "explain" });
  dispatch({
    type: "thinking",
    data: { step: "explain", agent: "teaching", content: "思考中" },
  });
  dispatch({
    type: "token",
    data: { content: "半截回复", messageId: "m1" },
  });
  store.flushTokenBuffer();
  store.abortTurn();

  const after = useSessionStore.getState().messages.find((m) => m.id === "m1");
  assert.ok(after);
  assert.equal(after.status, "done", "用户按停止不该得到红色报错");
  assert.equal(showsStreamingBadge(after), false);
});

test("全局时间线的封口时间与消息快照一致（耗时不会被算成 0ms）", () => {
  const store = useSessionStore.getState();
  store.beginTurn("第一问", { step: "explain" });
  dispatch({
    type: "thinking",
    data: { step: "explain", agent: "teaching", content: "思考中" },
  });
  dispatch({
    type: "token",
    data: { content: "回复正文", messageId: "m1" },
  });
  store.flushTokenBuffer();

  store.completeTurn({ messageId: "m1", tokens: { input: 1, output: 2 } });

  const state = useSessionStore.getState();
  const globalStep = state.thinking[state.thinking.length - 1];
  const assistant = state.messages.find((m) => m.id === "m1");
  const messageStep = (assistant?.thinkingSteps ?? [])[0];
  assert.ok(globalStep && messageStep);
  assert.equal(
    messageStep.endedAt,
    globalStep.endedAt,
    "两处封口应落在同一毫秒，否则时间线会显示一段 0ms 耗时",
  );
});

test("刷新后：残留的 streaming 助手消息收敛成 done（不再永久转圈）", () => {
  /**
   * 直接测 `settleStreamingMessages` 这个纯函数，而不是真的刷新浏览器。
   *
   * 背景：`persist` 的 partialize 不落 status、只落 messages，于是 rehydrate
   * 之后 store.status 回到 idle 而消息数组里那条 streaming 原样回来 ——
   * 没有在途请求会去推进它，就永远停在「输出中」。
   */
  const messages: ChatMessage[] = [
    {
      id: "s1",
      role: "student",
      content: "第一问",
      status: "done",
      citations: [],
      createdAt: "2026-10-07T00:00:00.000Z",
    },
    {
      id: "m1",
      role: "assistant",
      content: "导师输出中正在思考…",
      status: "streaming",
      citations: [],
      createdAt: "2026-10-07T00:00:01.000Z",
    },
    {
      id: "m2",
      role: "assistant",
      content: "服务端真失败过的那条",
      status: "error",
      citations: [],
      createdAt: "2026-10-07T00:00:02.000Z",
    },
  ];

  const next = settleStreamingMessages(messages);
  const student = next.find((m) => m.id === "s1");
  const streaming = next.find((m) => m.id === "m1");
  const errored = next.find((m) => m.id === "m2");

  assert.equal(streaming?.status, "done", "刷新后不该永久停在「输出中」");
  assert.equal(
    streaming?.content,
    "导师输出中正在思考…",
    "正文不能动：本地无从判断内容是否完整，既不假装成功也不篡改",
  );
  assert.equal(student?.status, "done", "学生消息不受影响");
  assert.equal(
    errored?.status,
    "error",
    "服务端真失败的消息要保留 error —— 那是有因的，不能被顺手抹平",
  );
});

test("settleStreamingMessages 无变化时返回原数组（引用稳定）", () => {
  const messages: ChatMessage[] = [
    {
      id: "m1",
      role: "assistant",
      content: "已完成",
      status: "done",
      citations: [],
      createdAt: "2026-10-07T00:00:00.000Z",
    },
  ];
  assert.equal(
    settleStreamingMessages(messages),
    messages,
    "没有要收敛的消息就不该产生新数组（避免无谓的重渲染）",
  );
});