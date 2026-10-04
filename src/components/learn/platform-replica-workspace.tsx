"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  MessageSquare,
  Terminal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Composer } from "@/components/chat/composer";
import { ValidateSubmit } from "@/components/code/validate-submit";
import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { useReplicaPhase } from "@/hooks/use-replica-phase";

import {
  REPLICA_PHASES,
  type ReplicaPhase,
} from "@/lib/platform-replica-phases";
import type { TeachingModule } from "@/lib/modules";

export function PlatformReplicaWorkspace({
  teachingModule,
  allModules,
}: {
  teachingModule: TeachingModule;
  allModules: readonly TeachingModule[];
}) {
  // 阶段位置持久化在 localStorage（use-replica-phase.ts 文件头写了为什么）：
  // 180 分钟的项目模块必然跨刷新，此前一次整页刷新就把学生打回启动台。
  const { phaseIndex: activePhaseIndex, setPhaseIndex: setActivePhaseIndex } =
    useReplicaPhase(REPLICA_PHASES.length);
  const [chatOpen, setChatOpen] = useState(false);

  const prerequisiteNames = teachingModule.prerequisites.map(
    (id) => allModules.find((m) => m.id === id)?.name ?? id,
  );
  const phase = REPLICA_PHASES[activePhaseIndex];

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
      {/* ---------- 面包屑 ---------- */}
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

      {/* ---------- 头部 ---------- */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {teachingModule.name}
        </h1>
        <DifficultyBadge difficulty={teachingModule.difficulty} />
        <Badge variant="outline">
          <Clock aria-hidden />
          {teachingModule.estimatedTime}
        </Badge>
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

      {/*
        定位说明（2026-10-04 学生走查）：其余 11 讲都在本页内学，唯独这一讲
        的「作业」是学生自己电脑上的一个真项目。零基础走查实测学生分不清
        「命令敲在哪里」——一句话把边界钉在视线主轴上。
      */}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        这一讲在浏览器外完成：命令敲在<b>你自己电脑的终端</b>里，代码写在
        <b>你自己的项目</b>
        里。这个页面是你的任务卡、验收速查和导师——卡住了随时问。
      </p>

      {/* ---------- 双栏：阶段导航 + 阶段详情 ---------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* 左栏：阶段进度 */}
        <nav aria-label="搭建阶段" className="flex flex-col gap-1">
          {REPLICA_PHASES.map((p, i) => {
            const isActive = i === activePhaseIndex;
            const isDone = i < activePhaseIndex;
            const isLast = i === REPLICA_PHASES.length - 1;

            return (
              <div key={p.index} className="flex gap-3">
                {/* 竖线 + 圆点 */}
                <div className="flex flex-col items-center">
                  {isDone ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                  ) : isActive ? (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {i + 1}
                    </div>
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground/40" />
                  )}
                  {!isLast ? (
                    <div
                      className={
                        isDone
                          ? "my-0.5 w-px flex-1 bg-emerald-500/30"
                          : "my-0.5 w-px flex-1 bg-muted"
                      }
                    />
                  ) : null}
                </div>

                {/* 文字 */}
                <button
                  type="button"
                  onClick={() => setActivePhaseIndex(i)}
                  className={
                    "flex-1 pb-5 text-left text-sm transition-colors " +
                    (isActive
                      ? "font-semibold text-foreground"
                      : isDone
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-muted-foreground/60 hover:text-muted-foreground")
                  }
                >
                  <div>{p.title}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed opacity-70">
                    {isDone
                      ? "已完成"
                      : p.goal.length > 28
                        ? p.goal.slice(0, 28) + "…"
                        : p.goal}
                  </div>
                </button>
              </div>
            );
          })}
        </nav>

        {/* 右栏：当前阶段详情 */}
        <div className="flex flex-col gap-4">
          {phase ? (
            <PhaseDetailCard phase={phase} />
          ) : (
            <p className="text-sm text-muted-foreground">阶段数据缺失</p>
          )}

          {/*
            结算阶段的正式交付口（2026-10-04 学生走查补上）：wiki 让学生
            「把 agent-loop.ts 交给点评导师出检验单」，此前界面没有任何点评
            入口，对话里贴作业只会得到答疑口径的即兴点评（不落库、不更新
            掌握度）。复用通用 validate 步的接线层（建会话 → /api/agent/
            validate → 落库 validation_results/prompt_history），仅在结算
            阶段出现、不跳转步骤页。
          */}
          {phase !== undefined && phase.index === REPLICA_PHASES.length - 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>交付与检验单</CardTitle>
                <p className="text-sm text-muted-foreground">
                  把 agent-loop.ts 全文贴进编辑器，点「提交点评」——点评导师按
                  评分维度出正式检验单（维度分、扣分点、改进建议，并计入掌握度）。
                </p>
              </CardHeader>
              <CardContent>
                <ValidateSubmit
                  moduleId={teachingModule.id}
                  redirectOnComplete={false}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* 阶段切换按钮 */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={activePhaseIndex === 0}
              onClick={() =>
                setActivePhaseIndex(Math.max(0, activePhaseIndex - 1))
              }
            >
              上一阶段
            </Button>
            <span className="text-xs text-muted-foreground">
              {activePhaseIndex + 1} / {REPLICA_PHASES.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={activePhaseIndex === REPLICA_PHASES.length - 1}
              onClick={() =>
                setActivePhaseIndex(
                  Math.min(REPLICA_PHASES.length - 1, activePhaseIndex + 1),
                )
              }
            >
              下一阶段
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>

          {/* 对话区 */}
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">对话</CardTitle>
                {!chatOpen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatOpen(true)}
                  >
                    <MessageSquare className="mr-1.5 size-4" />
                    开始对聊
                  </Button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    遇到问题随时问导师，按模块、按步骤、按报错都行
                  </p>
                )}
              </div>
            </CardHeader>
            {chatOpen ? (
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                <ChatPanel moduleId={teachingModule.id} />
                {/*
                  step 是 /api/chat 上身份层与概念页注入的总开关
                  （resolveStepAgent + buildTeachingScript 都要求 step 存在）。
                  此前没传 → 复刻导师跌回答疑口径、看不到复刻材料，答错过
                  「启动台 Node ≥ 22.5」这种平台自己的硬要求（2026-10-04
                  学生走查实测）。explain 的注入映射恰好命中「定义 + 关键
                  步骤（启动台/三板斧/验收）+ 为什么需要」。
                */}
                <Composer moduleId={teachingModule.id} step="explain" />
              </CardContent>
            ) : null}
          </Card>
        </div>
      </div>
    </main>
  );
}

