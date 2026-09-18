"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { JsonBlock } from "@/components/playground/lab-controls";
import type { LabOutcome } from "@/components/playground/lab-types";

/**
 * 一次运行的结果面板。
 *
 * 三种状态各有各的写法，不合并
 * ------------------------
 * - **还没跑**：说明「点运行会看到什么」，而不是留一片空白；
 * - **成功**：耗时 + 请求体 + 服务端返回；
 * - **失败**：错误码、可恢复性、**服务端报错原文**，以及仍然照原样显示的请求体。
 *
 * 失败分支为什么保留 `code` 而不是显示「失败」
 * -----------------------------------------
 * 服务端的错误码是有信息的：`FORBIDDEN` 说的是前置模块掌握度不够，
 * `INVALID_INPUT` 说的是哪个字段不合规。压成一句「运行失败」等于把沙箱最该
 * 展示的东西扔掉了 —— 一个 400 的原文比任何解释都更能说明「这里为什么必须填数字」。
 *
 * `recoverable` 单独标一个徽标：它不是「严重程度」，而是「能不能原样重试」。
 * 学生点两次就明白这两件事不是一回事。
 */
export function OutcomeView({ outcome }: { outcome: LabOutcome | null }) {
  if (outcome === null) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        点「运行」后，这里会显示实际发出的请求体与服务端返回的原始 JSON。
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={outcome.ok ? "levelLow" : "levelHigh"}>
          {outcome.ok ? "成功" : outcome.code}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {outcome.ms} ms
        </span>
        {!outcome.ok && outcome.recoverable ? (
          <Badge variant="levelMid">可原样重试</Badge>
        ) : null}
      </div>

      {!outcome.ok ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-relaxed">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          {outcome.message}
        </p>
      ) : null}

      <JsonBlock title="实际发出的请求体" value={outcome.request} />
      {outcome.ok ? (
        <JsonBlock title="服务端返回" value={outcome.data} />
      ) : null}
    </div>
  );
}
