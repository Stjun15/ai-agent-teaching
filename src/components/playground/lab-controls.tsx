"use client";

import { cn } from "@/lib/utils";
import type {
  LabField,
  PlaygroundModule,
} from "@/components/playground/lab-types";

/**
 * 沙箱的展示型控件：标签页、字段输入、JSON 原样块。
 *
 * 单独成文件的原因很实际：主组件（`playground-lab.tsx`）要承担的是**流程**
 * （选实验 → 取值 → 建会话 → 发请求 → 呈现结果），而这三块是**纯展示** ——
 * 给它们什么就画什么，不认识 store，也不认识 API。混在一起时，改一个输入框
 * 的样式要在几百行里翻找，而且很难看出哪些代码碰了网络。
 */

/** 实验切换标签页。 */
export function LabTabs({
  experiments,
  activeId,
  onSelect,
}: {
  experiments: readonly { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {experiments.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          aria-pressed={item.id === activeId}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm transition-colors",
            item.id === activeId
              ? "border-ring bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:border-ring/60 hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 一个字段的输入控件。`source: "modules"` 的渲染成模块下拉。 */
export function LabInput({
  field,
  modules,
  value,
  onChange,
}: {
  field: LabField;
  modules: readonly PlaygroundModule[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `lab-${field.key}`;
  const shared =
    "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">
        {field.label}
      </label>

      {field.source === "modules" ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={shared}
        >
          <option value="">（请选择模块）</option>
          {modules.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}（{item.id}）
            </option>
          ))}
        </select>
      ) : field.kind === "textarea" ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={5}
          className={cn(shared, "resize-y font-mono")}
        />
      ) : field.kind === "select" ? (
        <select
          id={id}
          value={value === "" ? (field.options?.[0]?.value ?? "") : value}
          onChange={(event) => onChange(event.target.value)}
          className={shared}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.kind === "number" ? "number" : "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          className={shared}
        />
      )}

      {field.help ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {field.help}
        </p>
      ) : null}
    </div>
  );
}

/**
 * JSON 原样展示。
 *
 * 不折叠、不高亮、不截断：学生要看到的就是**服务端真正返回的原文**。
 * 一旦做「友好化」（例如把长字符串截断加省略号），看到的就不是原文了，
 * 而沙箱的全部价值在于「看到真的东西」。
 */
export function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium">{title}</span>
      <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
