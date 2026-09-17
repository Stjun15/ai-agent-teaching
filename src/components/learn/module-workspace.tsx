import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { MasteryIndicator } from "@/components/learn/mastery-indicator";
import { StepNav } from "@/components/learn/step-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";
import type { TeachingModule } from "@/lib/modules";

/**
 * 模块学习工作区 —— 三栏布局本体（`04-frontend.md`「模块学习页（三栏）」）。
 *
 * 为什么单独成组件而不是写在页面里
 * ------------------------------
 * 同一套三栏要服务两条路由：`/learn/[moduleId]`（默认停在第一步）与
 * `/learn/[moduleId]/[step]`（指定步骤）。页面只负责取数据与校验参数，
 * 布局与分栏职责在这里，一处定义。
 *
 * 分栏职责
 * -------
 * - 左：步骤导航 + 掌握度 + 学习路径缩略图
 * - 中：对话区 + 代码编辑区 + 可视化区，底部是输入区
 * - 右：Agent 时间线 + 引用来源 + Token 计数
 *
 * 响应式：`xl`（≥1280px）三栏铺开；`lg` 收右栏到下方；更窄单栏。
 * 文档要求 <1024px 用抽屉、<768px 用底部 Tab —— 属于 Phase 6
 * 「响应式适配正常」验收项，本阶段先保证各断点可读、不破版。
 *
 * 本组件是**服务端组件**：它只负责结构与排布，不需要交互状态。
 * 真正要订阅 Store 与 SSE 的面板各自是客户端组件，边界在面板处。
 */
export function ModuleWorkspace({
  teachingModule,
  allModules,
  currentStepId,
}: {
  teachingModule: TeachingModule;
  allModules: readonly TeachingModule[];
  currentStepId: string;
}) {
  const prerequisiteNames = teachingModule.prerequisites.map(
    (id) => allModules.find((m) => m.id === id)?.name ?? id,
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
      {/* ---------- 面包屑 + 标题 ---------- */}
      <nav aria-label="面包屑" className="mb-3 text-xs text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/learn" className="underline-offset-4 hover:underline">
              学习中心
            </Link>
          </li>
          <ChevronRight className="size-3" aria-hidden />
          <li className="text-foreground">{teachingModule.name}</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {teachingModule.name}
        </h1>
        <DifficultyBadge difficulty={teachingModule.difficulty} />
        <Badge variant="outline">
          <Clock aria-hidden />
          {teachingModule.estimatedTime}
        </Badge>
        {teachingModule.sceneId !== null ? (
          <Badge variant="muted">{teachingModule.sceneId}</Badge>
        ) : null}
        {prerequisiteNames.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            前置：{prerequisiteNames.join("、")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            无前置，从这里开始
          </span>
        )}
      </header>

      {teachingModule.summary ? (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {teachingModule.summary}
        </p>
      ) : null}

      {/* ---------- 三栏 ---------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* 左栏 */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent>
              <StepNav
                moduleId={teachingModule.id}
                currentStepId={currentStepId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <MasteryIndicator
                moduleName={teachingModule.name}
                mastery={null}
              />
            </CardContent>
          </Card>

          <div className="hidden xl:block">
            <PlaceholderPanel
              title="学习路径缩略图"
              note="Phase 3 提交点「feat(store): add student store」接入学习路径后启用"
            />
          </div>
        </aside>

        {/* 中栏 */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="min-h-[440px]">
            <CardContent className="flex h-full flex-col">
              <PlaceholderPanel
                className="flex-1"
                title="对话区"
                note="Phase 3 提交点「feat(ui): add chat panel」"
              />
            </CardContent>
          </Card>

          <PlaceholderPanel
            title="代码编辑区"
            note="Phase 6 提交点「feat(ui): add code editor with monaco」"
          />

          <PlaceholderPanel
            title="可视化区"
            note="Phase 6 提交点「feat(scenes): add scene-*」；本讲对应场景见标题栏"
          />

          <Card>
            <CardContent>
              <PlaceholderPanel
                title="输入区"
                note="Phase 3 提交点「feat(sse): add client-side SSE handler」接入后启用"
              />
            </CardContent>
          </Card>
        </div>

        {/* 右栏 */}
        <aside className="flex flex-col gap-4 lg:col-span-2 xl:sticky xl:top-20 xl:col-span-1 xl:self-start">
          <Card>
            <CardContent>
              <PlaceholderPanel
                title="Agent 时间线"
                note="Phase 3 提交点「feat(ui): add agent timeline」"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <PlaceholderPanel
                title="引用来源"
                note="Phase 3 提交点「feat(ui): add citation panel」"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <PlaceholderPanel
                title="Token 计数"
                note="Phase 3 提交点「feat(ui): add token counter」"
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
