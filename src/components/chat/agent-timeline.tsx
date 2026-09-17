"use client";

import { Brain, ChevronRight, Timer, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { selectTimeline, useSessionStore } from "@/stores";

/**
 * Agent 时间线（模块页右栏）。
 *
 * 依据 `04-frontend.md` 的组件树（`<AgentTimeline>` 在 `<RightPanel>` 下）。
 *
 * 为什么「思考」默认折叠
 * -------------------
 * 端到端实测：一条包含工具调用的流共 39 帧，其中 33 帧是 `thinking` 增量，
 * 内容是模型原始推理碎片（实测为英文："The user wants me to calculate ..."）。
 *
 * 直接把原文铺在右栏会有两个问题：一是有信息量的 `tool_call` 被 33 条
 * 意识流刷到看不见；二是中文教学场景里给学生看英文推理碎片，没有教学价值。
 *
 * 所以思考段折叠成一行摘要（耗时 / 增量数 / 字数），要看原文点开即可 ——
 * 既不隐瞒「模型在想什么」，也不让它喧宾夺主。用原生 `<details>` 实现：
 * 无需 JS 状态、键盘可达、屏幕阅读器友好。
 *
 * 时间线把思考段与工具调用**按发生时间交错**排列，而不是分成两组 ——
 * 「先思考、再调工具、再思考」的顺序本身就是 Agent Loop 的教学内容。
 */
export function AgentTimeline() {
  const entries = useSessionStore(selectTimeline);
  const status = useSessionStore((state) => state.status);

  if (entries.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        {status === "streaming"
          ? "等待 Agent 动作…"
          : "还没有 Agent 动作。发一条消息后，这里会显示模型的思考与工具调用过程。"}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) =>
        entry.kind === "thinking" ? (
          <li key={entry.step.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 text-xs hover:bg-accent/60">
                <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                <Brain className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{entry.step.step}</span>
                {entry.step.endedAt === undefined ? (
                  <Badge variant="muted">进行中</Badge>
                ) : (
                  <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                    <Timer className="size-3" />
                    {formatDuration(entry.step.endedAt - entry.step.startedAt)}
                  </span>
                )}
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {entry.step.content}
              </pre>
              <p className="mt-1 px-1.5 text-[11px] text-muted-foreground">
                {entry.step.deltas} 个增量 · {entry.step.content.length} 字
                {entry.step.endedAt === undefined ? " · 还在累积" : ""}
              </p>
            </details>
          </li>
        ) : (
          <li key={entry.tool.callId}>
            <div className="rounded-md border px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <Wrench className="size-3.5 text-muted-foreground" />
                <span className="font-mono font-medium">
                  {entry.tool.toolName}
                </span>
                {entry.tool.durationMs === undefined ? (
                  <Badge variant="muted">执行中</Badge>
                ) : (
                  <span className="ml-auto text-muted-foreground">
                    {entry.tool.durationMs}ms
                  </span>
                )}
              </div>

              <dl className="mt-1.5 flex flex-col gap-1 text-[11px]">
                <div className="flex gap-1.5">
                  <dt className="shrink-0 text-muted-foreground">参数</dt>
                  <dd className="min-w-0">
                    <code className="block overflow-x-auto whitespace-pre">
                      {JSON.stringify(entry.tool.params)}
                    </code>
                  </dd>
                </div>
                {entry.tool.result !== undefined ? (
                  <div className="flex gap-1.5">
                    <dt className="shrink-0 text-muted-foreground">结果</dt>
                    <dd className="min-w-0">
                      <code className="block max-h-24 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(entry.tool.result)}
                      </code>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

/** 毫秒 → 人读的时长。超过 1 分钟就带分钟，免得出现「83421ms」这种。 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${Math.round(seconds - minutes * 60)}s`;
}
