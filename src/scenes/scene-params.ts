/**
 * 参数读取 —— 把 `SceneParams` 里的值安全地收窄成具体类型
 *
 * 为什么不让场景自己 `as string`
 * ---------------------------
 * `params` 的类型是 `Record<string, string | number | boolean>`，取值时静态类型
 * 是「三选一或 undefined」。场景里直接断言 `params.topK as number` 看着省事，
 * 但参数是**唯一一个会从组件外部进来的输入**（现在由播放器持有，将来要能从
 * 存档或链接恢复），脏值的可能性是真实的。断言把这个风险从「显示不对」升级成
 * 「拿到 undefined 当数字用」，再往后就是 `NaN` 出现在检索参数里。
 *
 * 所以每个取值都走一次收窄，收不到就用场景自己的默认值。函数名直白到不需要
 * 看实现：`paramString` 保证返回 string，`paramNumber` 保证返回有限数。
 *
 * 数值为什么还要夹范围
 * ----------------
 * `topK` 这类参数有物理边界（检索几条）。收窄只保证「是数字」，挡不住
 * `-3` 或 `1e9` —— 那会让界面按 10 亿条画格子。范围作为可选参数给出，
 * 由场景声明自己的边界，本文件不预设任何业务的合法区间。
 */

import type { SceneParams } from "./scene-types";

/** 取字符串参数；类型不对或缺失时用 `fallback`。 */
export function paramString(
  params: SceneParams,
  key: string,
  fallback: string,
): string {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

/**
 * 取数值参数；类型不对、缺失、或不是有限数时用 `fallback`。
 *
 * 给了 `range` 就顺便夹回区间内。`NaN` 单独挡一次：`typeof NaN === "number"`
 * 为真，但 `NaN` 参与任何比较都是 `false`，夹回区间那步也拦不住它。
 */
export function paramNumber(
  params: SceneParams,
  key: string,
  fallback: number,
  range?: { min: number; max: number },
): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (range === undefined) return value;
  return Math.min(range.max, Math.max(range.min, value));
}

/** 取开关参数；类型不对或缺失时用 `fallback`。 */
export function paramBool(
  params: SceneParams,
  key: string,
  fallback: boolean,
): boolean {
  const value = params[key];
  return typeof value === "boolean" ? value : fallback;
}
