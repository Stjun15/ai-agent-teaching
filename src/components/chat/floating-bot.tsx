"use client";

/**
 * FloatingChatBot —— 独立于教学对话的悬浮 AI 助教（多会话版）
 *
 * 数据隔离
 * -------
 * - 消息存在 useFloatingChatStore，与教学主对话（useSessionStore）完全隔离
 * - 多会话：支持新建/切换/删除历史对话
 * - 持久化到 localStorage（key: "ai-teaching:floating-chat"），刷新后恢复
 * - 自助 SSE：直接调 handleSSE，不走 useChatStream（后者绑定教学 Store）
 *
 * 交互
 * ----
 * - 右下角悬浮球（Bot 图标），点击展开 380×480 的聊天面板
 * - 面板内两种视图：对话视图 / 历史记录视图
 * - Enter 发送、Shift+Enter 换行
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CornerDownLeft,
  History,
  Loader2,
  MessageSquarePlus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { handleSSE, isAbortError, SSEHttpError } from "@/lib/sse";
import {
  useFloatingChatStore,
  type FloatingMessage,
  type FloatingSession,
} from "@/stores/floating-chat";

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 480;

type PanelView = "chat" | "history";

export function FloatingChatBot() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("chat");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const store = useFloatingChatStore;
  const activeSessionId = useFloatingChatStore((s) => s.activeSessionId);
  const sessions = useFloatingChatStore((s) => s.sessions);
  const sessionOrder = useFloatingChatStore((s) => s.sessionOrder);
  const status = useFloatingChatStore((s) => s.status);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const getActiveHistory = useCallback((): FloatingMessage[] => {
    const id = store.getState().activeSessionId;
    if (!id) return [];
    return store.getState().sessions[id]?.messages ?? [];
  }, [store]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed === "" || status === "streaming") return;

    setText("");
    const controller = new AbortController();
    abortRef.current = controller;

    store.getState().beginTurn(trimmed);

    try {
      await handleSSE(
        "/api/chat",
        {
          content: trimmed,
          history: buildHistory(getActiveHistory()),
        },
        (event) => {
          if (!mountedRef.current) return;
          switch (event.type) {
            case "token":
              store
                .getState()
                .appendToken(event.data.content, event.data.messageId);
              return;
            case "done":
              store.getState().completeTurn(event.data.messageId);
              return;
            case "error":
              store.getState().failTurn(event.data.message);
              return;
          }
        },
        {
          signal: controller.signal,
          onInvalidFrame: () => {},
        },
      );

      if (
        mountedRef.current &&
        store.getState().status === "streaming"
      ) {
        store.getState().completeTurn("");
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (isAbortError(error)) {
        store.getState().abortTurn();
        return;
      }
      const msg =
        error instanceof SSEHttpError
          ? error.message
          : "网络异常，请稍后重试";
      store.getState().failTurn(msg);
    } finally {
      abortRef.current = null;
    }
  }, [text, status, store, getActiveHistory]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleNewSession = useCallback(() => {
    abortRef.current?.abort();
    store.getState().createSession();
    setView("chat");
  }, [store]);

  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      store.getState().switchSession(sessionId);
      setView("chat");
    },
    [store],
  );

  const handleDeleteSession = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      store.getState().deleteSession(sessionId);
    },
    [store],
  );

  const handleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        store.getState().ensureSession();
        setView("chat");
      }
      return next;
    });
  }, [store]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open || view !== "chat") return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, open, view]);

  useEffect(() => {
    if (open && view === "chat") inputRef.current?.focus();
  }, [open, view]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "关闭对话" : "打开 AI 对话"}
        onClick={handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center",
          "rounded-full border border-input bg-background shadow-lg",
          "transition-all duration-300 hover:scale-105 hover:shadow-xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "scale-0 opacity-0 pointer-events-none",
        )}
      >
        <Bot className="size-6 text-primary" />
      </button>

      {open && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden",
            "rounded-xl border border-input bg-background shadow-2xl",
            "animate-in slide-in-from-bottom-4 duration-300",
          )}
          style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
        >
          {view === "history" ? (
            <HistoryView
              sessions={sessions}
              sessionOrder={sessionOrder}
              activeSessionId={activeSessionId}
              onBack={() => setView("chat")}
              onSwitch={handleSwitchSession}
              onDelete={handleDeleteSession}
              onNew={handleNewSession}
            />
          ) : (
            <ChatView
              messages={messages}
              status={status}
              text={text}
              activeSession={activeSession}
              onTextChange={setText}
              onSend={handleSend}
              onAbort={handleAbort}
              onKeyDown={handleKeyDown}
              onNew={handleNewSession}
              onHistory={() => setView("history")}
              onClose={() => setOpen(false)}
              inputRef={inputRef}
              scrollRef={scrollRef}
            />
          )}
        </div>
      )}
    </>
  );
}

function HistoryView({
  sessions,
  sessionOrder,
  activeSessionId,
  onBack,
  onSwitch,
  onDelete,
  onNew,
}: {
  sessions: Record<string, FloatingSession>;
  sessionOrder: string[];
  activeSessionId: string | null;
  onBack: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onNew: () => void;
}) {
  const list = sessionOrder
    .map((id) => sessions[id])
    .filter(Boolean);

  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="返回对话"
            onClick={onBack}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold">历史对话</span>
        </div>
        <button
          type="button"
          aria-label="新建对话"
          onClick={onNew}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <MessageSquarePlus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无历史对话
          </div>
        ) : (
          <div className="divide-y">
            {list.map((session) => {
              const lastMsg = session.messages[session.messages.length - 1];
              const preview = lastMsg
                ? lastMsg.content.slice(0, 50).replace(/\n/g, " ")
                : "";
              const isActive = session.id === activeSessionId;
              const date = formatDate(session.createdAt);

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSwitch(session.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    isActive && "bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {session.title}
                      </div>
                      {preview ? (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {preview}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[11px] text-muted-foreground/60">
                        {date}
                      </span>
                      <button
                        type="button"
                        aria-label="删除对话"
                        onClick={(e) => onDelete(session.id, e)}
                        className="rounded p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {isActive && (
                    <div className="mt-1.5 h-0.5 w-8 rounded-full bg-primary/40" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ChatView({
  messages,
  status,
  text,
  activeSession,
  onTextChange,
  onSend,
  onAbort,
  onKeyDown,
  onNew,
  onHistory,
  onClose,
  inputRef,
  scrollRef,
}: {
  messages: FloatingMessage[];
  status: string;
  text: string;
  activeSession: FloatingSession | undefined;
  onTextChange: (v: string) => void;
  onSend: () => void;
  onAbort: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onNew: () => void;
  onHistory: () => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">
            {activeSession?.title ?? "AI 助教"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {status === "streaming" && (
            <button
              type="button"
              aria-label="停止生成"
              onClick={onAbort}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Loader2 className="size-4 animate-spin" />
            </button>
          )}
          <button
            type="button"
            aria-label="历史对话"
            onClick={onHistory}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <History className="size-4" />
          </button>
          <button
            type="button"
            aria-label="新建对话"
            onClick={onNew}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MessageSquarePlus className="size-4" />
          </button>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            有问题随时问我
          </div>
        ) : (
          messages.map((message) => (
            <FloatingMessageItem key={message.id} message={message} />
          ))
        )}
      </div>

      <div className="border-t px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入你的问题…"
            rows={2}
            disabled={status === "streaming"}
            spellCheck={false}
            className={cn(
              "min-h-[40px] max-h-[120px] flex-1 resize-none rounded-md border-0 bg-muted/50",
              "px-3 py-2 text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:opacity-50",
            )}
          />
          <Button
            size="icon"
            variant="default"
            className="size-9 shrink-0"
            disabled={text.trim() === "" || status === "streaming"}
            onClick={onSend}
          >
            {status === "streaming" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CornerDownLeft className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

function buildHistory(
  messages: FloatingMessage[],
): { role: "student" | "assistant"; content: string }[] {
  return messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return "";
  }
}

function FloatingMessageItem({ message }: { message: FloatingMessage }) {
  const isStudent = message.role === "student";
  const isStreaming = message.status === "streaming";
  const isError = message.status === "error";

  return (
    <div
      className={cn(
        "flex gap-3",
        isStudent ? "flex-row-reverse text-right" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isStudent ? "bg-secondary" : "bg-primary/10",
        )}
      >
        {isStudent ? (
          <span className="text-xs">你</span>
        ) : (
          <Bot className="size-3.5 text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
            isStudent
              ? "bg-secondary text-secondary-foreground"
              : isError
                ? "bg-destructive/10 text-destructive"
                : "bg-muted",
            isStreaming && "border-l-2 border-primary/50",
          )}
        >
          {isError ? (
            <span>{message.content || "回复失败，请重试"}</span>
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary/70 align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
}