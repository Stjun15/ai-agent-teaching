"use client";

/**
 * FloatingChatStore —— 悬浮球 AI 对话的独立会话状态（多会话版）
 *
 * 与教学主对话（useSessionStore）完全隔离：
 * - 消息不混合：教学页的讲稿/追问与悬浮球的闲聊互不可见
 * - 多会话：支持新建/切换/删除历史对话（类似智能客服）
 * - 持久化到 localStorage：刷新页面后所有对话记录仍在
 * - 标题自动生成：取第一条学生消息前 30 字作为会话名
 */

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";

import { currentStudentId } from "@/lib/client-identity";

export interface FloatingMessage {
  id: string;
  role: "student" | "assistant";
  content: string;
  status: "streaming" | "done" | "error";
  createdAt: string;
}

export interface FloatingSession {
  id: string;
  title: string;
  messages: FloatingMessage[];
  createdAt: string;
}

export type FloatingStatus = "idle" | "streaming" | "error";

export interface FloatingChatState {
  sessions: Record<string, FloatingSession>;
  sessionOrder: string[];
  activeSessionId: string | null;
  status: FloatingStatus;
  errorMessage: string | null;

  ensureSession: () => string;
  createSession: () => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  beginTurn: (content: string) => string;
  appendToken: (content: string, messageId: string) => void;
  completeTurn: (messageId: string) => void;
  failTurn: (errorMessage: string) => void;
  abortTurn: () => void;
  reset: () => void;
}

function newId(): string {
  return crypto.randomUUID();
}

function titleFrom(content: string): string {
  return content.slice(0, 30).replace(/\n/g, " ").trim();
}

function findStreamingAssistant(
  messages: FloatingMessage[],
): FloatingMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (
      messages[i].role === "assistant" &&
      messages[i].status === "streaming"
    ) {
      return messages[i];
    }
  }
  return undefined;
}

function replaceMessage(
  messages: FloatingMessage[],
  id: string,
  patch: (msg: FloatingMessage) => FloatingMessage,
): FloatingMessage[] {
  const index = messages.findIndex((m) => m.id === id);
  if (index === -1) return messages;
  const next = messages.slice();
  next[index] = patch(messages[index]);
  return next;
}

function settleStreaming(
  messages: FloatingMessage[],
): FloatingMessage[] {
  let changed = false;
  const next = messages.map((m) => {
    if (m.role === "assistant" && m.status === "streaming") {
      changed = true;
      return { ...m, status: "done" as const };
    }
    return m;
  });
  return changed ? next : (messages as FloatingMessage[]);
}

function settleSessions(
  sessions: Record<string, FloatingSession>,
): Record<string, FloatingSession> {
  const result: Record<string, FloatingSession> = {};
  for (const [id, session] of Object.entries(sessions)) {
    result[id] = { ...session, messages: settleStreaming(session.messages) };
  }
  return result;
}

/**
 * 落盘的字段子集 —— 与 `partialize` 的返回类型逐字段对齐。
 *
 * `persist` 的第二参泛型是 `PersistStorage<partialize 的返回类型>`，
 * 而不是整个 `FloatingChatState`；用 `Pick` 表达子集，避免把 storage
 * 断言成完整 State 导致的泛型不匹配。
 */
type PersistedFloatingChatState = Pick<
  FloatingChatState,
  "sessions" | "sessionOrder" | "activeSessionId"
>;

