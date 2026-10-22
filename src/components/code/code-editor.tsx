"use client";

/**
 * 代码编辑区 —— 模块页中栏「动手模仿」那一块
 *
 * 依据
 * ----
 * `04-frontend.md`「核心页面布局 → 模块学习页（三栏）」中栏含「代码编辑区」，
 * 「组件树」里叫 `<CodeEditor>`。
 *
 * 内容活在 CodeStore 里，不是组件 state
 * ---------------------------------
 * 三件具体的事要求它活得比组件久：① 切步骤/切模块时不丢；
 * ② 校验结果由 SSE 事件写进**同一个** store（`useChatStream` 的
 *   `validation` 分支），两边必须看同一份文本；③ 对话里「附带代码」
 *   发出去的是 store 里那份。放组件 state 会立刻出现「编辑器里有、
 *   实际发出去的不是它」。
 *
 * 提交动作由外部注入
 * ----------------
 * 校验请求要带学生身份与会话 id，属于接线层的事，不属于编辑器。
 * `onSubmit` 不传时按钮禁用并说明原因 —— 与可视化面板「场景待交付」
 * 同一种做法：明确说还没接，好过给一个点了没反应的按钮。
 *
 * 为什么是纯文本 textarea
 * ---------------------
 * 点评 Agent 读的是裸字符串，不过编辑器内核。Monaco 的语法高亮与类型
 * 检查对 prompt/工具描述任务是一堆红波浪（编辑器不认识非代码格式），
 * 对代码任务也没进校验管道。换成 textarea 消除这些干扰，编辑与提交通
 * 常 —— 点评照样跑。
 */

import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeToolbar } from "@/components/code/code-toolbar";
import { selectIsPassed, useCodeStore } from "@/stores";

const HINT_BY_TASK: Record<string, string> = {
  code: "在这里写 TypeScript 代码",
  prompt: "在这里写 System Prompt",
  tool: "在这里写工具描述",
};

export interface CodeEditorProps {
  onSubmit?: () => void;
  submitting?: boolean;
}

export function CodeEditor({ onSubmit, submitting = false }: CodeEditorProps) {
  const code = useCodeStore((state) => state.code);
  const taskType = useCodeStore((state) => state.taskType);
  const attempt = useCodeStore((state) => state.attempt);
  const passed = useCodeStore(selectIsPassed);
  const setCode = useCodeStore((state) => state.setCode);

  const [focused, setFocused] = useState(false);

  const empty = code.trim() === "";
  const canSubmit = onSubmit !== undefined && !submitting && !empty;

  const displayedValue =
    focused || code !== "" ? code : HINT_BY_TASK[taskType] ?? HINT_BY_TASK.code;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CodeToolbar />
        {attempt > 0 ? (
          <Badge variant="muted">第 {attempt} 次提交</Badge>
        ) : null}
        {passed ? (
          <Badge variant="secondary">
            <Check aria-hidden />
            已通过
          </Badge>
        ) : null}
      </div>

      <div className="h-[260px] overflow-hidden rounded-md border bg-muted/20">
        <textarea
          value={displayedValue}
          onChange={(event) => setCode(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
          aria-label="代码编辑区"
          className={
            "h-full w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed outline-none" +
            (focused || code !== "" ? "" : " text-muted-foreground/50")
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={!canSubmit}
          title={onSubmit === undefined ? "点评功能还没接好" : undefined}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          {submitting ? "点评中…" : "提交点评"}
        </Button>

        <span className="text-xs text-muted-foreground">
          {onSubmit === undefined
            ? "点评功能还没接好，先自由练习。"
            : empty
              ? "先写下点什么，再提交点评。"
              : "提交后点评 Agent 按评分维度逐项给分，并给出改进建议。"}
        </span>
      </div>
    </div>
  );
}