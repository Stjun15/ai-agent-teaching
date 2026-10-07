"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AuditSeverity } from "@/lib/db";

import type { AuditFinding } from "./audit-types";

/**
 * 缺陷明细列表
 *
 * 每条 finding 必须带**可核验的证据原文** —— 这是产品内审计员和「模型随口说
 * 有问题」的根本区别：界面允许把结论折叠起来（默认收起），但点开必须能看到
 * 原文摘录，看不到就不该算一条 finding。所以 `evidence` 在类型上就是必填
 * 字符串，不是可选字段。
 */

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  critical: "阻断",
  high: "严重",
  medium: "中等",
  low: "轻微",
  info: "提示",
};

/**
 * 严重度配色复用难度徽标那三档（levelHigh/levelMid/levelLow）。
 *
 * 不另建一组：语义相同（都是「高低等级」），而 badge 文件头明确写过不要
 * 拿 `--chart-*` 那套序列色。当前这套是显式三档语义色，正好对得上。
 */
function severityVariant(severity: AuditSeverity) {
  switch (severity) {
    case "critical":
    case "high":
      return "levelHigh" as const;
    case "medium":
      return "levelMid" as const;
    default:
      return "levelLow" as const;
  }
}

export function AuditFindingList({
  findings,
}: {
  findings: readonly AuditFinding[];
}) {
  return (
    <section>
      <h2 className="text-sm font-medium">
        缺陷明细{findings.length > 0 ? `（${findings.length}）` : ""}
      </h2>
      {findings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          本轮未在这五项检查里发现结构缺陷。这不等于课程没有问题 ——
          判断类的缺陷不在这里，见上方口径说明。
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {findings.map((finding) => (
            <li key={finding.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={severityVariant(finding.severity)}>
                  {finding.severity === "critical" ? <AlertTriangle /> : null}
                  {SEVERITY_LABEL[finding.severity]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {finding.moduleName} · {finding.dimension}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{finding.title}</p>
              {/* 默认收起 —— 结论要一眼可见，证据要主动去翻。展开成本低但
                  让人愿意相信「真有依据」，比默认摊开更好。 */}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  查看证据与建议
                </summary>
                <div className="mt-2 flex flex-col gap-2 text-xs leading-relaxed">
                  <div>
                    <span className="font-medium">证据：</span>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted/60 p-2 whitespace-pre-wrap">
                      {finding.evidence}
                    </pre>
                  </div>
                  {finding.recommendation !== "" ? (
                    <div>
                      <span className="font-medium">建议：</span>
                      <span className="text-muted-foreground">
                        {finding.recommendation}
                      </span>
                    </div>
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
