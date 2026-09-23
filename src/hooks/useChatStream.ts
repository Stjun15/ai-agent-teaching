"use client";

/**
 * useChatStream —— 把 SSE 客户端与三个 Store 接起来
 *
 * 依据
 * ----
 * `04-frontend.md`「交付物」列出 `src/hooks/` 自定义 hooks（`useSSE` 等）；
 * `api-spec.md`「九、API 调用示例」给出前端消费 SSE 的写法（switch 事件类型）。
 *
 * 这一层存在的理由
 * --------------
 * `src/lib/sse.ts` 只负责「把字节变成合法的协议事件」，不知道 Store 的存在；
 * 各 Store 只负责「状态怎么变」，不知道 HTTP。中间的翻译（哪种事件改动哪个
 * Store 的哪一段）集中在这里一处 —— 否则每个面板组件都要自己订阅一遍流，
 * 同一条消息会被处理多次。
 *
 * 事件分发不是「全部塞进 SessionStore」
 * ---------------------------------
 * 10 种事件按归属分头处理，因为它们的生命周期不一样：
 *
 * | 事件 | 去处 | 为什么 |
 * |---|---|---|
 * | `token` / `thinking` / `tool_call` / `tool_result` / `citation` / `done` / `error` | SessionStore | 都是「这一轮对话发生了什么」 |
 * | `validation` | CodeStore | 校验结果属于**待校验的产物**，换一轮对话不该清掉它 |
 * | `visualization` | VisualizationStore | 场景播放状态与对话无关，且要能被反复重播 |
 * | `ui` | 回调交给调用方 | 生成式 UI 的组件注册表要到后续阶段才建；现在**不猜**，明确交出去 |
 *
 * `ui` 事件被交出去而不是忽略：它是协议里定义好的事件，忽略等于悄悄丢内容。
 * 调用方（模块页）现在明确地不处理它，但那是一个决定，不是一个疏漏。
 */

import { useCallback, useEffect, useRef } from "react";

import { useCodeStore } from "@/stores/code";
import { useSessionStore, type SessionError } from "@/stores/session";
import { useVisualizationStore } from "@/stores/visualization";
import { handleSSE, isAbortError, SSEHttpError } from "@/lib/sse";
import type { ChatRequest, SSEEventInput } from "@/schemas";

/**
 * `/api/chat` 的请求体类型**直接由 `ChatRequestSchema` 推导**，不在前端手写。
 *
 * 为什么不许手写：首版这里是一个手写接口 `{ content; agent? }`，而输入区
 * 实际发送的是 `{ content, code, language }`。调用处用对象展开传参 ——
 * 对象展开抹掉字面量 freshness，多余属性检查失效，`tsc` 全绿；随后服务端
 * 的 Zod 把不认识的键静默剥离。「附带代码」因此成了点了没反应的按钮，
 * 且类型检查完全拦不住（已实测）。类型从 schema 推导后，两边只有一份口径，
 * schema 里没有的字段前端根本写不出来。
 */
export type { ChatRequest };

export interface UseChatStreamOptions {
  /** 端点地址。默认 `/api/chat`。 */
  url?: string;
  /** 生成式 `ui` 事件的出口；不传即明确不处理。 */
  onUiEvent?: (event: {
    component: string;
    props: Record<string, unknown>;
  }) => void;
}

export interface ChatStreamController {
  /** 发一轮消息。重复调用会被拒绝（同一时刻只允许一条流）。 */
  send: (
    request: ChatRequest,
    options?: { silent?: boolean; moduleId?: string },
  ) => Promise<void>;
  /** 中断当前流。已收到的内容会保留。 */
  abort: () => void;
  /** 清空会话（消息、思考、工具、引用、用量）。 */
  reset: () => void;
}

/** 「同一时刻只允许一条流」的全局闸门。
 *
 * 为什么是模块级而不是实例级（`useRef`）：发起流的和摆「停止」按钮的
 * 可能是**两个组件实例** —— 讲解步骤由 `LectureLauncher` 自动开讲，
 * `Composer` 只负责中止。各存一份的话，停止按钮 abort 的是自己实例里
 * 那个 null，自动开讲的流根本停不下来（2026-09-19 实测推导）。
 */
const activeController: { current: AbortController | null } = { current: null };

