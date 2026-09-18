/**
 * 可视化场景的公共类型 —— 「数据」与「渲染」的分界线
 *
 * 为什么步骤定义住在 `.ts` 而场景视觉住在 `.tsx`
 * ------------------------------------------
 * 步骤定义（第几步、显示什么、放多久、参数默认值）是**纯数据**，它要能被
 * 回归测试直接 import —— `scripts/scene-spec.ts` 用它钉住「每个已注册场景的
 * 步骤数、时长、参数默认值都合规」。测试用
 * `node --experimental-strip-types` 跑源码，该模式只剥类型、**不编译 JSX**：
 * 一旦这些定义写在 `.tsx` 里，测试就 import 不了，那几条断言只能退回人眼。
 *
 * 所以分工是：`scene-catalog.ts` 存数据，`scene-<id>.tsx` 存视觉，两边靠
 * 场景 id 对应。代价是新增一个场景要动两处；换来的是「步骤定义可被断言」。
 *
 * 参数为什么只有三种取值
 * --------------------
 * 参数要能整份序列化：`04-frontend.md` 要求场景「可修改参数看变化」，而参数由
 * 播放器统一持有（场景只读不写），将来才可能进 URL 或存档。`string | number |
 * boolean` 是 JSON 里安全的那三类。不收对象与函数 —— 收了就要回答
 * 「怎么判断两个对象参数相等」，而播放器的「重置」与环境对比都依赖相等判断。
 *
 * 参数编辑为什么不放进本类型
 * ------------------------
 * 只给 `setParam` 一个写入口，不给「参数清单」。参数是文本、滑块还是开关，
 * 每个场景差别很大（`system` 消息要文本框、`topK` 要滑块、`stream` 要开关），
 * 统一成一份声明式描述反而要写更多适配代码。场景自己渲染控件、只通过
 * `setParam` 回报，值仍然只有播放器一处持有。
 */

import type { SceneId } from "@/lib/agent/scene-ids";

/** 场景可交互参数的取值。 */
export type SceneParamValue = string | number | boolean;

/** 一份完整的参数快照（含用户改过的值）。 */
export type SceneParams = Record<string, SceneParamValue>;

/**
 * 一个场景的动画步骤。
 *
 * 权威出处是 `agent-prompts/references/module-specs.md` 每个模块的
 * 「3. 可视化 → 动画步骤」逐条，不在这里另起一套。
 */
export interface SceneStep {
  /** 场景内唯一的步骤 id，用作 React key 与测试里的定位锚点。 */
  id: string;
  /** 该步在步骤列表里显示的短标题。 */
  title: string;
  /** 该步的解说（学生在不看动画时也能读懂这一步在讲什么）。 */
  description: string;
  /** 该步时长（毫秒，按 `speed: 1` 计）。播放器按它推进；变速是除以倍率。 */
  durationMs: number;
}

/**
 * 场景目录里**一条记录的内容**。
 *
 * 不含 `id` 与 `title`：这两项分别由目录的键与 `SCENE_LABELS` 给出。
 * 少抄一份就少一处会漂移的地方 —— `id` 抄错会让组件找不到场景，
 * `title` 抄错会让同一场景在两处显示不同名字。
 */
export type SceneContent = Pick<SceneDefinition, "steps" | "defaultParams">;

/** 一个场景的完整定义（数据侧，不含任何 JSX）。 */
export interface SceneDefinition {
  id: SceneId;
  /** 中文场景名，取自 `SCENE_LABELS`。 */
  title: string;
  steps: SceneStep[];
  /** 可交互参数的初值；「重置」回到的就是这一份。 */
  defaultParams: SceneParams;
}

/**
 * 渲染一个场景需要的全部输入。
 *
 * 场景组件是**受控的**：自己不持有 `stepIndex` 与参数，全部从 props 拿。
 * 这样播放器的暂停/前进/后退/重置/变速对 9 个场景是同一套语义，不会出现
 * 「某个场景自己实现了一遍播放、手感和别的场景不一样」。
 */
export interface SceneProps {
  /** 当前处于第几步（0 基）。场景需要自己处理 `stepIndex >= steps.length`。 */
  stepIndex: number;
  /**
   * 当前步骤的标题，由舞台从目录里取好传下来。
   *
   * 为什么不给场景整份 `steps`：场景要显示的只有「当前这一步叫什么」，
   * 而步骤列表已经在播放器面板上完整列出了。给整份数据会让场景有机会
   * 自己算「第几步」，与播放器的推进出现两份判断。
   */
  caption: string;
  params: SceneParams;
  setParam: (key: string, value: SceneParamValue) => void;
}
