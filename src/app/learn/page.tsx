import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Sparkles } from "lucide-react";

import { AnimatedGrid, AnimatedSection } from "@/components/layout/animated-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleCard } from "@/components/learn/module-card";
import { loadModules } from "@/lib/modules";

export const metadata: Metadata = {
  title: "学习中心",
  description: "10 个教学模块，按依赖关系顺序学习 AI Agent 的核心概念。",
};

/**
 * 学习中心。
 *
 * 服务端组件，模块列表来自 LLM Wiki 的概念页 frontmatter —— 与首页同一份数据源。
 * 新增一个概念页，这里自动多一张卡片，不需要改代码。
 *
 * 前置依赖的显示：`prerequisites` 里存的是模块 id，直接把 id 印在卡片上很难读，
 * 所以先在服务端建一张 id → 名称的表传下去。在客户端组件里现算这张表也可以，
 * 但那会把整个模块列表打进客户端包 —— 这是不必要的水。
 */
export default async function LearnPage() {
  const modules = await loadModules();
  const prerequisites = new Map(modules.map((m) => [m.id, m.name]));
  const totalMinutes = modules.reduce((total, teachingModule) => {
    const minutes = Number.parseInt(teachingModule.estimatedTime, 10);
    return total + (Number.isNaN(minutes) ? 0 : minutes);
  }, 0);

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <AnimatedSection>
        <header className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">学习中心</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {modules.length} 个模块按依赖关系排定顺序，共约 {totalMinutes} 分钟。
            每个模块走完「概念讲解 → 观察示范 → 动手模仿 → 校验点评 → 可视化 →
            变式练习 → 掌握判定」七步，掌握度达标后再进入下一个 ——
            这是掌握式学习的顺序，不建议跳讲。
          </p>
        </header>
      </AnimatedSection>

      {modules.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          没有读到任何概念页。请确认 `llm-wiki/concepts/` 下存在概念页面。
        </p>
      ) : (
        <AnimatedGrid className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* 欢迎卡片：独立页面，不走七步教学流程 */}
          <div>
            <Card className="h-full gap-3 border-ring/30 bg-muted/20 transition-colors hover:border-ring/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    <Link
                      href="/learn/welcome"
                      className="underline-offset-4 hover:underline"
                    >
                      写在最前面
                    </Link>
                  </CardTitle>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    第 0 讲
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="outline">
                    <Sparkles />
                    序言
                  </Badge>
                  <Badge variant="outline">
                    <Clock />
                    10min
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  这门课最后要做成什么？你正在用的这个网页就是你的期末作业——用
                  AI 教 AI，用 Agent 教 Agent。
                </p>

                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>前置：</span>
                    <span>无（从这里开始）</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      intro
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      overview
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      goal
                    </span>
                  </div>
                </div>
              </CardContent>

              <div className="px-5">
                <Link
                  href="/learn/welcome"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  进来坐
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </Card>
          </div>

          {modules.map((teachingModule) => (
            <div key={teachingModule.id}>
              <ModuleCard
                teachingModule={teachingModule}
                prerequisites={prerequisites}
              />
            </div>
          ))}
        </AnimatedGrid>
      )}
    </main>
  );
}