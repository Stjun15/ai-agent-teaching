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
import dynamic from "next/dynamic";

import { useVisualizationStore } from "@/stores";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { SCENE_CATALOG, getSceneDefinition } from "./scene-catalog";
import type { SceneProps } from "./scene-types";

function SceneSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-2">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

const DYNAMIC_SCENES: Partial<
  Record<keyof typeof SCENE_CATALOG, ComponentType<SceneProps>>
> = {
  "scene-request-response": dynamic(
    () =>
      import("./scene-request-response").then(
        (mod) => mod.SceneRequestResponse,
      ),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-role-filter": dynamic(
    () => import("./scene-role-filter").then((mod) => mod.SceneRoleFilter),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-loop-weather": dynamic(
    () => import("./scene-loop-weather").then((mod) => mod.SceneLoopWeather),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-tool-chain": dynamic(
    () => import("./scene-tool-chain").then((mod) => mod.SceneToolChain),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-retrieve-generate": dynamic(
    () =>
      import("./scene-retrieve-generate").then(
        (mod) => mod.SceneRetrieveGenerate,
      ),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-rag-vs-wiki": dynamic(
    () => import("./scene-rag-vs-wiki").then((mod) => mod.SceneRagVsWiki),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-orchestration": dynamic(
    () => import("./scene-orchestration").then((mod) => mod.SceneOrchestration),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-mcp-flow": dynamic(
    () => import("./scene-mcp-flow").then((mod) => mod.SceneMcpFlow),
    { ssr: false, loading: SceneSkeleton },
  ),
  "scene-attack-defense": dynamic(
    () =>
      import("./scene-attack-defense").then((mod) => mod.SceneAttackDefense),
    { ssr: false, loading: SceneSkeleton },
  ),
};

/**
 * `sceneId` 是**兜底**：Store 里已经有选中的场景时以 Store 为准。
 *
 * 为什么需要兜底：`selectScene` 在 effect 里调，而 effect 在服务端不跑。只看
 * Store 的话，服务端渲染出来的这一屏是空的，到客户端才补上 —— 首帧缺一块。
 * 播放状态（第几步、在播没有、参数）仍然只认 Store：它们本来就只有客户端才有。
 */
export function SceneStage({ sceneId }: { sceneId: string | null }) {
  const activeId = useVisualizationStore((state) => state.sceneId);
  const stepIndex = useVisualizationStore((state) => state.stepIndex);
  const status = useVisualizationStore((state) => state.status);
  const speed = useVisualizationStore((state) => state.speed);
  const params = useVisualizationStore((state) => state.params);
  const setParam = useVisualizationStore((state) => state.setParam);
  const nextStep = useVisualizationStore((state) => state.nextStep);

  const scene = getSceneDefinition(activeId ?? sceneId);
  const step = scene?.steps[stepIndex];

  useEffect(() => {
    if (status !== "playing" || step === undefined) return;
    const timer = setTimeout(() => nextStep(), step.durationMs / speed);
    return () => clearTimeout(timer);
  }, [status, step, speed, nextStep]);

  if (scene === undefined) return null;

  const Renderer = DYNAMIC_SCENES[scene.id];

  return (
    <div className="flex flex-col gap-2">
      {Renderer === undefined ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
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
