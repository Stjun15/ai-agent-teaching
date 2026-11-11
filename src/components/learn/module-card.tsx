import Link from "next/link";
import { ArrowRight, Film } from "lucide-react";

import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { ModuleProgress } from "@/components/learn/module-progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeachingModule } from "@/lib/modules";

/**
 * 讲次索引色：同一色相里从浅到深。
 *
 * 原来这里是 11 个互不相干的高饱和色（amber / teal / blue / purple / coral …），
 * 每张卡取一种描在顶上，一屏三张就是三条撞色的横杠 —— 这正是被否决过的
 * 「色彩太多」。但颜色本身不该取消：学生扫一眼要看得出「这是第几讲」。
 *
 * 所以保留一讲一色，收进同一个色相（色相 250，与星云的 --primary 同源），只让明度递减。
 * 第 0 讲最浅、越往后越深：位置本身携带了「进度」的含义，
 * 而页面上不再出现第二种色相。
 */
const ACCENT_STEPS = [
  "oklch(0.82 0.035 250)",
  "oklch(0.78 0.042 250)",
  "oklch(0.74 0.05 250)",
  "oklch(0.7 0.058 250)",
  "oklch(0.66 0.066 250)",
  "oklch(0.62 0.074 250)",
  "oklch(0.58 0.082 250)",
  "oklch(0.54 0.088 250)",
  "oklch(0.5 0.094 250)",
  "oklch(0.46 0.098 250)",
  "oklch(0.42 0.1 250)",
  "oklch(0.38 0.1 250)",
];

/** 取讲次对应的索引色。超出表长时回落到最深一档，不循环 —— 循环会让第 13 讲
 *  和第 1 讲撞色，反而破坏「越深越靠后」这条唯一的可读规律。 */
function accentFor(order: number): string {
  const index = Math.min(Math.max(order, 0), ACCENT_STEPS.length - 1);
  return ACCENT_STEPS[index];
}

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
      className="group h-full gap-3 overflow-hidden border-t-2 border-t-rule transition-colors duration-300 hover:bg-muted/40"
      style={{
        borderTopColor: accentFor(teachingModule.order),
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

      <div className="mt-auto border-t px-5 pt-3">
        <Link
          href={teachingModule.href}
          className="flex items-center justify-between text-sm font-medium transition-colors group-hover:text-primary"
        >
          进入本讲
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </Card>
  );
}
