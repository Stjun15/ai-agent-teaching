/**
 * 讲解 / 观察示范两步的自动开场词
 *
 * 为什么单独成文件（2026-09-19 抽出）
 * ------------------------------
 * 这两段开场词原本内联在 `module-workspace.tsx` 的 JSX 里，只有一个消费方。
 * 「点开即有」改造后出现了**第二个**消费方：预生成脚本
 * `scripts/generate-lecture-cache.mjs` 要用一模一样的话去生成缓存讲稿 ——
 * 开场词就是缓存的键的一部分，两处各写一份必然漂移（漂移的后果是「缓存的
 * 讲解」与「现场生成的讲解」根本不是同一个问题），所以在有两个消费方之前
 * 先收敛到一处。
 *
 * 「动手模仿」不在自动开场之列：那一步的主体是学生自己写，导师抢话反而
 * 打扰（该裁定详见 lecture-launcher.tsx 文件头）。本文件因此只提供两个
 * 步骤的词，不提供 imitate 的。
 */

import type { LectureCacheStep } from "@/lib/db";
import type { Expect } from "@/lib/type-assert";

/** 允许自动开场（缓存或实时生成）的步骤。2026-09-25 去掉 observe：示范代码改为从 wiki 页面直读，不走 LLM。 */
export const AUTO_LECTURE_STEPS = ["explain"] as const;

export type AutoLectureStep = (typeof AUTO_LECTURE_STEPS)[number];

/**
 * 编译期提醒：`AUTO_LECTURE_STEPS` 的值必须都是 `LectureCacheStep` 的子集，
 * 不能出现缓存表不支持却要自动开场的步骤。
 */
type _Extra = Exclude<AutoLectureStep, LectureCacheStep>;
export type __AssertStepsAligned = Expect<_Extra extends never ? true : false>;

/**
 * 按步骤取开场词。
 *
 * `explain` / `observe` 的措辞与 2026-09-19 首版（内联在 workspace 里）逐字
 * 一致 —— 改词等于换缓存键，必须同步重跑预生成脚本，所以不要随手润色。
 *
 * ⚠️ `keySteps` 是2026-10-08 新增的**步骤骨架注入**（措辞未变，只是多了这一段）：
 * 此前 prompt 只传模块名，模型不知道这一讲该讲几步、每步是什么。实测后果：
 * `platform-replica` 概念页声明 5 个关键步骤，讲稿里一个都没出现，整节讲成了
 * 「任务分解」——**这不是重试能解决的问题，必须把骨架送进 prompt**。
 *
 * 传入空数组时行为与旧版逐字一致（不改变已有缓存键的语义，且空骨架不该
 * 让prompt 变形）。
 */
export function lectureOpenerPrompt(
  step: AutoLectureStep,
  moduleName: string,
  keySteps: readonly string[] = [],
): string {
  const skeleton =
    keySteps.length === 0
      ? ""
      : `\n\n这一讲必须覆盖以下 ${keySteps.length} 个关键步骤，` +
        `**每个步骤都要单独讲清楚（叫什么、做什么、怎么验收）**：\n` +
        keySteps.map((s, i) => `${i + 1}. ${s}`).join("\n") +
        `\n\n不要用别的结构替代这些步骤。`;
  if (step === "explain") {
    return `请开始讲解「${moduleName}」这一讲的核心概念。${skeleton}`;
  }
  return `请给我看一个「${moduleName}」的完整示范：一段写得好的示例（Prompt 或代码），并逐段说明它为什么好、每个部分在起什么作用。${skeleton}`;
}
