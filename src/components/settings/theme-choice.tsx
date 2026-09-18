"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  applyTheme,
  loadPersistedTheme,
  persistTheme,
  useSettingsStore,
  type ThemeMode,
  type ThemeStorage,
} from "@/stores";

const OPTIONS: readonly { value: ThemeMode; label: string; hint: string }[] = [
  { value: "light", label: "浅色", hint: "始终使用浅色主题" },
  { value: "dark", label: "深色", hint: "始终使用深色主题" },
  { value: "system", label: "跟随系统", hint: "随操作系统的深色设置切换" },
];

/**
 * 主题选择（三态）。
 *
 * 为什么是「浅色 / 深色 / 跟随系统」而不是一个开关
 * --------------------------------------------
 * 「跟随系统」是真实诉求，用布尔表达不了 —— 事后补第三态要改所有消费方，
 * 所以 `ThemeMode` 一开始就是三态（见 `stores/settings.ts`）。
 *
 * 设置页是 `applyTheme` 的第一个真实消费方
 * -------------------------------------
 * 在此之前 `applyTheme` 没有任何调用方：主题只被代码编辑器读去选 monaco 的
 * `vs` / `vs-dark`，而 `<html>` 上的 `dark` class 从来没被加上过。也就是说
 * 「深色模式」此前只是一半 —— 编辑器变深、界面仍是浅色。这里补上另一半。
 *
 * 点击即生效，不经过 effect
 * ----------------------
 * 状态变更、DOM class、持久化三件事都发生在点击处理里。这是事件驱动的变化，
 * 放 effect 只会多一层「状态变了 → effect 读到它 → 再改 DOM」的间接，
 * 而中间那一帧界面还是旧主题。
 */
export function ThemeChoice() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  function choose(next: ThemeMode): void {
    setTheme(next);
    applyTheme(next);
    persistTheme(next, browserStorage());
  }

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">主题</legend>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option.value)}
          aria-pressed={theme === option.value}
          title={option.hint}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm transition-colors",
            theme === option.value
              ? "border-ring bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:border-ring/60 hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * 启动时把已保存的主题应用到 `<html>`。
 *
 * 只做 DOM 副作用，不改 React 状态
 * ------------------------------
 * `applyTheme` 是「同步外部系统」（这里的外部系统就是 DOM），正是 effect 该干的事。
 * 而「把偏好写回 store」不走这里 —— 见下面的取舍说明。
 *
 * 关于刷新时的闪烁（已知取舍）
 * ------------------------
 * effect 在 hydration 之后才跑，所以选了深色的学生刷新页面时会看到极短的浅色
 * 一瞬。彻底解决要在 `<head>` 里插一段同步脚本（需要 `dangerouslySetInnerHTML`），
 * 本项目对注入 HTML 一贯谨慎（Markdown 渲染那套也是刻意不用它），
 * 所以这里选择接受这一瞬，而不是为它开一个注入面。**这是取舍，不是遗漏。**
 */
export function ThemeBootstrap() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  React.useEffect(() => {
    // 已保存的偏好优先于 store 的默认值（"system"）。
    // 只在两者不同才写回 store：相同就不必触发一次无谓的渲染。
    // 这一次同步发生在挂载后，不会造成服务端/客户端不一致 —— 首帧渲染
    // 两边用的都是 store 的默认值，改到深色是挂载之后的一次普通重渲染。
    const stored = loadPersistedTheme(browserStorage());
    if (stored !== theme) setTheme(stored);
  }, [theme, setTheme]);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
}

/** 读写当前浏览器的存储；不可用时返回 null（隐私模式下访问会抛）。 */
function browserStorage(): ThemeStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
