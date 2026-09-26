import Link from "next/link";
import { ArrowRight, Clock, Film } from "lucide-react";

import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { ModuleProgress } from "@/components/learn/module-progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeachingModule } from "@/lib/modules";

const ACCENT_COLORS = [
  "oklch(0.62 0.19 50)" /* amber */,
  "oklch(0.55 0.16 160)" /* teal */,
  "oklch(0.50 0.14 230)" /* blue */,
  "oklch(0.55 0.18 320)" /* purple */,
  "oklch(0.58 0.20 20)" /* coral */,
  "oklch(0.50 0.16 185)" /* cyan */,
  "oklch(0.55 0.14 270)" /* indigo */,
  "oklch(0.56 0.20 140)" /* green */,
  "oklch(0.60 0.18 80)" /* gold */,
  "oklch(0.58 0.16 10)" /* rose */,
  "oklch(0.50 0.14 200)" /* sky */,
];

/**
 * 学习中心的模块卡片。
 *
 * 纯展示组件：数据由服务端组件传入（`loadModules()` 读 LLM Wiki），
 * 自己不读文件、不持状态 —— 这样它将来能被放进任何容器里复用，
 * 也不会因为「客户端组件偷偷读 wiki」而构建失败。
 */
export function ModuleCard({
  teachingModule,
  prerequisites,
}: {
  teachingModule: TeachingModule;
  /** 前置模块的 id → 名称，用于把 `prerequisites` 里的 id 显示成人能读的名字。 */
  prerequisites: ReadonlyMap<string, string>;
}) {
  return (
    <Card
      className="h-full gap-3 overflow-hidden border-t-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{
        borderTopColor:
          ACCENT_COLORS[teachingModule.order % ACCENT_COLORS.length],
      }}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            <Link
              href={teachingModule.href}
              className="underline-offset-4 hover:underline"
            >
              {teachingModule.name}
            </Link>
          </CardTitle>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {teachingModule.orderLabel || `第 ${teachingModule.order + 1} 讲`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <DifficultyBadge difficulty={teachingModule.difficulty} />
          <Badge variant="outline">
            <Clock />
            {teachingModule.estimatedTime}
          </Badge>
          {teachingModule.sceneId !== null ? (
            <Badge variant="muted">
              <Film />
              可视化
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {teachingModule.summary ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {teachingModule.summary}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2">
          <ModuleProgress
            moduleId={teachingModule.id}
            moduleName={teachingModule.name}
          />

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>前置：</span>
            {teachingModule.prerequisites.length === 0 ? (
              <span>无（从这里开始）</span>
            ) : (
              teachingModule.prerequisites.map((id) => (
                <span key={id} className="text-foreground/80">
                  {prerequisites.get(id) ?? id}
                </span>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-muted-foreground">
            {teachingModule.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </CardContent>

      <div className="px-5">
        <Link
          href={teachingModule.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          进入本讲
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
