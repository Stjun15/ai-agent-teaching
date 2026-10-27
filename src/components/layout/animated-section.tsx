"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";

export function AnimatedSection({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    // reducedMotion="user"：跟随系统的「减少动态效果」设置，装饰性入场动画
    // 自动退化为直接显示（与 globals.css 的媒体查询同一条纪律）。
    //
    // 入场动画只动位移、不动透明度（2026-10-24 修）：`initial` 里的 `opacity: 0`
    // 会让整块内容在 `whileInView` 触发前不可见。公网实测过一次「一进来就把滚动条
    // 拖到底」——跳滚没有触发 whileInView，`#modules` 停在 `opacity:0`，课程大纲
    // （含「写在最前面」）整块看不见。内容可见性不能押在滚动事件上。
    <MotionConfig reducedMotion="user">
      <motion.div
        id={id}
        initial={{ y: 16 }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={className}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

export function AnimatedGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className={className}>
        {Array.isArray(children)
          ? children.map((child, i) => (
              <motion.div
                key={i}
                initial={{ y: 12 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.35,
                  delay: i * 0.06,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                {child}
              </motion.div>
            ))
          : children}
      </div>
    </MotionConfig>
  );
}
