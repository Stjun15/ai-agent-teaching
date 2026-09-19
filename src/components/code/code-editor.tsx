"use client";

/**
 * 代码编辑区 —— 模块页中栏「动手模仿」那一块
 *
 * 依据
 * ----
 * `04-frontend.md`「核心页面布局 → 模块学习页（三栏）」中栏含「代码编辑区」，
 * 「组件树」里叫 `<CodeEditor>`，技术选型见 `00-MASTER.md`（Monaco Editor）。
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
 * CDN 失败时降级成纯文本
 * -------------------
 * monaco 从 CDN 加载（理由见 `monaco-surface.tsx`），所以**必须**假设它
 * 可能加载不到。降级后除了没有语法高亮，编辑与提交照常 —— 练习仍然能
 * 完成。留一块空白则连字都敲不进去。
 */

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeToolbar } from "@/components/code/code-toolbar";
import {
  resolveDark,
  selectIsPassed,
  useCodeStore,
  useSettingsStore,
} from "@/stores";

/**
 * 编辑器本体只在浏览器里加载。
 *
 * `ssr: false`：monaco 需要真实 DOM 与 worker，服务端渲染它没有意义，
 * 硬渲染只会在 hydration 时报错。`loading` 给**同尺寸**占位 —— 尺寸不一的
 * 占位会让下面的面板在加载完成时跳一下。
 */
const MonacoSurface = dynamic(
  () => import("./monaco-surface").then((mod) => mod.MonacoSurface),
  { ssr: false, loading: () => <SurfacePlaceholder /> },
);

export interface CodeEditorProps {
  /**
   * 提交校验。由接线层注入（它负责带学生身份与会话）。
   * 不传表示「校验链路还没接上」，按钮禁用并说明。
   */
  onSubmit?: () => void;
  /** 校验请求在飞。此时按钮禁用，避免连点产生多次计费调用。 */
  submitting?: boolean;
}

export function CodeEditor({ onSubmit, submitting = false }: CodeEditorProps) {
  const code = useCodeStore((state) => state.code);
  const language = useCodeStore((state) => state.language);
  const attempt = useCodeStore((state) => state.attempt);
  const passed = useCodeStore(selectIsPassed);
  const setCode = useCodeStore((state) => state.setCode);
  const theme = useSettingsStore((state) => state.theme);

  /**
   * 编辑器形态：先按「可加载」渲染，`onUnavailable` 报回来才降级。
   *
   * 初值取 `"monaco"` 而不是 `"loading"`：首次渲染时 CDN 还没开始加载，
   * 此时显示 monaco 的加载占位，比先渲染一个纯文本框再换掉更顺 ——
   * 否则每次进页面都会闪一下 textarea。
   */
  const [surface, setSurface] = useState<"monaco" | "fallback">("monaco");
  const handleUnavailable = useCallback(() => setSurface("fallback"), []);

  const empty = code.trim() === "";
  const canSubmit = onSubmit !== undefined && !submitting && !empty;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CodeToolbar />
        {attempt > 0 ? (
          <Badge variant="muted">第 {attempt} 次提交</Badge>
        ) : null}
        {passed ? (
          // 刻意用中性的 `secondary`：Badge 的三档语义色（levelLow/Mid/High）
          // 在这套设计里表示**难度/掌握度**高低，拿来标「已通过」会被读成
          // 「这一项难度低」。通过与否由校验结果面板详细表达。
          <Badge variant="secondary">
            <Check aria-hidden />
            已通过
          </Badge>
        ) : null}
      </div>

      {/*
        编辑器容器用**定高**：monaco 需要父元素有确定高度才能算出可视区域
        （`automaticLayout` 只是观察这个尺寸），auto 高度下它会塌成 0 高。
        降级用的 textarea 共用同一尺寸，切换时布局不跳。
      */}
      <div className="h-[260px] overflow-hidden rounded-md border bg-muted/20">
        {surface === "monaco" ? (
          <MonacoSurface
            value={code}
            language={language}
            theme={resolveDark(theme) ? "vs-dark" : "vs"}
            onChange={setCode}
            onUnavailable={handleUnavailable}
          />
        ) : (
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            aria-label="代码编辑区（纯文本降级）"
            placeholder="在这里写下你的 Prompt / 工具描述 / 代码…"
            className="h-full w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed outline-none"
          />
        )}
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

        {surface === "fallback" ? (
          <span className="text-xs text-muted-foreground">
            编辑器已降级为纯文本（无法从 CDN 加载 Monaco），编辑不受影响。
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** 编辑器加载中的占位。尺寸与真实容器一致，避免加载完成时布局跳动。 */
function SurfacePlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      正在加载编辑器…
    </div>
  );
}
