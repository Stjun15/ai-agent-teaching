"use client";

/**
 * ExplainColdStart —— 无缓存讲稿时的交互式内容预览
 *
 * 什么时候出现
 * ----------
 * explain 步、没有预生成讲稿缓存、也没有历史消息时。
 * 此时不显示「还没有对话」空态，而是拉取模块概念页正文，
 * 渲染成可交互的卡片（三板斧 / 路径选择等），比空白 + 等待
 * 模型响应的体验好一个数量级。
 *
 * 消失条件
 * -------
 * 学生点击「开始对聊」后，组件从 DOM 移除，聊天面板接管。
 * AI 在背景生成的首条消息出现后也自动移除。
 *
 * 模块适配
 * -------
 * - platform-replica：三板斧解析（parseAxes），可折叠卡片
 * - python-basics / ts-basics：仅渲染 intro 预览；路径选择与教学由 AI 在对话里驱动
 * - 其余模块：渲染全量 markdown 正文（纯阅读）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Axe,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownView } from "@/components/chat/markdown-view";
import { useChatStream } from "@/hooks/useChatStream";
import { parseAxes, parsePathSelect } from "@/lib/explain-cold-start-parser";
import { useSessionStore } from "@/stores";

/** /api/module-content 返回的正文。 */
interface ModuleContent {
  content: string;
}

export function ExplainColdStart({
  moduleId,
  moduleName,
  onStarted,
}: {
  moduleId: string;
  /** 模块名，生成开场词用。 */
  moduleName: string;
  /** 学生点击"开始对聊"后触发，父组件用此回调显示聊天面板。 */
  onStarted?: () => void;
}) {
  const { send } = useChatStream();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);
  const [expandedAxes, setExpandedAxes] = useState<Set<number>>(
    () => new Set([0]),
  );
  const startedRef = useRef(false);

  const status = useSessionStore((state) => state.status);

  // 路径选择数据（python-basics / ts-basics）
  const pathData = useMemo(() => {
    if (content === null) return null;
    return parsePathSelect(content);
  }, [content]);

  const handleStartChat = useCallback(async () => {
    if (startedRef.current || prompting) return;
    startedRef.current = true;
    setPrompting(true);
    onStarted?.();
    try {
      await send(
        {
          content: `我已阅读完「${moduleName}」的概念内容，可以开始互动了。`,
          moduleId,
        },
        { silent: true, moduleId },
      );
    } catch {
      startedRef.current = false;
      setPrompting(false);
    }
  }, [send, moduleId, moduleName, prompting]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/module-content?moduleId=${encodeURIComponent(moduleId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res
            .json()
            .catch(() => ({ message: String(res.status) }));
          throw new Error(body.message ?? String(res.status));
        }
        return res.json() as Promise<ModuleContent>;
      })
      .then((data) => {
        if (!cancelled) setContent(data.content);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  // AI 开始输出或已开始互动时，不渲染本组件。
  // 不再用 messages.some(step==="explain") 判旧消息：
  // localStorage rehydrate 的旧讲稿会导致误隐，学生进来还是空白。
  const shouldHide = status !== "idle" || startedRef.current;
  if (shouldHide || error !== null || content === null) return null;

  // ---- 平台复刻：三板斧专用渲染 ----
  if (moduleId === "platform-replica") {
    const axes = parseAxes(content);
    if (axes.length > 0) {
      return (
        <Card className="mb-4">
          <CardContent>
            {/* 头部 */}
            <div className="mb-4 flex items-start gap-3">
              <Axe className="mt-0.5 size-5 shrink-0 text-orange-500" />
              <div>
                <h2 className="text-lg font-semibold">
                  怎么造：三板斧 + 一条龙骨
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  不是先讲完理论再写代码。是
                  <strong>造一段、跑一段、通了再往下</strong>。
                </p>
              </div>
            </div>

            {/* 三板斧卡片 */}
            <div className="space-y-3">
              {axes.map((axe, i) => {
                const expanded = expandedAxes.has(i);
                return (
                  <button
                    key={axe.title}
                    type="button"
                    className="w-full rounded-lg border bg-card text-left transition-colors hover:bg-muted/30"
                    onClick={() => {
                      setExpandedAxes((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      });
                    }}
                  >
                    {/* 斧头标题行 */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-lg" aria-hidden>
                        {axe.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">
                          第{"一二三"[i]}斧：{axe.title}
                        </span>
                      </div>
                      {expanded ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </div>

                    {/* 展开内容 */}
                    {expanded && (
                      <div className="border-t px-4 pt-3 pb-4">
                        {/* 表格渲染（做什么 / 用到的模块 / 关键文件） */}
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <MarkdownView source={axe.body} />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 开始按钮 */}
            <div className="mt-5 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                看完结构了？跟 AI 聊聊，问清楚再动手。
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={handleStartChat}
                disabled={prompting}
                className="shrink-0"
              >
                {prompting ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-1.5 size-4" />
                )}
                {prompting ? "正在启动…" : "开始对聊"}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  // ---- 路径选择：python-basics / ts-basics ----
  // 概念页是给 AI 的教学脚本，不是 dump 给学生看的。
  // 前端只渲染 intro（到「你想怎么学？」表格为止）作为预览，
  // 路径选择与教学由 AI 在对话里驱动。
  if (pathData !== null) {
    return (
      <Card className="mb-4">
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MarkdownView source={pathData.intro} />
          </div>
          <div className="mt-5 flex items-center justify-end">
            <Button
              variant="default"
              size="sm"
              onClick={handleStartChat}
              disabled={prompting}
            >
              {prompting ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <MessageSquare className="mr-1.5 size-4" />
              )}
              {prompting ? "正在启动…" : "开始对聊"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- 通用回退：渲染全部正文 ----
  return (
    <Card className="mb-4">
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MarkdownView source={content} />
        </div>
        <div className="mt-5 flex items-center justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={handleStartChat}
            disabled={prompting}
          >
            {prompting ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <MessageSquare className="mr-1.5 size-4" />
            )}
            {prompting ? "正在启动…" : "开始对聊"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}