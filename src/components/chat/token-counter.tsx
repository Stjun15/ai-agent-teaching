"use client";

import { useMemo } from "react";
import { AlertTriangle, Coins } from "lucide-react";

import { selectTotalTokens, useSessionStore } from "@/stores";

/**
 * Token 计数（模块页右栏）。
 *
 * 依据 `04-frontend.md` 的组件树（`<TokenCounter>` 在 `<RightPanel>` 下），
 * 数据来自 `done` 事件的 `tokens: { input, output }`。
 *
 * 为什么必须让学生看见 token 数
 * --------------------------
 * `00-MASTER.md` 的第一原则里，「上下文管理 —— 给 AI 提供恰当的背景信息，
 * 不多不少」和「理解 AI 行为模式」是六个子能力中的两个。这两个能力都建立在
 * **对成本有体感**之上：不知道自己一句话花了多少 token 的人，无法理解
 * 「把整份文档贴进去」和「只贴相关段落」的区别。
 *
 * 所以这里显示的是**累计值**（所有轮次相加，见 `selectTotalTokens`），
 * 而不是最近一轮 —— 学生要能看着它随对话增长，那才是成本感的来源。
 * 同时把 input / output 分开列：input 大说明上下文给多了，output 大说明
 * 模型话多，两者的处置方式完全不同。
 *
 * 顺带承载「损坏帧」的提示
 * ----------------------
 * `invalidFrames > 0` 时给一行警告。这些帧被丢弃了（见 `src/lib/sse.ts`），
 * 界面必须能说明「为什么内容好像少了一段」，而不是静默。
 */
export function TokenCounter() {
  // 只订阅原始切片，派生计算放 useMemo —— selectTotalTokens 与内联的
  // .filter() 都会返回新对象/新数组，直接当 selector 用会无限重渲染
  // （React #185，见 selectTotalTokens 上方的说明）。
  const messages = useSessionStore((state) => state.messages);
  const invalidFrames = useSessionStore((state) => state.invalidFrames);
  const totals = useMemo(() => selectTotalTokens(messages), [messages]);
  const turns = useMemo(
    () => messages.filter((m) => m.role === "student").length,
    [messages],
  );

  const total = totals.input + totals.output;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-1.5">
        <Coins className="size-3.5 text-muted-foreground" />
        <span className="text-lg font-semibold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">
          tokens · {turns} 轮
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>输入</dt>
          <dd className="text-foreground tabular-nums">{totals.input}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>输出</dt>
          <dd className="text-foreground tabular-nums">{totals.output}</dd>
        </div>
      </dl>

      {total === 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          完成一轮对话后显示用量。输入量偏大通常意味着上下文给多了。
        </p>
      ) : null}

      {invalidFrames > 0 ? (
        <p className="flex items-start gap-1 text-[11px] leading-relaxed text-destructive">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />有 {invalidFrames}{" "}
          帧数据未通过协议校验，已丢弃。
        </p>
      ) : null}
    </div>
  );
}
