"use client";

import { useEffect, useRef } from "react";

// 手写坐标，不生成随机数：左半稀疏像星座，右半较密像电路，整体故意不对称。
// 坐标写死还有一个好处 —— 服务端与客户端渲染出来的图形完全一致，不会水合错位。
const NODES: ReadonlyArray<readonly [number, number]> = [
  [38, 42],
  [104, 78],
  [78, 132],
  [166, 58],
  [196, 118],
  [248, 34],
  [268, 150],
  [330, 92],
  [372, 46],
  [386, 140],
  [440, 72],
  [486, 30],
  [500, 122],
  [552, 88],
];

const LINKS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 3],
  [1, 2],
  [1, 3],
  [3, 4],
  [2, 4],
  [3, 5],
  [4, 6],
  [5, 6],
  [5, 7],
  [6, 7],
  [7, 8],
  [7, 10],
  [8, 9],
  [9, 10],
  [10, 12],
  [8, 11],
  [11, 12],
  [11, 13],
  [12, 13],
];

/**
 * 不规则节点网络：一块不对称的线框图形，用鼠标做轻微视差。
 *
 * 用在深色区块当背景层（宿主 `relative overflow-hidden`，内容 `relative z-10`）：
 *   <WireNet className="absolute inset-0" />
 *
 * 位移上限只有 ±9px，且只写 `transform`；`prefers-reduced-motion` 或
 * 触摸设备下完全不挂监听，图形保持静止。
 */
export function WireNet({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    let frame = 0;
    let offsetX = 0;
    let offsetY = 0;

    const paint = () => {
      frame = 0;
      group.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      offsetX =
        ((event.clientX - (rect.left + rect.width / 2)) / rect.width) * 18;
      offsetY =
        ((event.clientY - (rect.top + rect.height / 2)) / rect.height) * 10;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 600 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={`pointer-events-none ${className}`}
    >
      <g ref={groupRef}>
        {LINKS.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={NODES[from][0]}
            y1={NODES[from][1]}
            x2={NODES[to][0]}
            y2={NODES[to][1]}
            strokeWidth={1}
            className="stroke-background/15"
          />
        ))}
        {NODES.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={index % 4 === 0 ? 2.6 : 1.6}
            className={
              index % 4 === 0 ? "fill-primary/70" : "fill-background/35"
            }
          />
        ))}
      </g>
    </svg>
  );
}
