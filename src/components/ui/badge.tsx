import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // 徽标从「圆角填充块」收成「小字 + 极淡底」：它们在页面里出现几十次，
  // 每一次都是一个色块的话，页面读起来就是一串标签而不是一段话。
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[0.75rem] leading-none font-medium transition-colors [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-rule text-muted-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        /**
         * 难度 / 掌握度的三档语义色（低 / 中 / 高）。
         *
         * 不用 `--chart-*` 那组变量：那套颜色是给图表准备的，本意是「序列区分」
         * 而不是「等级高低」，用在难度徽标上会出现「难度越高颜色越浅」这种
         * 与直觉相反的情况。这里显式给三档固定色。
         *
         * 饱和度压到 emerald-50/700 这一档：原来 100/800 的底在浅纸上是
         * 一块抢眼的色斑，六个徽标并排时整页颜色失控。
         */
        levelLow:
          "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        levelMid:
          "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        levelHigh:
          "border-transparent bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
