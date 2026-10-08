"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

import {
  parseMarkdown,
  type InlineToken,
  type MarkdownBlock,
} from "@/lib/markdown";

/**
 * 把 Markdown 源码渲染成 React 元素。
 *
 * 这里**一次 `dangerouslySetInnerHTML` 都没有**，这是本模块的全部意义所在
 * ---------------------------------------------------------------------
 * 模型输出是不可信内容。常见做法是「Markdown → HTML 字符串 → 净化 → 塞进
 * `dangerouslySetInnerHTML`」，那条链的安全性取决于净化配置有没有漏（历史上
 * 出问题的大多不是 Markdown 解析器，而是净化器的边界）。
 *
 * 这里换一条更硬的路：解析器只产出**结构**（`src/lib/markdown.ts` 的 token
 * 树），渲染时逐节点生成 React 元素。不可信文本永远是 React 的**子节点**，
 * 由 React 负责转义；整条链上不存在「HTML 字符串」这个中间物，
 * 也就没有可以注入的载体 —— 白名单不再是「过滤掉什么」，而是
 * 「**只存在这些**」。多一种 token 类型就必须改这里，改不动就渲染不出来。
 *
 * 换行的处理
 * --------
 * 段落内的单换行不在这里插 `<br/>`：气泡本身带 `whitespace-pre-wrap`
 * （见 `MessageItem`），换行与空格由 CSS 保留。这样「模型怎么写就怎么显示」
 * 这条原有性质不变，Markdown 只负责把结构叠上去 —— 属于叠加，不是替换。
 */

/** 行内 token → React 节点。文本直接作为子节点，由 React 转义。 */
function renderInline(tokens: InlineToken[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-i${index}`;
    switch (token.type) {
      // 返回裸字符串而不是 `<span>`：字符串数组项不需要 key，
      // 少一层 DOM 也让复制出来的文本更干净。
      case "text":
        return token.value;

      case "code":
        return (
          <code
            key={key}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] break-all"
          >
            {token.value}
          </code>
        );

      case "strong":
        return (
          <strong key={key} className="font-semibold">
            {renderInline(token.children, key)}
          </strong>
        );

      case "emphasis":
        return <em key={key}>{renderInline(token.children, key)}</em>;

      case "link":
        // href 已在解析层过白名单（`isSafeHref`），能走到这里的都是
        // http/https/mailto 或站内相对路径。rel 三件套照旧加上：
        // 外链一律新窗口打开，不能让外部页面拿到 window.opener。
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline underline-offset-2"
          >
            {renderInline(token.children, key)}
          </a>
        );
    }
  });
}

/**
 * 标题在气泡里要收敛。
 *
 * 消息气泡正文是 `text-sm`，若 h1 按浏览器默认的 2em 渲染，一句「# 小结」
 * 会比学生的提问还大一圈，把对话节奏打乱。所以 h1 只到 `text-base`，
 * h2 及以下与正文同号、只靠字重区分。
 */
const HEADING_CLASS: Record<number, string> = {
  1: "text-[clamp(13px,2vw,18px)] font-semibold",
  2: "text-[clamp(12px,1.8vw,16px)] font-semibold",
  3: "text-[clamp(12px,1.6vw,15px)] font-semibold",
  4: "text-[clamp(11px,1.4vw,14px)] font-medium",
  5: "text-[clamp(11px,1.2vw,13px)] font-medium",
  6: "text-[clamp(11px,1.2vw,13px)] font-medium text-muted-foreground",
};

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** 从行内 token 列表中提取纯文本，用于生成标题 id。 */
function getPlainText(tokens: InlineToken[]): string {
  return tokens
    .map((t) => {
      if (t.type === "text") return t.value;
      if (t.type === "code") return t.value;
      if (t.type === "strong" || t.type === "emphasis" || t.type === "link") {
        return getPlainText(t.children);
      }
      return "";
    })
    .join("");
}

/** 将标题文本转为 URL 安全的 slug。 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** 代码块卡片（含语言标签 + 复制按钮）。 */
function CodeBlock({
  language,
  value,
  closed,
}: {
  language: string | null;
  value: string;
  closed: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：选中文本让用户手动复制
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <div
      className={`overflow-hidden rounded-md bg-muted/40 ${
        closed ? "border" : "border border-dashed"
      }`}
    >
      <div className="flex items-center justify-between border-b px-2 py-0.5">
        {language !== null ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {language}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={copied ? "已复制" : "复制代码"}
        >
          {copied ? (
            <Check className="size-3 text-emerald-500" />
          ) : (
            <Copy className="size-3" />
          )}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-2 text-[clamp(11px,1.8vw,16px)] leading-relaxed break-words whitespace-pre-wrap">
        <code>{value}</code>
      </pre>
    </div>
  );
}

/** 块级 token → React 节点。 */
function renderBlocks(blocks: MarkdownBlock[], keyPrefix: string): ReactNode[] {
  return blocks.map((block, index) => {
    const key = `${keyPrefix}-b${index}`;

    switch (block.type) {
      case "paragraph":
        return (
          <p key={key} className="text-[clamp(12px,1.8vw,18px)]">
            {renderInline(block.children, key)}
          </p>
        );

      case "heading": {
        const level = Math.min(Math.max(block.level, 1), HEADING_TAGS.length);
        const Tag = HEADING_TAGS[level - 1];
        const plainText = getPlainText(block.children);
        const id = slugify(plainText);
        return (
          <Tag key={key} id={id || undefined} className={HEADING_CLASS[level]}>
            {renderInline(block.children, key)}
          </Tag>
        );
      }

      case "code":
        return (
          <CodeBlock
            key={key}
            language={block.language}
            value={block.value}
            closed={block.closed}
          />
        );

      case "list": {
        const items = block.items.map((item, itemIndex) => (
          <li key={`${key}-li${itemIndex}`}>
            {renderInline(item, `${key}-li${itemIndex}`)}
          </li>
        ));
        // Tailwind 预置把 list-style 清成了 none，这里必须显式加回来，
        // 否则每个条目都变成缩进的一大坨文字、看不出是列表。
        return block.ordered ? (
          <ol
            key={key}
            start={block.start}
            className="list-decimal space-y-1 pl-5"
          >
            {items}
          </ol>
        ) : (
          <ul key={key} className="list-disc space-y-1 pl-5">
            {items}
          </ul>
        );
      }

      case "quote":
        return (
          <blockquote
            key={key}
            className="border-l-2 border-border pl-3 text-muted-foreground"
          >
            {renderBlocks(block.children, key)}
          </blockquote>
        );

      case "rule":
        return <hr key={key} className="border-border" />;
    }
  });
}

/**
 * Markdown 渲染入口。空内容返回 `null`，让 `MessageItem` 的「正在思考…」
 * 占位逻辑保持现在的样子（不然会多出一个空段落把占位挤下去）。
 */
export function MarkdownView({ source }: { source: string }) {
  // 流式输出期间 `source` 每次增量都会变，这里 memo 掉是为了避免
  // 「与内容无关的重渲染」也重跑一遍解析（例如 token 计数器更新）。
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  if (blocks.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">{renderBlocks(blocks, "md")}</div>
  );
}
