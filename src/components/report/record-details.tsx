/**
 * 报告页的两块明细：错题本 与 Prompt 历史
 *
 * 为什么单独一个文件
 * ----------------
 * `report-sections.tsx` 画的是**汇总**（四个数字、六项能力、趋势折线），
 * 这里画的是**逐条原始记录**。混在一起会让那个文件变成两个主题：
 * 一半在处理量纲，一半在处理「一条记录怎么摊开」。
 *
 * 这里每一条都是真实点评产生的，展示纪律也是真实的
 * --------------------------------------
 * 1. **没有的空字段不写占位文案**。`question` 可空（学生自主提交的作业没有题面）、
 *    `relatedAntiPattern` 可空（点评没关联到反模式就不编一个）。
 * 2. **分数一律带 `/ 100`**。点评分是 0~100（`PROMPT_SCORE_MAX`），
 *    与报告上方的掌握度 0~5 不是同一量纲，不写单位就会被读成同一个东西。
 * 3. **长文本用原生 `<details>` 折叠**，不自己造展开状态 ——
 *    这份记录只增不减，造状态就要为每个条目各存一份 `useState`。
 */

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PROMPT_SCORE_MAX } from "@/lib/scores";
import type { ErrorRecord, PromptHistory } from "@/schemas";

/** 错题本。空态要说清「没有记录」而不是显示 0 条。 */
export function ErrorBookSection({ errors }: { errors: ErrorRecord[] }) {
  return (
    <section aria-label="错题本" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">错题本</h2>
        <span className="text-[11px] text-muted-foreground">
          点评判为不通过时记录，兜底输出不写
        </span>
      </div>

      {errors.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          还没有错题记录。这项只统计真实点评判为不通过的提交。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {errors.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/learn/${item.conceptId}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {item.conceptId}
                </Link>
                <Badge variant="muted">{item.taskType}</Badge>
                {item.isCorrected ? (
                  <Badge variant="levelHigh">已订正</Badge>
                ) : (
                  <Badge variant="levelMid">未订正</Badge>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {formatTime(item.createdAt)}
                </span>
              </div>

              {item.question ? (
                <p className="mt-2 text-muted-foreground">
                  题面：{item.question}
                </p>
              ) : null}

              <details className="mt-2">
                <summary className="cursor-pointer text-muted-foreground">
                  当时的提交
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[11px] whitespace-pre-wrap">
                  {item.studentAnswer}
                </pre>
              </details>

              {item.problems.length > 0 ? (
                <ul className="mt-2 list-disc pl-4">
                  {item.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}

              {item.correctExample ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground">
                    参考写法
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[11px] whitespace-pre-wrap">
                    {item.correctExample}
                  </pre>
                </details>
              ) : null}

              {item.relatedAntiPattern ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  关联反模式：{item.relatedAntiPattern}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Prompt 历史。每条是一次真实点评（非兜底）的 rubric 结果。 */
export function PromptHistorySection({
  history,
}: {
  history: PromptHistory[];
}) {
  return (
    <section aria-label="Prompt 历史" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">Prompt 历史</h2>
        <span className="text-[11px] text-muted-foreground">
          每次真实点评一条，评分满分 {PROMPT_SCORE_MAX}
        </span>
      </div>

      {history.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          还没有 Prompt 提交记录。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {history.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/learn/${item.moduleId}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {item.moduleId}
                </Link>
                <Badge variant="muted">{item.taskType}</Badge>
                <Badge variant={item.isPassed ? "levelHigh" : "levelMid"}>
                  {item.isPassed ? "通过" : "未通过"}
                </Badge>
                <span className="tabular-nums">
                  {item.score}
                  <span className="text-muted-foreground">
                    {" "}
                    / {PROMPT_SCORE_MAX}
                  </span>
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  第 {item.attemptNumber} 次 · {formatTime(item.createdAt)}
                </span>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-muted-foreground">
                  提交的 Prompt
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[11px] whitespace-pre-wrap">
                  {item.content}
                </pre>
              </details>

              {item.dimensions.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {item.dimensions.map((dimension) => (
                    <li key={dimension.name} className="flex gap-2">
                      <span className="w-24 shrink-0">{dimension.name}</span>
                      <span className="tabular-nums">
                        {dimension.score}
                        <span className="text-muted-foreground">
                          {" "}
                          / {PROMPT_SCORE_MAX}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {dimension.comment}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {item.issues.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {item.issues.map((issue) => (
                    <li key={`${issue.type}-${issue.detail}`}>
                      <Badge
                        variant={
                          issue.type === "严重错误" ? "levelLow" : "muted"
                        }
                      >
                        {issue.type}
                      </Badge>
                      <span className="ml-2">{issue.detail}</span>
                      <span className="ml-1 text-muted-foreground">
                        （-{issue.deduction}）
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {item.suggestions.length > 0 ? (
                <ul className="mt-2 list-disc pl-4 text-muted-foreground">
                  {item.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * `created_at` 的显示格式。
 *
 * 数据层写的是 `helpers.now()` 的 `toISOString()` 产物 —— 带 `Z` 的完整
 * ISO-8601 UTC 字符串。解析成 `Date` 再用本地时区取年月日时分：库里的
 * 时刻没有歧义，学生看到的就是自己手表上的时间。
 *
 * 之前按字面截取，显示的是 UTC 墙上时间 —— 东八区学生看到的时间比
 * 自己手表晚 8 小时（提交于 13:40，报告却写 05:40），学生没法把它和
 * 自己的记忆对上。
 *
 * 本组件由客户端渲染（身份在浏览器，取数在 `ReportView`），格式化只
 * 发生在浏览器里，不存在服务端/客户端时区不一致的水合差异。
 */
function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number): string => String(part).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
