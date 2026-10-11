"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageSquare } from "lucide-react";

import { MessageItem } from "@/components/chat/message-item";
import { useSessionStore } from "@/stores";
import {
  selectStepMessages,
  arbitrateDualTask,
  type LectureMode,
} from "@/lib/lecture-split";

/**
 * 对话面板（模块页中栏主体）。
 *
 * 自动滚动只在「用户本来就在底部」时才跟随
 * -------------------------------------
 * 最省事的写法是每次内容变化都 `scrollToBottom()`，但那样有个很糟的副作用：
 * 学生想往上翻看前一句时，流式输出会不断把他拽回底部 —— 根本没法读。
 * 这里用一个 48px 的容差判断「是否在底部」，只有在底部才跟随。
 * 这是纯前端的交互细节，但直接决定「能不能一边输出一边读」。
 *
 * 滚动容器与消息列表是同一个元素（`overflow-y-auto`），
 * 判断距离用 `scrollHeight - scrollTop - clientHeight`。
 */
export function ChatPanel({
  stepFilter,
  lectureMode = "full",
  moduleId,
  hasCachedTask = false,
}: {
  /**
   * 按学习步骤过滤消息（七步分屏，2026-09-19）：每一步只渲染属于自己的
   * 消息 —— 概念讲解页不再出现示范步的内容，动手模仿页上划也看不到
   * 前面的讲稿。不传 = 旧的全量行为（未分屏的步骤与模块沿用）。
   */
  stepFilter?: string;
  /** 该步讲稿消息的处理方式，语义见 `lib/lecture-split.ts`。 */
  lectureMode?: LectureMode;
  /**
   * 所属模块：会话态按模块隔离（`ensureModule`），切模块即清空上一
   * 模块的对话；渲染守卫防止切换瞬间闪现旧模块的消息。
   */
  moduleId?: string;
  /**
   * 当前模块是否有缓存任务（assignment-card 已从 explain 讲稿中取出）。
   * 为 true 时，检测实时对话消息中的任务标题并追加仲裁文案，
   * 防止导师在 observe/imitate 步另出一道新题造成双任务冲突。
   */
  hasCachedTask?: boolean;
}) {
  const rawMessages = useSessionStore((state) => state.messages);
  const activeModuleId = useSessionStore((state) => state.activeModuleId);
  const status = useSessionStore((state) => state.status);
  const error = useSessionStore((state) => state.error);
  const messages = useMemo(() => {
    const filtered = stepFilter
      ? selectStepMessages(rawMessages, stepFilter, lectureMode)
      : rawMessages;
    if (!hasCachedTask) return filtered;
    return filtered.map((message) =>
      message.role === "assistant"
        ? { ...message, content: arbitrateDualTask(message.content, true) }
        : message,
    );
  }, [rawMessages, stepFilter, lectureMode, hasCachedTask]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (moduleId !== undefined) {
      useSessionStore.getState().ensureModule(moduleId);
    }
  }, [moduleId]);

  // 模块切换的第一帧 store 里还是旧模块的消息：渲染空态而不是闪现
  // 旧内容（effect 清空后下一帧恢复正常）。
  const moduleMismatch = moduleId !== undefined && activeModuleId !== moduleId;

  function handleScroll(): void {
    const element = scrollRef.current;
    if (element === null) return;
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottomRef.current = distance < 48;
  }

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const element = scrollRef.current;
    if (element === null) return;
    // 概念讲解步（lectureMode==="truncate"）初进时只有一条讲稿：默认
    // 把滚动停在最上方（显示讲稿开头），而不是自动滚到底部。学生开始
    // 追问产生多条消息后照常滚到底跟随对话。
    if (
      lectureMode === "truncate" &&
      messages.length === 1 &&
      messages[0].role === "assistant"
    ) {
      element.scrollTop = 0;
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [messages, lectureMode]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-1 py-2"
        aria-live="polite"
        aria-busy={status === "streaming"}
      >
        {moduleMismatch || messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="size-5 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">还没有对话</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              在下面输入你的问题，或先说说你打算怎么写。
              导师不会直接给答案，会先问你几个问题。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {error !== null ? (
        <p
          role="alert"
          className="mx-1 mb-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive"
        >
          <span className="font-medium">{error.code}</span>：{error.message}
          {error.recoverable ? "（可以重试）" : "（重试无效，需要改输入）"}
        </p>
      ) : null}
    </div>
  );
}
