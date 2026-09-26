"use client";

import { useEffect, useRef } from "react";
import {
  Film,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PLAYBACK_SPEEDS,
  useVisualizationStore,
  type PlaybackSpeed,
} from "@/stores";
import { SCENE_LABELS, isSceneId } from "@/lib/agent/scene-ids";
import { getSceneDefinition } from "@/scenes/scene-catalog";
import { SceneStage } from "@/scenes/scene-stage";
import { cn } from "@/lib/utils";

/**
 * 可视化面板（模块页中栏）。
 *
 * 依据 `04-frontend.md`「9 个可视化场景」：每个场景包含动画步骤定义、
 * 播放控制（播放/暂停/前进/后退/重置/变速）、交互（可修改参数看变化）。
 *
 * 本组件是**控制台**，不是场景本身
 * -----------------------------
 * 它只负责三件事：把本讲的场景 id 灌进 Store、渲染控制条与步骤列表、
 * 把步骤列表之外的地方留给舞台。场景的视觉在 `src/scenes/scene-<id>.tsx`，
 * 由 `src/scenes/scene-catalog.ts` 按 id 索引 —— 面板不认识任何具体场景，
 * 所以新增场景不需要改这里。
 *
 * 场景的权威口径只有 Store 一处（就「在播什么、第几步」而言）
 * -------------------------------------------------------
 * 面板从 props 拿到的是「本讲**配了**哪个场景」（来自概念页 →
 * `MODULE_SCENE_IDS`），那是初始值；真正在播的是 Store 的 `sceneId`。
 * 两者若各留一套，控制条推进的步数会和面板显示的步骤列表对不上
 * （`nextStep` 读的是 Store）。所以挂载时把 prop 灌进 Store 一次，
 * 之后一切听 Store 的 —— `visualization` 事件也是往 Store 写，天然一致。
 *
 * 场景未交付时的显示是诚实的
 * ------------------------
 * 显示「本讲对应哪个场景 id + 由哪个提交点交付」，而不是给一个能点但没反应的
 * 播放按钮。可点却没反应比不可点更让人困惑。
 *
 * 为什么没有「切换到别的场景」的入口
 * ------------------------------
 * Phase 5 时这里有一排场景按钮，那是为了在只有一个场景时也能试播放器。但
 * `MODULE_SCENE_IDS` 定的是**一一对应**：每个概念只有一个场景。放一排全部
 * 场景的按钮，学生会在学 LLM API 时点开 RAG 的动画 —— 与那一讲的讲解、
 * 校验、练习全不搭。需要「场景库」是另一件事，不在本阶段。
 *
 * 变速为什么放在面板而不是场景里
 * ----------------------------
 * 「速度」是播放器的控制维度，与场景内容无关。若让每个场景各自实现，
 * 9 个场景会有 9 种对速度的处理，学生切换场景时手感会不一致。
 */
