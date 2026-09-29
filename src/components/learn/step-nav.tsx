"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { motion } from "motion/react";

import type { StepType } from "@/lib/db";
import { LEARNING_STEPS } from "@/lib/learning-steps";
import { cn } from "@/lib/utils";

/**
 * 步骤导航（模块页左栏）。横向折叠：收起时整块收窄成一条竖排的窄按钮，
 * 点击再展开成完整步骤列表。三种状态有明确含义不混用：
 * - `done`：已完成（将来由学习路径数据决定）
 * - `current`：当前所在步骤
 * - `todo`：尚未开始
 */
export function StepNav({
  moduleId,
  currentStepId,
  doneStepIds = [],
}: {
  moduleId: string;
  currentStepId: StepType;
  doneStepIds?: readonly StepType[];
}) {
  const done = new Set(doneStepIds);
  const [collapsed, setCollapsed] = useState(false);
  const toggle = () => setCollapsed((c) => !c);

  if (collapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: "auto" }}
        exit={{ opacity: 0, width: 0 }}
        className="w-fit rounded-md border bg-card p-2"
      >
        <button
          type="button"
          onClick={toggle}
          aria-label="展开学习步骤"
          title="展开学习步骤"
          aria-expanded={false}
          className="flex flex-col items-center gap-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-4" aria-hidden />
          <span className="text-xs [writing-mode:vertical-rl]">学习步骤</span>
        </button>
      </motion.div>
    );
  }

  return (
    <nav aria-label="学习步骤" className="w-fit rounded-md border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          学习步骤
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-label="收起学习步骤"
          title="收起学习步骤"
          aria-expanded={true}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      </div>
      <ol className="flex flex-col gap-0.5">
        {LEARNING_STEPS.map((step, index) => {
          const isDone = done.has(step.id) && step.id !== currentStepId;
          const isCurrent = step.id === currentStepId;
          const Icon = isDone ? Check : Circle;

          return (
            <li key={step.id}>
              <Link
                href={`/learn/${moduleId}/${step.id}`}
                aria-current={isCurrent ? "step" : undefined}
                title={step.detail}
                className={cn(
                  "flex items-start gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                  isCurrent
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors duration-300",
                    isDone
                      ? "border-transparent bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_0_2px_var(--primary)]/20"
                        : "border-muted-foreground/40",
                  )}
                >
                  {isDone ? <Icon className="size-3" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block">{step.label}</span>
                  {isCurrent ? (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {step.detail}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
