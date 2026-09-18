"use client";

/**
 * 打字机 —— 「AI 正在逐字回复」这个效果
 *
 * 为什么单独成文件而不是塞进 `scene-parts.tsx`
 * -----------------------------------------
 * 它是唯一一个**自己会走时间**的零件（其余的出场动画都交给 CSS）。会走时间的
 * 东西值得单独看一眼、单独改：播放器的「暂停」管不到它，所以它的时长必须自己
 * 有上限（见下）。
 *
 * 重置靠重挂，不靠在 effect 里 setState
 * --------------------------------
 * 外层壳子只做一件事：把 `key` 设成文本。文本一变，内层整体重挂，「已显示
 * 字数」自然回到 0。若改成在 effect 开头 `setShown(0)` 同步重置，
 * `react-hooks/set-state-in-effect` 会拦下 —— 那是故意的，同步 setState 会
 * 触发一次级联渲染。而把重置做在 `key` 上，连「什么时候该重置」都不必判断。
 *
 * 逐字推进用递归 `setTimeout` 而不是 `setInterval`：文本长度不定，递归调度在
 * 卸载时只需清一个定时器，不会漏。
 *
 * 长文本自动加速
 * ------------
 * 一段 60 字的回复按 45ms/字要 2.7 秒，而播放器已按步骤时长走到了下一步 ——
 * 现象是「话还没说完就被换掉了」。所以给整段设一个时长上限（默认 1.4 秒），
 * 按文本长度反推每字间隔，保证打字机总是打得完。
 */

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function Typewriter({
  text,
  speedMs = 45,
  maxMs = 1400,
  className,
}: {
  text: string;
  /** 每字间隔（毫秒），会被 `maxMs` 压缩。 */
  speedMs?: number;
  /** 整段上限（毫秒）。 */
  maxMs?: number;
  className?: string;
}) {
  return (
    <TypewriterBody
      key={text}
      text={text}
      speedMs={speedMs}
      maxMs={maxMs}
      className={className}
    />
  );
}

function TypewriterBody({
  text,
  speedMs,
  maxMs,
  className,
}: {
  text: string;
  speedMs: number;
  maxMs: number;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  // 空文本时 `maxMs / 0` 会得到 Infinity，用 `Math.max(1, …)` 挡住。
  const step = Math.max(
    12,
    Math.min(speedMs, maxMs / Math.max(1, text.length)),
  );

  useEffect(() => {
    if (shown >= text.length) return;
    const timer = setTimeout(() => setShown((count) => count + 1), step);
    return () => clearTimeout(timer);
  }, [shown, text.length, step]);

  const done = shown >= text.length;

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {text.slice(0, shown)}
      {/* 光标用块字符而不是动画边框：在中文文本里，等宽块的「正在写」暗示最直白。 */}
      {done ? null : (
        <span aria-hidden="true" className="animate-pulse">
          ▍
        </span>
      )}
    </span>
  );
}
