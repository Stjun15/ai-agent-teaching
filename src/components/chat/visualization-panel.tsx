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
import { cn } from "@/lib/utils";

/**
 * 可视化面板（模块页中栏）。
 *
 * 依据 `04-frontend.md`「9 个可视化场景」：每个场景包含动画步骤定义、
 * 播放控制（播放/暂停/前进/后退/重置/变速）、交互（可修改参数看变化）。
 *
 * 本阶段交付的是**播放器**，场景内容在 Phase 6
 * -----------------------------------------
 * 9 个场景组件依赖的能力（Agent 编排、RAG、MCP、多 Agent）要到 Phase 4 / 5
 * 才具备，所以执行计划把场景排在 Phase 6。但播放器不必等 —— 它只是一套
 * 「按步骤推进 + 控制条」的通用壳子。这样切的实际收益：Phase 6 每写完一个
 * 场景，调 `registerScene` 注册步骤定义就能播，不用回头改这里。
 *
 * 场景的权威口径只有 Store 一处
 * --------------------------
 * 面板从 props 拿到的是「本讲**配了**哪个场景」（来自概念页 → `MODULE_SCENE_IDS`），
 * 那是初始值；真正在播的是 Store 的 `sceneId`。两者若各留一套，
 * 控制条推进的步数会和面板显示的步骤列表对不上（`nextStep` 读的是 Store）。
 * 所以挂载时把 prop 灌进 Store 一次，之后一切听 Store 的 ——
 * `visualization` 事件也是往 Store 写，天然一致。
 *
 * 场景未注册时的显示是诚实的
 * ------------------------
 * 显示「本讲对应哪个场景 id + 由哪个阶段交付」，而不是给一个能点但没反应的
 * 播放按钮。可点却没反应比不可点更让人困惑。
 *
 * 变速为什么放在播放器而不是场景里
 * ----------------------------
 * 「速度」是播放器的控制维度，与场景内容无关。若让每个场景各自实现，
 * 9 个场景会有 9 种对速度的处理，学生切换场景时手感会不一致。
 */
export function VisualizationPanel({ sceneId }: { sceneId: string | null }) {
  const scenes = useVisualizationStore((state) => state.scenes);
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
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || sceneId === null) return;
    seededRef.current = true;
    selectScene(sceneId);
  }, [sceneId, selectScene]);

  if (sceneId === null && activeId === null) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        本讲没有配置可视化场景。
      </p>
    );
  }

  const scene = activeId === null ? undefined : scenes[activeId];
  const registered = scene !== undefined;
  const total = scene?.steps.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">
          <Film />
          {activeId}
        </Badge>
        {registered ? (
          <span className="text-sm font-medium">{scene.title}</span>
        ) : (
          <Badge variant="levelMid">场景待交付（Phase 6）</Badge>
        )}
      </div>

      {/* 控制条。场景未注册时禁用 —— 可点但没反应比不可点更让人困惑。 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={status === "playing" ? "secondary" : "default"}
          disabled={!registered}
          onClick={() => (status === "playing" ? pause() : play())}
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
          场景组件由 Phase 6 的提交点
          <code className="mx-1 rounded bg-muted px-1 py-0.5">
            feat(scenes): add {activeId}
          </code>
          交付。播放器（步骤推进、变速、参数覆盖）已就绪，场景注册后即可播放。
        </p>
      )}

      {/* 场景切换入口：仅在已注册多个场景时才出现 */}
      {Object.keys(scenes).length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {Object.values(scenes).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={item.id === activeId ? "secondary" : "outline"}
              onClick={() => selectScene(item.id)}
            >
              {item.title}
            </Button>
          ))}
        </div>
      ) : null}
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
