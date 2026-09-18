/**
 * 主题偏好规格测试
 *
 * 守的是**「刷新之后主题还在、脏值不会让界面卡住」**这件事。
 *
 * 为什么值得单独测
 * -------------
 * 主题是唯一一个「用户改了、下次打开还要记得」的设置项，而它的持久化发生在
 * `localStorage` —— 一个学生能手改、隐私模式下访问会抛异常、脏值不会被任何
 * 类型检查挡住的地方。三种失败各有各的现象：
 *   - 存了 `blue` 而代码照用 → `resolveDark` 把它当浅色，界面看起来「设置坏了」；
 *   - 存了 `blue` 而代码退回 `system` → 用户看到的是「我的选择丢了」；
 *   - `setItem` 抛异常没接住 → 整个组件树白屏。
 *
 * 本组用例把前两条钉住（第三条是 `persistTheme` 里的 try，同样的写法在
 * `client-identity.ts` 已有先例）。
 *
 * 运行：
 *   pnpm test:theme
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  THEME_STORAGE_KEY,
  isThemeMode,
  loadPersistedTheme,
  persistTheme,
} from "@/stores/settings";

/** 内存版存储，模拟 `localStorage`。 */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    /** 测试用：直接读回写进去的值。 */
    peek: (key: string) => data.get(key) ?? null,
  };
}

test("没有存过偏好时退回「跟随系统」", () => {
  assert.equal(loadPersistedTheme(memoryStorage()), "system");
  // 存储整个不可用（服务端渲染 / 隐私模式）时同样退回默认值，而不是抛错。
  assert.equal(loadPersistedTheme(null), "system");
  assert.equal(loadPersistedTheme(undefined), "system");
});

test("存过的三种取值都能原样读回", () => {
  for (const theme of ["light", "dark", "system"] as const) {
    assert.equal(
      loadPersistedTheme(memoryStorage({ [THEME_STORAGE_KEY]: theme })),
      theme,
    );
  }
});

test("脏值退回「跟随系统」，而不是照原样发出去", () => {
  // 学生手改或用旧版本写进去的取值。照原样采用会让 `resolveDark` 把它当浅色，
  // 界面停在一个两不管的状态 —— 看起来像「设置坏了」。
  for (const dirty of ["blue", "", "DARK", "dark ", " true"]) {
    assert.equal(
      loadPersistedTheme(memoryStorage({ [THEME_STORAGE_KEY]: dirty })),
      "system",
      `${JSON.stringify(dirty)} 应当退回 system`,
    );
    assert.equal(isThemeMode(dirty), false);
  }
});

test("persistTheme 写入合法值，跳过非法值", () => {
  const storage = memoryStorage();
  persistTheme("dark", storage);
  assert.equal(storage.peek(THEME_STORAGE_KEY), "dark");

  // 非法值不写：宁可下次回到「跟随系统」，也不留下一个读不懂的值。
  // 且**不能**把上一次的合法值冲掉（学生只是触发了一次不该发生的调用）。
  persistTheme("blue" as never, storage);
  assert.equal(storage.peek(THEME_STORAGE_KEY), "dark");
});

test("setItem 抛异常时不影响调用方", () => {
  // 隐私模式下 localStorage 可能抛（配额/策略）。「主题没记住」不该让页面崩。
  const throwing = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("denied", "SecurityError");
    },
  };
  assert.doesNotThrow(() => persistTheme("dark", throwing));
});

test("存储键是契约字面量，改名等于丢掉所有人的偏好", () => {
  // 钉住字面量：改这个键名会让已保存的偏好在升级后「静默失效」——
  // 现象是「我明明选了深色」，而没有任何报错。值得让测试红一次提醒改的人。
  assert.equal(THEME_STORAGE_KEY, "ai-teaching:theme");
});

test("读回的值一定过得了 isThemeMode（读写两侧同一把尺子）", () => {
  // 这条守的是「读」与「写」用同一套取值判断：`persistTheme` 只写合法的，
  // `loadPersistedTheme` 也只认合法的，中间不会出现「写得进、读不出」。
  const storage = memoryStorage();
  for (const theme of ["light", "dark", "system"] as const) {
    persistTheme(theme, storage);
    const loaded = loadPersistedTheme(storage);
    assert.equal(loaded, theme);
    assert.equal(isThemeMode(loaded), true);
  }
});
