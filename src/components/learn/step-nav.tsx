import Link from "next/link";
import { Check, Circle } from "lucide-react";

import type { StepType } from "@/lib/db";
import { LEARNING_STEPS } from "@/lib/learning-steps";
import { cn } from "@/lib/utils";

/**
 * 步骤导航（模块页左栏）。
 *
 * 三种状态各有明确含义，不混用：
 * - `done`：已完成（将来由学习路径数据决定）
 * - `current`：当前所在步骤
 * - `todo`：尚未开始
 *
 * 目前没有持久化的学习进度（`StudentStore` 与 `learning-path` 表的接线在后面
 * 的提交点），所以状态由调用方以 `currentStepId` 传入 —— 组件本身不猜。
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

  return (
    <nav aria-label="学习步骤">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        学习步骤
      </h2>
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
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    isDone
                      ? "border-transparent bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-foreground/40"
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
