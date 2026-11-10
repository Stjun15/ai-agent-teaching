"use client";

import { useEffect, useRef } from "react";

/**
 * 星月夜笔触场。
 *
 * 关键不是「一圈圈带子」，而是**短笔触**：《星月夜》的天上是无数截短促的
 * 断续油彩，顺着同一条流向排开 —— 远看是波，近看全是断笔。
 * 所以这里的每一圈只画一条细折线，再用 `stroke-dasharray` 切成一截截；
 * 相邻圈用不同的虚线节奏，断口就不会连成栅栏。
 *
 * 笔触必须细（1.4~3.2 单位，视框 440 宽）。粗到十几单位就成了丝带 ——
 * 那是「大色块」而非笔触，也正是上一版压住正文的原因。
 *
 * 颜色取自那张画：钴蓝/群青、浅蓝、星月的奶黄，全部换成 oklch，
 * 饱和度压在 0.11 以内 —— 是夜空，不是荧光。
 *
 * 路径只定义一次（`StripeSprite`），各片用 `<use>` 引用：
 * 整页十来片纹理，若各内联一份几何，光 HTML 就多出上百 KB。
 *
 * 鼠标跟随：每片用不同的 depth 各自位移，指针移动时产生轻微视差。
 * 位移只写 transform（合成层，不触发重排），全程不 setState；
 * 只在「精确指针 + 允许动效」时挂监听，触摸设备与减少动效时完全不响应。
 */

/**
 * 几何定义处：整页渲染一次即可。宽高为 0，不占布局、不进无障碍树，
 * 但仍然参与文档树，所以别处的 `url(#…)` / `<use href="#…">` 都能解析到。
 */
export function StripeSprite() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      className="pointer-events-none absolute overflow-hidden"
    >
      <defs>
        {/* 中心略带暖、外围冷：星月的黄从漩涡核心往外散，越外越接近钴蓝 */}
        <radialGradient
          id="sky-night"
          gradientUnits="userSpaceOnUse"
          cx="222"
          cy="156"
          r="250"
        >
          <stop offset="0" stopColor="oklch(0.78 0.055 95)" />
          <stop offset="0.14" stopColor="oklch(0.72 0.085 218)" />
          <stop offset="0.4" stopColor="oklch(0.6 0.1 252)" />
          <stop offset="0.7" stopColor="oklch(0.47 0.105 262)" />
          <stop offset="1" stopColor="oklch(0.33 0.09 268)" />
        </radialGradient>
        <radialGradient
          id="sky-glow"
          gradientUnits="userSpaceOnUse"
          cx="222"
          cy="156"
          r="250"
        >
          <stop offset="0" stopColor="oklch(0.84 0.05 96)" />
          <stop offset="0.3" stopColor="oklch(0.76 0.055 98)" />
          <stop offset="0.75" stopColor="oklch(0.62 0.075 300)" />
          <stop offset="1" stopColor="oklch(0.42 0.1 285)" />
        </radialGradient>
        <linearGradient
          id="sky-cypress-body"
          gradientUnits="userSpaceOnUse"
          x1="60"
          y1="6"
          x2="60"
          y2="556"
        >
          <stop
            offset="0"
            stopColor="oklch(0.34 0.05 272)"
            stopOpacity="0.25"
          />
          <stop
            offset="0.35"
            stopColor="oklch(0.3 0.07 268)"
            stopOpacity="0.8"
          />
          <stop offset="1" stopColor="oklch(0.24 0.06 264)" stopOpacity="1" />
        </linearGradient>

        <symbol id="sky-rings" viewBox="0 0 440 320">
          {FLOW.map((ring, index) => (
            <path
              key={ring.d}
              d={ring.d}
              fill="none"
              stroke={`url(#${index % 5 === 1 ? "sky-glow" : "sky-night"})`}
              strokeWidth={ring.width}
              strokeLinecap="round"
              strokeDasharray={ring.dash}
              opacity={ring.opacity}
            />
          ))}

          {/* 漩涡核心：几段向内收紧的螺旋，笔触最密的地方 */}
          {SWIRLS.map((swirl) => (
            <path
              key={swirl.d}
              d={swirl.d}
              fill="none"
              stroke="url(#sky-night)"
              strokeWidth={swirl.width}
              strokeLinecap="round"
              strokeDasharray={swirl.dash}
              opacity={swirl.opacity}
            />
          ))}

          {/* 星：奶黄的实心点 + 三圈同样断续的光晕 */}
          {STARS.map((star) => (
            <g key={`${star.cx}-${star.cy}`}>
              {star.halos.map((halo, i) => (
                <circle
                  key={halo.r}
                  cx={star.cx}
                  cy={star.cy}
                  r={halo.r}
                  fill="none"
                  stroke="oklch(0.9 0.07 94)"
                  strokeWidth={1 + i * 0.3}
                  strokeDasharray={halo.dash}
                  opacity={halo.opacity}
                />
              ))}
              <circle
                cx={star.cx}
                cy={star.cy}
                r={star.r}
                fill="oklch(0.95 0.05 96)"
                opacity={0.92}
              />
            </g>
          ))}
        </symbol>

        <symbol id="sky-cypress" viewBox="0 0 120 560">
          <path d={CYPRESS.body} fill="url(#sky-cypress-body)" />
          {/* 笔触内的高光条：比主体亮一档，暗示分量与走向 */}
          {CYPRESS.strokes.map((stroke) => (
            <path
              key={stroke}
              d={stroke}
              fill="oklch(0.5 0.07 258)"
              opacity={0.22}
            />
          ))}
        </symbol>
      </defs>
    </svg>
  );
}

