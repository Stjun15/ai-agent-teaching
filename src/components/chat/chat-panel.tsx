"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

import { MessageItem } from "@/components/chat/message-item";
import { useSessionStore } from "@/stores";

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
export function ChatPanel() {
  const messages = useSessionStore((state) => state.messages);
  const status = useSessionStore((state) => state.status);
  const error = useSessionStore((state) => state.error);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

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
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-1 py-2"
        aria-live="polite"
        aria-busy={status === "streaming"}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageSquare className="size-6" />
            <p className="text-sm">还没有对话</p>
            <p className="max-w-xs text-xs leading-relaxed">
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
