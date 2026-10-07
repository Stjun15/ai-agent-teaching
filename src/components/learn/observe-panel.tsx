"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Maximize, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/chat/markdown-view";
import { segmentByCode } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * 观察示范面板——七步第2步的主视图。
 *
 * 示范代码从哪里来
 * ---------------
 * 此前这一步由 LectureLauncher 自动发起 LLM 调用生成讲稿，再用
 * ObservePanel 从讲稿里提取代码块展示。但「观察示范」的本质是：
 *
 * > 把预先写好的示范代码摆到学生眼前，让他看清「对的」长什么样。
 *
 * 这件事不需要 LLM 翻译——wiki 页面里已经写好了 `## 示范代码` 小节，
 * 由服务端页面组件在构建期读入、序列化为 `demoCode` prop 传入。
 * 零模型调用，零等待，点开即有。
 *
 * 渲染规则（2026-10-07 改）
 * -----------------------
 * 原先只取代码块、把其余内容丢掉。实测概念页这一节里夹着大量面向学生
 * 的说明与类比（multi-agent 的「把它想象成招聘」、llm-wiki 的「就像用
 * 微波炉不用懂磁控管」、rag 的「你不用懂它们怎么算」），丢掉它们等于把
 * 这一讲最该给零基础学生的部分藏起来 —— 扇出审计 8/10 讲命中此问题。
 *
 * 现在按 `segmentByCode` 切分：散文原样渲染，代码块仍走带序号与全屏
 * 按钮的卡片。没有代码块时整体回退为 MarkdownView。
 *
 * 无示范代码时的表现
 * -----------------
 * demoCode 为空 →「示范代码准备中」占位提示，门控按钮仍可用。
 *
 * 确认理解的门控
 * ------------
 * 「进入动手模仿」默认禁用，勾选「我理解示范在做什么」才解锁。
 */
export function ObservePanel({
  moduleId,
  demoCode,
}: {
  moduleId: string;
  demoCode?: string;
}) {
  const [hasUnderstood, setUnderstood] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const router = useRouter();

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  /**
   * 散文与代码交替的段落序列，散文保留原文。
   *
   * 为什么不用 `parseMarkdown`（见 markdown.ts 的 segmentByCode 注释）：
   * 结构化 token 还原成 Markdown 是有损的，这里的散文必须原样渲染。
   */
  const segments = useMemo(() => {
    if (!demoCode) return [];
    return segmentByCode(demoCode);
  }, [demoCode]);

  const codeCount = useMemo(
    () => segments.filter((s) => s.kind === "code").length,
    [segments],
  );

  /** 全屏视图只列代码段 —— 那里是「看代码」，不是读散文。 */
  const codeSegments = useMemo(
    () => segments.filter((s) => s.kind === "code"),
    [segments],
  );

  if (!demoCode) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
        <Eye className="size-6" />
        <p className="text-sm">示范代码准备中</p>
        <p className="max-w-xs text-xs leading-relaxed">
          这一讲的示范代码还没写好。你可以在下面的对话框里问导师看看。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          这些是给本讲准备的示范代码——看清「对的」长什么样。有疑问直接在下面
          的对话框问导师。
        </p>

        {codeCount === 0 ? (
          <MarkdownView source={demoCode} />
        ) : (
          <div className="flex flex-col gap-3">
            {segments.map((segment, index) =>
              segment.kind === "code" ? (
                <li
                  key={index}
                  className="rounded-lg border bg-card"
                  style={{ listStyle: "none" }}
                >
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
                    <span className="text-xs font-medium">
                      示范 {segment.ordinal}
                    </span>
                    {segment.language ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {segment.language}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      title="全屏查看代码"
                      className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Maximize className="size-3.5" />
                      全屏
                    </button>
                  </div>
                  <MarkdownView
                    source={
                      "```" +
                      (segment.language ?? "") +
                      "\n" +
                      segment.value +
                      "\n```"
                    }
                  />
                </li>
              ) : (
                // 代码块之间的说明与类比：原样渲染，不丢。
                <MarkdownView key={index} source={segment.source} />
              ),
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
          <input
            id="observe-understood"
            type="checkbox"
            checked={hasUnderstood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="size-4 accent-primary"
          />
          <label
            htmlFor="observe-understood"
            className="text-xs leading-relaxed"
          >
            我理解这些示范代码在做什么了
          </label>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={!hasUnderstood}
            title={hasUnderstood ? undefined : "先勾选上面的确认，按钮才会解锁"}
            onClick={() => router.push(`/learn/${moduleId}/imitate`)}
          >
            进入动手模仿→
          </Button>
          <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
            还没理解？不着急——多读几遍，或在下面的对话框里问导师。
            进入动手模仿之后，也随时可以跳回这一步重看。
          </p>
        </div>
      </div>

      {/* 全屏覆盖层 */}
      <AnimatePresence>
        {isFullscreen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-background p-6 sm:p-8"
          >
            {/* 顶部：标题 + 关闭按钮 */}
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">示范代码</span>
              <button
                type="button"
                onClick={closeFullscreen}
                title="退出全屏"
                className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 代码内容 */}
            <div className="flex-1 overflow-auto">
              {codeSegments.map((segment, index) => (
                <div
                  key={index}
                  className={cn(
                    "mb-4 overflow-hidden rounded-lg border bg-card",
                    index === codeSegments.length - 1 ? "mb-0" : "",
                  )}
                >
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
                    <span className="text-sm font-medium">
                      示范 {segment.ordinal}
                    </span>
                    {segment.language ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {segment.language}
                      </span>
                    ) : null}
                  </div>
                  <MarkdownView
                    source={
                      "```" +
                      (segment.language ?? "") +
                      "\n" +
                      segment.value +
                      "\n```"
                    }
                  />
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
