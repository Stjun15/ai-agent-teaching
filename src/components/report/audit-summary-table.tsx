"use client";

import { ScoreCell } from "./audit-score-cell";
import type { AuditSummary } from "./audit-types";

/**
 * 逐讲检查结果表
 *
 * 单独成文件而不是塞进 `audit-view.tsx`：这一块的核心风险是**把 null 画成 0**。
 * 「未检测」与「0 分」在这个项目里从来不是同一件事（见 `audit-score-cell.tsx`
 * 头注），所以判据、渲染、脚注三者必须待在一起，改一处必然要改三处。
 *
 * 表格里的数字有两个来源，必须分清：
 *   确定性检查（任务节可达 / 示范可读 / 术语断层 / 内容一致）→ 有值或 null
 *   模型判断（认知负荷）→ 本轮不调模型 → 恒为 null
 * 底下的脚注就是防止有人把「未检测」读成「这一项满分」。
 */
export function AuditSummaryTable({
  summaries,
}: {
  summaries: readonly AuditSummary[];
}) {
  return (
    <section>
      <h2 className="text-sm font-medium">逐讲检查结果</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">讲</th>
              <th className="px-2 py-1.5 font-medium">任务节可达</th>
              <th className="px-2 py-1.5 font-medium">示范可读</th>
              <th className="px-2 py-1.5 font-medium">术语断层</th>
              <th className="px-2 py-1.5 font-medium">内容一致</th>
              <th className="px-2 py-1.5 font-medium">认知负荷</th>
              <th className="px-2 py-1.5 font-medium">问题数</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.moduleId} className="border-b">
                <td className="px-2 py-1.5">
                  <span className="font-medium">{summary.moduleName}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {summary.moduleId}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <ScoreCell value={summary.reachability} />
                </td>
                <td className="px-2 py-1.5">
                  <ScoreCell value={summary.demoReadability} />
                </td>
                <td className="px-2 py-1.5">
                  <ScoreCell value={summary.terminologyGap} />
                </td>
                <td className="px-2 py-1.5">
                  <ScoreCell value={summary.consistency} />
                </td>
                <td className="px-2 py-1.5">
                  <ScoreCell value={summary.cognitiveLoad} />
                </td>
                <td className="px-2 py-1.5 tabular-nums">
                  {summary.findingsCount === 0 ? (
                    <span className="text-muted-foreground">
                      0（未发现结构缺陷）
                    </span>
                  ) : (
                    <span className="font-medium">{summary.findingsCount}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        「认知负荷」恒为未检测：它要模型判「这一讲读起来累不累」，本轮没调 模型
        —— 写数字就是编数据。
      </p>
    </section>
  );
}
