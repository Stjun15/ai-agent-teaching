import Link from "next/link";
import { Blocks } from "lucide-react";

import { siteConfig } from "@/lib/site";

/**
 * 全站页脚。
 *
 * 之前没有页脚：首页滚到底是一条模块列表，戛然而止 —— 页面没有「结束感」。
 * 页脚同时承担三件事：品牌收尾、快速入口、以及一句诚实的课程口径
 * （「评价来自 AI 点评，不替你背书」与本产品「不编造」的哲学一致）。
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-muted/30">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Blocks className="size-4" />
            </span>
            <span className="text-sm font-semibold">{siteConfig.name}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            用 Agent 教 Agent —— 训练六项可迁移的 AI
            协作能力。你的每一次作业都由教学 Agent 按公开的评分标准点评： AI
            的评价不替你背书，掌握度由你自己一步步挣出来。
          </p>
        </div>

        <nav
          aria-label="页脚导航"
          className="flex gap-10 text-sm sm:justify-end"
        >
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              学习
            </span>
            <Link
              href="/learn"
              className="text-foreground/80 transition-colors hover:text-primary"
            >
              学习中心
            </Link>
            <Link
              href="/report"
              className="text-foreground/80 transition-colors hover:text-primary"
            >
              学习报告
            </Link>
            <Link
              href="/settings"
              className="text-foreground/80 transition-colors hover:text-primary"
            >
              设置
            </Link>
          </div>
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <span>{siteConfig.name}</span>
        </div>
      </div>
    </footer>
  );
}
