"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import {
  ErrorBookSection,
  PromptHistorySection,
} from "@/components/report/record-details";
import { ReportSections } from "@/components/report/report-sections";
import { ApiError, apiGet } from "@/lib/client-api";
import { isAbortError } from "@/lib/sse";
import type { ReportResponse } from "@/schemas";

/** 学习报告的取数与状态机。
 *
 * 错题本和 Prompt 历史已改为组件自取（含模块筛选与分页），
 * 这里只负责报告主体的 `/api/report` 请求。 */

export function ReportView() {
  const [state, setState] = React.useState<ViewState>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  const run = React.useCallback(
    (signal: AbortSignal): Promise<void> =>
      apiGet<ReportResponse>("/api/report", signal).then(
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
      ),
    [],
  );

  const retry = React.useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal);
    return () => controller.abort();
  }, [run, attempt]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-8">
        <SkeletonGrid count={4} />
        <SkeletonGrid count={2} className="sm:grid-cols-2" />
      </div>
    );
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
            onClick={retry}
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
    report.weaknesses.length > 0 ||
    report.adjustments.length > 0;

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

  return (
    <div className="flex flex-col gap-8">
      <ReportSections report={report} />

      <div className="flex flex-col gap-8 border-t pt-6">
        <ErrorBookSection />
        <PromptHistorySection />
      </div>
    </div>
  );
}

/** 页面状态。用可辨识联合而不是三个独立 `useState`：三者互斥。 */
type ViewState =
  | { status: "loading" }
  | { status: "ready"; report: ReportResponse }
  | { status: "error"; error: ApiError };