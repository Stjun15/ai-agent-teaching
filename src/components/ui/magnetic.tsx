"use client";

import {
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * 磁吸：鼠标靠近时，子元素朝指针方向轻微偏移（最多 1/4 距离），
 * 离开即回正。用于主行动按钮 —— 只做 4~8px 的位移，不做缩放。
 *
 * 位移写在 `transform` 上，不参与布局；`transition` 让回正有惯性，
 * 而不是硬切。触摸设备没有 hover，指针类型不是 mouse 时完全不响应。
 */
export function Magnetic({
  children,
  className = "",
  strength = 0.25,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const offsetX = (event.clientX - (rect.left + rect.width / 2)) * strength;
    const offsetY = (event.clientY - (rect.top + rect.height / 2)) * strength;
    element.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  };

  const reset = () => {
    if (ref.current) ref.current.style.transform = "translate3d(0, 0, 0)";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`inline-flex transition-transform duration-200 ease-out motion-reduce:transition-none ${className}`}
    >
      {children}
    </div>
  );
}
