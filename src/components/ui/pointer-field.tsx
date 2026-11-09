"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 指针场：在区块内跟随鼠标画一条十字准星，右下角给出等宽坐标读数。
 *
 * 它不是装饰图 —— 是「设计画布 / 编辑器」的语言，和全站等宽数字、
 * 1px 细线、主色节点同一套视觉体系，所以别的页面可以直接复用：
 *
 *   <PointerField className="…">内容</PointerField>
 *
 * 只在同时满足三件事时出现，缺一项这层就完全不存在：
 * 1. 精确指针（鼠标）—— 触摸与手写笔的 pointerType 不是 mouse，直接返回；
 * 2. 设备支持悬停 —— CSS `@media (hover: hover) and (pointer: fine)` 兜住，
 *    没有 hover 的设备连节点都不占位；
 * 3. 未开启「减少动态效果」—— 同一媒体查询里带 prefers-reduced-motion: no-preference。
 *
 * 性能：坐标只写 CSS transform（合成层，不触发 layout），读数文本在同一个
 * rAF 里直接改 textContent —— 全程不 setState，指针移动不会引起任何渲染。
 * 这一层 pointer-events-none + aria-hidden，不拦截点击、不进读屏。
 */
export function PointerField({
  children,
  backdrop,
  className = "",
}: {
  children: ReactNode;
  backdrop?: ReactNode;
  className?: string;
}) {
  const hostRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const hLineRef = useRef<HTMLDivElement>(null);
  const vLineRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      hLineRef.current?.style.setProperty(
        "transform",
        `translate3d(0, ${y}px, 0)`,
      );
      vLineRef.current?.style.setProperty(
        "transform",
        `translate3d(${x}px, 0, 0)`,
      );
      markerRef.current?.style.setProperty(
        "transform",
        `translate3d(${x}px, ${y}px, 0)`,
      );
      if (readoutRef.current) {
        const pad = (value: number) =>
          Math.round(value).toString().padStart(3, "0");
        readoutRef.current.textContent = `X ${pad(x)} · Y ${pad(y)}`;
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = host.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      if (layerRef.current) layerRef.current.style.opacity = "1";
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const onLeave = () => {
      if (layerRef.current) layerRef.current.style.opacity = "0";
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={hostRef} className={`relative ${className}`}>
      {backdrop ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          {backdrop}
        </div>
      ) : null}

      {children}

      <div
        ref={layerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 hidden overflow-hidden opacity-0 transition-opacity duration-300 [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:block"
      >
        <div
          ref={hLineRef}
          className="absolute inset-x-0 top-0 h-px bg-primary/25 will-change-transform"
        />
        <div
          ref={vLineRef}
          className="absolute inset-y-0 left-0 w-px bg-primary/25 will-change-transform"
        />
        <div
          ref={markerRef}
          className="absolute top-0 left-0 will-change-transform"
        >
          <span className="absolute -top-[3px] -left-[3px] block size-[7px] border border-primary bg-background" />
        </div>
        <span
          ref={readoutRef}
          className="absolute right-1 bottom-1 font-mono text-[10px] tracking-wide text-primary/70 tabular-nums"
        />
      </div>
    </section>
  );
}
