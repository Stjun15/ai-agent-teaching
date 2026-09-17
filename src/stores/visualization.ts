"use client";

/**
 * VisualizationStore —— 当前场景、步骤、播放状态、速度
 *
 * 依据 `04-frontend.md`：
 * - 「状态管理」表：当前场景、步骤、播放状态、速度；
 * - 「9 个可视化场景」：每个场景包含「动画步骤定义、播放控制
 *   （播放/暂停/前进/后退/重置/变速）、交互（可修改参数看变化）」。
 *
 * 场景本身在 Phase 6 交付
 * ---------------------
 * 9 个场景组件（`src/scenes/scene-*`）依赖的能力要到 Phase 4 / 5 才具备
 * （Agent 编排、RAG、MCP、多 Agent），所以 `04-frontend.md` 把它们列在
 * 模块表里、而执行计划把它们排在 Phase 6。本阶段交付的是**播放器骨架**：
 * 场景注册（`registerScene`）、步骤推进、播放控制、变速、参数覆盖。
 *
 * 这样切的好处是明确的：Phase 6 每写完一个场景，只要调 `registerScene`
 * 注册它的步骤定义即可播放，不必回头改播放器。模块页现在就能显示
 * 「本讲对应 scene-xxx」，而不是一块空白。
 *
 * 为什么播放位置是「步骤索引」而不是「时间轴秒数」
 * --------------------------------------------
 * 场景的动画步骤是**离散**的（第几步做什么），不是连续时间轴。
 * 用索引做状态意味着暂停/前进/后退都是精确的、可断言的整数运算；
 * 用秒数则要处理步长边界与浮点误差，而变速只是乘一个系数。
 * 真实的时间推进由场景组件自己的计时器负责，它读 `speed` 决定间隔。
 */

import { create } from "zustand";

/** 一个场景的动画步骤定义（由 `src/scenes/` 下的场景组件提供）。 */
export interface SceneStep {
  id: string;
  /** 该步在界面上显示的标题。 */
  title: string;
  /** 该步的解说文案。 */
  description: string;
  /** 该步的时长（毫秒，按 `speed: 1` 计算），播放器据此推进。 */
  durationMs: number;
}

/** 场景的静态定义。 */
export interface SceneDefinition {
  id: string;
  title: string;
  /** 该场景属于哪个模块（概念 id）。 */
  moduleId: string;
  steps: SceneStep[];
  /**
   * 可交互参数的默认值。
   *
   * `04-frontend.md` 要求场景「可修改参数看变化」，参数值由播放器统一持有，
   * 场景组件只读不写 —— 这样「重置」能回到同一份初值，不必让每个场景
   * 自己实现一遍。
   */
  defaultParams: Record<string, string | number | boolean>;
}

export type PlaybackStatus = "idle" | "playing" | "paused" | "finished";

/** 播放速度档位。`04-frontend.md` 要求「变速」，给四档。 */
export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface VisualizationState {
  /** 已注册的场景，键为场景 id。 */
  scenes: Record<string, SceneDefinition>;
  /** 当前场景 id；未选场景时为 `null`。 */
  sceneId: string | null;
  /** 当前处于第几步（0 基）。 */
  stepIndex: number;
  status: PlaybackStatus;
  speed: PlaybackSpeed;
  /** 用户改过的参数（覆盖场景的 `defaultParams`）。 */
  params: Record<string, string | number | boolean>;

  registerScene: (scene: SceneDefinition) => void;
  selectScene: (sceneId: string | null) => void;
  play: () => void;
  pause: () => void;
  nextStep: () => void;
  prevStep: () => void;
  /** 回到第 0 步并把参数恢复为场景默认值。 */
  reset: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  setParam: (key: string, value: string | number | boolean) => void;
}

export const useVisualizationStore = create<VisualizationState>((set, get) => ({
  scenes: {},
  sceneId: null,
  stepIndex: 0,
  status: "idle",
  speed: 1,
  params: {},

  registerScene: (scene) =>
    set((state) => ({
      scenes: { ...state.scenes, [scene.id]: scene },
    })),

  selectScene: (sceneId) => {
    const scene = sceneId === null ? undefined : get().scenes[sceneId];
    set({
      sceneId,
      stepIndex: 0,
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

/** 当前场景定义。 */
export function currentScene(
  state: VisualizationState,
): SceneDefinition | undefined {
  return state.sceneId === null ? undefined : state.scenes[state.sceneId];
}

/** 当前场景的步骤总数；无场景时为 0。 */
export function stepCount(state: VisualizationState): number {
  return currentScene(state)?.steps.length ?? 0;
}
