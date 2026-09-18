"use client";

/**
 * 场景舞台 —— 把「正在播的场景」渲染出来，并按步骤时长推进
 *
 * 舞台上两件事
 * ----------
 * 1. **渲染**：按 id 找到场景组件，把步骤与参数传下去；
 * 2. **走时间**：`playing` 时按当前步的时长排一个定时器，到点 `nextStep()`。
 *
 * 时间只在舞台这一处
 * ---------------
 * 步骤的时长写在目录里（`SceneStep.durationMs`），由舞台读；场景自己不算时间，
 * 只用 CSS 入场动画表现「这一步的元素出现了」。这条分工是「暂停」能成立的前提：
 * 暂停停的是舞台的定时器，场景里没有别的计时器在偷偷往前走。
 *
 * 改速度是从当前步重头计时，不折算已过的部分
 * -------------------------------------
 * 于是 1× 切到 2× 时，当前步会按新时长重新走一遍。要折算得记下每步已过多久，
 * 那是与控制条并行的第二份状态，还要处理暂停/后退时的对齐 —— 为了一个
 * 观感上的连续性引入这一层，不划算。
 *
 * 组件映射由类型钉住
 * ---------------
 * `SCENE_COMPONENTS` 用 `Record<keyof typeof SCENE_CATALOG, …>` 约束：目录里
 * 加了场景却忘了写组件，**编译就过不去**。运行期仍保留一个「组件缺失」的兜底
 * 分支 —— 类型保证的是本仓库当前这份代码，`as` 之类的强转不在保证范围内。
 */

import { useEffect, type ComponentType } from "react";

import { useVisualizationStore } from "@/stores";
import { SCENE_CATALOG, getSceneDefinition } from "./scene-catalog";
import { SceneRequestResponse } from "./scene-request-response";
import type { SceneId } from "@/lib/agent/scene-ids";
import type { SceneProps } from "./scene-types";

/** 场景 id → 组件；键必须与目录里**已注册**的场景一一对应。 */
export const SCENE_COMPONENTS = {
  "scene-request-response": SceneRequestResponse,
} satisfies Record<keyof typeof SCENE_CATALOG, ComponentType<SceneProps>>;

/**
 * 查组件用的放宽视图。
 *
 * 与 `scene-catalog.ts` 里那份 `LOOKUP` 同一个理由：写入侧要窄类型（编译期
 * 查漏），读取侧要宽类型（运行期按任意 id 查）。这里额外多一层理由 ——
 * 运行时的 id 来自目录，类型上是 `SceneId`，比「已注册的键」宽。
 */
const RENDERERS: Partial<Record<SceneId, ComponentType<SceneProps>>> =
  SCENE_COMPONENTS;

export function SceneStage() {
  const activeId = useVisualizationStore((state) => state.sceneId);
  const stepIndex = useVisualizationStore((state) => state.stepIndex);
  const status = useVisualizationStore((state) => state.status);
  const speed = useVisualizationStore((state) => state.speed);
  const params = useVisualizationStore((state) => state.params);
  const setParam = useVisualizationStore((state) => state.setParam);
  const nextStep = useVisualizationStore((state) => state.nextStep);

  const scene = getSceneDefinition(activeId);
  const step = scene?.steps[stepIndex];

  useEffect(() => {
    if (status !== "playing" || step === undefined) return;
    const timer = setTimeout(() => nextStep(), step.durationMs / speed);
    return () => clearTimeout(timer);
  }, [status, step, speed, nextStep]);

  if (scene === undefined) return null;

  const Renderer = RENDERERS[scene.id];

  return (
    <div className="flex flex-col gap-2">
      {Renderer === undefined ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          场景 <code className="mx-1">{scene.id}</code>{" "}
          有步骤定义但没有组件，暂时无法播放。
        </p>
      ) : (
        // `key` 换场景时整体重挂：上一条场景残留的入场动画与局部状态不该带过来。
        <Renderer
          key={scene.id}
          stepIndex={stepIndex}
          caption={step?.title ?? "播放已结束"}
          params={params}
          setParam={setParam}
        />
      )}
    </div>
  );
}