export const useFloatingChatStore = create<FloatingChatState>()(
  persist(
    (set, get) => {
      function updateActiveSession(
        fn: (session: FloatingSession) => FloatingSession,
      ): Partial<FloatingChatState> {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId || !sessions[activeSessionId]) return {};
        return {
          sessions: {
            ...sessions,
            [activeSessionId]: fn(sessions[activeSessionId]),
          },
        };
      }

      function activeMessages(): FloatingMessage[] {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId || !sessions[activeSessionId]) return [];
        return sessions[activeSessionId].messages;
      }

      return {
        sessions: {},
        sessionOrder: [],
        activeSessionId: null,
        status: "idle",
        errorMessage: null,

        ensureSession: (): string => {
          const { activeSessionId, sessions } = get();
          if (activeSessionId && sessions[activeSessionId]) {
            return activeSessionId;
          }
          return get().createSession();
        },

        createSession: (): string => {
          const id = newId();
          const now = new Date().toISOString();
          set((s) => ({
            sessions: {
              ...s.sessions,
              [id]: {
                id,
                title: "新对话",
                messages: [],
                createdAt: now,
              },
            },
            sessionOrder: [id, ...s.sessionOrder],
            activeSessionId: id,
            status: "idle" as const,
            errorMessage: null,
          }));
          return id;
        },

        switchSession: (sessionId: string) => {
          const { sessions } = get();
          if (!sessions[sessionId]) return;
          set({
            activeSessionId: sessionId,
            status: "idle",
            errorMessage: null,
          });
        },

        deleteSession: (sessionId: string) => {
          set((s) => {
            const next = { ...s.sessions };
            delete next[sessionId];
            const order = s.sessionOrder.filter((id) => id !== sessionId);
            const activeId =
              s.activeSessionId === sessionId ? (order[0] ?? null) : s.activeSessionId;
            return {
              sessions: next,
              sessionOrder: order,
              activeSessionId: activeId,
              status: "idle",
              errorMessage: null,
            };
          });
        },

        beginTurn: (content: string): string => {
          get().ensureSession();
          const studentId = newId();
          set(() => ({
            ...updateActiveSession((session) => {
              const isFirst = session.messages.length === 0;
              return {
                ...session,
                title: isFirst ? titleFrom(content) : session.title,
                messages: [
                  ...session.messages,
                  {
                    id: studentId,
                    role: "student",
                    content,
                    status: "done",
                    createdAt: new Date().toISOString(),
                  },
                ],
              };
            }),
            status: "streaming",
            errorMessage: null,
          }));
          return studentId;
        },

        appendToken: (content: string, messageId: string) => {
          set(() => {
            const messages = activeMessages();
            const streaming = findStreamingAssistant(messages);
            if (streaming) {
              return updateActiveSession((session) => ({
                ...session,
                messages: replaceMessage(session.messages, streaming.id, (m) => ({
                  ...m,
                  content: m.content + content,
                })),
              }));
            }
            return updateActiveSession((session) => ({
              ...session,
              messages: [
                ...session.messages,
                {
                  id: messageId,
                  role: "assistant",
                  content,
                  status: "streaming",
                  createdAt: new Date().toISOString(),
                },
              ],
            }));
          });
        },

        completeTurn: (_messageId: string) => {
          set(() => {
            const messages = activeMessages();
            const streaming = findStreamingAssistant(messages);
            if (streaming) {
              return {
                ...updateActiveSession((session) => ({
                  ...session,
                  messages: replaceMessage(session.messages, streaming.id, (m) => ({
                    ...m,
                    status: "done",
                  })),
                })),
                status: "idle" as const,
              };
            }
            return { status: "idle" as const };
          });
        },

        failTurn: (errorMessage: string) => {
          set(() => {
            const messages = activeMessages();
            const streaming = findStreamingAssistant(messages);
            if (streaming) {
              return {
                ...updateActiveSession((session) => ({
                  ...session,
                  messages: replaceMessage(session.messages, streaming.id, (m) => ({
                    ...m,
                    status: "error",
                  })),
                })),
                status: "error",
                errorMessage,
              };
            }
            return { status: "error", errorMessage };
          });
        },

        abortTurn: () => {
          set(() => {
            const messages = activeMessages();
            const streaming = findStreamingAssistant(messages);
            if (streaming) {
              return {
                ...updateActiveSession((session) => ({
                  ...session,
                  messages: replaceMessage(session.messages, streaming.id, (m) => ({
                    ...m,
                    status: "done",
                  })),
                })),
                status: "idle" as const,
              };
            }
            return { status: "idle" as const };
          });
        },

        reset: () =>
          set({
            sessions: {},
            sessionOrder: [],
            activeSessionId: null,
            status: "idle",
            errorMessage: null,
          }),
      };
    },
    {
      name: "ai-teaching:floating-chat",
      storage: {
        getItem: (name) => {
          try {
            const key = `${name}:${currentStudentId()}`;
            const raw = localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            const key = `${name}:${currentStudentId()}`;
            localStorage.setItem(key, JSON.stringify(value));
          } catch {
            // silently ignore
          }
        },
        removeItem: (name) => {
          try {
            const key = `${name}:${currentStudentId()}`;
            localStorage.removeItem(key);
          } catch {
            // silently ignore
          }
        },
      } as PersistStorage<PersistedFloatingChatState>,
      partialize: (state) => ({
        sessions: settleSessions(state.sessions),
        sessionOrder: state.sessionOrder,
        activeSessionId: state.activeSessionId,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<FloatingChatState>),
      }),
    },
  ),
);