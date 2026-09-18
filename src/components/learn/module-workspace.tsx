import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { MasteryCard } from "@/components/learn/mastery-card";
import { StepNav } from "@/components/learn/step-nav";
import { AgentTimeline } from "@/components/chat/agent-timeline";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CitationPanel } from "@/components/chat/citation-panel";
import { CodeEditor } from "@/components/code/code-editor";
import { Composer } from "@/components/chat/composer";
import { TokenCounter } from "@/components/chat/token-counter";
import { VisualizationPanel } from "@/components/chat/visualization-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";
import type { StepType } from "@/lib/db";
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
 * - 中：对话区（底部输入区在对话卡片内）+ 代码编辑区 + 可视化区
 * - 右：Agent 时间线 + 引用来源 + Token 计数
 *
 * 响应式：`xl`（≥1280px）三栏铺开；`lg` 收右栏到下方；更窄单栏。
 * 文档要求 <1024px 用抽屉、<768px 用底部 Tab —— 属于 Phase 6
 * 「响应式适配正常」验收项，本阶段先保证各断点可读、不破版。
 *
 * 本组件是**服务端组件**：它只负责结构与排布，不需要交互状态。
 * 真正要订阅 Store 与 SSE 的面板各自是客户端组件，边界在面板处
 * （`ChatPanel` / `Composer` / `AgentTimeline` / `CitationPanel` /
 * `TokenCounter` / `VisualizationPanel` / `MasteryCard`）。
 */
export function ModuleWorkspace({
  teachingModule,
  allModules,
  currentStepId,
}: {
  teachingModule: TeachingModule;
  allModules: readonly TeachingModule[];
  currentStepId: StepType;
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
              <MasteryCard
                moduleId={teachingModule.id}
                moduleName={teachingModule.name}
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
          {/*
            对话卡片用**定高**而不是 min-h：ChatPanel 的自动滚动依赖一个
            高度有界的滚动容器 —— auto 高度下 overflow 容器只会被内容撑开，
            overflow-y-auto 永远不会真的滚起来。
          */}
          <Card className="h-[560px]">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              <ChatPanel />
              {/*
                输入区放进对话卡片、而不是单独一张卡：组件树里它就是对话区的
                底部。拆成两张卡它会被挤到可视化面板下面，学生每发一句话都要
                滚过整个中栏才够得到输入框。
              */}
              <Composer />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>动手模仿</CardTitle>
            </CardHeader>
            <CardContent>
              {/*
                编辑器本体（`CodeEditor`）是客户端组件，但卡片与标题留在
                这个服务端组件里：标题是静态文案，没必要为它把整块中栏
                变成客户端组件。
              */}
              <CodeEditor />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>可视化</CardTitle>
            </CardHeader>
            <CardContent>
              <VisualizationPanel sceneId={teachingModule.sceneId} />
            </CardContent>
          </Card>
        </div>

        {/* 右栏 */}
        <aside className="flex flex-col gap-4 lg:col-span-2 xl:sticky xl:top-20 xl:col-span-1 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Agent 时间线</CardTitle>
            </CardHeader>
            <CardContent>
              {/*
                时间线限高 + 内部滚动：右栏在 xl 断点是 sticky，若时间线不限高，
                整栏会比视口还高，底部两个面板会被顶出视口且再也看不见。
              */}
              <div className="max-h-[420px] overflow-y-auto">
                <AgentTimeline />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>引用来源</CardTitle>
            </CardHeader>
            <CardContent>
              <CitationPanel />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token 计数</CardTitle>
            </CardHeader>
            <CardContent>
              <TokenCounter />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
