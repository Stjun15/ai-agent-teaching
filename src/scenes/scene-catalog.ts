/**
 * 场景目录 —— 9 个可视化场景的步骤定义（**纯数据**，不含 JSX）
 *
 * 为什么不写成 `Record<SceneId, SceneDefinition>`
 * -------------------------------------------
 * 那样从第一个场景开始就要求 9 个齐全，而场景是一个一个交付的。这里用
 * `satisfies Partial<Record<SceneId, SceneContent>>`：键必须是合法场景 id
 * （键名拼错立即编译报错），但允许**先缺着**，缺的那个在界面上显示
 * 「场景待交付」而不是给一个能点却没反应的播放按钮。
 *
 * 为什么用 `satisfies` 而不是 `:` 类型标注
 * --------------------------------------
 * `satisfies` 会保留字面量键的联合类型。`scene-stage.tsx` 里的组件映射正是
 * 用它约束的：`keyof typeof SCENE_CATALOG` 只包含**已注册**的场景，
 * 于是「目录里加了场景却忘了写组件」会直接编译失败，不必靠人记。
 * 换成 `:` 标注会把键 widen 成 `SceneId`，这道检查就没了。
 *
 * 为什么还要一份 `LOOKUP`
 * ---------------------
 * 上面那个「保留字面量键」的代价，是这个常量的类型就是它自己的字面量类型 ——
 * 目录为空时它是 `{}`，用任意场景 id 去索引都会报「不能用该键索引 `{}`」。
 * 写入侧要的是窄类型（编译期查错），读取侧要的是宽类型（运行时查表），
 * 两者需求相反，所以显式并存：`SCENE_CATALOG` 给写入与 `keyof` 用，
 * `LOOKUP` 给查表用。
 *
 * 顺序由 `SCENE_IDS` 决定，不由本文件的书写顺序决定
 * ---------------------------------------------
 * `listSceneDefinitions()` 按 `SCENE_IDS` 过滤，所以界面上的场景顺序与
 * `01-teaching-system.md` 的表格一致。在这里调整条目位置不会改到界面顺序，
 * 也就不会出现「看着像排好了、其实界面上是另一个顺序」。
 */

import { SCENE_IDS, SCENE_LABELS, isSceneId } from "@/lib/agent/scene-ids";
import type { SceneId } from "@/lib/agent/scene-ids";
import type { SceneContent, SceneDefinition } from "./scene-types";

/** 写入侧视图：键必须是合法场景 id，值必须结构完整。 */
export const SCENE_CATALOG = {} satisfies Partial<
  Record<SceneId, SceneContent>
>;

/** 读取侧视图：查表用，允许任意键查空。 */
const LOOKUP: Partial<Record<SceneId, SceneContent>> = SCENE_CATALOG;

/**
 * 按 id 取场景定义；id 不是合法场景、或该场景尚未交付时返回 `undefined`。
 *
 * 返回 `undefined` 而不是抛错：调用方（播放器）要把「这个场景还没有」显示成
 * 一句诚实的话。抛错会把「某个场景没写完」升级成「整个模块页打不开」，
 * 代价完全不对等。
 */
export function getSceneDefinition(
  id: string | null,
): SceneDefinition | undefined {
  if (id === null || !isSceneId(id)) return undefined;
  const content = LOOKUP[id];
  if (content === undefined) return undefined;
  return { id, title: SCENE_LABELS[id], ...content };
}

/** 已交付的场景定义，按 `SCENE_IDS` 的权威顺序。 */
export function listSceneDefinitions(): SceneDefinition[] {
  return SCENE_IDS.map((id) => getSceneDefinition(id)).filter(
    (definition): definition is SceneDefinition => definition !== undefined,
  );
}
