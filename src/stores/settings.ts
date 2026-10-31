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

import type { DashScopeSettings } from "@/lib/agent/dashscope-config";

export type ThemeMode = "light" | "dark" | "system";

export interface SettingsState {
  /** 模型选择。`null` 表示用服务端默认（`DASHSCOPE_TEXT_MODEL`）。 */
  textModel: string | null;
  /** 服务端实际使用的百练配置。由 `/api/health` 填充，只读展示用。 */
  modelSettings: DashScopeSettings | null;
  theme: ThemeMode;
  /** 界面语言。内容语言由教学内容决定，这里只管界面文案。 */
  locale: "zh-CN" | "en";
  /** 语音输入开关。 */
  voiceEnabled: boolean;

  setTextModel: (model: string | null) => void;
  setModelSettings: (settings: DashScopeSettings | null) => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: SettingsState["locale"]) => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// 主题的持久化
// ---------------------------------------------------------------------------

/** 浏览器里记主题用的存储键。 */
export const THEME_STORAGE_KEY = "ai-teaching:theme";

/** 与 `client-identity.ts` 同构的存储抽象：只用到这两个方法，便于在 Node 里断言。 */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];

/** 是否是合法的主题取值。`localStorage` 是学生能手动改的，必须过这一道。 */
export function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

/**
 * 读取已保存的主题。
 *
 * 脏值（手改出来的 `blue`）一律退回 `"system"` 而不是原样采用：否则界面会
 * 停在一个两不管的状态 —— 既不是深色也不是浅色，而 `resolveDark` 会把它
 * 当浅色处理，看起来像「设置坏了」。
 */
export function loadPersistedTheme(
  storage: ThemeStorage | null | undefined,
): ThemeMode {
  const stored = storage?.getItem(THEME_STORAGE_KEY) ?? null;
  return stored !== null && isThemeMode(stored) ? stored : "system";
}

/** 保存主题。非法值不写（宁可下次回到跟随系统，也不留下一个读不懂的值）。 */
export function persistTheme(
  theme: ThemeMode,
  storage: ThemeStorage | null | undefined,
): void {
  if (!isThemeMode(theme)) return;
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 隐私模式下 `setItem` 会抛（配额/策略），而「主题没记住」不该让页面崩。
  }
}

/**
 * 当前主题**实际**是不是深色（把 `system` 解析成系统偏好）。
 *
 * 为什么要单独一个函数：`applyTheme` 是要改 DOM 的副作用，而有些消费方
 * 只是想知道「现在是不是深色」—— 以供主题消费方据此切换样式。
 *
 * 无 `window`（服务端渲染）时按浅色处理：此时还没有系统偏好可读，
 * 而 hydration 之后 effect 会立刻把它纠正过来。
 */
export function resolveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
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
  document.documentElement.classList.toggle("dark", resolveDark(theme));
}

export const useSettingsStore = create<SettingsState>((set) => ({
  textModel: null,
  modelSettings: null,
  theme: "system",
  locale: "zh-CN",
  voiceEnabled: false,

  setTextModel: (textModel) => set({ textModel }),
  setModelSettings: (modelSettings) => set({ modelSettings }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
}));