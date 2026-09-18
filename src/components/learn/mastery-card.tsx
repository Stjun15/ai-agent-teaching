"use client";

import { MasteryIndicator } from "@/components/learn/mastery-indicator";
import { levelOfMastery, masteryToPercent } from "@/lib/scores";
import { selectMastery, useStudentStore } from "@/stores";

/**
 * 掌握度卡片 —— `MasteryIndicator`（纯展示）与 StudentStore 之间的接线。
 *
 * 为什么多这一层而不让 `MasteryIndicator` 自己读 Store
 * --------------------------------------------------
 * `MasteryIndicator` 的取值类型是 `number | null` 的**纯 props 组件**：
 * 它不关心数据来自哪里，任何调用方（将来还有模块列表页、复盘页）都能喂它。
 * 一旦让它内部去订阅 Store，「未测评显示什么」这个决策就被焊死在组件里，
 * 复用都要连带着拖上整个 Store。订阅与取数的口径（按 `moduleId` 即概念 id 命中、
 * `null` 表示没数据）集中在这一处。
 *
 * 量纲转换必须在这里做
 * ------------------
 * `MasteryIndicator` 画的是百分比（文案是「x / 100」、`Progress` 的 `value`
 * 也按百分比），而 `mastery.score` 存的是 **0~5**（建表 `CHECK` 约束，
 * 见 `src/lib/scores.ts` 文件头）。不转换的话，一个已经 `mastered` 的
 * 4 分会显示成「4 / 100」并被判成「不及格」。
 *
 * 这个错在本文件修复前是**潜伏的**：`StudentStore.hydrate` 还没有调用方，
 * 卡片一直显示「尚未测评」，所以 4/5 和 4/100 的区别看不出来。
 * 一旦有人接上取数，它就会立刻变成界面上看得见的错。
 */
export function MasteryCard({
  moduleId,
  moduleName,
}: {
  /** 概念 id。StudentStore 的 mastery 以它为键。 */
  moduleId: string;
  moduleName: string;
}) {
  const mastery = useStudentStore((state) => selectMastery(state, moduleId));

  return (
    <MasteryIndicator
      moduleName={moduleName}
      // 0~5 → 0~100；`null` 保持 `null`（「没测过」与「0 分」是两件事）。
      mastery={mastery === null ? null : masteryToPercent(mastery.score)}
      level={mastery === null ? undefined : levelOfMastery(mastery.score)}
    />
  );
}
