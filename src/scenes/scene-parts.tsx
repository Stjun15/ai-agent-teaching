"use client";

/**
 * 场景零件 —— 摆在画布上的「参与者」与「连线」
 *
 * 与 `scene-canvas.tsx` 的分工：那边是「舞台长什么样」，这里是一件件道具。
 *
 * 动画靠 CSS 入场，不靠 JS 计时
 * --------------------------
 * 元素出场统一用 `animate-in` 系列（`tw-animate-css`，已随 `globals.css`
 * 引入），场景在换步时借 `key` 重挂来触发。这条约束不是审美问题：如果每个
 * 零件各自计时，播放器的「暂停」就只能停住步骤推进，停不住散在各处的定时器，
 * 界面会继续动 —— 那是最难解释的一类 bug。所以：**能交给入场动画的，
 * 不用计时器**；JS 计时只留在播放器与打字机两处。
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { TONE_LINE, TONE_SURFACE, type SceneTone } from "./scene-canvas";

/**
 * 一个节点：卡片形态的「参与者」（Agent、工具、消息、知识库都算）。
 *
 * 内容用 `lines: string[]` 而不是 `children`：节点里放的往往是等宽的数据片段
 * （工具入参、返回的 JSON、SQL 原文），交给 `MonoBlock` 统一渲染，比让 9 个
 * 场景各自决定字号与内边距更一致。
 *
 * `enter` 是「从哪边进来」：`up` 从下方升上来，`down` 从上方落下来。听着像纯
 * 装饰，但它是「消息卡片按角色分位摆放」这类步骤的**主要内容** ——
 * 「system 从上方入、user 从下方入」正是在讲两条消息在数组里的位置关系。
 * 放在这里而不是让场景自己拼 `slide-in-from-*`：两个方向的类都写在同一个元素
 * 上时，谁生效取决于 Tailwind 产物的顺序，那是**不可靠**的；由本组件二选一
 * 拼出来，才保证只有一个方向类存在。
 */
export function NodeCard({
  title,
  subtitle,
  icon,
  lines,
  tone = "idle",
  enter = "up",
  className,
}: {
  title: string;
  subtitle?: string;
  /** 小图标（来自 `lucide-react`），可选。 */
  icon?: ReactNode;
  /** 逐行显示的等宽内容。 */
  lines?: readonly string[];
  tone?: SceneTone;
  /** 进场方向；`none` 用于不该有动画的常驻元素。 */
  enter?: "up" | "down" | "none";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 animate-in rounded-md border px-2.5 py-2 duration-300 fade-in",
        enter === "up"
          ? "slide-in-from-bottom-2"
          : enter === "down"
            ? "slide-in-from-top-2"
            : "",
        TONE_SURFACE[tone],
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        <span className="truncate">{title}</span>
      </p>
      {subtitle === undefined ? null : (
        <p className="mt-0.5 text-sm leading-relaxed opacity-80">{subtitle}</p>
      )}
      {lines === undefined || lines.length === 0 ? null : (
        <div className="mt-1.5">
          <MonoBlock>{lines.join("\n")}</MonoBlock>
        </div>
      )}
    </div>
  );
}

/**
 * 等宽内容块（JSON、SQL、Prompt 原文）。
 *
 * `plain` 直接嵌在卡片里（背景用半透明的黑/白，深浅色主题都压得住）；
 * `boxed` 自带边框，用于独立摆放的代码或数据面板。
 */
export function MonoBlock({
  children,
  tone = "plain",
  className,
}: {
  children: ReactNode;
  tone?: "plain" | "boxed";
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded font-mono text-sm leading-relaxed break-words whitespace-pre-wrap",
        tone === "boxed"
          ? "border border-border bg-muted/50 p-2"
          : "bg-black/[0.04] px-1.5 py-1 dark:bg-white/[0.06]",
        className,
      )}
    >
      {children}
    </pre>
  );
}

/**
 * 箭头连线。
 *
 * 用 SVG 而不是「一个 div 加 border」：后者在竖直方向上要额外处理，箭头头部
 * 只能靠伪元素拼；而 `currentColor` 还能让四档状态色直接复用。
 *
 * 竖直方向的做法是「把横向箭头整体转 90°」，不是另画一条纵向箭头：旋转发生
 * 在 svg 自己的中心，40×12 的盒子转过 90° 正好是 12×40，与外侧 `h-10 w-3`
 * 的容器完全重合 —— 既不溢出，也不必维护两份坐标。
 */
export function SceneArrow({
  direction = "right",
  tone = "idle",
  label,
}: {
  direction?: "right" | "down" | "left";
  tone?: SceneTone;
  label?: string;
}) {
  const vertical = direction === "down";
  return (
    <span
      className={cn(
        "flex shrink-0 flex-col items-center text-center",
        TONE_LINE[tone],
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          vertical ? "h-10 w-3" : "h-3 w-10",
        )}
      >
        <svg
          viewBox="0 0 40 12"
          aria-hidden="true"
          className={cn(
            "h-3 w-10 animate-in duration-300 fade-in",
            direction === "right"
              ? ""
              : direction === "left"
                ? "rotate-180"
                : "rotate-90",
          )}
        >
          <line
            x1="1"
            y1="6"
            x2="32"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <path d="M31 2 L38 6 L31 10 Z" fill="currentColor" />
        </svg>
      </span>
      {label === undefined ? null : (
        <span className="text-sm leading-tight">{label}</span>
      )}
    </span>
  );
}

/**
 * 工具卡：一个工具的「名称 + 描述」，可点。
 *
 * 为什么做成共享零件而不是留在工具调用链那一场
 * ----------------------------------------
 * 「工具卡」会出现在两场里（工具调用链、MCP 调用流程），两处要长一个样：
 * 名称用等宽字、描述灰一档、被选中时加一圈 ring。各写一遍的话，学生在两讲之间
 * 看到的会是两种「工具」，而这两讲讲的本来就是同一件事的两个层次。
 *
 * 描述是给模型看的，所以它在卡片上的位置比名称更显眼 —— 学生最容易犯的错是
 * 只写名称不写描述，而描述为空时 Agent 根本判断不了该不该用它。
 *
 * `onSelect` 给了才可点：没给就渲染成一块静态内容，而不是一个点了没反应的按钮。
 */
export function ToolCard({
  name,
  description,
  icon,
  tone = "idle",
  selected = false,
  trouble = false,
  onSelect,
}: {
  name: string;
  /** 该工具的描述；为空时由调用方给一句显式的占位说明。 */
  description: string;
  icon?: ReactNode;
  tone?: SceneTone;
  /** 当前是否被选中（选中的那张会在下方展开定义）。 */
  selected?: boolean;
  /** 该工具的定义有问题（例如描述为空）时标红。 */
  trouble?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 font-mono text-sm font-medium">
        {icon}
        {name}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm leading-relaxed",
          trouble
            ? "text-rose-900 dark:text-rose-200"
            : "text-muted-foreground",
        )}
      >
        {description}
      </p>
    </>
  );

  const skin = cn(
    "min-w-0 flex-1 rounded-md border px-2.5 py-2 text-left transition-colors",
    TONE_SURFACE[tone],
    selected && "ring-1 ring-ring",
  );

  if (onSelect === undefined) {
    return <div className={skin}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(skin, "hover:border-ring")}
    >
      {body}
    </button>
  );
}
