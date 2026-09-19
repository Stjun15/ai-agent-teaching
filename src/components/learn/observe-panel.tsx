"use client";

import { useMemo } from "react";
import { Eye } from "lucide-react";

import { MarkdownView } from "@/components/chat/markdown-view";
import { parseMarkdown } from "@/lib/markdown";
import { useSessionStore } from "@/stores";

/**
 * 观察示范面板 —— 七步第 2 步的主视图。
 *
 * 为什么与「概念讲解」分屏
 * ----------------------
 * 此前七步里的 explain / observe 共用同一屏，切步只有侧栏高亮在变：
 * 零基础学生（2026-09-19 走查实测）感知不到「切步发生了什么」。
 * 教学法上两步的目的不同 —— 讲解步建立心智模型，示范步是「看清『对的』
 * 长什么样」（认知学徒制的示范环节）。本面板把讲稿里的**代码块**抽出来
 * 编号放大，代码本身成为主角；讲稿全文收进折叠区供对照解释。
 *
 * 代码从哪来
 * --------
 * 讲稿是会话里的第一条导师消息（缓存命中时由 `seedLecture` 播种、
 * 未命中时流式生成）。这里读同一个会话 store，用与聊天气泡**同一个**
 * Markdown 解析器提取围栏代码块 —— 流式输出时代码卡会随内容增长逐块
 * 出现，不需要单独的加载态。
 *
 * 只提取、不解释
 * ------------
 * 本面板不自己写一句教学文案：示范的「看点」就在讲稿原文里（代码前后的
 * 关键行为解释），折叠区原样给出。讲解的活是导师的，这里只负责
 * 「把代码摆到学生眼前」。
 */
export function ObservePanel() {
  const messages = useSessionStore((state) => state.messages);
  const lecture = messages.find((message) => message.role === "assistant");

  const codeBlocks = useMemo(() => {
    if (!lecture) return [];
    return parseMarkdown(lecture.content).filter(
      (block) => block.type === "code",
    );
  }, [lecture]);

  if (!lecture) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
        <Eye className="size-6" />
        <p className="text-sm">导师的讲稿还没开始</p>
        <p className="max-w-xs text-xs leading-relaxed">
          讲稿开始后，里面的示范代码会自动提取到这里，编号放大展示。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        这些是本讲讲稿里的示范代码 —— 对照讲稿原文（文末折叠区）读它们，
        看清「对的」长什么样。有疑问直接在下面问导师。
      </p>

      {codeBlocks.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          讲稿里还没有出现代码块（可能在输出中，稍等片刻）。
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {codeBlocks.map((block, index) => {
            if (block.type !== "code") return null;
            const fenced =
              "```" + (block.language ?? "") + "\n" + block.value + "\n```";
            return (
              <li
                key={index}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
                  <span className="text-xs font-medium">示范 {index + 1}</span>
                  {block.language ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {block.language}
                    </span>
                  ) : null}
                </div>
                <MarkdownView source={fenced} />
              </li>
            );
          })}
        </ol>
      )}

      <details className="rounded-lg border px-3 py-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          展开讲稿全文（含每段代码前后的解释）
        </summary>
        <div className="mt-2 text-sm leading-relaxed">
          <MarkdownView source={lecture.content} />
        </div>
      </details>
    </div>
  );
}
