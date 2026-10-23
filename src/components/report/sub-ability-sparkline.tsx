/**
 * 子能力成长曲线（迷你折线，手写 SVG）
 *
 * 为什么不复用 `trend-chart.tsx`
 * ---------------------------
 * 那一个是「报告主图」：带坐标轴、日期标签、读屏列表，尺寸 320×120。
 * 六项能力各要一条 96×24 的缩略线，塞进同一行列表里 —— 主图的字号与
 * 留白在这个尺寸下会糊成一片。两者共享的只有「0~5 分映射到高度」这一件事，
 * 重复的也只有这几行坐标计算，比抽一套「能同时服务大图与小图」的参数化
 * 组件便宜。
 *
 * 为什么曲线是「按序号均分」而不是按日期
 * ------------------------------------
 * 与主图同一口径（见 `trend-chart.tsx`）：掌握度是按事件更新的，日期间隔
 * 不代表学习节奏；按日期铺开会把「隔了三天补测一次」画成长长的平线。
 *
 * 信息不全靠图
 * -----------
 * SVG 对读屏软件等于不存在。这里只画线，**首测→当前的变化量由父组件用
 * 文字写出**（`report-sections.tsx`），所以本组件对辅助技术整体 `aria-hidden`。
 */

import { MASTERY_MAX_SCORE } from "@/lib/scores";
import type { ReportSubAbilityTrendPoint } from "@/schemas/report";

const WIDTH = 96;
const HEIGHT = 24;
const PADDING = 3;

export interface SparklineCoord {
  x: number;
  y: number;
  score: number;
  date: string;
}

/**
 * 把趋势点换算成视图坐标（纯函数，便于在 Node 里断言边界）。
 * 单点时光标固定在左端：分母兜底为 1，避免除 0 得到 NaN 而整条线消失。
 */
export function buildSparklineCoords(
  points: readonly ReportSubAbilityTrendPoint[],
  width: number = WIDTH,
  height: number = HEIGHT,
  padding: number = PADDING,
): SparklineCoord[] {
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return points.map((point, index) => {
    const step = points.length > 1 ? index / (points.length - 1) : 0;
    const ratio = Math.min(Math.max(point.score / MASTERY_MAX_SCORE, 0), 1);
    return {
      x: padding + step * innerWidth,
      y: height - padding - ratio * innerHeight,
      score: point.score,
      date: point.date,
    };
  });
}

/** 折线的 `d`；点不足 2 个时返回空串（单点只画圆，不画线）。 */
export function sparklinePathD(coords: readonly SparklineCoord[]): string {
  if (coords.length < 2) return "";
  return coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x} ${coord.y}`)
    .join(" ");
}

export function SubAbilitySparkline({
  points,
}: {
  points: readonly ReportSubAbilityTrendPoint[];
}) {
  if (points.length === 0) return null;

  const coords = buildSparklineCoords(points);
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden
      focusable="false"
      className="h-6 w-24 shrink-0 text-primary"
    >
      <path
        d={sparklinePathD(coords)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill="currentColor" />
    </svg>
  );
}
