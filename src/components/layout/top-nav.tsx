"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Blocks,
  Compass,
  FlaskConical,
  LineChart,
  Settings,
} from "lucide-react";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * `ready` = 路由已实现，渲染成链接；`planned` = 尚未实现，渲染成不可点的标签。
   *
   * 为什么要有这个区分：Phase 3 只交付主链路（首页 / 学习中心 / 模块页），
   * 沙箱、报告、设置是 Phase 6 的提交点。如果现在就给出链接，点下去是 404 ——
   * 在演示视频里就是一个扣分画面；如果干脆不显示，又看不出产品全貌。
   * 明确标成「规划中」是唯一不撒谎也不出丑的选择。
   * Phase 6 把 status 改成 `ready` 即可，链接形态自动跟随。
   */
  status: "ready" | "planned";
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/learn", label: "学习中心", icon: Compass, status: "ready" },
  {
    href: "/playground",
    label: "沙箱实验室",
    icon: FlaskConical,
    status: "ready",
  },
  { href: "/report", label: "学习报告", icon: LineChart, status: "ready" },
  { href: "/settings", label: "设置", icon: Settings, status: "ready" },
];

/** 判断当前路径是否应高亮某导航项（含子路由）。 */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="返回首页"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Blocks className="size-4" />
          </span>
          {/* 小屏只留图形标：四个字在 390px 下会把顶栏挤成三行 */}
          <span className="hidden text-sm font-semibold sm:inline">
            {siteConfig.name}
          </span>
        </Link>

        <nav
          aria-label="主导航"
          className="relative flex flex-1 items-center gap-0.5 sm:gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.status === "ready" && isActive(pathname, item.href);

            if (item.status === "planned") {
              return (
                <span
                  key={item.href}
                  className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground/70 sm:px-2.5"
                  title="该页面在后续阶段实现"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <Badge
                    variant="muted"
                    className="ml-0.5 hidden sm:inline-flex"
                  >
                    规划中
                  </Badge>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors sm:px-2.5",
                  active
                    ? "font-medium text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="topnav-active"
                    className="absolute inset-0 rounded-md bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <UserMenu className="ml-auto" />
      </div>
    </header>
  );
}