export function useChatStream(
  options: UseChatStreamOptions = {},
): ChatStreamController {
  const { url = "/api/chat", onUiEvent } = options;

  // 组件卸载后仍在飞的事件要丢弃，否则会对已卸载的 Store 消费者写入。
  const mountedRef = useRef(true);
  const onUiEventRef = useRef(onUiEvent);
  useEffect(() => {
    // 回调经 ref 转发，避免它成为 send 的依赖（调用方常用内联函数）。
    // 必须在 effect 里写 ref，而不是渲染期间直接赋值 —— 后者违反
    // React 的渲染纯性约定（react-hooks/refs 会拦），并发渲染下会读到
    // 与本次渲染不一致的值。
    onUiEventRef.current = onUiEvent;
  }, [onUiEvent]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 卸载即中断：否则关页面后服务端还在跑一次完整的模型调用，
      // 白烧一份 token。
      activeController.current?.abort();
      activeController.current = null;
    };
  }, []);

  const send = useCallback(
    async (
      request: ChatRequest,
      /** `silent`：不在对话里落学生消息 —— 给「导师自动开讲」用。 */
      options?: { silent?: boolean; moduleId?: string },
    ): Promise<void> => {
      if (activeController.current !== null) return;

      const controller = new AbortController();
      activeController.current = controller;

      const session = useSessionStore.getState();
      // 模块切换时清空上一模块的对话态（含中止在途流）—— 跨模块的
      // 讲稿/问答不允许串台（2026-09-19「每个模块不要套用其他模块」）。
      if (options?.moduleId !== undefined) {
        if (session.activeModuleId !== options.moduleId) {
          activeController.current?.abort();
          activeController.current = null;
        }
        session.ensureModule(options.moduleId);
      }

      // ---- 构建历史 ----
      // silent（自动开讲）不带历史：开场讲稿应从零生成，不该受上一模块
      // 残余消息干扰。学生追问才带历史，让模型理解「你刚才提到的…」。
      if (options?.silent !== true) {
        // 在 beginTurn 之前取：当前这条学生消息还没进 messages，
        // 历史只包含「已经说过的话」。
        const priorMessages = request.step
          ? session.messages.filter((m) => m.step === request.step)
          : session.messages;
        const recent = priorMessages.slice(-10);
        if (recent.length > 0) {
          request = {
            ...request,
            history: recent.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          };
        }
      }

      // step 随轮次进 store：学生消息直接带标签，助手消息经 turnStep 继承
      // —— LectureLauncher 的「这一步开过场没有」按消息的 step 判断。
      session.beginTurn(request.content, {
        silent: options?.silent,
        step: request.step,
      });

      const turnModuleId = options?.moduleId;
      try {
        await handleSSE(
          url,
          request,
          (event) => {
            if (!mountedRef.current) return;
            // 学生在流式输出途中切走了模块：迟到事件一律丢弃，
            // 否则旧模块的 token 会写进新模块的对话。
            if (
              turnModuleId !== undefined &&
              useSessionStore.getState().activeModuleId !== turnModuleId
            ) {
              return;
            }
            dispatch(event, onUiEventRef.current);
          },
          {
            signal: controller.signal,
            // 损坏的帧只计数、不弹错：一条坏帧不该中断整轮对话，
            // 但用户要有办法知道「有内容没解析出来」（见 TokenCounter）。
            onInvalidFrame: () => useSessionStore.getState().noteInvalidFrame(),
          },
        );

        // 流正常结束但没收到 `done`（服务端异常关闭）时兜底收尾，
        // 否则界面会永远停在「正在输出」。
        const state = useSessionStore.getState();
        if (state.status === "streaming") {
          useSessionStore.getState().completeTurn({
            messageId: "",
            tokens: state.tokens ?? { input: 0, output: 0 },
          });
        }
      } catch (error) {
        if (isAbortError(error)) {
          useSessionStore.getState().abortTurn();
          return;
        }

        useSessionStore.getState().failTurn(toSessionError(error));
      } finally {
        activeController.current = null;
      }
    },
    [url],
  );

  const abort = useCallback(() => {
    activeController.current?.abort();
  }, []);

  const reset = useCallback(() => {
    activeController.current?.abort();
    useSessionStore.getState().reset();
  }, []);

  return { send, abort, reset };
}

/** 单个事件 → 对应 Store 的改动。 */
function dispatch(
  event: SSEEventInput,
  onUiEvent?: (event: {
    component: string;
    props: Record<string, unknown>;
  }) => void,
): void {
  const session = useSessionStore.getState();

  switch (event.type) {
    case "token":
      session.appendToken(event.data.content, event.data.messageId);
      return;

    case "thinking":
      session.appendThinking(event.data);
      return;

    case "tool_call":
      session.addToolCall(event.data);
      return;

    case "tool_result":
      session.addToolResult({
        callId: event.data.callId,
        result: event.data.result,
        durationMs: event.data.duration,
      });
      return;

    case "citation":
      session.addCitation(event.data);
      return;

    case "validation":
      useCodeStore.getState().resolveValidation(event.data);
      return;

    case "visualization":
      useVisualizationStore.getState().selectScene(event.data.sceneId);
      return;

    case "ui":
      // 生成式 UI：注册表尚未建立，明确交给调用方而不是丢弃。
      onUiEvent?.(event.data);
      return;

    case "done":
      session.completeTurn(event.data);
      return;

    case "error":
      session.failTurn(event.data);
      return;

    default: {
      // 穷举检查：协议新增事件类型而这里没接时，这一行会编译报错。
      const exhaustive: never = event;
      void exhaustive;
      return;
    }
  }
}

/**
 * 任意异常 → `SessionError`。
 *
 * `SSEHttpError` 带着协议里的错误码与可恢复性，直接用；
 * 其余（网络中断、DNS 失败）归为 `LLM_ERROR` 并标可恢复 ——
 * 这类失败重试往往就好了，而 `INVALID_INPUT` 那种重试多少次都一样。
 */
function toSessionError(error: unknown): SessionError {
  if (error instanceof SSEHttpError) {
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
    };
  }

  return {
    code: "LLM_ERROR",
    message: error instanceof Error ? error.message : String(error),
    recoverable: true,
  };
}
