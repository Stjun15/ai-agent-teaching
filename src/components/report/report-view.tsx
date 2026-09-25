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
import type {
  ErrorRecord,
  PromptHistory,
  ReportResponse,
  StudentErrorsResponse,
  StudentPromptsResponse,
} from "@/schemas";

/**
 * 明细一次取多少条。
 *
 * 取小一点不是省流量：报告页的明细是「最近做了什么」，
 * 一屏放 50 条等于没有明细，只是把列表变长了。
 */
const DETAIL_LIMIT = 20;

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
 *
 * 三个请求为什么分开成败
 * ------------------
 * 汇总（`/api/report`）失败 = 这一页没法看，整页进 error。
 * 明细（`errors` / `prompts`）失败 = 只少两块，报告主体照常显示 ——
 * 把「明细没取到」升级成整页失败，等于让一个次要数据源决定主内容能不能看。
 * 所以明细用 `settle` 包住：失败记成 `null`（取不到），空数组是「真的没有」，
 * 两者在界面上是两句不同的话。
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
    return Promise.all([
      apiGet<ReportResponse>("/api/report", signal),
      settle<StudentErrorsResponse>(
        `/api/student/errors?limit=${DETAIL_LIMIT}`,
        signal,
      ),
      settle<StudentPromptsResponse>(
        `/api/student/prompts?limit=${DETAIL_LIMIT}`,
        signal,
      ),
    ]).then(
      ([report, errors, prompts]) =>
        setState({
          status: "ready",
          report,
          details: {
            errors: errors?.errors ?? null,
            history: prompts?.history ?? null,
          },
        }),
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

  const { report, details } = state;
  const hasAnything =
    report.masteryTrend.length > 0 ||
    report.overview.totalQuestions > 0 ||
    report.weaknesses.length > 0 ||
    (details.errors?.length ?? 0) > 0 ||
    (details.history?.length ?? 0) > 0;

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
        {details.errors ? (
          <ErrorBookSection errors={details.errors} />
        ) : (
          <DegradedNotice label="错题本" onRetry={retry} />
        )}
        {details.history ? (
          <PromptHistorySection history={details.history} />
        ) : (
          <DegradedNotice label="Prompt 历史" onRetry={retry} />
        )}
      </div>
    </div>
  );
}

/**
 * 明细取不到时的说明条。
 *
 * 只给一句状态和一个重试按钮，不显示任何数字 —— 取不到就是取不到，
 * 用 0 或占位文案顶上去会比留白更像真的。
 */
function DegradedNotice({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{label}</h2>
      <p className="rounded-lg border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {label}这次没取到，不影响上面的报告内容。
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={onRetry}
      >
        <RefreshCw className="size-4" />
        重新加载明细
      </Button>
    </section>
  );
}

/** 页面状态。用可辨识联合而不是三个独立 `useState`：三者互斥，分开写会出现
 * 「既 loading 又有 error」这种表达得出来却不该存在的组合。 */
type ViewState =
  | { status: "loading" }
  | {
      status: "ready";
      report: ReportResponse;
      /** `null` = 这次没取到（与空数组「真的没有」是两回事）。 */
      details: {
        errors: ErrorRecord[] | null;
        history: PromptHistory[] | null;
      };
    }
  | { status: "error"; error: ApiError };

/**
 * 明细请求的包装：失败返回 `null`，但**主动 abort 要继续往外抛** ——
 * 否则离开页面时的一次 abort 会被记成「明细取不到」，
 * 用户回到这一页就看见一条并不存在的失败。
 */
async function settle<T>(path: string, signal: AbortSignal): Promise<T | null> {
  try {
    return await apiGet<T>(path, signal);
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    return null;
  }
}