/** 当前阶段的任务卡片 + 验收脚本。 */
function PhaseDetailCard({ phase }: { phase: ReplicaPhase }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            第 {phase.index + 1} / {REPLICA_PHASES.length} 阶段
          </span>
        </div>
        <CardTitle className="text-lg">{phase.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{phase.goal}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 任务表格 */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  做什么
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  用到的模块
                </th>
                <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">
                  关键文件
                </th>
              </tr>
            </thead>
            <tbody>
              {phase.tasks.map((task, i) => (
                <tr
                  key={i}
                  className={
                    "border-b last:border-0 " +
                    (i % 2 === 0 ? "bg-background" : "bg-muted/20")
                  }
                >
                  <td className="px-3 py-2">{task.label}</td>
                  <td className="px-3 py-2">
                    {task.moduleRef ? (
                      <Link
                        href={`/learn/${task.moduleRef}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {task.moduleRef}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[11px] text-muted-foreground sm:table-cell">
                    {task.file ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 验收 */}
        {phase.acceptanceScript || phase.acceptanceDesc ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Terminal className="size-3.5" />
              验收
            </div>
            {phase.acceptanceScript ? (
              <pre className="overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed">
                {phase.acceptanceScript}
              </pre>
            ) : null}
            {phase.acceptanceDesc ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {phase.acceptanceDesc}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
