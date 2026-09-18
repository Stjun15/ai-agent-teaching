"use client";

/**
 * SettingsStore —— 模型、主题、语言、语音开关
 *
 * 依据 `04-frontend.md`「状态管理」表。
 *
 * 只有主题是真的接上了界面
 * ----------------------
 * 四项里当前只有**主题**有消费方（顶栏的明暗切换，`globals.css` 里
 * `.dark` 那套变量 Phase 0 就写好了）。其余三项的消费方在后续阶段：
 * 模型选择要等 Phase 5 的 API 层透出可选模型，语言影响的是内容而非界面骨架，
 * 语音输入属 Phase 6。
 *
 * 把它们一并定义出来不是提前设计，而是因为**它们都是要随学生偏好持久化的
 * 字段**（`data-models.md` 的 `StudentProfile` 里有 `preferredLanguage`），
 * 三处各写一份「临时状态」比集中一处更难收拾。界面按需接。
 *
 * `theme` 的取值刻意是 `"light" | "dark" | "system"` 三态，不是布尔：
 * 「跟随系统」是用户的真实诉求，用布尔表达不了，事后补第三态要改所有消费方。
 */

import { create } from "zustand";

import type { ArkSettings } from "@/lib/agent/ark-config";

export type ThemeMode = "light" | "dark" | "system";

export interface SettingsState {
  /** 模型选择。`null` 表示用服务端默认（`ARK_TEXT_MODEL`）。 */
  textModel: string | null;
  /** 服务端实际使用的方舟配置。由 `/api/health` 或配置接口填充，只读展示用。 */
  arkSettings: ArkSettings | null;
  theme: ThemeMode;
  /** 界面语言。内容语言由教学内容决定，这里只管界面文案。 */
  locale: "zh-CN" | "en";
  /** 语音输入开关。 */
  voiceEnabled: boolean;

  setTextModel: (model: string | null) => void;
  setArkSettings: (settings: ArkSettings | null) => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: SettingsState["locale"]) => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

/** 主题对应的根元素 class；`system` 交给 CSS 的媒体查询处理。 */
export function themeClassName(theme: ThemeMode): string | null {
  if (theme === "system") return null;
  return theme === "dark" ? "dark" : null;
}

/**
 * 把主题应用到 `<html>` 上。
 *
 * 单独导出而不是写在 store 里：store 是纯状态，副作用（改 DOM）放在动作里
 * 会让「状态变更」与「DOM 变更」两件事纠缠在一起，测试时也不好隔离。
 * 服务端渲染阶段不要调用它 —— 调用方是客户端组件的 `useEffect`。
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

export const useSettingsStore = create<SettingsState>((set) => ({
  textModel: null,
  arkSettings: null,
  theme: "system",
  locale: "zh-CN",
  voiceEnabled: false,

  setTextModel: (textModel) => set({ textModel }),
  setArkSettings: (arkSettings) => set({ arkSettings }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
}));
