"use client";

/**
 * PracticeStore —— 变式练习的流程状态，按模块隔离
 *
 * 为什么必须搬到 Store（2026-11-02 学生走查）
 * ----------------------------------------
 * 原状态是 `usePractice` 里的 `useState`。七步是**独立路由**
 * （`/learn/[moduleId]/[step]`，见 `[step]/page.tsx` 的文件头说明），
 * 换一步就卸载整个工作区 —— 学生刚生成的三道题、填了一半的答案、
 * 甚至评完的分全部丢失，切回「变式练习」看到的又是「生成练习题」按钮。
 * 出题要等 20~60 秒，丢一次就得重等一次。
 *
 * 与 CodeStore 同一取舍：同讲内切步不清，只有**换讲**才清。
 * 按 `moduleId` 分桶而不是像 CodeStore 那样单例，是因为从练习页跳去
 * 报告页再回来、又或者左右栏切换模块时，前一个模块的进度没有理由被
 * 后一个模块冲掉；单例就得靠「进入时重置」补救，反而更容易出错。
 *
 * 只活在内存里：刷新整页仍会丢（题目是模型现生成的，落库的只有评分
 * 结果 `question_results`）。界面要恢复整组题目就需要把题也写库，
 * 那是数据层改动，不在本次修复范围内。
 */

import { create } from "zustand";

import type {
  DisplayQuestion,
  GradeResult,
} from "@/components/learn/practice-question-card";

export type PracticePhase =
  "idle" | "generating" | "answering" | "grading" | "graded";

export interface PracticeRecord {
  phase: PracticePhase;
  /** 面向学生的错误文案（出题失败 / 未答完 / 网络异常）。 */
  error: string | null;
  /** 当前这一组题；还没生成时为空数组。 */
  questions: DisplayQuestion[];
  /** 题目 id → 学生作答。 */
  answers: Record<string, string>;
  /** 题目 id → 评分结论；未评分时不在这里。 */
  grades: Record<string, GradeResult>;
  /** 本轮是否出现过评分兜底（兜底分不计入掌握度，面板要如实提示）。 */
  anyFallback: boolean;
  /**
   * `answer-grade` 归属用的会话 id。必须持久化：重挂载后为 null 时，
   * `submit` 会直接 return —— 学生点「提交评分」什么都不会发生。
   */
  sessionId: string | null;
}

export interface PracticeStore {
  byModule: Record<string, PracticeRecord>;
  /** 局部更新某个模块的记录；没有记录时先建一份空记录再合并。 */
  patch: (
    moduleId: string,
    patch: Partial<PracticeRecord> | ((record: PracticeRecord) => Partial<PracticeRecord>),
  ) => void;
}

/**
 * 空记录常量：模块从未练过时选择器返回它的**同一个引用**。
 * 每次返回新对象会让 `useSyncExternalStore` 快照不稳定（React #185）。
 */
export const EMPTY_PRACTICE: PracticeRecord = Object.freeze({
  phase: "idle" as PracticePhase,
  error: null,
  questions: [] as DisplayQuestion[],
  answers: {} as Record<string, string>,
  grades: {} as Record<string, GradeResult>,
  anyFallback: false,
  sessionId: null,
});

export const usePracticeStore = create<PracticeStore>((set) => ({
  byModule: {},

  patch: (moduleId, patch) =>
    set((state) => {
      const current = state.byModule[moduleId] ?? EMPTY_PRACTICE;
      const next =
        typeof patch === "function" ? patch(current) : patch;
      return {
        byModule: {
          ...state.byModule,
          [moduleId]: { ...current, ...next },
        },
      };
    }),
}));

/** 读某模块的练习记录（永不返回 undefined，便于选择器稳定）。 */
export function selectPractice(
  state: PracticeStore,
  moduleId: string,
): PracticeRecord {
  return state.byModule[moduleId] ?? EMPTY_PRACTICE;
}
