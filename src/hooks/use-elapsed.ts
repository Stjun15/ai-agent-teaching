"use client";

/**
 * useElapsed —— 计一条「已等待多少秒」的计时器
 *
 * 为什么需要它（2026-09-19，零基础走查 P2）
 * ----------------------------------------
 * 真实模型一次讲解 / 批改要等 20~40 秒，此前界面上只有一行静态小字
 * （「模型正在输出」/「正在批改」）——没有时间参照的等待最难熬：学生
 * 不知道它是「在干活」还是「卡死了」，最有价值的提问「我该等多久」
 * 没有任何地方回答。让秒数自己走起来，就是在回答这个问题。
 *
 * 实现约束
 * -------
 * - 只在 `active` 为 true 时走表，停下时把读数留在原地（学生能看到
 *   「这次讲了 38 秒」，本身也是有用的信息）；
 * - 重置到 0 而不是从挂载开始累计：连续两轮对话，第二轮不该从 40 秒
 *   接着跳；
 * - `setInterval` 1s 足够，不要更密 —— 这是给人看的粗粒度反馈。
 */
import { useEffect, useState } from "react";

export function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  // active 翻转时清零：在**渲染期**调整状态（React 官方推荐模式，
  // react-hooks/new-rule 明确要求别在 effect 里同步 setState）。
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (active) setSeconds(0);
  }

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  return seconds;
}
