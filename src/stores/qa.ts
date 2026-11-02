/**
 * QaStore —— Q&A 模块的校验状态与结果
 *
 * 与 CodeStore 对应：TextAnswerArea 在 imitate 页提交后立即跳转
 * validate 页，状态由本 store 承载，不依赖组件生命周期。
 */

import { create } from "zustand";

export type QaValidationStatus = "idle" | "validating" | "done" | "error";

export interface QaState {
  /**
   * 当前回答属于哪一讲。换讲由 `syncModule` 清空 —— 与 CodeStore 同一问题：
   * 全局单例不清会把上一讲的答案与评分带到下一讲。
   */
  moduleId: string | null;
  submittedAnswer: string;
  validationStatus: QaValidationStatus;
  result: {
    totalScore: number;
    level: string;
    feedback: string;
    /** 点评兜底（模型没回来）。兜底分数是编的，界面不能据此劝学生重学。 */
    usedFallback?: boolean;
  } | null;
  error: string | null;
  attempt: number;

  beginValidation: (answer: string) => void;
  /** 同一讲内为空操作；换讲才清空答案、评分与次数。 */
  syncModule: (moduleId: string) => void;
  resolveValidation: (result: {
    totalScore: number;
    level: string;
    feedback: string;
    /** 点评兜底（模型没回来）。兜底分数是编的，界面不能据此劝学生重学。 */
    usedFallback?: boolean;
  }) => void;
  failValidation: (error: string) => void;
  clear: () => void;
}

export const useQaStore = create<QaState>((set) => ({
  moduleId: null,
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

  syncModule: (moduleId) =>
    set((state) =>
      state.moduleId === moduleId
        ? state
        : {
            moduleId,
            submittedAnswer: "",
            validationStatus: "idle",
            result: null,
            error: null,
            attempt: 0,
          },
    ),

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