"use client";

/**
 * 变式练习的单题卡（2026-09-19 从 PracticePanel 拆出）
 *
 * 为什么单独成文件
 * --------------
 * 不是为了行数好看（那只是顺带）：**答案不泄漏**这条纪律的载体在这里 ——
 * `DisplayQuestion` 是学生能看到的题目形状，`correct_answer` / `explanation`
 * 在归一化时就被剥掉、根本不进这个组件的类型。守卫测试
 * （practice-mastery-spec）钉死了这一点：泄漏必须是类型层面的不可能，
 * 而不是「这次恰好没渲染」。
 *
 * 拆出后它也是纯 props 组件：状态（作答内容、评分结论）全部由面板持有，
 * 本组件只消费。将来报告页要复看做过的题，可以直接复用。
 */
import { CircleCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** 出题响应里的一道题（snake_case 原样，路由透传模型输出）。 */
export interface RawQuestion {
  id: string;
  type: "选择题" | "填空题" | "简答题" | "实战题";
  concept_id: string;
  difficulty: number;
  scenario: string;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

/** 展示用的题 —— `correct_answer` / `explanation` 在归一化时被剥掉。 */
export interface DisplayQuestion {
  id: string;
  type: RawQuestion["type"];
  difficulty: number;
  scenario: string;
  question: string;
  options: string[];
}

/** 一次评分的结论（answer-grade 响应）。 */
export interface GradeResult {
  isCorrect: boolean;
  score: number;
  feedback: string;
  gradedBy: string;
  resultId: string | null;
  usedFallback: boolean;
}

export function PracticeQuestionCard({
  index,
  question,
  answer,
  graded,
  grade,
  locked,
  onAnswer,
}: {
  index: number;
  question: DisplayQuestion;
  answer: string;
  graded: boolean;
  grade: GradeResult | undefined;
  locked: boolean;
  onAnswer: (value: string) => void;
}) {
  return (
    <li className="flex flex-col gap-2.5 rounded-lg border bg-background px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{question.type}</Badge>
        <span className="text-xs text-muted-foreground">
          难度 {question.difficulty} / 5
        </span>
        {graded && grade !== undefined ? (
          grade.isCorrect ? (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="size-4" aria-hidden />
              答对 · {grade.score} 分
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
              <XCircle className="size-4" aria-hidden />
              还没对 · {grade.score} 分
            </span>
          )
        ) : null}
      </div>

      {question.scenario !== "" ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          场景：{question.scenario}
        </p>
      ) : null}
      <p className="text-sm leading-relaxed">
        {index}. {question.question}
      </p>

      {question.options.length > 0 ? (
        <div className="flex flex-col gap-1.5" role="radiogroup">
          {question.options.map((option) => {
            const selected = answer === option;
            return (
              <label
                key={option}
                className={
                  "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm leading-relaxed " +
                  (selected ? "border-ring bg-muted/40" : "")
                }
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={selected}
                  disabled={locked}
                  onChange={() => onAnswer(option)}
                  className="mt-1"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <textarea
          value={answer}
          disabled={locked}
          onChange={(event) => onAnswer(event.target.value)}
          rows={3}
          placeholder="写下你的答案…"
          className="w-full resize-y rounded-md border bg-background p-2.5 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        />
      )}

      {graded && grade !== undefined && !grade.usedFallback ? (
        <div className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">点评：</span>
            {grade.feedback}
          </span>
          <span>
            （{grade.gradedBy === "rule" ? "按答案规则判分" : "由点评模型批改"}
            ）
          </span>
        </div>
      ) : null}
    </li>
  );
}
