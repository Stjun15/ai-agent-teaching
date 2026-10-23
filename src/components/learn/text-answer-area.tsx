"use client";

/**
 * 文本问答区 —— Q&A 类模块的动手环节输入。
 *
 * ts-basics、agent-loop、ai-safety 三个模块的「现在轮到你」是纯文本任务。
 * 状态托管在 `useQaStore`（全局），提交后立即跳 validate 页，
 * validate 页从 store 读结果，不等 LLM 返回。
 */

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError, apiPost } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { useQaStore } from "@/stores/qa";
import { useElapsed } from "@/hooks/use-elapsed";

export function TextAnswerArea({
  moduleId,
}: {
  moduleId: string;
}) {
  const answer = useQaStore((s) => s.submittedAnswer);
  const setAnswer = useCallback(
    (value: string) => {
      useQaStore.setState({ submittedAnswer: value });
    },
    [],
  );
  const validationStatus = useQaStore((s) => s.validationStatus);
  const result = useQaStore((s) => s.result);
  const error = useQaStore((s) => s.error);
  const beginValidation = useQaStore((s) => s.beginValidation);
  const resolveValidation = useQaStore((s) => s.resolveValidation);
  const failValidation = useQaStore((s) => s.failValidation);
  const sessionIdRef = useRef<string | null>(null);
  const router = useRouter();

  const handleSubmitAndRedirect = useCallback(async () => {
    if (validationStatus === "validating" || answer.trim() === "") return;

    beginValidation(answer);

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
      const result = await apiPost<{
        totalScore: number;
        level: string;
        isCorrect: boolean;
        usedFallback: boolean;
        issues: Array<{ type: string; detail: string; deduction: number }>;
      }>("/api/agent/validate", {
        studentId,
        sessionId: sessionIdRef.current,
        moduleId,
        taskType: "qa",
        content: answer,
      });
      const feedback = result.issues
        .map((i) => `[${i.type}] ${i.detail}`)
        .join("\n\n");
      resolveValidation({
        totalScore: result.totalScore,
        level: result.level,
        feedback: feedback || "没有发现明显问题。",
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "网络异常，请重试。";
      failValidation(message);
    }
  }, [answer, moduleId, validationStatus, beginValidation, resolveValidation, failValidation]);

  /** 包装一层：点击时先写 store 再跳到 validate 页，API 后台跑 */
  const handleSubmit = useCallback(() => {
    if (validationStatus === "validating" || answer.trim() === "") return;
    beginValidation(answer);
    router.push(`/learn/${moduleId}/validate`);
    // API 在后台异步跑，validate 页从 store 读结果
    handleSubmitAndRedirect();
  }, [answer, moduleId, validationStatus, router, beginValidation, handleSubmitAndRedirect]);

  const elapsed = useElapsed(validationStatus === "validating");

  return (
    <div className="flex flex-col gap-4">
      <textarea
        spellCheck={false}
        placeholder="在这里写下你的回答…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={8}
        disabled={validationStatus === "validating"}
        className="min-h-[160px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={validationStatus === "validating" || answer.trim() === ""}
          size="sm"
        >
          {validationStatus === "validating" ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
              点评中…
            </>
          ) : (
            "提交回答"
          )}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          回答不评分？前面的学习内容有标准答案可对照。—— 也可以点最右边的
          &ldquo;问老师&rdquo;
        </span>
      </div>

      {validationStatus === "validating" ? (
        <p
          className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          点评 Agent 正在阅读你的回答，已等 {elapsed} 秒（通常 20~40 秒）…
        </p>
      ) : null}

      {validationStatus === "error" && error !== null ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {validationStatus === "done" && result !== null ? (
        <div className="rounded-lg border bg-background px-4 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold tabular-nums">
              {result.totalScore}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / 100
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{result.level}</span>
            {result.totalScore >= 75 ? (
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
          {result.feedback !== "" ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {result.feedback}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}