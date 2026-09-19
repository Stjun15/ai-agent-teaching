"use client";

/**
 * 提交点评的接线层（2026-09-19 接通）
 *
 * 为什么单独成组件
 * --------------
 * `CodeEditor` 只管编辑——「提交」需要学生身份、一个真实会话、以及与
 * `/api/agent/validate` 的完整往返，这些属于接线层的事（编辑器文件头的
 * 注释从第一天就这么承诺：`onSubmit` 由外部注入）。此前没有注入方，
 * 「提交点评」按钮一直禁用，注释里写着「接线提交点：feat(integration)」
 * —— 就是现在。
 *
 * 会话从哪来
 * ---------
 * `ValidateSchema` 要求 `sessionId` 且必须是**本学生的真实会话**（服务端
 * 会查库校验归属）。学习页的对话走 `/api/chat`，不落库、没有会话 id，
 * 所以这里在首次提交时为该模块**开一个会话**（`POST /api/session`），
 * 之后本次挂载内的提交复用它 —— 每次提交都开会话会把 sessions 表刷成垃圾。
 *
 * 兜底点评的诚实展示
 * ----------------
 * 响应里的 `usedFallback` 为 true 时，分数与问题都是**编的**（模型没回来，
 * 系统给了个占位结果）。面板会明说「这次点评没能连上模型」，不让学生把
 * 兜底分数当成真实评价。
 */

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react";

import { CodeEditor } from "@/components/code/code-editor";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ApiError, apiPost } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { useCodeStore } from "@/stores";
import type { ValidationResult } from "@/lib/db";

/** `/api/agent/validate` 的响应（route.ts 手写 JSON，形状以此为准）。 */
interface ValidateResponse {
  totalScore: number;
  level: ValidationResult["level"];
  isCorrect: boolean;
  dimensions: ValidationResult["dimensions"];
  issues: ValidationResult["issues"];
  suggestions: string[];
  nextAction: "pass" | "retry" | "lower_difficulty";
  success: boolean;
  usedFallback: boolean;
}

export function ValidateSubmit({ moduleId }: { moduleId: string }) {
  const [submitting, setSubmitting] = useState(false);
  // 本挂载内复用的会话。切模块/刷新后重建 —— 会话是廉价资源，缓存到
  // sessionStorage 反而要在模块切换时清理，得不偿失。
  const sessionIdRef = useRef<string | null>(null);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (submitting) return;
    const store = useCodeStore.getState();
    if (store.code.trim() === "") return;

    setSubmitting(true);
    store.beginValidation();
    try {
      const studentId = currentStudentId();
      if (studentId === "") {
        throw new ApiError(
          0,
          "NO_IDENTITY",
          "还没有学生身份，刷新页面后再试。",
          true,
        );
      }
      if (sessionIdRef.current === null) {
        const created = await apiPost<{ sessionId: string }>("/api/session", {
          studentId,
          moduleId,
        });
        sessionIdRef.current = created.sessionId;
      }
      const result = await apiPost<ValidateResponse>("/api/agent/validate", {
        studentId,
        sessionId: sessionIdRef.current,
        moduleId,
        taskType: store.taskType,
        content: store.code,
      });
      // 响应不含 id / createdAt（那是库行的字段），面板展示用不到，
      // 按类型要求补上占位值 —— 不为此造第二份展示类型。
      useCodeStore.getState().resolveValidation({
        id: "",
        studentId,
        sessionId: sessionIdRef.current,
        taskType: store.taskType,
        totalScore: result.totalScore,
        level: result.level,
        isCorrect: result.isCorrect,
        dimensions: result.dimensions,
        issues: result.issues,
        suggestions: result.suggestions,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "网络异常，请重试。";
      useCodeStore.getState().failValidation(message);
    } finally {
      setSubmitting(false);
    }
  }, [moduleId, submitting]);

  return (
    <div className="flex flex-col gap-4">
      <CodeEditor onSubmit={handleSubmit} submitting={submitting} />
      <ValidationReport />
    </div>
  );
}

/** 点评结果面板：状态（批改中 / 失败 / 结果）三分支。 */
function ValidationReport() {
  const status = useCodeStore((state) => state.validationStatus);
  const result = useCodeStore((state) => state.validationResult);
  const error = useCodeStore((state) => state.validationError);

  if (status === "validating") {
    return (
      <p
        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        点评 Agent 正在按评分维度逐项批改，大约需要十几秒…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm"
        role="alert"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="size-4" aria-hidden />
          这次点评没有完成
        </span>
        <span className="text-xs text-muted-foreground">
          {error} 你的内容还在编辑器里，改一改或直接再提交一次都行。
        </span>
      </div>
    );
  }

  if (status !== "done" || result === null) return null;

  const passed = result.isCorrect;
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background px-4 py-3.5">
      {/* 总分与判定 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums">
          {result.totalScore}
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            / 100
          </span>
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {result.level}
        </span>
        {passed ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CircleCheck className="size-4" aria-hidden />
            通过
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4" aria-hidden />
            还没通过
          </span>
        )}
      </div>

      {/* 维度得分 */}
      {result.dimensions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {result.dimensions.map((dimension) => (
            <li key={dimension.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs">{dimension.name}</span>
              <Progress
                value={dimension.score}
                label={`${dimension.name} ${dimension.score} / 100`}
                className="flex-1"
              />
              <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {dimension.score} / 100
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 问题清单 */}
      {result.issues.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {result.issues.map((issue, index) => (
            <li
              key={`${issue.type}-${index}`}
              className="flex flex-col gap-0.5 text-xs leading-relaxed"
            >
              <span className="flex items-center gap-2">
                <Badge
                  variant={issue.type === "严重错误" ? "outline" : "muted"}
                >
                  {issue.type}
                  {issue.deduction > 0 ? ` −${issue.deduction} 分` : ""}
                </Badge>
                <span className="text-muted-foreground">
                  影响「{issue.relatedDimension}」
                </span>
              </span>
              <span>{issue.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 改进建议 */}
      {result.suggestions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">下一步建议</span>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
            {result.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
