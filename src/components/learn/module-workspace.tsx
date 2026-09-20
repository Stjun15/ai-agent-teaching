import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

import { AssignmentCard } from "@/components/learn/assignment-card";
import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { MasteryCard } from "@/components/learn/mastery-card";
import { MasteryCheck } from "@/components/learn/mastery-check";
import { ObservePanel } from "@/components/learn/observe-panel";
import { PracticePanel } from "@/components/learn/practice-panel";
import { StepNav } from "@/components/learn/step-nav";
import { AgentTimeline } from "@/components/chat/agent-timeline";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CitationPanel } from "@/components/chat/citation-panel";
import { ValidateSubmit } from "@/components/code/validate-submit";
import { Composer } from "@/components/chat/composer";
import { LectureLauncher } from "@/components/chat/lecture-launcher";
import { lectureOpenerPrompt } from "@/lib/lecture-openers";
import { TokenCounter } from "@/components/chat/token-counter";
import { VisualizationPanel } from "@/components/chat/visualization-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { StepType } from "@/lib/db";
import { SCENE_LABELS, isSceneId } from "@/lib/agent/scene-ids";
import { LEARNING_STEPS, stepIndex } from "@/lib/learning-steps";
import type { TeachingModule } from "@/lib/modules";

/**
 * 场景 id → 学生可读的名字（「scene-request-response」这类内部 id 不该
 * 出现在界面上）。id 不在登记表里时退回通用叫法，不硬编码。
 */