/** 边缘羽化：笔触在画布边界之前先淡出，整片与页面底色融成一体，看不出矩形边缘。 */
const EDGE_FADE =
  "radial-gradient(closest-side, rgb(0 0 0 / 1) 54%, rgb(0 0 0 / 0.5) 78%, rgb(0 0 0 / 0) 100%)";

/** 柏树是竖向的，羽化改为上下淡出 —— 用径向会让树梢和树根一起消失。 */
const BAND_FADE =
  "linear-gradient(to bottom, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 1) 18%, rgb(0 0 0 / 1) 74%, rgb(0 0 0 / 0) 100%)";

export function StripeField({
  className = "",
  depth = 1,
  rotate = 0,
}: {
  className?: string;
  depth?: number;
  rotate?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const paint = () => {
      frame = 0;
      currentX += (targetX - currentX) * 0.09;
      currentY += (targetY - currentY) * 0.09;
      svg.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      if (
        Math.abs(targetX - currentX) > 0.08 ||
        Math.abs(targetY - currentY) > 0.08
      ) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      targetX = (event.clientX / window.innerWidth - 0.5) * 28 * depth;
      targetY = (event.clientY / window.innerHeight - 0.5) * 20 * depth;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [depth]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        maskImage: EDGE_FADE,
        WebkitMaskImage: EDGE_FADE,
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 440 320"
        fill="none"
        className="w-full will-change-transform"
      >
        <use href="#sky-rings" />
      </svg>
    </div>
  );
}

/**
 * 柏树：画里那道从地平线直插夜空的纵向暗柱。
 *
 * 它不是一条线，是一束有宽窄的笔触 —— 顶端收成尖，腰腹最宽，
 * 边缘靠两条正弦错开，所以看上去是「被风吹斜的一团墨」而不是柱子。
 *
 * 只穿插在波纹区里，透明度压得很低：作用是打断横向流向的均质感。
 */
export function CypressBand({
  className = "",
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={{
        transform: flip ? "scaleX(-1)" : undefined,
        maskImage: BAND_FADE,
        WebkitMaskImage: BAND_FADE,
      }}
    >
      <svg viewBox="0 0 120 560" fill="none" className="h-full w-full">
        <use href="#sky-cypress" />
      </svg>
    </div>
  );
}

/** 极坐标取点：半径按三条正弦起伏，横向略压扁，像手画的椭圆而非正圆。 */
function pointOnRing(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  phase: number,
) {
  const wobble =
    1 +
    0.075 * Math.sin(3 * angle + phase) +
    0.04 * Math.sin(5 * angle - phase * 1.4) +
    0.018 * Math.sin(9 * angle + phase * 2.1);
  return {
    x: cx + Math.cos(angle) * radius * wobble * 1.12,
    y: cy + Math.sin(angle) * radius * wobble * 0.82,
  };
}

/** 一圈流向线：一条细折线，留一道小缺口（像一笔没绕回来）。 */
function flowPath(
  cx: number,
  cy: number,
  radius: number,
  phase: number,
  gap: number,
) {
  const steps = 64;
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = gap * 0.5 + (i / steps) * (Math.PI * 2 - gap);
    const p = pointOnRing(cx, cy, radius, angle, phase);
    points.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }

  return `M${points.join("L")}`;
}

