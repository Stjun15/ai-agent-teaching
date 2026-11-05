"use client";

import { BookMarked } from "lucide-react";

import { useSessionStore, type Citation } from "@/stores";

/**
 * 引用来源面板（模块页右栏）。
 *
 * 依据 `04-frontend.md` 的组件树（`<CitationPanel>` 在 `<RightPanel>` 下），
 * 数据来自 SSE 的 `citation` 事件（`api-spec.md` 第三节）。
 *
 * 相关度显示为百分比条
 * ------------------
 * `citation.relevance` 是个 0~1 的浮点数。直接显示 `0.83` 对学生没有意义，
 * 显示成「83%」才有 —— 而且它要能**被比较**：学生据此判断该先看哪一条。
 *
 * 本阶段为空是预期的（`/api/chat` 还没接 RAG）
 * -----------------------------------------
 * 检索要到 Phase 4 / 5 才有数据。这里不做假数据填充：面板显示真实的空态，
 * 一行字说明「为什么现在是空的」，比塞几条编造的出处诚实得多。
 */
export function CitationPanel() {
  const citations = useSessionStore((state) => state.citations);

  if (citations.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        这条回答没有引用参考资料。等导师开始查资料答题后，引用出处会列在这里。
      </p>
    );
  }

  return <CitationList citations={citations} />;
}

/**
 * 引用条目列表（纯展示、无 store 依赖）。
 *
 * 2026-11-03 从 `<CitationPanel>` 拆出：消息气泡里的「引用了 N 个知识来源」
 * 此前只是一行计数，学生点不开、看不到是哪篇文章 —— `CitationPanel`
 * 本身全仓没有挂载点，等于这段渲染代码从未生效。详情改挂到消息下方，
 * 与右栏复用同一份列表实现。
 */
export function CitationList({ citations }: { citations: readonly Citation[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {citations.map((citation, index) => (
        <li
          key={`${citation.source}-${index}`}
          className="rounded-md border px-2 py-1.5"
        >
          <div className="flex items-start gap-1.5 text-xs">
            <BookMarked className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              {/* 学生要看的是「哪篇文章」，路径只在有标题时作为副标题出现。 */}
              <span className="block truncate font-medium">
                {citation.title ?? citation.source}
              </span>
              {citation.title !== undefined ? (
                <span className="block truncate text-[10px] text-muted-foreground">
                  {citation.source}
                </span>
              ) : null}
            </div>
            {citation.page !== undefined ? (
              <span className="shrink-0 text-muted-foreground">
                p.{citation.page}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {citation.snippet}
          </p>

          <div className="mt-1.5 flex items-center gap-2">
            <div
              role="progressbar"
              aria-label={`${citation.source} 的相关度`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(citation.relevance * 100)}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-foreground/70"
                style={{
                  width: `${Math.min(Math.max(citation.relevance, 0), 1) * 100}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round(citation.relevance * 100)}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
