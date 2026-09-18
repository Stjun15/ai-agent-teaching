"use client";

/**
 * StudentStore —— 学生画像、掌握度、学习路径、错题、Prompt 历史
 *
 * 依据 `04-frontend.md`「状态管理」表，字段形状取自 `data-models.md` 的
 * `StudentProfile` / `Mastery` / `LearningPath` / `ErrorRecord` / `PromptHistory`。
 *
 * 为什么这一版全是空的、而且**刻意不填假数据**
 * ----------------------------------------
 * 这些数据的权威来源是数据库（Phase 1 已建表，Phase 5 才开 API）。
 * 现在填任何示例数据都会变成「看起来能用、实际接不上」的演示外壳，
 * 而且一旦有人照着假值的形状写下游代码，Phase 5 的接线成本反而更高。
 *
 * 所以本 store 的定位是**接线的另一端**：Phase 5 的
 * `feat(api): add student profile endpoints` 拿到数据后调这里的 `hydrate`，
 * 界面（掌握度卡片、学习路径缩略图）已经准备好读它，读到空就显示「尚未测评」。
 * 这条路径现在就是通的，只是暂时没有数据流过。
 *
 * 当前唯一的消费方是模块页左栏的掌握度卡片（`MasteryCard`）：
 * 它按 `moduleId`（即概念 id）取掌握度，取不到就显示「尚未测评」——
 * 而不是显示 0%。0% 与「没测过」是两件事，见 `mastery-indicator.tsx`。
 */

import { create } from "zustand";

import type {
  ErrorRecord,
  LearningPath,
  Mastery,
  PromptHistory,
  StudentProfile,
} from "@/lib/db";

export interface StudentState {
  /** 当前学生 id；未登录时为 `null`。 */
  studentId: string | null;
  profile: StudentProfile | null;
  /** 概念 id → 掌握度。用 Map 语义的对象而非数组：查询按 id 命中。 */
  mastery: Record<string, Mastery>;
  learningPath: LearningPath | null;
  errors: ErrorRecord[];
  promptHistory: PromptHistory[];
  /** 数据是否已从后端取过一轮。用于区分「还没取」与「取了但是空」。 */
  loaded: boolean;

  hydrate: (input: {
    studentId: string;
    profile: StudentProfile | null;
    mastery: Mastery[];
    learningPath: LearningPath | null;
    errors?: ErrorRecord[];
    promptHistory?: PromptHistory[];
  }) => void;
  /** 单条掌握度更新（校验结束后即时反馈，不必重取全量）。 */
  upsertMastery: (mastery: Mastery) => void;
  clear: () => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  studentId: null,
  profile: null,
  mastery: {},
  learningPath: null,
  errors: [],
  promptHistory: [],
  loaded: false,

  hydrate: ({
    studentId,
    profile,
    mastery,
    learningPath,
    errors = [],
    promptHistory = [],
  }) =>
    set({
      studentId,
      profile,
      mastery: Object.fromEntries(
        mastery.map((item) => [item.conceptId, item]),
      ),
      learningPath,
      errors,
      promptHistory,
      loaded: true,
    }),

  upsertMastery: (mastery) =>
    set((state) => ({
      mastery: { ...state.mastery, [mastery.conceptId]: mastery },
    })),

  clear: () =>
    set({
      studentId: null,
      profile: null,
      mastery: {},
      learningPath: null,
      errors: [],
      promptHistory: [],
      loaded: false,
    }),
}));

/**
 * 取某模块（即某概念）的掌握度。
 *
 * 返回 `null` 表示「没有数据」，调用方必须与「0 分」区别对待。
 */
export function selectMastery(
  state: StudentState,
  conceptId: string,
): Mastery | null {
  return state.mastery[conceptId] ?? null;
}

/**
 * 掌握度分数 → `rubrics.md` 的四档：已移到 `src/lib/scores.ts`（`levelOfMastery`）。
 *
 * 迁移的原因是一个**真实的量纲错位**：这里原先按 0~100 写的门槛
 * （90 / 75 / 60），而数据源 `mastery.score` 是 0~5（建表 `CHECK (score <= 5)`）。
 * 于是 `llm-api = 4`（种子数据里已是 `mastered`）在本项目里会被判成「不及格」。
 * 错位之所以一直没暴露，是因为 `hydrate` 还没有调用方、卡片恒显示「尚未测评」；
 * 接线的第一步就会让它变成看得见的错。
 *
 * 档位来自**分数**，而分数的量纲与 store 无关（报告页也要用同一套），
 * 所以口径统一放到叶子模块里，而不是留在某个 store 的实现细节中。
 */