/** 一段向内收紧的螺旋：漩涡中心那种「卷进去」的地方。 */
function spiralPath(
  cx: number,
  cy: number,
  from: number,
  to: number,
  phase: number,
  turns: number,
) {
  const steps = 90;
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const radius = from + (to - from) * t;
    const angle = phase + t * Math.PI * 2 * turns;
    const p = pointOnRing(cx, cy, radius, angle, phase + t * 3);
    points.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }

  return `M${points.join("L")}`;
}

/** 断笔节奏：相邻圈错开，断口才不会连成栅栏。 */
const DASHES = ["13 4", "8 3", "19 5", "6 2.5", "11 3.5", "24 6"];

/**
 * 在模块加载时算一次：纯函数、无随机，
 * 服务端与客户端结果完全一致，不会水合错位。
 */
function buildFlow(index: number) {
  // 圆心逐圈漂移 + 半径不等距，避免画成同心圆靶子
  const cx = 222 + Math.sin(index * 0.8) * 14;
  const cy = 156 + Math.cos(index * 0.55) * 9;
  const radius = 12 + index * 11.4 + (index % 3) * 2.2;

  return {
    d: flowPath(cx, cy, radius, index * 0.44, 0.5 + (index % 4) * 0.12),
    width: 1.4 + (index % 4) * 0.55,
    dash: DASHES[index % DASHES.length],
    opacity: 0.34 + ((index * 29) % 46) / 100,
  };
}

function buildSwirl(cx: number, cy: number, from: number, turns: number) {
  return {
    d: spiralPath(cx, cy, from, from * 0.16, turns * 1.7, turns),
    width: 1.3,
    dash: DASHES[Math.abs(Math.round(cx)) % DASHES.length],
    opacity: 0.5,
  };
}

/** 光晕：绕星心两三圈断续的细环，比纯描边更像颜料堆出来的发散光。 */
function buildStar(index: number) {
  const cx = 118 + ((index * 137) % 250);
  const cy = 54 + ((index * 103) % 210);

  return {
    cx,
    cy,
    r: 1.5 + (index % 3) * 0.8,
    halos: [7, 12, 18].map((base, halo) => ({
      r: base + index * 1.2,
      dash: DASHES[(index + halo) % DASHES.length],
      opacity: 0.32 - halo * 0.06,
    })),
  };
}

/**
 * 柏树的轮廓：从树梢（t=0）一路加宽到根部（t=1），
 * 宽度用 0.55 次幂撑开 —— 直上直下会变成柱子，幂次小一点才有「火焰」的收势。
 */
function cypressPath() {
  const steps = 34;
  const top = 6;
  const bottom = 554;
  const spine = 60;
  const half = 34;
  const left: string[] = [];
  const right: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = top + (bottom - top) * t;
    const waist = half * (0.08 + 0.92 * Math.pow(t, 0.55));
    const swell = 1 + 0.16 * Math.sin(t * Math.PI);
    const sway = Math.sin(t * 5.2 + 0.6) * 7 + Math.sin(t * 11.5 - 0.9) * 2.6;
    left.push(`${(spine + sway - waist * swell).toFixed(1)} ${y.toFixed(1)}`);
    right.push(`${(spine + sway + waist * swell).toFixed(1)} ${y.toFixed(1)}`);
  }

  return `M${left.join("L")}L${right.reverse().join("L")}Z`;
}

/** 树身里的三道走向笔触：比主体窄得多，沿着主干扭动。 */
function cypressStroke(offset: number, width: number, start: number) {
  const steps = 22;
  const left: string[] = [];
  const right: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = start + (0.92 - start) * (i / steps);
    const y = 6 + 548 * t;
    const sway = Math.sin(t * 5.2 + 0.6) * 7 + Math.sin(t * 11.5 - 0.9) * 2.6;
    const x = 60 + sway + offset * (0.3 + 0.7 * t);
    left.push(`${(x - width).toFixed(1)} ${y.toFixed(1)}`);
    right.push(`${(x + width).toFixed(1)} ${y.toFixed(1)}`);
  }

  return `M${left.join("L")}L${right.reverse().join("L")}Z`;
}

const FLOW = Array.from({ length: 20 }, (_, index) => buildFlow(index));
const SWIRLS = [
  buildSwirl(214, 148, 66, 1.45),
  buildSwirl(310, 96, 38, 1.2),
  buildSwirl(146, 214, 30, 1.1),
];
const STARS = Array.from({ length: 5 }, (_, index) => buildStar(index));

const CYPRESS = {
  body: cypressPath(),
  strokes: [
    cypressStroke(-11, 2.6, 0.16),
    cypressStroke(2, 3.4, 0.1),
    cypressStroke(13, 2.2, 0.24),
  ],
};
