"use client";

/**
 * 路径调整列表 —— Ploy「闭环」的 UI 消费端
 *
 * 作用
 * ----
 * 读取 `StudentStore.learningPath.adjustments`，在模块页左栏渲染。
 * `path-adjuster` 在每次答题评分后写入调整记录，本组件是它的
 * 可视化消费方 —— 让学生看到「系统注意到了我的问题并给出了建议」。
 *
 * 展示规则
 * ------
 * - 无调整时完全不渲染（不占位置、不显示空标题），避免信息噪音
 * - 最多展示最近 3 条，按日期降序
 * - 每条根据 reason 关键词自动匹配图标：
 *   - "连续…校验"  → 警报图标（最高优先级）
 *   - "错题"        → 灯泡图标
 *   - "下降"        → 重试图标
 *   - 其他（含"可跳过"） → 前跳图标
 */

import { AlertTriangle, ArrowRight, Lightbulb, RotateCcw } from "lucide-react";

import { useStudentStore } from "@/stores";
import type { PathAdjustment } from "@/lib/db";

function pickIcon(reason: string) {
  if (reason.includes("连续") && reason.includes("校验")) {
    return (
      <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-hidden />
    );
  }
  if (reason.includes("错题")) {
    return (
      <Lightbulb className="size-3.5 shrink-0 text-blue-500" aria-hidden />
    );
  }
  if (reason.includes("下降")) {
    return (
      <RotateCcw className="size-3.5 shrink-0 text-rose-500" aria-hidden />
    );
  }
  return (
    <ArrowRight className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AdjustmentCard({ adjustment }: { adjustment: PathAdjustment }) {
  return (
    <div className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed">
      <span className="mt-0.5">{pickIcon(adjustment.reason)}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{adjustment.reason}</p>
        <p className="mt-0.5 text-muted-foreground">{adjustment.action}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          {formatDate(adjustment.date)}
        </p>
      </div>
    </div>
  );
}

export function PathAdjustmentList() {
  const learningPath = useStudentStore((state) => state.learningPath);
  const adjustments = learningPath?.adjustments ?? [];

  if (adjustments.length === 0) return null;

  const recent = [...adjustments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <section aria-label="路径调整" className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        路径调整
      </h2>
      <div className="flex flex-col gap-2">
        {recent.map((adj, i) => (
          <AdjustmentCard key={`${adj.date}-${i}`} adjustment={adj} />
        ))}
      </div>
    </section>
  );
}
