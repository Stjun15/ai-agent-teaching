"use client";

/**
 * 任务类型切换 —— 代码编辑区的工具栏
 *
 * 为什么单独成组件
 * --------------
 * 工具栏不碰编辑器的任何东西：只往 CodeStore 写任务类型字段。
 * 拆开之后，工具栏在页面加载时就已经可用了。
 *
 * 为什么任务类型必须让学生自己选
 * ---------------------------
 * 点评 Agent 是按 `taskType` 取评分标准的（`api-spec.md` 的 `taskType`
 * 三值：prompt / tool / code）。让模型去猜「学生交的这段是 Prompt 还是
 * 代码」会在边界情况上出错，而错的那一次会给出完全不相关的建议 ——
 * 这比多一次点击的代价大得多。
 */

import { useCodeStore, type TaskType } from "@/stores";
import { cn } from "@/lib/utils";

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  prompt: "Prompt",
  tool: "工具描述",
  code: "代码",
};

const TASK_TYPE_OPTIONS = Object.keys(TASK_TYPE_LABELS) as TaskType[];

interface Props {
  className?: string;
}

export function CodeToolbar({ className }: Props) {
  const taskType = useCodeStore((state) => state.taskType);
  const setTaskType = useCodeStore((state) => state.setTaskType);
  const isCode = taskType === "code";

  return (
    <div
      role="group"
      aria-label="任务类型"
      className={cn("flex items-center rounded-md border", className)}
    >
      <span className="px-2 text-xs text-muted-foreground">类型</span>
      {TASK_TYPE_OPTIONS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={taskType === key}
          onClick={() => setTaskType(key)}
          className={cn(
            "border-l px-3 py-1 text-xs transition-colors first:border-l-0",
            taskType === key
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {TASK_TYPE_LABELS[key]}
        </button>
      ))}
      <span
        className={cn(
          "ml-2 border-l pl-2 text-xs transition-opacity",
          isCode
            ? "font-medium text-foreground"
            : "text-muted-foreground opacity-40",
        )}
      >
        TypeScript
      </span>
    </div>
  );
}