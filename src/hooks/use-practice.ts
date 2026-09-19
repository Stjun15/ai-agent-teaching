"use client";

/**
 * 变式练习的流程状态机（2026-09-19 从面板拆出）
 *
 * 为什么抽成 hook
 * --------------
 * 「取题 → 作答 → 评分」这条流程的**行为**（开会话、调两端点、兜底处理、
 * 逐题顺序评分）与**长相**（题目卡、按钮、提示文案）是两件事。抽开后：
 * 面板是纯视图，行为改动不碰 JSX，样式改动不碰请求逻辑；守卫测试也能
 * 单独钉住行为侧的纪律（先开会话再评分、答案剥离、兜底诚实）。
 *
 * 两个刻意的设计
 * ------------
 * 1. **顺序逐题评分**，不并发：主观题走真实模型，三路并发只会互相抢
 *    限流额度，还让学生看到「第三题先出分」的乱序。
 * 2. **会话缓存在本 hook 实例内**（useRef）：每次提交都开会话会把
 *    sessions 表刷成垃圾（与点评接线层同一裁定）。
 */
import { useCallback, useRef, useState } from "react";

import type {
  DisplayQuestion,
  GradeResult,
  RawQuestion,
} from "@/components/learn/practice-question-card";
import { useElapsed } from "@/hooks/use-elapsed";
import { ApiError, apiPost } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";

export type PracticePhase =
  "idle" | "generating" | "answering" | "grading" | "graded";

export function usePractice(moduleId: string) {
  const [phase, setPhase] = useState<PracticePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DisplayQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, GradeResult>>({});
  const [anyFallback, setAnyFallback] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const busy = phase === "generating" || phase === "grading";
  const elapsed = useElapsed(busy);

  /** 首次作答前为本模块开一个真实会话（answer-grade 校验归属）。 */
  const ensureSession = async (studentId: string): Promise<string> => {
    if (sessionIdRef.current !== null) return sessionIdRef.current;
    const created = await apiPost<{ sessionId: string }>("/api/session", {
      studentId,
      moduleId,
    });
    sessionIdRef.current = created.sessionId;
    return created.sessionId;
  };

  const generate = useCallback(async (): Promise<void> => {
    setPhase("generating");
    setError(null);
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
      await ensureSession(studentId);
      const result = await apiPost<{
        questions: RawQuestion[];
        usedFallback: boolean;
      }>("/api/agent/generate-question", {
        studentId,
        moduleId,
        count: 3,
      });
      if (result.usedFallback) {
        // 出题兜底意味着题目是编的（没有可判分的正确答案），直接如实告知
        // 而不是展示一份假题。
        setError("这次没能连上出题模型，稍等片刻再点一次「生成练习题」。");
        setPhase("idle");
        return;
      }
      // 归一化：剥掉 correct_answer / explanation（答案不进展示形状）。
      setQuestions(
        result.questions.map((raw) => ({
          id: raw.id,
          type: raw.type,
          difficulty: raw.difficulty,
          scenario: raw.scenario,
          question: raw.question,
          options: raw.options ?? [],
        })),
      );
      setAnswers({});
      setGrades({});
      setAnyFallback(false);
      setPhase("answering");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "网络异常，请稍后重试。",
      );
      setPhase("idle");
    }
  }, [moduleId]);

  const submit = useCallback(async (): Promise<void> => {
    if (phase !== "answering" || sessionIdRef.current === null) return;
    const studentId = currentStudentId();
    if (studentId === "") return;
    const unanswered = questions.filter(
      (question) => (answers[question.id] ?? "").trim() === "",
    );
    if (unanswered.length > 0) {
      setError(`还有 ${unanswered.length} 道题没作答。`);
      return;
    }

    setPhase("grading");
    setError(null);
    const nextGrades: Record<string, GradeResult> = {};
    let fallback = false;
    try {
      for (const question of questions) {
        const grade = await apiPost<GradeResult>("/api/agent/answer-grade", {
          studentId,
          sessionId: sessionIdRef.current,
          questionId: question.id,
          studentAnswer: (answers[question.id] ?? "").trim(),
          moduleId,
          conceptId: moduleId,
        });
        nextGrades[question.id] = grade;
        if (grade.usedFallback) fallback = true;
      }
      setGrades(nextGrades);
      setAnyFallback(fallback);
      setPhase("graded");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "网络异常，请稍后重试。",
      );
      setPhase("answering");
    }
  }, [answers, moduleId, phase, questions]);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  return {
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
  };
}
