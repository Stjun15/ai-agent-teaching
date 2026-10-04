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
import { useRouter } from "next/navigation";
import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react";

import { CodeEditor } from "@/components/code/code-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ApiError, apiPost } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { useElapsed } from "@/hooks/use-elapsed";
import { useCodeStore } from "@/stores";
import type { ValidationResult } from "@/lib/db";

/** `/api/agent/validate` 的响应（route.ts 手写 JSON，形状以此为准）。 */
interface ValidateResponse {
  totalScore: number;
  level: ValidationResult["level"];
  isCorrect: boolean;
  dimensions: ValidationResult["dimensions"];
  /** ⚠️ 路由原样透传点评输出，字段是 snake_case（related_dimension 等）。 */
  issues: Array<{
    type: ValidationResult["issues"][number]["type"];
    detail: string;
    deduction: number;
    related_dimension: string;
    related_anti_pattern: string | null;
  }>;
  /**
   * ⚠️ 不是 `string[]`：点评 Agent 的建议是对象（priority/action/example），
   * validate 路由**原样透传**（`db/types.ts` 里 `suggestions: string[]` 的
   * 声明与真实载荷不符 —— 2026-09-19 实测 React #31 崩溃才发现）。
   * 在这里归一化成展示字符串，进 store 后才是 `string[]`。
   */
  suggestions: Array<
    string | { priority: "高" | "中" | "低"; action: string; example: string }
  >;
  nextAction: "pass" | "retry" | "lower_difficulty";
  success: boolean;
  usedFallback: boolean;
}

/** 建议对象 → 一行可读文本：`【高】做法（例：…）`。 */
function normalizeSuggestion(
  item: ValidateResponse["suggestions"][number],
): string {
  if (typeof item === "string") return item;
  const parts = [item.action];
  if (item.example !== "") parts.push(`例：${item.example}`);
  return `【${item.priority}】${parts.join(" —— ")}`;
}

/** 问题对象 snake_case → 库行形状（面板只认一种口径）。 */
function normalizeIssue(
  item: ValidateResponse["issues"][number],
): ValidationResult["issues"][number] {
  return {
    type: item.type,
    detail: item.detail,
    deduction: item.deduction,
    relatedDimension: item.related_dimension,
    relatedAntiPattern: item.related_anti_pattern,
  };
}

export function ValidateSubmit({
  moduleId,
  redirectOnComplete = true,
}: {
  moduleId: string;
  /**
   * 提交成功后是否跳转该模块的 validate 步。通用七步的 imitate/validate
   * 卡里用默认跳转；platform-replica 结算阶段内嵌本组件时关掉 —— 复刻
   * 没有 validate 步（跳过去是 404），检验单就地展示。
   */
  redirectOnComplete?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // 兜底点评标记：store 的 ValidationResult 没有这个字段（那是库行的形状），
  // 放在组件 state 里，随结果一起交给面板做「这次分数不算数」的提示。
  const [usedFallback, setUsedFallback] = useState(false);
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
      setUsedFallback(result.usedFallback);
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
        issues: result.issues.map(normalizeIssue),
        suggestions: result.suggestions.map(normalizeSuggestion),
        createdAt: new Date().toISOString(),
      });
      if (redirectOnComplete) {
        router.push(`/learn/${moduleId}/validate`);
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "网络异常，请重试。";
      useCodeStore.getState().failValidation(message);
    } finally {
      setSubmitting(false);
    }
  }, [moduleId, submitting, router, redirectOnComplete]);

  return (
    <div className="flex flex-col gap-4">
      <CodeEditor onSubmit={handleSubmit} submitting={submitting} />
      <ValidationReport usedFallback={usedFallback} moduleId={moduleId} />
    </div>
  );
}

/** 批改中提示：带等待秒数（真实点评 20~40 秒，秒数走起来学生才安心）。 */
function ValidatingNotice() {
  const elapsed = useElapsed(true);
  return (
    <p
      className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      点评 Agent 正在按评分维度逐项批改，已等 {elapsed} 秒（通常 20~40 秒）…
    </p>
  );
}

/** 点评结果面板：状态（批改中 / 失败 / 结果）三分支。 */
function ValidationReport({
  usedFallback,
  moduleId,
}: {
  usedFallback: boolean;
  moduleId: string;
}) {
  const router = useRouter();
  const status = useCodeStore((state) => state.validationStatus);
  const result = useCodeStore((state) => state.validationResult);
  const error = useCodeStore((state) => state.validationError);

  if (status === "validating") {
    return <ValidatingNotice />;
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
      {usedFallback ? (
        <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          这次没能连上点评模型，以下是系统兜底的占位结果——分数仅供参考，别当真。
        </p>
      ) : null}
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

      {result.totalScore > 90 ? (
        <Button
          onClick={() => router.push(`/learn/${moduleId}/visualize`)}
          className="self-start"
        >
          演示代码执行过程
        </Button>
      ) : null}
    </div>
  );
}
