"use client";

import { memo } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  Brain,
  Timer,
  User,
} from "lucide-react";

import { MarkdownView } from "@/components/chat/markdown-view";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage, ThinkingStep } from "@/stores";
import { cn } from "@/lib/utils";

/**
 * 单条消息。
 *
 * 助手消息渲染 Markdown，学生消息保持纯文本
 * -------------------------------------
 * 之前两种角色都是 `whitespace-pre-wrap` 原样显示。问题出在助手侧：模型习惯
 * 用 `**粗体**`、`- 列表`、``` 代码块 ```，原样显示就成了「满屏星号」，学生要
 * 自己在脑子里解析格式 —— 教学内容本身没问题，呈现方式让它读起来很费劲。
 *
 * 所以助手消息交给 `MarkdownView`。**注入面没有因此变大**：那条链上用的是自己
 * 的解析器，产出的是 token 树而非 HTML 字符串，渲染时由 React 转义文本节点，
 * 全程不碰 `dangerouslySetInnerHTML`；链接另过协议白名单。理由与边界写在
 * `src/lib/markdown.ts` 和 `markdown-view.tsx` 的文件头。
 *
 * 学生消息**保持原样**，不做 Markdown 解析：学生贴进来的代码里 `*`、`_`、`#`
 * 满地都是，把用户自己的输入当标记解释，风险是「我打的东西被吃掉了」。
 * 输入框里打什么、气泡里就显示什么。
 *
 * 两者都保留 `whitespace-pre-wrap`：换行与空格照旧保真，Markdown 只是
 * 在结构上**叠加**（列表、代码块、标题），不是替换原有呈现。
 *
 * 视觉层次（2026-09-24 Warm Minimal 改造）
 * -------------------------------------
 * 助手气泡加了一条暖色左边线（`border-l-primary/50`），学生气泡用暖色背景
 * （`bg-secondary`），两色来自全局 CSS 变量，不在组件里写死。光标动画用
 * `animate-pulse` —— taste 禁令允许在关键行动点上使用。
 */
