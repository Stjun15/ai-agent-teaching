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
    <MotionConfig reducedMotion="user">
      <motion.div
        id={id}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
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
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
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
