"use client";

import { useEffect, useRef } from "react";

// 点阵间距、鼠标影响半径、最大推离距离（px）
const SPACING = 26;
const RADIUS = 130;
const PUSH = 20;

type Dot = { homeX: number; homeY: number; x: number; y: number };

/**
 * 点阵力场：一层 2px 的点阵，鼠标靠近时被推开并点亮成主色，离开后回弹。
 *
 * 这不是背景图，是「场」——和全站等宽数字、1px 细线是同一套工程语言，
 * 所以任何页面都能当背景铺：`<GridField className="absolute inset-0" />`
 * （宿主记得 `relative` + 内容 `relative z-10`）。
 *
 * 性能与降级：
 * - dots 全部静态缓存，每帧只做一次 lerp 与 fillRect，位移用不到 1ms；
 * - 点阵静止时自动停掉 rAF，指针一动再启动（不空转）；
 * - `prefers-reduced-motion` 下只画一帧静态点阵，不挂任何指针监听；
 * - 触摸设备没有 hover，点阵保持静止（pointerType 不是 mouse 直接返回）。
 */
export function GridField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const styles = window.getComputedStyle(canvas);
    const baseColor =
      styles.getPropertyValue("--muted-foreground").trim() || "#888888";
    const hotColor = styles.getPropertyValue("--primary").trim() || baseColor;

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let pointerX = -9999;
    let pointerY = -9999;
    let frame = 0;

    const render = () => {
      context.clearRect(0, 0, width, height);
      for (const dot of dots) {
        const distance = Math.hypot(dot.x - pointerX, dot.y - pointerY);
        const near = distance < RADIUS ? 1 - distance / RADIUS : 0;
        // 越近越亮、越大；远处是 2px 的淡点，近处是 3px 的主色点
        const size = near > 0.05 ? 3 : 2;
        context.globalAlpha = 0.14 + near * 0.86;
        context.fillStyle = near > 0.02 ? hotColor : baseColor;
        context.fillRect(dot.x - size / 2, dot.y - size / 2, size, size);
      }
      context.globalAlpha = 1;
    };

    const step = () => {
      frame = 0;
      let moving = false;
      for (const dot of dots) {
        let targetX = dot.homeX;
        let targetY = dot.homeY;
        const dx = dot.homeX - pointerX;
        const dy = dot.homeY - pointerY;
        const distance = Math.hypot(dx, dy);
        if (distance < RADIUS && distance > 0.01) {
          const force = (1 - distance / RADIUS) * PUSH;
          targetX += (dx / distance) * force;
          targetY += (dy / distance) * force;
        }
        const nextX = dot.x + (targetX - dot.x) * 0.2;
        const nextY = dot.y + (targetY - dot.y) * 0.2;
        if (
          Math.abs(targetX - nextX) > 0.08 ||
          Math.abs(targetY - nextY) > 0.08
        ) {
          moving = true;
        }
        dot.x = nextX;
        dot.y = nextY;
      }
      render();
      if (moving) frame = window.requestAnimationFrame(step);
    };

    const kick = () => {
      if (!frame) frame = window.requestAnimationFrame(step);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = SPACING / 2; y < height; y += SPACING) {
        for (let x = SPACING / 2; x < width; x += SPACING) {
          dots.push({ homeX: x, homeY: y, x, y });
        }
      }
      render();
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !fineQuery.matches) return;
      const rect = canvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      kick();
    };

    const onLeave = () => {
      pointerX = -9999;
      pointerY = -9999;
      kick();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    if (!reduceQuery.matches) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerleave", onLeave);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none h-full w-full ${className}`}
    />
  );
}
