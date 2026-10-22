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
 *
 * 错题本的数据获取方式（2026-10-15 改造）
 * ---------------------------------
 * 此前 `report-view.tsx` 在页面级一次拉取全量错题（limit=20），
 * 传进本组件做纯展示。模块筛选与分页上线后改为组件自取：
 * 错题本自己管理 `moduleId`/`page` 状态，按需发 `GET /api/student/errors`，
 * 不再依赖父组件的数据注入。
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, apiGet, apiPut } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { PROMPT_SCORE_MAX } from "@/lib/scores";
import type { ErrorRecord, PromptHistory, StudentErrorsResponse, StudentPromptsResponse } from "@/schemas";

/** 每页条数。 */
const PAGE_SIZE = 10;

/** 每条错题的订正状态。 */
type CorrectionState = {
  answer: string;
  submitting: boolean;
  done: boolean;
  error: string | null;
};

/** 错题本。数据自取，内部管理模块筛选与分页状态。 */
export function ErrorBookSection() {
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{
    errors: ErrorRecord[];
    total: number;
    moduleIds: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signalRef = useRef<AbortController | null>(null);

  const fetchErrors = useCallback(
    async (modId: string | null, pg: number) => {
      signalRef.current?.abort();
      const controller = new AbortController();
      signalRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(pg * PAGE_SIZE));
        if (modId) params.set("moduleId", modId);

        const res = await apiGet<StudentErrorsResponse>(
          `/api/student/errors?${params.toString()}`,
          controller.signal,
        );
        setData(res);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof ApiError ? err.message : "取错题失败，请稍后重试。",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (currentStudentId() === "") {
      setError("还没有学生身份，刷新页面后再试。");
      setLoading(false);
      return;
    }
    void fetchErrors(moduleId, page);
    return () => signalRef.current?.abort();
  }, [moduleId, page, fetchErrors]);

  const handleModuleChange = useCallback(
    (value: string) => {
      const modId = value === "__all__" ? null : value;
      setModuleId(modId);
      setPage(0);
    },
    [],
  );

  const [corrections, setCorrections] = useState<
    Record<string, CorrectionState>
  >({});

  const handleCorrect = useCallback(async (errorId: string, originalAnswer: string) => {
    const entry = corrections[errorId];
    if (!entry || !entry.answer.trim()) return;

    const trimmed = entry.answer.trim();
    if (trimmed === originalAnswer.trim()) {
      setCorrections((prev) => ({
        ...prev,
        [errorId]: { ...entry, error: "订正答案不能和原来的错误答案一模一样，请重新思考后写出正确答案。" },
      }));
      return;
    }

    setCorrections((prev) => ({
      ...prev,
      [errorId]: { ...entry, submitting: true, error: null },
    }));

    try {
      await apiPut("/api/student/errors", {
        id: errorId,
        correctedAnswer: trimmed,
      });
      setCorrections((prev) => ({
        ...prev,
        [errorId]: { ...prev[errorId], submitting: false, done: true },
      }));
      void fetchErrors(moduleId, page);
    } catch (err) {
      setCorrections((prev) => ({
        ...prev,
        [errorId]: {
          ...prev[errorId],
          submitting: false,
          error:
            err instanceof ApiError
              ? err.message
              : "提交失败，请重试。",
        },
      }));
    }
  }, [corrections, moduleId, page, fetchErrors]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section aria-label="错题本" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">错题本</h2>
        <span className="text-[11px] text-muted-foreground">
          点评判为不通过时记录，兜底输出不写
        </span>
      </div>

      {/* 模块筛选下拉 */}
      {data !== null && data.moduleIds.length > 0 ? (
        <div className="flex items-center gap-2">
          <label
            htmlFor="error-book-module"
            className="text-xs text-muted-foreground shrink-0"
          >
            模块
          </label>
          <select
            id="error-book-module"
            value={moduleId ?? "__all__"}
            onChange={(e) => handleModuleChange(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="__all__">全部模块</option>
            {data.moduleIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          {data.total > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              共 {data.total} 条
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 状态：加载中 / 出错 / 空态 / 有数据 */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          正在加载错题本…
        </div>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-relaxed">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => fetchErrors(moduleId, page)}
          >
            <RefreshCw className="size-4" />
            重试
          </Button>
        </div>
      ) : data === null || data.errors.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {moduleId !== null
            ? "该模块还没有错题记录。"
            : "还没有错题记录。这项只统计真实点评判为不通过的提交。"}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.errors.map((item) => (
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

                {/* 订正区：未订正的错题才显示 */}
                {!item.isCorrected ? (
                  <CorrectForm
                    errorId={item.id}
                    originalAnswer={item.studentAnswer}
                    state={corrections[item.id] ?? { answer: "", submitting: false, done: false, error: null }}
                    onAnswerChange={(v) =>
                      setCorrections((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], answer: v, submitting: false, done: false, error: null },
                      }))
                    }
                    onSubmit={handleCorrect}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          {/* 分页控件 */}
          {totalPages > 1 ? (
            <nav
              aria-label="错题本分页"
              className="flex items-center justify-center gap-2 pt-1"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                aria-label="上一页"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                aria-label="下一页"
              >
                <ChevronRight className="size-4" />
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Prompt 历史。数据自取，内部管理模块筛选与分页状态。 */
export function PromptHistorySection() {
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{
    history: PromptHistory[];
    total: number;
    moduleIds: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signalRef = useRef<AbortController | null>(null);

  const fetchPrompts = useCallback(
    async (modId: string | null, pg: number) => {
      signalRef.current?.abort();
      const controller = new AbortController();
      signalRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(pg * PAGE_SIZE));
        if (modId) params.set("moduleId", modId);

        const res = await apiGet<StudentPromptsResponse>(
          `/api/student/prompts?${params.toString()}`,
          controller.signal,
        );
        setData(res);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof ApiError ? err.message : "取 Prompt 历史失败，请稍后重试。",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (currentStudentId() === "") {
      setError("还没有学生身份，刷新页面后再试。");
      setLoading(false);
      return;
    }
    void fetchPrompts(moduleId, page);
    return () => signalRef.current?.abort();
  }, [moduleId, page, fetchPrompts]);

  const handleModuleChange = useCallback(
    (value: string) => {
      const modId = value === "__all__" ? null : value;
      setModuleId(modId);
      setPage(0);
    },
    [],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section aria-label="Prompt 历史" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">Prompt 历史</h2>
        <span className="text-[11px] text-muted-foreground">
          每次真实点评一条，评分满分 {PROMPT_SCORE_MAX}
        </span>
      </div>

      {/* 模块筛选下拉 */}
      {data !== null && data.moduleIds.length > 0 ? (
        <div className="flex items-center gap-2">
          <label
            htmlFor="prompt-history-module"
            className="text-xs text-muted-foreground shrink-0"
          >
            模块
          </label>
          <select
            id="prompt-history-module"
            value={moduleId ?? "__all__"}
            onChange={(e) => handleModuleChange(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="__all__">全部模块</option>
            {data.moduleIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          {data.total > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              共 {data.total} 条
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 状态：加载中 / 出错 / 空态 / 有数据 */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          正在加载 Prompt 历史…
        </div>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-relaxed">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => fetchPrompts(moduleId, page)}
          >
            <RefreshCw className="size-4" />
            重试
          </Button>
        </div>
      ) : data === null || data.history.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {moduleId !== null
            ? "该模块还没有 Prompt 提交记录。"
            : "还没有 Prompt 提交记录。"}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.history.map((item) => (
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

          {/* 分页控件 */}
          {totalPages > 1 ? (
            <nav
              aria-label="Prompt 历史分页"
              className="flex items-center justify-center gap-2 pt-1"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                aria-label="上一页"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                aria-label="下一页"
              >
                <ChevronRight className="size-4" />
              </Button>
            </nav>
          ) : null}
        </>
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

function CorrectForm({
  errorId,
  originalAnswer,
  state,
  onAnswerChange,
  onSubmit,
}: {
  errorId: string;
  originalAnswer: string;
  state: CorrectionState;
  onAnswerChange: (value: string) => void;
  onSubmit: (errorId: string, originalAnswer: string) => void;
}) {
  if (state.done) {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs text-green-600">
        <Check className="size-3.5" />
        已提交订正
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2">
      <label
        htmlFor={`correction-${errorId}`}
        className="text-[11px] text-muted-foreground"
      >
        请重新写出正确答案：
      </label>
      <textarea
        id={`correction-${errorId}`}
        rows={3}
        className="w-full resize-y rounded-md border bg-background px-2 py-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="在这里订正你的答案…"
        value={state.answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        disabled={state.submitting}
      />
      {state.error ? (
        <p className="text-[11px] text-destructive">{state.error}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={state.submitting || !state.answer.trim()}
        onClick={() => onSubmit(errorId, originalAnswer)}
        className="w-fit"
      >
        {state.submitting ? (
          <>
            <Loader2 className="mr-1 size-3 animate-spin" />
            提交中…
          </>
        ) : (
          <>
            <Check className="mr-1 size-3" />
            提交订正
          </>
        )}
      </Button>
    </div>
  );
}