"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import { MarkdownView } from "@/components/chat/markdown-view";
import { getAssignmentFromMessages, splitLecture } from "@/lib/lecture-split";
import { useSessionStore } from "@/stores";

/**
 * 动手模仿页的任务卡 —— 讲解稿里「现在轮到你」整节。
 *
 * 分屏后（2026-09-19）作业要求在模仿步才输出：概念讲解页的讲稿渲染到
 * 该节之前为止，这里补上 —— 学生带着刚读过的概念，直接面对任务。
 *
 * 内容源有两条，互为兜底：
 * 1. **讲稿缓存 API**（`/api/lecture-cache?step=explain`，本地 SQLite，
 *    毫秒级、零模型调用）—— 覆盖「直接刷新到模仿页」的场景：消息在
 *    内存里，硬刷新后 store 是空的，没有这条兜底任务卡就会消失；
 * 2. **会话 store** 里 step=explain 的讲稿消息 —— 覆盖缓存未预生成、
 *    讲稿是现场流式生成的部署（新部署还没跑预生成脚本）。
 *
 * 两者都取不到时不渲染整卡：编辑器本身不需要等任务卡。
 */
export function AssignmentCard({ moduleId }: { moduleId: string }) {
  const messages = useSessionStore((state) => state.messages);
  const [cachedAssignment, setCachedAssignment] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lecture-cache?moduleId=${moduleId}&step=explain`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { found?: boolean; content?: string } | null) => {
        if (cancelled || !data?.found || !data.content) return;
        setCachedAssignment(splitLecture(data.content).assignment);
      })
      .catch(() => {
        // 缓存不可达不报错：还有会话兜底，再不行就不渲染任务卡。
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const storeAssignment = useMemo(
    () => getAssignmentFromMessages(messages, "explain"),
    [messages],
  );
  const assignment = cachedAssignment ?? storeAssignment;

  if (!assignment) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <ClipboardCheck className="size-4" />
        <span className="text-xs font-medium">现在轮到你</span>
      </div>
      <div className="px-3 py-2 text-sm leading-relaxed">
        <MarkdownView source={assignment} />
      </div>
      <div className="border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        提交前，请在上方编辑器选择与本作业相符的「交付类型」（Prompt / 工具描述
        / 代码）—— 点评按所选类型取评分标准，选错会得到不相关的建议。
      </div>
    </div>
  );
}