export const MessageItem = memo(
  function MessageItem({ message }: { message: ChatMessage }) {
    const isStudent = message.role === "student";
    const isStreaming = message.status === "streaming";
    const isError = message.status === "error";

    return (
      <article
        data-role={message.role}
        data-status={message.status}
        className={cn(
          "flex gap-3 animate-in fade-in duration-300 fill-mode-both",
          isStudent ? "flex-row-reverse text-right" : "flex-row",
        )}
      >
        <div
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-all duration-500",
            isStudent
              ? "bg-secondary text-secondary-foreground"
              : "bg-primary text-primary-foreground",
            !isStudent &&
              isStreaming &&
              "ring-2 ring-primary/30 shadow-[0_0_6px_0] shadow-primary/20",
          )}
        >
          {isStudent ? <User className="size-4" /> : <Bot className="size-4" />}
        </div>

        <div
          className={cn(
            "flex max-w-[85%] min-w-0 flex-col gap-1.5",
            isStudent && "items-end",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {isStudent ? "我" : (message.agent ?? "导师")}
            </span>
            {isStreaming ? <Badge variant="muted">输出中</Badge> : null}
            {isError ? (
              <Badge variant="levelHigh">
                <AlertTriangle />
                失败
              </Badge>
            ) : null}
          </div>

          {message.thinkingSteps !== undefined &&
          message.thinkingSteps.length > 0 ? (
            <ThinkingChain steps={message.thinkingSteps} />
          ) : null}

          <div
            className={cn(
              "rounded-lg px-3 py-2 text-[clamp(11px,1.6vw,16px)] leading-relaxed break-words whitespace-pre-wrap",
              isStudent
                ? "bg-secondary text-secondary-foreground"
                : "border border-l-2 border-l-primary/50 bg-primary/5",
              isError && "border-destructive/40",
              isStreaming &&
                message.content === "" &&
                "relative overflow-hidden",
            )}
          >
            {isStreaming && message.content === "" ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 block h-0.5 animate-pulse rounded-t-lg bg-gradient-to-r from-transparent via-primary/50 to-transparent"
              />
            ) : null}
            {isStudent ? (
              message.content
            ) : (
              <MarkdownView source={message.content} />
            )}
            {isStudent && message.images && message.images.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.images.map((dataUrl, i) => (
                  <a
                    key={i}
                    href={dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block size-20 overflow-hidden rounded-md border-2 border-transparent transition-colors hover:border-primary/50"
                  >
                    <img
                      src={dataUrl}
                      alt={`截图 ${i + 1}`}
                      className="size-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : null}
            {isStreaming ? (
              // 光标用内联块而不是伪元素：它必须在文本流里占据位置，
              // 否则会出现「最后一个字被光标盖住」。
              <span
                aria-hidden
                className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-[1px] bg-foreground"
              />
            ) : null}
            {isStreaming && message.content === "" ? (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                正在思考
                <span
                  aria-hidden
                  className="inline-block size-1 rounded-full bg-muted-foreground/50 animate-pulse"
                />
                <span
                  aria-hidden
                  className="inline-block size-1 rounded-full bg-muted-foreground/50 animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  aria-hidden
                  className="inline-block size-1 rounded-full bg-muted-foreground/50 animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                />
              </span>
            ) : null}
          </div>

          {message.citations.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              引用了 {message.citations.length} 个知识来源
            </p>
          ) : null}
        </div>
      </article>
    );
  },
  (prev, next) => {
    const p = prev.message;
    const n = next.message;
    if (p.status !== n.status) {
      return false;
    }
    if (p.thinkingSteps?.length !== n.thinkingSteps?.length) {
      return false;
    }
    if (p.status === "done") {
      return (
        p.content === n.content &&
        (p.thinkingSteps === undefined ||
          n.thinkingSteps === undefined ||
          p.thinkingSteps.every(
            (s, i) => s.content === n.thinkingSteps?.[i]?.content,
          ))
      );
    }
    return false;
  },
);

/**
 * 思维链面板（对标 DeepSeek 网页端）。
 *
 * 把属于同一条助手消息的思考段折叠成一行摘要行，点击展开推理原文。
 * 流式进行中的思考段显示「进行中」徽标，已完成的显示耗时。
 *
 * 用原生 `<details>`：零 JS 状态、键盘可达、屏幕阅读器友好。
 *
 * 为什么默认折叠（2026-10-07 扇出审计 10/10 讲）
 * -------------------------------------------
 * 原先 `open` 写死默认展开。实测每一讲都是思维链压倒正文 ——
 * 链:正文 从 3.0:1 到 **1148:1**（system-prompt），思维链占全文
 * 75%~99.9%，且 9/10 是英文。学生首屏看到的是大段英文自我对话，
 * 中文答案被挤到折叠区以下。
 *
 * 这一改动**不动 2026-09-21「思维链先于首 token 可见」的初衷**：
 * 那条决策要的是「学生知道 AI 正在想」，摘要行仍然常驻、徽标与耗时
 * 仍然可见，被收起来的只是推理正文。学生想看仍可点开。
 *
 * 另一条已知问题不在此处修：思维链正文会泄漏内部口径（铁律 / 掌握度 /
 * 门禁 / 编排层），那是提示词层的输出问题，收起只是降低暴露面，
 * 彻底修要改教学提示词的输出约束并 `--force` 重跑讲稿缓存。
 */
function ThinkingChain({ steps }: { steps: readonly ThinkingStep[] }) {
  if (steps.length === 0) return null;

  // 只累计已结束的段：流式进行中本就不显示耗时（显示「进行中」徽标），
  // 用 Date.now() 补未结束段会让渲染期出现随时间变化的非纯计算。
  const totalMs = steps.reduce(
    (sum, s) =>
      s.endedAt !== undefined ? sum + (s.endedAt - s.startedAt) : sum,
    0,
  );
  const isStreaming = steps.some((s) => s.endedAt === undefined);

  return (
    <details className="group" open>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent/60">
        <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" />
        <Brain className="size-3.5 shrink-0" />
        <span className="font-medium">思考过程</span>
        {isStreaming ? (
          <Badge variant="muted" className="shrink-0">
            进行中
          </Badge>
        ) : (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <Timer className="size-3" />
            {formatDuration(totalMs)}
          </span>
        )}
      </summary>
      <pre className="mt-1 max-h-80 overflow-auto rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {steps.map((s) => s.content).join("")}
      </pre>
    </details>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${Math.round(seconds - minutes * 60)}s`;
}