function sceneLabel(sceneId: string): string {
  return isSceneId(sceneId) ? SCENE_LABELS[sceneId] : "流程演示";
}

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
  // 依赖顺序的下一讲（allModules 已按拓扑序排列）。最后一讲为 null。
  const nextModule =
    allModules.find((m) => m.order === teachingModule.order + 1) ?? null;
  // 当前步的展示数据。LEARNING_STEPS 与 StepType 的一致性由编译期断言钉住，
  // find 理论上不会落空；万一落空就不渲染横幅，而不是让页面挂掉。
  const currentStep =
    LEARNING_STEPS.find((step) => step.id === currentStepId) ?? null;

  /**
   * 步骤分屏（2026-09-20 从 llm-api 原型推广到全部 9 讲）。
   *
   * 教学法上 explain（建立心智模型）与 observe（看清「对的」长什么样）
   * 目的不同，此前却共用同一屏 —— 走查实测学生感知不到切步。分屏改法：
   *   - explain：讲稿 + 问答聊天（不再同屏展示动手模仿与可视化）；
   *   - observe：示范代码卡（从讲稿提取）+ 问答聊天；
   *   - 其余五步照常不展示这些卡位。
   */
  // explain/observe 步收起面板，其余步展开。
  const showWorkspacePanels =
    currentStepId !== "explain" && currentStepId !== "observe";
  // 分屏后每一步的聊天只渲染本步消息；讲解稿在本步的呈现方式见
  // lib/lecture-split.ts（truncate=截到作业前 / skip=整条不显示）。
  const chatStepProps =
    currentStepId === "explain"
      ? { stepFilter: "explain", lectureMode: "truncate" as const }
      : currentStepId === "observe"
        ? { stepFilter: "observe", lectureMode: "skip" as const }
        : // 其余五步没有预生成讲稿（LectureLauncher 只管 explain/observe），
          // 按步过滤即可去掉前面步骤的讲解残留；lectureMode 用 full，
          // 避免把本步问答里的首条导师回复误当讲稿跳掉。
          { stepFilter: currentStepId, lectureMode: "full" as const };

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
          <Badge variant="muted">
            配套动画：{sceneLabel(teachingModule.sceneId)}
          </Badge>
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
        <Card className="ml-auto w-full max-w-[280px] min-w-[220px] sm:w-auto">
          <CardContent>
            <MasteryCard
              moduleId={teachingModule.id}
              moduleName={teachingModule.name}
            />
          </CardContent>
        </Card>
      </header>

      {teachingModule.summary ? (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {teachingModule.summary}
        </p>
      ) : null}

      {/* ---------- 三栏 ---------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_320px]">
        {/* 左栏 */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <StepNav moduleId={teachingModule.id} currentStepId={currentStepId} />
        </aside>

        {/* 中栏 */}
        <div className="flex min-w-0 flex-col gap-4">
          {/*
            当前步横幅：七步共用同一工作区，切步只换左栏高亮 —— 零基础
            走查实测学生感知不到「切步发生了」。在中栏顶部常驻一条横幅，
            把「我在第几步、这一步要做什么」放进视线主轴。
          */}
          {currentStep ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">
                第 {stepIndex(currentStep.id) + 1} / {LEARNING_STEPS.length} 步
                · {currentStep.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentStep.detail}
              </span>
            </div>
          ) : null}
          {/*
            观察示范卡（分屏原型）：示范代码是这一步的主角，卡位排在
            聊天**之前** —— 聊天退居其下，学生先读代码、再提问。
          */}
          {currentStepId === "observe" ? (
            <Card>
              <CardHeader>
                <CardTitle>观察示范</CardTitle>
              </CardHeader>
              <CardContent>
                <ObservePanel moduleId={teachingModule.id} />
              </CardContent>
            </Card>
          ) : null}

          {/*
            对话卡片用**定高**而不是 min-h：ChatPanel 的自动滚动依赖一个
            高度有界的滚动容器 —— auto 高度下 overflow 容器只会被内容撑开，
            overflow-y-auto 永远不会真的滚起来。

            变式练习（practice）与动手模仿（imitate）两步去掉顶上的对话卡：
            学生在此动手，不再需要一直挂着一个大对话框(2026-09-20)。
          */}
          {currentStepId !== "practice" && currentStepId !== "imitate" ? (
            <Card className="h-[560px]">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                <ChatPanel moduleId={teachingModule.id} {...chatStepProps} />
                {/*
                  输入区放进对话卡片、而不是单独一张卡：组件树里它就是对话区的
                  底部。拆成两张卡它会被挤到可视化面板下面，学生每发一句话都要
                  滚过整个中栏才够得到输入框。
                */}
                {/*
                  step 随每条消息发给后端：讲解三步由讲解导师接管（2026-09-19
                  修正，此前一律是答疑口径，「概念讲解就一句话」）。
                */}
                {currentStepId === "explain" || currentStepId === "observe" ? (
                  <LectureLauncher
                    moduleId={teachingModule.id}
                    step={currentStepId}
                    prompt={lectureOpenerPrompt(
                      currentStepId,
                      teachingModule.name,
                    )}
                  />
                ) : null}
                <Composer step={currentStepId} moduleId={teachingModule.id} />
              </CardContent>
            </Card>
          ) : null}

          {/*
            变式练习（2026-09-19 接线）：此前这一步点进去没有任何界面内容，
            学生不知道该干什么 —— 而出题与评分端点早就建好了，缺的只是消费方。
          */}
          {currentStepId === "practice" ? (
            <Card>
              <CardHeader>
                <CardTitle>变式练习</CardTitle>
              </CardHeader>
              <CardContent>
                <PracticePanel moduleId={teachingModule.id} />
              </CardContent>
            </Card>
          ) : null}

          {/*
            掌握判定（同日接线）：给出「过没过、过了去哪、没过怎么办」的答案。
            判定线与学习路径解锁用同一档（MASTERY_PASS_SCORE），两条口径不分叉。
          */}
          {currentStepId === "mastery" ? (
            <Card>
              <CardHeader>
                <CardTitle>掌握判定</CardTitle>
              </CardHeader>
              <CardContent>
                <MasteryCheck
                  teachingModule={teachingModule}
                  nextModule={nextModule}
                />
              </CardContent>
            </Card>
          ) : null}

          {showWorkspacePanels ? (
            <Card>
              <CardHeader>
                <CardTitle>动手模仿</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {currentStepId === "imitate" ? (
                  <>
                    <AssignmentCard moduleId={teachingModule.id} />
                    <p className="text-xs text-muted-foreground">
                      看不懂示范？{" "}
                      <Link
                        href={`/learn/${teachingModule.id}/observe`}
                        className="underline underline-offset-2"
                      >
                        回到观察示范
                      </Link>{" "}
                      再看一遍 —— 示范代码卡就在那一步。
                    </p>
                  </>
                ) : null}
                {/*
                  接线层（身份、会话、点评请求）在这里注入，CodeEditor 本体
                  只管编辑 —— 见 validate-submit.tsx 文件头。
                */}
                <ValidateSubmit moduleId={teachingModule.id} />
              </CardContent>
            </Card>
          ) : null}

          {showWorkspacePanels &&
          currentStepId !== "practice" &&
          currentStepId !== "imitate" ? (
            <Card>
              <CardHeader>
                <CardTitle>可视化</CardTitle>
              </CardHeader>
              <CardContent>
                <VisualizationPanel sceneId={teachingModule.sceneId} />
              </CardContent>
            </Card>
          ) : null}
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
