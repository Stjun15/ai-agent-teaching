"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
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
 *
 * 确认理解的门控
 * ------------
 * 「进入动手模仿」默认禁用，勾选「我理解示范在做什么」才解锁 —— 跳转是
 * 学生**自证理解**的动作，不是系统替他判断（掌握度评估是点评 Agent 的活，
 * 这里不设分数门槛）。反向的跳回不做门控：不理解时随时回来看，没有成本。
 */
export function ObservePanel({ moduleId }: { moduleId: string }) {
  const messages = useSessionStore((state) => state.messages);
  const [hasUnderstood, setUnderstood] = useState(false);
  const router = useRouter();
  // 代码取自**示范步自己的讲稿**（step=observe，由 LectureLauncher 播种
  // 或流式生成）—— 概念讲解稿里的例子在讲解页，两步内容不复用。
  const lecture = messages.find(
    (message) => message.step === "observe" && message.role === "assistant",
  );

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
        这些是导师示范里的代码 —— 看清「对的」长什么样。每段代码前后的
        解释在「概念讲解」步的讲稿里；有疑问直接在下面的对话框问导师。
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
        <input
          id="observe-understood"
          type="checkbox"
          checked={hasUnderstood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="size-4 accent-primary"
        />
        <label htmlFor="observe-understood" className="text-xs leading-relaxed">
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
          进入动手模仿 →
        </Button>
        <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
          还没理解？不着急——多读几遍，或在下面的对话框里问导师。
          进入动手模仿之后，也随时可以跳回这一步重看。
        </p>
      </div>
    </div>
  );
}
