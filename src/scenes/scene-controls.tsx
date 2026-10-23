"use client";

/**
 * 场景参数控件 —— 「可改参数看变化」的编辑件
 *
 * 依据 `04-frontend.md`：每个场景都要「可修改参数看变化」。9 个场景要改的东西
 * 五花八门（一段 system 消息、一个 topK、一次左右对比），但**长什么样**不该各
 * 写各的：这一处是原生 checkbox、那一处是自绘开关，学生会以为是两种不同的设置。
 *
 * 控件是**受控**的：值不在控件里，只在播放器的 `params` 里（`setParam` 写回）。
 * 于是「重置」能把 9 个场景一起恢复初值，不需要每个场景自己实现一遍重置。
 *
 * 为什么只用原生表单元素
 * -------------------
 * 原生 `<input>` 自带键盘操作、焦点环、屏幕阅读器语义与移动端合适的软键盘；
 * 自绘一个「好看的开关」要把这些一样样补回来，漏一样就是一类无障碍缺陷。
 * 样式用 Tailwind 覆盖即可，没必要换掉元素本身。
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 输入控件的公共外观。 */
const FIELD =
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring";

const LABEL = "text-sm font-medium text-muted-foreground";

/** 控件栏：虚线框把「这些是可以改的」和画布里的动画区分开。 */
export function SceneControls({
  label,
  children,
}: {
  /** 无障碍分组名；也提示这里能改什么，例如「本场景的可调参数」。 */
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-start gap-3 rounded-md border border-dashed border-border p-2"
    >
      {children}
    </div>
  );
}

/** 多行文本参数（system 消息、Prompt、攻击输入）。 */
export function ParamText({
  label,
  value,
  onChange,
  rows = 3,
  hint,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        readOnly={readOnly}
        className={cn(
          FIELD,
          "resize-y font-mono text-sm leading-relaxed",
          readOnly && "cursor-default border-muted-foreground/30 bg-muted/50",
        )}
      />
      {hint === undefined ? null : (
        <span className="text-sm leading-relaxed text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

/** 开关参数。原生 checkbox + `accent-` 取主题色，不必自绘。 */
export function ParamToggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex min-w-[10rem] flex-col gap-1">
      <span className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-[var(--color-foreground)]"
        />
        {label}
      </span>
      {hint === undefined ? null : (
        <span className="text-sm leading-relaxed text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

/** 数值参数（topK 这类有边界、要看得出取值的量）。 */
export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
      <span className={LABEL}>
        {label}
        <span className="ml-1 font-mono text-foreground tabular-nums">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-[var(--color-foreground)]"
      />
      {hint === undefined ? null : (
        <span className="text-sm leading-relaxed text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

/** 少选一的参数（看哪个 Agent、模拟哪台 MCP Server）。 */
export function ParamChoice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={cn(
              "rounded border px-2 py-0.5 text-sm transition-colors",
              option.value === value
                ? "border-ring bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}