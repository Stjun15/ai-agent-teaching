"use client";

import { MasteryIndicator } from "@/components/learn/mastery-indicator";
import { levelOfScore, selectMastery, useStudentStore } from "@/stores";

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
 * 分档为什么在这里算而不是在指示器里
 * --------------------------------
 * `levelOfScore` 的 60/75/90 阈值是**推断**（`rubrics.md` 没给分界值，见
 * `stores/student.ts`）。推断的东西必须只活在一个文件里；指示器只认传进来的
 * 档位文案，不自己重算 —— 否则阈值一改要改两个地方。
 *
 * 现在永远显示「尚未测评」是**预期的**：掌握度数据的权威来源是数据库，
 * Phase 5 的 `feat(api): add student profile endpoints` 取到数据后调
 * `hydrate`，这条链路的另一端已经就位（见 `stores/student.ts`）。
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
      mastery={mastery?.score ?? null}
      level={mastery === null ? undefined : levelOfScore(mastery.score)}
    />
  );
}
