/**
 * QaStore —— Q&A 模块的校验状态与结果
 *
 * 与 CodeStore 对应：TextAnswerArea 在 imitate 页提交后立即跳转
 * validate 页，状态由本 store 承载，不依赖组件生命周期。
 */

import { create } from "zustand";

export type QaValidationStatus = "idle" | "validating" | "done" | "error";

export interface QaState {
  submittedAnswer: string;
  validationStatus: QaValidationStatus;
  result: {
    totalScore: number;
    level: string;
    feedback: string;
  } | null;
  error: string | null;
  attempt: number;

  beginValidation: (answer: string) => void;
  resolveValidation: (result: {
    totalScore: number;
    level: string;
    feedback: string;
  }) => void;
  failValidation: (error: string) => void;
  clear: () => void;
}

export const useQaStore = create<QaState>((set) => ({
  submittedAnswer: "",
  validationStatus: "idle",
  result: null,
  error: null,
  attempt: 0,

  beginValidation: (answer) =>
    set((state) => ({
      submittedAnswer: answer,
      validationStatus: "validating",
      error: null,
      attempt: state.attempt + 1,
    })),

  resolveValidation: (result) =>
    set({ validationStatus: "done", result, error: null }),

  failValidation: (error) => set({ validationStatus: "error", error }),

  clear: () =>
    set({
      submittedAnswer: "",
      validationStatus: "idle",
      result: null,
      error: null,
      attempt: 0,
    }),
}));