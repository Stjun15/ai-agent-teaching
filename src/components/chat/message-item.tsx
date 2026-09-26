"use client";

import { memo } from "react";
import { AlertTriangle, Bot, User } from "lucide-react";

import { MarkdownView } from "@/components/chat/markdown-view";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/stores";
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
              : "border border-l-2 border-l-primary/50 bg-primary/5",
            isError && "border-destructive/40",
          )}
        >
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
},
(prev, next) => {
  const p = prev.message;
  const n = next.message;
  if (p.status !== n.status) {
    return false;
  }
  if (p.status === "done") {
    return p.content === n.content;
  }
  return false;
});