"use client";

import { useRouter } from "next/navigation";
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
 *
 * 点击行为
 * -------
 * 点击后弹出确认弹窗，提醒学生对照检查清单确认自己已学完。
 * 教学上这个节点不能直接跳过——从「听讲」切换到「观察示范」没有回头路，
 * 让学生明确确认后再走。点「取消」留下来继续学。点「确定」才跳转。
 */
export function ExplainNextButton({ moduleId }: { moduleId: string }) {
  const router = useRouter();

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

  const handleClick = () => {
    const confirmed = window.confirm(
      "确认完成学习了吗？\n\n" +
        "请确保你已经：\n" +
        "  1. 认真阅读了全部讲解内容\n" +
        "  2. 理解了本讲的核心概念\n" +
        "  3. 完成了概念测验并通过\n\n" +
        "如果还没看完或不理解，请点「取消」继续学习。",
    );
    if (confirmed) {
      router.push(`/learn/${moduleId}/observe`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-sm"
    >
      讲解完毕，进入观察示范
      <ChevronsRight className="size-4" />
    </button>
  );
}