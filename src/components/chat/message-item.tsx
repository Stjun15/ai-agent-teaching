"use client";

import { AlertTriangle, Bot, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/stores";
import { cn } from "@/lib/utils";

/**
 * 单条消息。
 *
 * 不做 Markdown 渲染，这是刻意的
 * ----------------------------
 * 模型输出目前是纯文本。要渲染 Markdown 得再引一个渲染器（`react-markdown`
 * 及其一整条 remark/rehype 依赖链），而本机装包的成本很高（见项目记忆的
 * 依赖安装定式）。更重要的是：**引入 Markdown 渲染同时引入了注入面** ——
 * 模型输出里的 HTML / 链接会成为风险点，那属于 Phase 7 的安全加固
 * （`fix(security): add output filter`）。
 *
 * 所以现在用 `whitespace-pre-wrap` 原样呈现：换行与空格都保留，
 * 内容是保真的。这不是「还没做」，是一个有理由的取舍。
 */
export function MessageItem({ message }: { message: ChatMessage }) {
  const isStudent = message.role === "student";
  const isStreaming = message.status === "streaming";
  const isError = message.status === "error";

  return (
    <article
      data-role={message.role}
      data-status={message.status}
      className={cn(
        "flex gap-3",
        isStudent ? "flex-row-reverse text-right" : "flex-row",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
          isStudent
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary text-primary-foreground",
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

        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
            isStudent
              ? "bg-secondary text-secondary-foreground"
              : "border bg-card",
            isError && "border-destructive/40",
          )}
        >
          {message.content}
          {isStreaming ? (
            // 光标用内联块而不是伪元素：它必须在文本流里占据位置，
            // 否则会出现「最后一个字被光标盖住」。
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-[1px] bg-foreground"
            />
          ) : null}
          {isStreaming && message.content === "" ? (
            <span className="text-muted-foreground">正在思考…</span>
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
}