export function VisualizationPanel({ sceneId }: { sceneId: string | null }) {
  const activeId = useVisualizationStore((state) => state.sceneId);
  const stepIndex = useVisualizationStore((state) => state.stepIndex);
  const status = useVisualizationStore((state) => state.status);
  const speed = useVisualizationStore((state) => state.speed);
  const selectScene = useVisualizationStore((state) => state.selectScene);
  const play = useVisualizationStore((state) => state.play);
  const pause = useVisualizationStore((state) => state.pause);
  const nextStep = useVisualizationStore((state) => state.nextStep);
  const prevStep = useVisualizationStore((state) => state.prevStep);
  const reset = useVisualizationStore((state) => state.reset);
  const setSpeed = useVisualizationStore((state) => state.setSpeed);

  // 只灌一次：本讲配置的场景是初始值，之后由 Store 主导（可能被
  // `visualization` 事件切到别的场景）。
  //
  // 注意：sceneId 为 null 时也要调 selectScene(null)，否则 Store 里残留上
  // 一个模块的场景（如从 mcp/observe 切到 platform-replica/observe 时，
  // store 仍指向 scene-mcp-flow，导致本讲展示了别人的可视化）。
  const syncRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (syncRef.current === sceneId) return;
    syncRef.current = sceneId;
    selectScene(sceneId);
  }, [sceneId, selectScene]);

  if (sceneId === null && activeId === null) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        本讲没有配置可视化场景。
      </p>
    );
  }

  /**
   * 显示用哪个场景：Store 里选中的，还没有就先用 props 传进来的。
   *
   * 为什么不能只看 Store：`selectScene` 在 effect 里调，而 effect 在服务端不跑。
   * 只看 Store 的话，服务端渲染出来的这一屏会显示「本讲没有配置可视化场景」——
   * 而 `llm-api` 明明配了场景。学生看到的是「界面先说没有、随后又有了」。
   * 先按 props 显示，第一帧就是对的；Store 选中之后两者一致，不产生跳变。
   */
  const displayId = activeId ?? sceneId;
  const scene = getSceneDefinition(displayId);
  const registered = scene !== undefined;
  const total = scene?.steps.length ?? 0;

  /**
   * 播放键：正在播就暂停；播完了则**从头**再放一次。
   *
   * 少了 `reset()` 那一步的话，播完后再点「播放」只会从最后一步再走一遍，随即
   * 又回到完成态 —— 看起来像按钮坏了。这时用户的意图明确是「我要重看」，
   * 而不是「我要看最后一步」，所以先回第 0 步。
   */
  const togglePlay = () => {
    if (status === "playing") {
      pause();
      return;
    }
    if (status === "finished") reset();
    play();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">
          <Film />
          {displayId !== null && isSceneId(displayId)
            ? SCENE_LABELS[displayId]
            : "流程演示"}
        </Badge>
        {registered ? (
          <span className="text-sm font-medium">{scene.title}</span>
        ) : (
          <Badge variant="levelMid">场景待交付</Badge>
        )}
      </div>

      {/* 控制条。场景尚未交付时禁用 —— 可点但没反应比不可点更让人困惑。 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={status === "playing" ? "secondary" : "default"}
          disabled={!registered}
          onClick={togglePlay}
        >
          {status === "playing" ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
          {status === "playing" ? "暂停" : "播放"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!registered}
          onClick={prevStep}
          aria-label="上一步"
        >
          <SkipBack className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!registered}
          onClick={nextStep}
          aria-label="下一步"
        >
          <SkipForward className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!registered}
          onClick={reset}
        >
          <RotateCcw className="size-4" />
          重置
        </Button>

        <div
          role="group"
          aria-label="播放速度"
          className="ml-auto flex items-center gap-1"
        >
          {PLAYBACK_SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={!registered}
              onClick={() => setSpeed(option as PlaybackSpeed)}
              aria-pressed={speed === option}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] tabular-nums transition-colors",
                speed === option
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
                !registered && "cursor-not-allowed opacity-50",
              )}
            >
              {option}×
            </button>
          ))}
        </div>
      </div>

      {/* 舞台：正在播的场景本体。未交付时它自己渲染 null，面板下方给出说明。 */}
      <SceneStage sceneId={displayId} />

      {registered ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              第 {Math.min(stepIndex + 1, total)} / {total} 步
            </span>
            <span>{statusLabel(status)}</span>
          </div>
          <ol className="flex flex-col gap-1">
            {scene.steps.map((step, index) => (
              <li
                key={step.id}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs",
                  index === stepIndex
                    ? "border-ring bg-accent/50"
                    : index < stepIndex
                      ? "opacity-60"
                      : "opacity-40",
                )}
              >
                <p className="font-medium">
                  {index + 1}. {step.title}
                </p>
                <p className="mt-0.5 leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          本讲对应的场景
          <code className="mx-1 rounded bg-muted px-1 py-0.5">{displayId}</code>
          尚未交付。控制条已就绪，场景的视觉与步骤定义补齐后即可播放。
        </p>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "playing":
      return "播放中";
    case "paused":
      return "已暂停";
    case "finished":
      return "已播完";
    default:
      return "未开始";
  }
}
