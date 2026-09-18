"use client";

/**
 * VisualizationStore —— 当前场景、步骤、播放状态、速度
 *
 * 依据 `04-frontend.md`：
 * - 「状态管理」表：当前场景、步骤、播放状态、速度；
 * - 「9 个可视化场景」：每个场景包含「动画步骤定义、播放控制
 *   （播放/暂停/前进/后退/重置/变速）、交互（可修改参数看变化）」。
 *
 * 场景定义不放在本 Store 里
 * -----------------------
 * Phase 5 时这里存着一张 `scenes` 表，靠 `registerScene` 在运行时填。那套做法
 * 有个时序坑：`selectScene` 读不到「还没注册」的场景，参数只能给空对象，
 * 等场景注册上来又要回头补一次 —— 而补的时机由调用顺序决定，谁先谁后都能
 * 写出「参数是空的但界面正常」的状态。
 *
 * 场景定义是**静态数据**（`src/scenes/scene-catalog.ts`），不需要运行时注册。
 * 于是改成查目录：`selectScene` 当场就能拿到参数初值，步骤数也随查随有。
 * 「晚注册」这类问题不是被修好了，而是不存在了。
 *
 * 这样切还有个副作用是好的：Store 只持有**播放状态**（第几步、在播没有、
 * 多快、参数被改成了什么），场景内容与它无关。播放器要复用同一套控制语义，
 * 靠的正是「内容在外面、状态在里面」。
 *
 * 为什么播放位置是「步骤索引」而不是「时间轴秒数」
 * --------------------------------------------
 * 场景的动画步骤是**离散**的（第几步做什么），不是连续时间轴。
 * 用索引做状态意味着暂停/前进/后退都是精确的、可断言的整数运算；
 * 用秒数则要处理步长边界与浮点误差，而变速只是乘一个系数。
 * 真实的时间推进由舞台的计时器负责，它读 `speed` 决定间隔。
 */

import { create } from "zustand";

import { getSceneDefinition } from "@/scenes/scene-catalog";
import type {
  SceneDefinition,
  SceneParams,
  SceneParamValue,
} from "@/scenes/scene-types";

export type PlaybackStatus = "idle" | "playing" | "paused" | "finished";

/** 播放速度档位。`04-frontend.md` 要求「变速」，给四档。 */
export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface VisualizationState {
  /** 当前场景 id；未选场景时为 `null`。 */
  sceneId: string | null;
  /** 当前处于第几步（0 基）。 */
  stepIndex: number;
  status: PlaybackStatus;
  speed: PlaybackSpeed;
  /** 用户改过的参数（覆盖场景的 `defaultParams`）。 */
  params: SceneParams;

  selectScene: (sceneId: string | null) => void;
  play: () => void;
  pause: () => void;
  nextStep: () => void;
  prevStep: () => void;
  /** 回到第 0 步并把参数恢复为场景默认值。 */
  reset: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  setParam: (key: string, value: SceneParamValue) => void;
}

export const useVisualizationStore = create<VisualizationState>((set, get) => ({
  sceneId: null,
  stepIndex: 0,
  status: "idle",
  speed: 1,
  params: {},

  selectScene: (sceneId) => {
    const scene = getSceneDefinition(sceneId);
    set({
      sceneId,
      stepIndex: 0,
      // 场景没有定义（还没交付、或模型给了一个不认识的 id）时停在 `idle`：
      // 控制条据此变成不可点，而不是给一个点了没反应的播放按钮。
      status: scene === undefined ? "idle" : "paused",
      params: scene === undefined ? {} : { ...scene.defaultParams },
    });
  },

  play: () => set({ status: "playing" }),
  pause: () => set({ status: "paused" }),

  nextStep: () =>
    set((state) => {
      const total = stepCount(state);
      if (total === 0) return {};
      const next = state.stepIndex + 1;
      // 到最后一步之后停在原地并标记完成 —— 不回卷到 0。
      // 回卷会让人以为「自己播完了又自动重播了」。
      if (next >= total) return { status: "finished" as const };
      return { stepIndex: next };
    }),

  prevStep: () =>
    set((state) => {
      // 后退时若已到末尾，先解除 finished，否则界面上的「播放」按钮
      // 还停在完成态，点了没有反应。
      const base = state.stepIndex <= 0 ? 0 : state.stepIndex - 1;
      return {
        stepIndex: base,
        status: state.status === "finished" ? "paused" : state.status,
      };
    }),

  reset: () => {
    const scene = currentScene(get());
    set({
      stepIndex: 0,
      status: scene === undefined ? "idle" : "paused",
      params: scene === undefined ? {} : { ...scene.defaultParams },
      // 速度不重置：那是用户偏好，不是场景状态。
    });
  },

  setSpeed: (speed) => set({ speed }),

  setParam: (key, value) =>
    set((state) => ({ params: { ...state.params, [key]: value } })),
}));

/** 当前场景定义；未选场景、或该场景尚未交付时为 `undefined`。 */
export function currentScene(
  state: VisualizationState,
): SceneDefinition | undefined {
  return getSceneDefinition(state.sceneId);
}

/** 当前场景的步骤总数；无场景时为 0。 */
export function stepCount(state: VisualizationState): number {
  return currentScene(state)?.steps.length ?? 0;
}
