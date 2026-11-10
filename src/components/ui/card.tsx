import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        // scroll-mt-24：滚动定位（键盘 Tab、锚点、scrollIntoView）落到卡片时，
        // 给 sticky 页头（h-14）留出高度，否则卡片顶部被页头盖住 —— 实测
        // 自动化点击与键盘滚动都会命中「可见却被遮」的死区。
        //
        // 视觉：从「描边 + 阴影的盒子」改成「一张纸」。
        // 去掉 border 与 shadow-xs —— 满屏圆角描边盒是模板感最直接的来源，
        // 卡片之间的分界交给背景明度差（bg-card 比 bg-background 亮一档）
        // 和留白，页面立刻从「一堆容器」回到「一张纸上的几块内容」。
        "flex scroll-mt-24 flex-col gap-4 rounded-lg bg-card py-6 text-card-foreground transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1 px-5", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "font-serif text-[1.0625rem] leading-snug font-semibold",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-5", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
