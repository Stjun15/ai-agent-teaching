"use client";

/**
 * 任务类型 / 语言切换 —— 代码编辑区的工具栏
 *
 * 为什么单独成组件
 * --------------
 * 这两组开关**不碰编辑器的任何东西**：它们只往 CodeStore 写两个字段，
 * 而 monaco 是从 CDN 加载的重组件。拆开之后，工具栏在编辑器还没加载出来
 * 时就已经可用了 —— 学生进页面先看到的是「能点的开关 + 一块占位」，
 * 而不是整片空白。
 *
 * 为什么任务类型必须让学生自己选
 * ---------------------------
 * 点评 Agent 是按 `taskType` 取评分标准的（`api-spec.md` 的 `taskType`
 * 三值：prompt / tool / code）。让模型去猜「学生交的这段是 Prompt 还是
 * 代码」会在边界情况上出错，而错的那一次会给出完全不相关的建议 ——
 * 这比多一次点击的代价大得多。
 */

import { useCodeStore, type CodeLanguage, type TaskType } from "@/stores";
import { cn } from "@/lib/utils";

/** 任务类型的中文标签。键必须覆盖 `TaskType` 的全部取值。 */
const TASK_TYPE_LABELS: Record<TaskType, string> = {
  prompt: "Prompt",
  tool: "工具描述",
  code: "代码",
};

/**
 * 语言标签。取值受 `api-spec.md` 限制，只有这两种。
 *
 * 这两个字符串同时也是 monaco 的语言 id，所以不需要另一张映射表 ——
 * 见 `monaco-surface.tsx` 里 `language` 的传法。
 */
const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  typescript: "TypeScript",
  python: "Python",
};

/** 一组互斥的单选开关。两个 `role="group"` 里的结构相同，抽出来避免抄两遍。 */
function Segmented<T extends string>({
  label,
  options,
  value,
  labels,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-1 rounded-md border p-0.5"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "rounded px-2 py-0.5 text-xs transition-colors",
            value === option
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

/**
 * 顺序固定为「任务类型在前、语言在后」：任务类型决定评分标准，是本栏里
 * 对学生影响最大的一个选择；语言只影响高亮与示例风格。
 */
const TASK_TYPE_OPTIONS = Object.keys(TASK_TYPE_LABELS) as TaskType[];
const LANGUAGE_OPTIONS = Object.keys(LANGUAGE_LABELS) as CodeLanguage[];

export function CodeToolbar() {
  const taskType = useCodeStore((state) => state.taskType);
  const language = useCodeStore((state) => state.language);
  const setTaskType = useCodeStore((state) => state.setTaskType);
  const setLanguage = useCodeStore((state) => state.setLanguage);

  return (
    <>
      <Segmented
        label="任务类型"
        options={TASK_TYPE_OPTIONS}
        labels={TASK_TYPE_LABELS}
        value={taskType}
        onChange={setTaskType}
      />
      <Segmented
        label="语言"
        options={LANGUAGE_OPTIONS}
        labels={LANGUAGE_LABELS}
        value={language}
        onChange={setLanguage}
      />
    </>
  );
}
