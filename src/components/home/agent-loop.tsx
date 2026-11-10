"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";

// 首屏右侧那块深色面板的内容：一次真实教学循环的四个节点。
const LOOP = [
  { label: "讲解", line: "什么是 Prompt？把任务说清楚的三要素", note: null },
  {
    label: "动手",
    line: "帮我把这段话改成正式邮件",
    note: "学生提交，未看答案",
  },
  { label: "点评", line: "78 / 100", note: "扣分：没有限定输出格式" },
  { label: "判定", line: "掌握度 3 / 5", note: "解锁下一讲 · 基础语法" },
] as const;

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// 读系统级「减少动态效果」：服务端先按 false 渲染，客户端水合后取真实值。
// 用 useSyncExternalStore 而不是在 effect 里 setState —— 后者会触发级联渲染。
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );
}

/**
 * 教学循环面板。
 *
 * 不是装饰动画：它按顺序吐出一个学生真实走一遍的四步，
 * 让首屏在不放截图的前提下说明「这个产品在跑什么」。
 * 系统开启「减少动态效果」时直接显示全部，不循环。
 */
export function AgentLoop() {
  // 1..LOOP.length = 已吐出的行数；大于长度 = 全部显示，停留一拍后重来
  const [step, setStep] = useState(1);
  const reduceMotion = usePrefersReducedMotion();
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setStep((current) => (current > LOOP.length ? 1 : current + 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const shown = reduceMotion ? LOOP.length : Math.min(step, LOOP.length);

  // 鼠标划过某一行时，整行亮一条（终端里选中行的样子）。
  // 只改 transform/height/opacity，不触发重渲染；触摸设备直接不响应。
  const highlightRow = (event: ReactPointerEvent<HTMLLIElement>) => {
    if (event.pointerType !== "mouse") return;
    const band = bandRef.current;
    if (!band) return;
    const row = event.currentTarget;
    band.style.opacity = "1";
    band.style.transform = `translate3d(0, ${row.offsetTop}px, 0)`;
    band.style.height = `${row.offsetHeight}px`;
  };

  const clearHighlight = () => {
    if (bandRef.current) bandRef.current.style.opacity = "0";
  };

  return (
    <div className="border border-border bg-foreground text-background">
      <div className="flex items-center justify-between border-b border-background/15 px-4 py-2.5">
        <span className="font-mono text-[12px] text-background/60">
          教学循环
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-background/60">
          <span className="size-1.5 animate-pulse rounded-full bg-background/70" />
          运行中
        </span>
      </div>

      <div className="relative" onPointerLeave={clearHighlight}>
        <div
          ref={bandRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-background/8 opacity-0 transition-opacity duration-150 will-change-transform"
        />

        <ol className="space-y-3 px-4 py-4 font-mono text-[13px] leading-6">
          {LOOP.slice(0, shown).map((item) => (
            <li
              key={item.label}
              onPointerEnter={highlightRow}
              className="animate-in duration-500 fade-in slide-in-from-bottom-1"
            >
              <div className="flex gap-3">
                <span className="w-7 shrink-0 text-background/45">
                  {item.label}
                </span>
                <span className="min-w-0 flex-1">{item.line}</span>
              </div>
              {item.note ? (
                <p className="mt-0.5 pl-10 text-background/50">{item.note}</p>
              ) : null}
            </li>
          ))}
          <li className="flex items-center gap-3" aria-hidden>
            <span className="w-7 shrink-0 text-background/45">&gt;</span>
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-background/70" />
          </li>
        </ol>
      </div>

      <p className="border-t border-background/15 px-4 py-2 font-mono text-[12px] text-background/45">
        示意：一次真实教学循环的形状
      </p>
    </div>
  );
}
