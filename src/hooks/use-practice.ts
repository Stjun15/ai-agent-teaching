"use client";

/**
 * 变式练习的流程状态机（2026-09-19 从面板拆出；2026-11-02 状态搬进 Store）
 *
 * 为什么抽成 hook
 * --------------
 * 「取题 → 作答 → 评分」这条流程的**行为**（开会话、调两端点、兜底处理、
 * 逐题顺序评分）与**长相**（题目卡、按钮、提示文案）是两件事。抽开后：
 * 面板是纯视图，行为改动不碰 JSX，样式改动不碰请求逻辑；守卫测试也能
 * 单独钉住行为侧的纪律（先开会话再评分、答案剥离、兜底诚实）。
 *
 * 为什么状态不在 `useState` 里（2026-11-02）
 * --------------------------------------
 * 七步是独立路由，换一步就卸载本组件 —— `useState` 里的题目与作答随之
 * 消失，切回「变式练习」等于从头再来（出题一次 20~60 秒）。所以记录按
 * `moduleId` 存进 `PracticeStore`，同讲内切步不清；细节见 `stores/practice.ts`。
 *
 * 两个刻意的设计
 * ------------
 * 1. **顺序逐题评分**，不并发：主观题走真实模型，三路并发只会互相抢
 *    限流额度，还让学生看到「第三题先出分」的乱序。
 * 2. **会话缓存在 Store 里**：每次提交都开会话会把 sessions 表刷成垃圾
 *    （与点评接线层同一裁定），而只放 `useRef` 则在重挂载后丢失，
 *    学生点「提交评分」会静默无反应。
 */
import { useCallback } from "react";

import type {
  GradeResult,
  RawQuestion,
} from "@/components/learn/practice-question-card";
import { useElapsed } from "@/hooks/use-elapsed";
import { ApiError, apiPost } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { selectPractice, usePracticeStore } from "@/stores/practice";
import { useStudentStore } from "@/stores/student";

export type { PracticePhase } from "@/stores/practice";

export function usePractice(moduleId: string) {
  const record = usePracticeStore((state) => selectPractice(state, moduleId));
  const { phase, error, questions, answers, grades, anyFallback } = record;

  const busy = phase === "generating" || phase === "grading";
  const elapsed = useElapsed(busy);

  /** 首次作答前为本模块开一个真实会话（answer-grade 校验归属）。 */
  const ensureSession = useCallback(
    async (studentId: string): Promise<string> => {
      const existing = selectPractice(
        usePracticeStore.getState(),
        moduleId,
      ).sessionId;
      if (existing !== null) return existing;
      const created = await apiPost<{ sessionId: string }>("/api/session", {
        studentId,
        moduleId,
      });
      usePracticeStore
        .getState()
        .patch(moduleId, { sessionId: created.sessionId });
      return created.sessionId;
    },
    [moduleId],
  );

  const generate = useCallback(async (): Promise<void> => {
    const patch = usePracticeStore.getState().patch;
    patch(moduleId, {
      phase: "generating",
      error: null,
      // 立即清空上一轮的旧题，避免在出题等待（20~60 秒）期间
      // 页面还挂着已经做完的上一组题目。
      questions: [],
      answers: {},
      grades: {},
    });
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
      // 把概念掌握度作为难度上下文带给出题 Agent —— 等待文案承诺的是
      // 「按你的掌握度出题」，但此前请求里根本没有这个字段，出题 Agent
      // 只能盲出（掌握度 4 也出一堆基础题，简答题永远轮不到）。无记录
      // 或 0 分时不传：schema 的 difficulty 下限是 1，「没测过」不是难度。
      const mastery = useStudentStore.getState().mastery[moduleId];
      const result = await apiPost<{
        questions: RawQuestion[];
        usedFallback: boolean;
      }>("/api/agent/generate-question", {
        studentId,
        moduleId,
        count: 3,
        ...(mastery && mastery.score >= 1 ? { difficulty: mastery.score } : {}),
      });
      if (result.usedFallback) {
        // 出题兜底意味着题目是编的（没有可判分的正确答案），直接如实告知
        // 而不是展示一份假题。
        patch(moduleId, {
          error: "这次没能连上出题模型，稍等片刻再点一次「生成练习题」。",
          phase: "idle",
        });
        return;
      }
      // 归一化：剥掉 correct_answer / explanation（答案不进展示形状）。
      patch(moduleId, {
        questions: result.questions.map((raw) => ({
          id: raw.id,
          type: raw.type,
          difficulty: raw.difficulty,
          scenario: raw.scenario,
          question: raw.question,
          options: raw.options ?? [],
        })),
        answers: {},
        grades: {},
        anyFallback: false,
        phase: "answering",
      });
    } catch (err) {
      patch(moduleId, {
        error: err instanceof ApiError ? err.message : "网络异常，请稍后重试。",
        phase: "idle",
      });
    }
  }, [moduleId, ensureSession]);

  const submit = useCallback(async (): Promise<void> => {
    const patch = usePracticeStore.getState().patch;
    // 现读现写：重挂载后 sessionId 与作答都来自 Store，不能依赖挂载时的快照。
    const current = selectPractice(usePracticeStore.getState(), moduleId);
    if (current.phase !== "answering" || current.sessionId === null) return;
    const studentId = currentStudentId();
    if (studentId === "") return;
    const unanswered = current.questions.filter(
      (question) => (current.answers[question.id] ?? "").trim() === "",
    );
    if (unanswered.length > 0) {
      patch(moduleId, { error: `还有 ${unanswered.length} 道题没作答。` });
      return;
    }

    patch(moduleId, { phase: "grading", error: null });
    const nextGrades: Record<string, GradeResult> = {};
    let fallback = false;
    try {
      for (const question of current.questions) {
        const grade = await apiPost<GradeResult>("/api/agent/answer-grade", {
          studentId,
          sessionId: current.sessionId,
          questionId: question.id,
          studentAnswer: (current.answers[question.id] ?? "").trim(),
          moduleId,
          conceptId: moduleId,
        });
        nextGrades[question.id] = grade;
        if (grade.usedFallback) fallback = true;
      }
      patch(moduleId, {
        grades: nextGrades,
        anyFallback: fallback,
        phase: "graded",
      });
    } catch (err) {
      patch(moduleId, {
        error: err instanceof ApiError ? err.message : "网络异常，请稍后重试。",
        phase: "answering",
      });
    }
  }, [moduleId]);

  const setAnswer = useCallback(
    (questionId: string, value: string) => {
      usePracticeStore
        .getState()
        .patch(moduleId, (record) => ({
          answers: { ...record.answers, [questionId]: value },
        }));
    },
    [moduleId],
  );

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
