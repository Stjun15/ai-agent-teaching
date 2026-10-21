"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { AssignmentCard } from "@/components/learn/assignment-card";
import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { ExplainFullscreen } from "@/components/learn/explain-fullscreen";
import { KnowledgeCard } from "@/components/learn/knowledge-card";
import { MasteryCard } from "@/components/learn/mastery-card";
import { MasteryCheck } from "@/components/learn/mastery-check";
import { ObservePanel } from "@/components/learn/observe-panel";
import { PathAdjustmentList } from "@/components/learn/path-adjustment-list";
import { PracticePanel } from "@/components/learn/practice-panel";
import { StepNav } from "@/components/learn/step-nav";
import { ChatPanel } from "@/components/chat/chat-panel";
import { LearnDashboard } from "@/components/chat/learn-dashboard";
import { TextAnswerArea } from "@/components/learn/text-answer-area";
import { ValidateSubmit } from "@/components/code/validate-submit";
import { Composer } from "@/components/chat/composer";
import { ExplainColdStart } from "@/components/learn/explain-cold-start";
import { ExplainNextButton } from "@/components/learn/explain-next-button";
import { LectureLauncher } from "@/components/chat/lecture-launcher";
import { lectureOpenerPrompt } from "@/lib/lecture-openers";
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
 * explain 步不走 AI 自动讲课、而是直接渲染概念页内容的模块。
 *
 * 这些模块的概念页正文是给人读的（路径选择 / 三板斧 / 结算），
 * 不是给 TEACHING_EXPLAIN_PROMPT 当参考资料的。渲染 ExplainColdStart
 * 卡片后学生自己决定要不要启动 AI 对聊。
 */
/**
 * 冷启动交互卡的适用集合。2026-10-01 收窄到只剩 platform-replica：
 * ts-basics 的讲稿缓存早已生成（lecture_cache 表 model 列
 * 可查），却因在此集合内永远用不上；「开始对聊」点下去反而是一次现场等
 * 模型的调用。统一为与其余九讲相同——LectureLauncher 自动种入缓存讲稿，
 * 点开即有（学生 Agent 全链路模拟也是按这个口径验证的）。
 * platform-replica 是项目模块，三板斧交互卡就是它的导学形态，保留。
 */
const INTERACTIVE_EXPLAIN_MODULES = new Set(["platform-replica"]);

// ---------------------------------------------------------------------------
// 三栏可拖拽列宽
// ---------------------------------------------------------------------------

const STORAGE_KEY_LEFT = "ai-teaching:workspace-left-width";
const STORAGE_KEY_RIGHT = "ai-teaching:workspace-right-width";
const STORAGE_KEY_RIGHT_COLLAPSED = "ai-teaching:workspace-right-collapsed";
const DEFAULT_LEFT = 220;
const DEFAULT_RIGHT = 320;
const MIN_LEFT = 160;
const MAX_LEFT = 400;
const MIN_RIGHT = 240;
const MAX_RIGHT = 500;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function readPersistedWidth(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const n = Number.parseInt(raw, 10);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  } catch {
    // 隐私模式
  }
  return fallback;
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
 * - 右：学习仪表盘（本节目标 / 学习进度 / 模块信息）
 *
 * 响应式：`xl`（≥1280px）三栏铺开；`lg` 收右栏到下方；更窄单栏。
 * 文档要求 <1024px 用抽屉、<768px 用底部 Tab —— 属于 Phase 6
 * 「响应式适配正常」验收项，本阶段先保证各断点可读、不破版。
 *
 * 本组件是客户端组件：\"use client\"。
 */
