"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 概念讲解全屏开关 —— 只在 explain 步可见的切换按钮。
 *
 * 教学场景
 * -------
 * 概念讲解的核心是让学生**沉浸式阅读讲稿**（由 LectureLauncher 播种的
 * 缓存讲稿），而三栏布局里的左栏步骤导航、右栏时间线/引用/Token 计数、
 * 顶部的面包屑与标题，在这一步都不是主角。全屏模式把这些收起来，
 * 讲稿 + 问答区占据整个视口。
 *
 * 不影响其他步骤
 * -----------
 * 本组件只包裹 explain 步的对话卡片区域，其余六步不渲染全屏按钮，
 * 它们的布局完全不受影响。
 *
 * 退出方式
 * -------
 * - 点击同一个按钮（图标从最大化变成还原）；
 * - 按 Escape 键。
 * 退出后恢复进入前的状态（对话消息不受影响，组件从 DOM 移除后
 * ChatPanel 的 store 状态仍在内存里）。
 */
export function ExplainFullscreen({ children }: { children: React.ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);

  const toggle = useCallback(() => setFullscreen((f) => !f), []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return (
    <>
      {/* 正常模式下的全屏按钮 */}
      {!fullscreen ? (
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 size-8"
            onClick={toggle}
            title="全屏阅读"
            aria-label="全屏阅读"
          >
            <Maximize2 className="size-4" />
          </Button>
          {children}
        </div>
      ) : (
        /* 全屏覆盖层 */
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* 顶部栏：退出按钮 */}
          <div className="flex shrink-0 items-center border-b px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggle}
              title="退出全屏"
              aria-label="退出全屏"
            >
              <Minimize2 className="size-4" />
            </Button>
            <span className="ml-3 text-sm text-muted-foreground">
              全屏阅读 · 按 Esc 退出
            </span>
          </div>
          {/* 内容区：填满剩余高度；[&>*]:!h-full 覆盖 Card 的固定高度 */}
          <div className="min-h-0 flex-1 [&>*]:!h-full">{children}</div>
        </div>
      )}
    </>
  );
}
