"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/chat/markdown-view";
import { parseMarkdown } from "@/lib/markdown";

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
 * 代码块提取规则
 * -------------
 * 1. 先找围栏代码块（```language ... ```）。
 * 2. 如果 wiki 里没写围栏代码（纯文本描述），回退为整段渲染
 *    （MarkdownView 原样展示）。
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
  const router = useRouter();

  const codeBlocks = useMemo(() => {
    if (!demoCode) return [];
    return parseMarkdown(demoCode).filter((block) => block.type === "code");
  }, [demoCode]);

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
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        这些是给本讲准备的示范代码——看清「对的」长什么样。有疑问直接在下面
        的对话框问导师。
      </p>

      {codeBlocks.length === 0 ? (
        <MarkdownView source={demoCode} />
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
          进入动手模仿→
        </Button>
        <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
          还没理解？不着急——多读几遍，或在下面的对话框里问导师。
          进入动手模仿之后，也随时可以跳回这一步重看。
        </p>
      </div>
    </div>
  );
}
