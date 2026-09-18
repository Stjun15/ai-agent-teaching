"use client";

import { MASTERY_MAX_SCORE } from "@/lib/scores";

/**
 * 掌握度趋势折线（手写 SVG，零新增依赖）
 *
 * 为什么不装图表库
 * -------------
 * 全站只有这一处画图，而且只是一条折线。引一个图表库要多几百 KB 客户端包、
 * 一套自己的主题系统（还得跟本项目的明暗变量对齐）、以及一次图表库版本升级
 * 的风险。手写 SVG 的代价是这里 100 行左右，收益是它天然用 CSS 变量着色、
 * 跟着 `dark` class 走、以及**可测试**（见下）。
 *
 * 坐标计算抽成纯函数
 * ----------------
 * `buildTrendPoints` 是纯函数：给一串分数和画布尺寸，返回每个点的像素坐标。
 * 这样「单点会不会退化、越界分数会不会画到框外」这类问题可以在 Node 里断言，
 * 而不是靠肉眼看图（肉眼对 1 像素的偏差是不可靠的）。
 *
 * 为什么要额外给屏幕阅读器一段文字
 * -----------------------------
 * SVG 折线对读屏软件等于不存在。所以坐标轴之外再挂一个 `sr-only` 的列表，
 * 把「哪一天多少分」逐条读出来 —— 图表是给眼睛的，但信息不能只有眼睛能拿到。
 */

export interface TrendPoint {
  /** `YYYY-MM-DD`。 */
  date: string;
  /** 0~5（`mastery.score` 的量纲，见 `src/lib/scores.ts`）。 */
  score: number;
}

/** 画布尺寸与内边距（视图坐标，`svg` 用 `viewBox` 缩放）。 */
const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 16;

export interface PlottedPoint {
  x: number;
  y: number;
  score: number;
  date: string;
}

/**
 * 把趋势点换算成视图坐标。
 *
 * x 按**序号**均分而不是按日期：掌握度是「每次回顾后更新」的，日期间隔本身
 * 不代表学习的节奏。按日期铺开会把「隔了三天补测一次」画成一段很长的平线，
 * 读起来像「三天没进步」，而事实是那三天没有数据。
 */
export function buildTrendPoints(
  points: readonly TrendPoint[],
): PlottedPoint[] {
  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;

  return points.map((point, index) => {
    // 单点时除以 0 会得到 NaN，所以分母兜底为 1：单点就画在左端。
    const step = points.length > 1 ? index / (points.length - 1) : 0;
    const ratio = Math.min(Math.max(point.score / MASTERY_MAX_SCORE, 0), 1);
    return {
      x: PADDING + step * innerWidth,
      y: HEIGHT - PADDING - ratio * innerHeight,
      score: point.score,
      date: point.date,
    };
  });
}

/** 折线的 `d` 属性；点不足 2 个时返回空串（单点只画圆，不画线）。 */
export function trendPathD(plotted: readonly PlottedPoint[]): string {
  if (plotted.length < 2) return "";
  return plotted
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}

export function TrendChart({ points }: { points: readonly TrendPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        还没有掌握度记录。完成一次「校验点评」后这里会出现趋势线。
      </p>
    );
  }

  const plotted = buildTrendPoints(points);
  const last = points[points.length - 1];

  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`掌握度趋势，共 ${points.length} 个数据点，最新 ${last.date} 为 ${last.score} 分（满分 ${MASTERY_MAX_SCORE}）`}
        className="h-32 w-full text-primary"
      >
        {/* 上限与下限参考线：没有它们，折线的高低看不出量纲 */}
        <line
          x1={PADDING}
          y1={PADDING}
          x2={WIDTH - PADDING}
          y2={PADDING}
          className="stroke-border"
          strokeDasharray="3 3"
        />
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
          className="stroke-border"
        />

        <path
          d={trendPathD(plotted)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {plotted.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r={3}
            fill="currentColor"
          />
        ))}

        <text
          x={PADDING}
          y={PADDING - 5}
          className="fill-muted-foreground text-[9px]"
        >
          {MASTERY_MAX_SCORE}
        </text>
        <text
          x={PADDING}
          y={HEIGHT - PADDING + 11}
          className="fill-muted-foreground text-[9px]"
        >
          0
        </text>
        <text
          x={WIDTH - PADDING}
          y={HEIGHT - PADDING + 11}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          {last.date}
        </text>
      </svg>

      {/* 读屏用：把图上的信息逐条读出来，而不是只给一句「一张图」。 */}
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.date}>
            {point.date}：{point.score} 分
          </li>
        ))}
      </ul>

      <figcaption className="text-[11px] text-muted-foreground tabular-nums">
        共 {points.length} 天有记录 · 最新 {last.date}：{last.score} /{" "}
        {MASTERY_MAX_SCORE}
      </figcaption>
    </figure>
  );
}
