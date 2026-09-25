"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

export function AnimatedSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {child}
            </motion.div>
          ))
        : children}
    </div>
  );
}