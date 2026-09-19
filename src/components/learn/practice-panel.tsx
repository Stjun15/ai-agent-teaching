"use client";

/**
 * 变式练习面板（2026-09-19 接线）
 *
 * 为什么要有这个组件
 * ----------------
 * 零基础走查发现：七步里的「变式练习」点进去**没有任何界面内容** —— 中栏
 * 还是「模仿编辑器 + 可视化」老三样，学生不知道这一步该干什么。而出题与
 * 评分两个端点（`/api/agent/generate-question`、`/api/agent/answer-grade`）
 * 早在 Phase 5/7 就建好并落库了，缺的只是消费方。本组件把
 * 「取题 → 作答 → 评分 → 看解析」接成一条学生能走的路。
 *
 * 本组件是**纯视图**：流程状态机在 `use-practice.ts`，单题渲染在
 * `practice-question-card.tsx`。数据落库（question_results / 错题本）
 * 只发生在 answer-grade 路由内，前端不碰数据层（分层约定）。
 *
 * 两条展示纪律
 * -----------
 * 1. **兜底诚实**：出题兜底 = 题目是编的，直接退回不展示；评分兜底 =
 *    分数不算数，面板明说（与点评面板同一纪律）。
 * 2. **等待有秒数**：出题与主观题评分都走真实模型（20~60 秒），
 *    沿用 useElapsed 计时。
 */

import { AlertTriangle, Loader2 } from "lucide-react";

import { PracticeQuestionCard } from "@/components/learn/practice-question-card";
import { Button } from "@/components/ui/button";
import { usePractice } from "@/hooks/use-practice";

export function PracticePanel({ moduleId }: { moduleId: string }) {
  const {
    phase,
    error,
    questions,
    answers,
    grades,
    anyFallback,
    busy,
    elapsed,
    generate,
    submit,
    setAnswer,
  } = usePractice(moduleId);

  return (
    <div className="flex flex-col gap-4">
      {phase === "idle" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            换一个条件再问一次，检验这一讲是不是真的掌握了。选择题和填空题秒判，
            简答题由点评模型批改。
          </p>
          <Button onClick={() => void generate()} className="self-start">
            生成练习题
          </Button>
        </div>
      ) : null}

      {busy ? (
        <p
          className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {phase === "generating"
            ? "出题 Agent 正在按你的掌握度出题，已等"
            : "正在逐题评分，已等"}{" "}
          {elapsed} 秒（通常 20~60 秒）…
        </p>
      ) : null}

      {error ? (
        <div
          className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm"
          role="alert"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            {error}
          </span>
        </div>
      ) : null}

      {questions.length > 0 ? (
        <ol className="flex flex-col gap-5">
          {questions.map((question, index) => (
            <PracticeQuestionCard
              key={question.id}
              index={index + 1}
              question={question}
              answer={answers[question.id] ?? ""}
              graded={phase === "graded"}
              grade={grades[question.id]}
              locked={phase === "grading" || phase === "graded"}
              onAnswer={(value) => setAnswer(question.id, value)}
            />
          ))}
        </ol>
      ) : null}

      {phase === "answering" ? (
        <Button onClick={() => void submit()} className="self-start">
          提交答案
        </Button>
      ) : null}

      {phase === "graded" ? (
        <div className="flex flex-col gap-3">
          {anyFallback ? (
            <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              有题目这次没能连上评分模型，那几题的结论是系统占位——不算数，可以重新提交。
            </p>
          ) : null}
          <Button onClick={() => void generate()} className="self-start">
            再练一组
          </Button>
        </div>
      ) : null}
    </div>
  );
}