export function ModuleWorkspace({
  teachingModule,
  allModules,
  currentStepId,
  demoCode,
}: {
  teachingModule: TeachingModule;
  allModules: readonly TeachingModule[];
  currentStepId: StepType;
  demoCode?: string;
}) {
  const [explainChatStarted, setExplainChatStarted] = useState(false);

  // 三栏列宽（xl+ 拖拽可调，localStorage 持久化）
  const [leftWidth, setLeftWidth] = useState(() =>
    readPersistedWidth(STORAGE_KEY_LEFT, DEFAULT_LEFT),
  );
  const [rightWidth, setRightWidth] = useState(() =>
    readPersistedWidth(STORAGE_KEY_RIGHT, DEFAULT_RIGHT),
  );
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY_RIGHT_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });

  const toggleRight = useCallback(() => {
    setRightCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_RIGHT_COLLAPSED, next ? "1" : "0");
      } catch {
        // 隐私模式
      }
      return next;
    });
  }, []);

  // 拖拽期间用 ref 避免闭包拿到旧值
  const leftWidthRef = useRef(leftWidth);
  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);
  const rightWidthRef = useRef(rightWidth);
  useEffect(() => {
    rightWidthRef.current = rightWidth;
  }, [rightWidth]);

  const dragRef = useRef<{
    side: "left" | "right";
    startX: number;
    startWidth: number;
  } | null>(null);

  const beginDrag = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        side,
        startX: e.clientX,
        startWidth:
          side === "left" ? leftWidthRef.current : rightWidthRef.current,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      if (d.side === "left") {
        setLeftWidth(clamp(d.startWidth + delta, MIN_LEFT, MAX_LEFT));
      } else {
        setRightWidth(clamp(d.startWidth - delta, MIN_RIGHT, MAX_RIGHT));
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        try {
          localStorage.setItem(
            STORAGE_KEY_LEFT,
            String(leftWidthRef.current),
          );
          localStorage.setItem(
            STORAGE_KEY_RIGHT,
            String(rightWidthRef.current),
          );
        } catch {
          // 隐私模式
        }
      }
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

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
        : // 其余五步没有预生成讲稿（LectureLauncher 只管 explain），
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
      <div className="mt-6 flex flex-wrap xl:flex-nowrap">
        {/* 左栏 */}
        <aside
          className="flex shrink-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start"
          style={{ width: leftWidth }}
        >
          <StepNav moduleId={teachingModule.id} currentStepId={currentStepId} />
          <PathAdjustmentList />
        </aside>

        {/* 左拖拽手柄（xl+ 可见） */}
        <div
          className="hidden shrink-0 cursor-col-resize items-center justify-center px-1.5 transition-colors hover:bg-accent/50 xl:flex"
          onMouseDown={beginDrag("left")}
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整左栏宽度"
        >
          <div className="h-10 w-0.5 rounded-full bg-border" />
        </div>

        {/* 中栏 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
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
                <ObservePanel
                  moduleId={teachingModule.id}
                  demoCode={demoCode}
                />
              </CardContent>
            </Card>
          ) : null}

          {/*
            对话卡片用**定高**而不是 min-h：ChatPanel 的自动滚动依赖一个
            高度有界的滚动容器 —— auto 高度下 overflow 容器只会被内容撑开，
            overflow-y-auto 永远不会真的滚起来。

            变式练习（practice）与动手模仿（imitate）两步去掉顶上的对话卡：
            学生在此动手，不再需要一直挂着一个大对话框(2026-09-20)。

            概念讲解步包裹 ExplainFullscreen：学生可切换全屏沉浸阅读讲稿，
            此时对话卡片充满整个视口。其余步（观察示范等）不提供全屏开关。
          */}
          {currentStepId === "explain" ? (
            <>
              {INTERACTIVE_EXPLAIN_MODULES.has(teachingModule.id) ? (
                <ExplainColdStart
                  moduleId={teachingModule.id}
                  moduleName={teachingModule.name}
                  onStarted={() => setExplainChatStarted(true)}
                />
              ) : null}
              {/* 交互型模块：只有点击"开始对聊"后才弹出对话面板 */}
              {INTERACTIVE_EXPLAIN_MODULES.has(teachingModule.id) &&
              !explainChatStarted ? null : (
                <ExplainFullscreen>
                  <Card className="h-[560px]">
                    <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                      <ChatPanel
                        moduleId={teachingModule.id}
                        {...chatStepProps}
                      />
                      {INTERACTIVE_EXPLAIN_MODULES.has(
                        teachingModule.id,
                      ) ? null : (
                        <LectureLauncher
                          moduleId={teachingModule.id}
                          step={currentStepId}
                          prompt={lectureOpenerPrompt(
                            currentStepId,
                            teachingModule.name,
                          )}
                        />
                      )}
                      <ExplainNextButton moduleId={teachingModule.id} />
                      <Composer
                        step={currentStepId}
                        moduleId={teachingModule.id}
                      />
                    </CardContent>
                  </Card>
                </ExplainFullscreen>
              )}
            </>
          ) : currentStepId === "observe" ? (
            <Card className="h-[calc(100vh-12rem)] min-h-[400px]">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                <ChatPanel
                  moduleId={teachingModule.id}
                  {...chatStepProps}
                  hasCachedTask
                />
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
            <>
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

              <div className="mt-4">
                <KnowledgeCard
                  moduleId={teachingModule.id}
                  moduleName={teachingModule.name}
                />
              </div>
            </>
          ) : null}

          {showWorkspacePanels &&
          currentStepId !== "visualize" &&
          currentStepId !== "mastery" &&
          currentStepId !== "practice" ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {currentStepId === "validate"
                    ? "校验点评"
                    : teachingModule.taskType === "qa"
                      ? "回答问题"
                      : "动手模仿"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {currentStepId === "imitate" ? (
                  <>
                    <AssignmentCard
                      moduleId={teachingModule.id}
                      showTaskTypeFooter={
                        teachingModule.taskType === "code"
                      }
                    />
                    {teachingModule.taskType === "code" ? (
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
                    ) : null}
                  </>
                ) : null}
                {teachingModule.taskType === "qa" ? (
                  <TextAnswerArea moduleId={teachingModule.id} />
                ) : (
                  <ValidateSubmit moduleId={teachingModule.id} />
                )}
              </CardContent>
            </Card>
          ) : null}

          {showWorkspacePanels &&
          teachingModule.sceneId !== null &&
          currentStepId !== "practice" &&
          currentStepId !== "imitate" &&
          currentStepId !== "validate" &&
          currentStepId !== "mastery" ? (
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

        {/* 右拖拽手柄（xl+ 可见，折叠时隐藏） */}
        {!rightCollapsed ? (
          <div
            className="hidden shrink-0 cursor-col-resize items-center justify-center px-1.5 transition-colors hover:bg-accent/50 xl:flex"
            onMouseDown={beginDrag("right")}
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整右栏宽度"
          >
            <div className="h-10 w-0.5 rounded-full bg-border" />
          </div>
        ) : null}

        {/* 右栏 */}
        {rightCollapsed ? (
          <aside className="hidden shrink-0 xl:flex xl:sticky xl:top-20 xl:self-start">
            <div className="w-fit rounded-md border bg-card p-2">
              <button
                type="button"
                onClick={toggleRight}
                aria-label="展开本节目标"
                title="展开本节目标"
                aria-expanded={false}
                className="flex flex-col items-center gap-3 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden />
                <span className="text-xs [writing-mode:vertical-rl]">
                  本节目标
                </span>
              </button>
            </div>
          </aside>
        ) : (
          <aside
            className="flex shrink-0 flex-col gap-4 w-full xl:sticky xl:top-20 xl:self-start"
            style={{ width: rightWidth, maxWidth: "100%" }}
          >
            <LearnDashboard
              teachingModule={teachingModule}
              currentStepIndex={stepIndex(currentStepId)}
              totalSteps={LEARNING_STEPS.length}
              currentStepLabel={currentStep?.label ?? ""}
              onToggleCollapse={toggleRight}
            />
          </aside>
        )}
      </div>
    </main>
  );
}