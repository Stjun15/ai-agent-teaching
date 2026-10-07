"use client";

import Link from "next/link";
import { ChevronsRight } from "lucide-react";

import { useSessionStore } from "@/stores";

/**
 * 概念讲解完成后的「下一步」按钮。
 *
 * 出现条件
 * -------
 * - 会话空闲（不在流式输出中）
 * - 当前步骤范围内存在至少一条状态为 `done` 的助手消息（讲稿已产出）
 *
 * 满足条件时在 ChatPanel 与 Composer 之间渲染一条醒目的跳转按钮，
 * 引导学生进入观察示范。按钮在全屏与半屏模式下均可见——
 * 它渲染在 CardContent 的 flex 列内，全屏时 Card 撑满视口、按钮自然在底部。
 */
export function ExplainNextButton({ moduleId }: { moduleId: string }) {
  const hasCompletedLecture = useSessionStore((state) => {
    if (state.status !== "idle" && state.status !== "done") return false;
    return state.messages.some(
      (m) =>
        m.role === "assistant" &&
        m.step === "explain" &&
        m.status === "done" &&
        m.content.trim() !== "",
    );
  });

  if (!hasCompletedLecture) return null;

  return (
    <Link
      href={`/learn/${moduleId}/observe`}
      className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-sm"
    >
      讲解完毕，进入观察示范
      <ChevronsRight className="size-4" />
    </Link>
  );
}
