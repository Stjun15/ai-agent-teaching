"use client";

/**
 * 审计日志面板 —— 把一组「事件记录」按等级着色列出来
 *
 * 与 `scene-parts.tsx` 里的零件一样只负责画：给它一组带等级的记录，它不关心这些
 * 记录怎么来的。所以本文件不认识安全、过滤或 MCP —— 换一场戏要展示「发生过什么」，
 * 把记录按同一套等级传进来即可。
 *
 * 四档等级直接映射到画布那套语义色，不在这里另写一份颜色。另写一份的代价很具体：
 * 将来调色时这里会被漏掉，于是日志里的红色与画布上的红色对不上 —— 而它们讲的是
 * 同一件事（这条被拦下了）。
 *
 * 为什么单独一个文件而不是塞进场景
 * ----------------------------
 * 模块 9 的产物就是这份日志（规格第 5 步「日志记录 → 写入日志面板」），日志面板
 * 本身就是这一场的「结果」。把它留在 200 行的场景组件里，本体就只剩布局与状态判断；
 * 这与 `scene-typewriter.tsx` 独立成文件是同一个理由。
 */

import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneColumn, TONE_SURFACE } from "./scene-canvas";

/**
 * 一条记录的等级。
 *
 * 与 `scene-safety-fixture.ts` 的 `LogEntry["level"]` 是同一组字面量 ——
 * 结构相同即可传入，不必互相 import：这个零件不该为了一个类型就依赖某一场的样本。
 */
export type AuditLevel = "block" | "pass" | "redact" | "fallback";

const LEVEL: Record<AuditLevel, string> = {
  block: TONE_SURFACE.alert,
  pass: TONE_SURFACE.idle,
  redact: TONE_SURFACE.active,
  fallback: TONE_SURFACE.done,
};

/** 一条记录。 */
export interface AuditEntry {
  level: AuditLevel;
  text: string;
}

export function AuditLogPanel({
  entries,
  note,
}: {
  entries: readonly AuditEntry[];
  /** 标题右侧那句说明，例如「出了事要能倒推回当时规则是怎么配的」。 */
  note: string;
}) {
  return (
    <div className="flex animate-in flex-col gap-1.5 rounded-md border border-dashed border-border p-2 duration-300 fade-in">
      <p className="flex items-center gap-1.5 text-[11px] font-medium">
        <FileText className="size-3.5" />
        审计日志
        <span className="font-normal text-muted-foreground">{note}</span>
      </p>
      <SceneColumn>
        {entries.map((entry) => (
          <p
            key={entry.text}
            className={cn(
              "animate-in rounded border px-2 py-1 text-[10px] leading-relaxed fade-in",
              LEVEL[entry.level],
            )}
          >
            {entry.text}
          </p>
        ))}
      </SceneColumn>
    </div>
  );
}
