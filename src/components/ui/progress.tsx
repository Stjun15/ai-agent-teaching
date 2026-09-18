import { cn } from "@/lib/utils";

/**
 * 进度条。
 *
 * 刻意不用 Radix 的 Progress 原语：本项目的进度条只有一个用途（掌握度），
 * 且不需要键盘交互。用一个带 `role="progressbar"` 的 div 反而更小更好审查。
 * 可访问性属性是必须的 —— 屏幕阅读器读不到「视觉上的宽度」。
 */
function Progress({
  value,
  max = 100,
  label,
  className,
  indicatorClassName,
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
  indicatorClassName?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(Math.max(value / safeMax, 0), 1);

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={value}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full bg-primary transition-all", indicatorClassName)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export { Progress };
