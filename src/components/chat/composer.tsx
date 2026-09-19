"use client";

import { useState, type KeyboardEvent } from "react";
import {
  Code2,
  CornerDownLeft,
  Loader2,
  Send,
  Sparkles,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChatStream } from "@/hooks/useChatStream";
import { useCodeStore, useSessionStore } from "@/stores";
import type { StepType } from "@/lib/db";
import { cn } from "@/lib/utils";

/**
 * 输入区（模块页中栏底部）。
 *
 * 依据 `04-frontend.md`：底部输入区含「输入框（文本/语音/截图/发送）」。
 * 文本与发送已接；语音与截图需要相应能力（语音识别、视觉模型 + 文件上传），
 * 分别在 Phase 6 与 Phase 5 之后 —— 这里**不摆不可点的图标**，
 * 摆上去只会让人以为坏了。
 *
 * 「附带代码」为什么放在这里
 * ----------------------
 * 教学流程第 3 步「动手模仿」要求学生写 Prompt / 工具定义 / 核心逻辑，
 * 第 4 步才是 AI 校验。学生写完要能让导师看到，代码就必须能随消息发出去
 * （`api-spec.md` 的 `SendMessageSchema` 里本来就有 `code` / `language`）。
 * 代码编辑器（Monaco）是 Phase 6 的事，但「把代码发出去」这条链路现在就能通。
 *
 * step / starter（2026-09-19 新增）
 * ------------------------------
 * 学习页随每条消息携带当前步骤（`step`），后端据此决定用讲解导师还是
 * 通用答疑口径回答 —— 学生反馈过「概念讲解就一句话」，根因是对话一直走
 * 答疑口径。`starter` 是「开始讲解」入口：空对话时摆一个可点的起点，
 * 学生不必自己想第一句怎么说。二者都由模块工作区（知道当前步骤与模块名）
 * 传入；演练场不传，保持纯自由对话。
 */
export function Composer({
  step,
  starter,
}: {
  /** 学生当前所处学习步骤。缺省 = 非学习页语境（演练场）。 */
  step?: StepType;
  /** 空对话时显示的「开始讲解」按钮文案；不传则不显示。 */
  starter?: string;
}) {
  // 流控制器由本组件持有，而不是提到上层：输入区是**唯一**发起请求的地方，
  // 「同一时刻只允许一条流」这个约束放在这里既自然又不用跨组件共享状态。
  // 消息列表只需要读 Store，不需要拿到控制器。
  const { send, abort } = useChatStream();

  const status = useSessionStore((state) => state.status);
  const messageCount = useSessionStore((state) => state.messages.length);
  const code = useCodeStore((state) => state.code);
  const language = useCodeStore((state) => state.language);
  const setCode = useCodeStore((state) => state.setCode);

  const [text, setText] = useState("");
  const [showCode, setShowCode] = useState(false);

  const streaming = status === "streaming";
  const canSend = text.trim() !== "" && !streaming;
  // 「开始讲解」只在对话真正为空、且没有在流式输出时出现 ——
  // 对话一旦开始，它就成了噪音。
  const showStarter = starter !== undefined && messageCount === 0 && !streaming;

  function sendContent(content: string): void {
    void send({
      content,
      // 步骤随消息走：后端按它选讲解导师或答疑口径（见 step-prompt.ts）。
      ...(step !== undefined ? { step } : {}),
      // 空代码不发送：让请求体保持最简，也免得后端把空字符串当成
      // 「学生提交了空代码」。
      ...(showCode && code.trim() !== ""
        ? { code: code.trim(), language }
        : {}),
    });
    setText("");
  }

  function submit(): void {
    if (!canSend) return;
    sendContent(text.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter 发送、Shift+Enter 换行 —— 与主流对话界面一致。
    // 但输入法组合中的 Enter 是「选字确认」，必须放过，否则中文输入会被打断。
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    <div className="flex flex-col gap-2">
      {showCode ? (
        <textarea
          value={code}
          onChange={(event) => setCode(event.target.value)}
          spellCheck={false}
          rows={6}
          placeholder="把你的 Prompt / 工具定义 / 核心逻辑贴在这里，导师会按评分标准逐项点评。"
          className="w-full resize-y rounded-md border bg-background p-2.5 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : null}

      {showStarter ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => sendContent(starter)}
          >
            <Sparkles className="size-4" />
            {starter}
          </Button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="说说你的思路，或问一个具体的问题…（Enter 发送，Shift+Enter 换行）"
          className="min-h-[60px] flex-1 resize-y rounded-md border bg-background p-2.5 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={showCode ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowCode((value) => !value)}
            aria-pressed={showCode}
            className={cn(showCode && "border-ring")}
          >
            <Code2 className="size-4" />
            {showCode ? "收起代码" : "附带代码"}
          </Button>

          {streaming ? (
            <Button type="button" variant="outline" size="sm" onClick={abort}>
              <Square className="size-3.5" />
              停止
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!canSend}
            >
              {status === "idle" ? (
                <Send className="size-4" />
              ) : (
                <CornerDownLeft className="size-4" />
              )}
              发送
            </Button>
          )}
        </div>
      </div>

      {streaming ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          模型正在输出，可以随时停止
        </p>
      ) : null}
    </div>
  );
}
