/**
 * 编辑器焦点守卫
 *
 * 背景（2026-09-19）：学生反馈「点观察示范直接跳到动手模仿、示范内容没出现」。
 * 真浏览器取证：进入步骤页 1~2 秒后窗口被滚下 465px，滚动瞬间 activeElement
 * 落在 monaco 编辑器内 —— 根因是 Monaco 挂载后无条件 `editor.focus()`，
 * 浏览器把焦点元素（动手模仿卡里的编辑器，位于对话卡下方）滚进视口，
 * 学生刚点开的讲稿被顶出屏幕。
 *
 * 钉什么：`editor.focus()` 必须被「编辑器本来就在视口内」的判断包住。
 * 看不见的编辑器不值得为它动滚动位置 —— 否则任何步骤页都会在 Monaco
 * 加载完成后把学生从讲稿拽到编辑器。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Monaco 挂载时不得无条件抢焦点（滚动劫持守卫）", () => {
  const source = read("../src/components/code/monaco-surface.tsx");

  const guardAt = source.indexOf(
    "getBoundingClientRect().top < window.innerHeight",
  );
  assert.ok(
    guardAt !== -1,
    "focus 必须有视口判断 —— 缺了它，任何步骤页都会在 Monaco 挂载后把窗口滚到动手模仿卡",
  );

  const focusAt = source.indexOf("editor.focus()");
  assert.ok(focusAt !== -1, "挂载聚焦的意图保留（编辑器可见时直接敲字）");
  assert.ok(
    focusAt > guardAt,
    "editor.focus() 必须在视口判断之后 —— 无条件抢焦点会把学生从讲稿拽到编辑器",
  );
});
