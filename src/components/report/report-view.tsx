"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReportSections } from "@/components/report/report-sections";
import { ApiError, apiGet } from "@/lib/client-api";
import { isAbortError } from "@/lib/sse";
import type { ReportResponse } from "@/schemas";

/**
 * 学习报告的取数与状态机。
 *
 * 本组件只做四件事：取数、区分「加载中 / 失败 / 没数据 / 有数据」、
 * 决定重试按钮给不给、以及把有数据的部分交给 `ReportSections` 渲染。
 * 四个区块的画法在 `report-sections.tsx`。
 *
 * 本页最容易错的两件事，都在这里挡住
 * --------------------------------
 * 1. **「没数据」不是「0 分」**。接口在没有任何掌握度记录时返回 0 —— 那是
 *    `reduce` 的空数组初值，不是「你考了 0 分」。判据用
 *    `masteryTrend.length === 0`（一条 mastery 行都没有）来区分，
 *    而不是看分数是不是 0。这与 `mastery-indicator.tsx` 是同一条原则。
 * 2. **不可恢复的错误不给重试按钮**。`INVALID_INPUT` 重试多少次都一样，
 *    给一个按了没用的按钮比不给更糟（`recoverable` 的含义见 `client-api.ts`）。
 *
 * 取数为什么在客户端
 * ----------------
 * 报告按学生身份聚合，而身份在浏览器里（`localStorage` / 种子身份，
 * 见 `client-identity.ts`）。服务端渲染阶段拿不到它，硬做只能先渲染一份错的数据。
 */
export function ReportView() {
  const [state, setState] = React.useState<ViewState>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  /**
   * 拉报告。**不在同步路径上 `setState`** ——
   * 在 effect 里同步 setState 会触发级联渲染（`react-hooks/set-state-in-effect`
   * 会拦，而且这条规则是有道理的）。所以初始状态直接就是 `loading`，
   * 状态只由 promise 的回调改写。
   */
  const run = React.useCallback((signal: AbortSignal): Promise<void> => {
    return apiGet<ReportResponse>("/api/report", signal).then(
      (report) => setState({ status: "ready", report }),
      (cause: unknown) => {
        if (isAbortError(cause)) return;
        setState({
          status: "error",
          error:
            cause instanceof ApiError
              ? cause
              : new ApiError(0, "NETWORK_ERROR", String(cause), true),
        });
      },
    );
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal);
    return () => controller.abort();
  }, [run, attempt]);

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">正在汇总学习数据…</p>;
  }

  if (state.status === "error") {
    const { error } = state;
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-relaxed">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <span>
            {error.message}
            <span className="ml-1 text-muted-foreground">（{error.code}）</span>
          </span>
        </p>
        {error.recoverable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            <RefreshCw className="size-4" />
            重试
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            这类错误重试不会有不同结果，请先检查学生身份是否有效。
          </p>
        )}
      </div>
    );
  }

  const { report } = state;
  const hasAnything =
    report.masteryTrend.length > 0 ||
    report.overview.totalQuestions > 0 ||
    report.weaknesses.length > 0;

  if (!hasAnything) {
    return (
      <div className="max-w-xl rounded-xl border bg-card p-6">
        <p className="text-sm font-medium">还没有可汇总的学习数据</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          这份报告的全部数字都来自真实记录（掌握度、答题、错题、Prompt 历史），
          没有数据时不会显示 0 分 —— 0 分与「还没测」是两件事。
          去学习中心完成一个模块的「校验点评」，这里就会有内容。
        </p>
        <Button asChild size="sm" className="mt-4 w-fit">
          <Link href="/learn">去学习中心</Link>
        </Button>
      </div>
    );
  }

  return <ReportSections report={report} />;
}

/** 页面状态。用可辨识联合而不是三个独立 `useState`：三者互斥，分开写会出现
 * 「既 loading 又有 error」这种表达得出来却不该存在的组合。 */
type ViewState =
  | { status: "loading" }
  | { status: "ready"; report: ReportResponse }
  | { status: "error"; error: ApiError };
