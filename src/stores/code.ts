"use client";

/**
 * CodeStore —— 代码、语言、校验状态、校验结果
 *
 * 依据 `04-frontend.md`「状态管理」表；`validationResult` 的形状取自
 * `data-models.md` 的 `ValidationResult`（与 `src/lib/db/types.ts` 一致）。
 *
 * 与 SessionStore 的分工
 * --------------------
 * 学生在「动手模仿」（第 3 步）里写的东西，与对话内容不是一回事：
 * 对话是过程记录，代码是**待校验的产物**。校验请求会带上代码 + 语言 +
 * 任务类型（`api-spec.md` 的 `ValidateSchema`），校验结果要能反复重试、
 * 逐轮对比。混进 SessionStore 会让「清空对话」与「清空代码」互相牵连。
 *
 * 语言只给一种
 * -----------
 * 平台只教 TypeScript。`data-models.md` 的 `Message.language` 与
 * `SendMessageSchema` 的值域见 `lib/languages.ts`。
 */

import { create } from "zustand";

import type { CodeLanguage } from "@/lib/languages";
import type { ValidationResult } from "@/lib/db";

/**
 * 值域已收敛到 `lib/languages.ts`；这里重导出历史名字，
 * 组件层的 `CodeLanguage` 引用不用改。
 */
export type { CodeLanguage };

/** 「产品要学生完成的那一类东西」，与 `api-spec.md` 的 `taskType` 一致。 */
export type TaskType = "prompt" | "tool" | "code";

export type ValidationStatus = "idle" | "validating" | "done" | "error";

export interface CodeState {
  code: string;
  language: CodeLanguage;
  taskType: TaskType;
  validationStatus: ValidationStatus;
  /** 最近一次校验结果；未校验时为 `null`。 */
  validationResult: ValidationResult | null;
  /** 校验失败（网络/服务端问题）时的原因，与「校验不通过」不是一回事。 */
  validationError: string | null;
  /** 本模块内已提交的校验次数 —— 对应 `PromptHistory.attemptNumber`。 */
  attempt: number;

  setCode: (code: string) => void;
  setLanguage: (language: CodeLanguage) => void;
  setTaskType: (taskType: TaskType) => void;
  beginValidation: () => void;
  resolveValidation: (result: ValidationResult) => void;
  failValidation: (message: string) => void;
  clear: () => void;
}

export const useCodeStore = create<CodeState>((set) => ({
  code: "",
  // 平台只教 TypeScript；见 `lib/languages.ts`。
  language: "typescript",
  taskType: "code",
  validationStatus: "idle",
  validationResult: null,
  validationError: null,
  attempt: 0,

  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setTaskType: (taskType) => set({ taskType }),

  beginValidation: () =>
    set((state) => ({
      validationStatus: "validating",
      validationError: null,
      // 次数在**开始**时自增，不是成功时：失败的尝试也算一次，
      // 否则「第几次尝试」在学生反复卡住时会一直显示 1。
      attempt: state.attempt + 1,
    })),

  resolveValidation: (validationResult) =>
    set({ validationStatus: "done", validationResult, validationError: null }),

  failValidation: (validationError) =>
    set({ validationStatus: "error", validationError }),

  clear: () =>
    set({
      code: "",
      validationStatus: "idle",
      validationResult: null,
      validationError: null,
      attempt: 0,
    }),
}));

/** 校验是否已通过（`ValidationResult.isCorrect`）。未校验时为 `false`。 */
export function selectIsPassed(state: CodeState): boolean {
  return state.validationResult?.isCorrect ?? false;
}