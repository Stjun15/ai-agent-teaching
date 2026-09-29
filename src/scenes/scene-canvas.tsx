"use client";

/**
 * 场景画布与状态色 —— 9 个场景共用的「舞台」
 *
 * 为什么先立一套原语
 * ----------------
 * 9 个场景如果各写各的画布与间距，会出现「同一个东西在 9 个场景里长得不一样」：
 * 一个场景的节点是圆角边框、另一个是灰底无边框，学生切换场景时会以为这是
 * 不同的概念。原语的作用是把「一个节点长什么样」定死一次。
 *
 * 状态只有四档，而且是**语义档位**而不是颜色
 * --------------------------------------
 * `idle / active / done / alert` 是这类动画里唯一需要的区分：还没轮到、正在
 * 处理、已完成、被拦下。颜色（中性 / 强调 / 绿 / 红）由本文件映射，场景只声明
 * 「这一步处于什么状态」。将来要调色（比如深色模式下绿色发白）只改一处，
 * 不必去 9 个场景里找散落的 className。
 *
 * 为什么状态色不用 `--chart-*` 那组变量
 * ----------------------------------
 * 那套颜色是为「序列区分」准备的，不是「等级高低」；用在状态上会出现
 * 「越严重越浅」这种与直觉相反的情况。这里给固定的 emerald / rose 两档，
 * 与 `ui/badge.tsx` 的三档语义色同一套写法（浅底深字 + 一条深色态）。
 *
 * 浅深色都要能看
 * ------------
 * 主题由 `<html>` 上的 `.dark` class 切换（`globals.css` 的
 * `@custom-variant dark (&:is(.dark *))`），所以每档颜色都给一对值。
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 节点/连线的四档语义状态。 */
export type SceneTone = "idle" | "active" | "done" | "alert";

/** 卡片类元素（节点、徽标）的状态色。 */
export const TONE_SURFACE: Record<SceneTone, string> = {
  idle: "border-border bg-card text-muted-foreground",
  active: "border-ring bg-accent text-accent-foreground shadow-sm",
  done: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  alert:
    "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
};

/** 连线类元素的状态色（比卡片淡一档，不与节点抢注意力）。 */
export const TONE_LINE: Record<SceneTone, string> = {
  idle: "text-border",
  active: "text-ring",
  done: "text-emerald-400 dark:text-emerald-700",
  alert: "text-rose-400 dark:text-rose-700",
};

/**
 * 场景画布。
 *
 * 固定 `min-h` 是有意的：不同步骤的元素多少不同，若高度跟着内容变，面板下方
 * 的内容会在播放过程中上下跳动，学生的目光要重新找位置。高度稳定下来，
 * 视线才稳。
 *
 * 底色是 16px 的点阵（`radial-gradient` 铺出来的），用来暗示「这是一块可动的
 * 画布」而不是普通的内容面板。点色取 `--color-border`，深浅色主题自动跟随。
 */
export function SceneFrame({
  caption,
  label,
  children,
  className,
}: {
  /** 画布底部的一句当前步骤说明。 */
  caption: string;
  /** 无障碍名称，例如「请求-响应流程」。 */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3",
        className,
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="flex min-h-[260px] flex-1 flex-col justify-center gap-3">
        {children}
      </div>
      <p className="border-t border-border pt-2 text-sm leading-relaxed text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}

/** 横向排列的一格；`wrap` 让窄屏可以换行而不溢出。 */
export function SceneRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

/** 纵向堆叠的一格（消息数组、日志面板这类「一行一个」的地方）。 */
export function SceneColumn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>
  );
}