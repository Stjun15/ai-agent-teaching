"use client";

import { BookOpen, ChevronRight, Target, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/learn/difficulty-badge";

import type { TeachingModule } from "@/lib/modules";

export interface LearnDashboardProps {
  teachingModule: TeachingModule;
  currentStepIndex: number;
  totalSteps: number;
  currentStepLabel: string;
  onToggleCollapse?: () => void;
}

export function LearnDashboard({
  teachingModule,
  currentStepIndex,
  totalSteps,
  currentStepLabel,
  onToggleCollapse,
}: LearnDashboardProps) {
  return (
    <>
      {/* 本节目标 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="size-4 text-blue-500" />
            本节目标
            {onToggleCollapse ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="收起本节目标"
                title="收起本节目标"
                className="ml-auto hidden text-muted-foreground transition-colors hover:text-foreground xl:block"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {teachingModule.summary}
          </p>
          {teachingModule.keySteps.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {teachingModule.keySteps.map((step) => (
                <li
                  key={step}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground before:block before:size-1 before:shrink-0 before:rounded-full before:bg-blue-400"
                >
                  {step}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {/* 学习进度 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4 text-emerald-500" />
            学习进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">
              {currentStepIndex + 1}
            </span>
            <span className="text-sm text-muted-foreground">
              / {totalSteps}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            当前：{currentStepLabel}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.round(((currentStepIndex + 1) / totalSteps) * 100)}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 模块信息 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="size-4 text-amber-500" />
            模块信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>难度</span>
            <DifficultyBadge difficulty={teachingModule.difficulty} />
          </div>
          <div className="flex items-center gap-2">
            <span>预计时长</span>
            <span className="font-medium text-foreground">
              {teachingModule.estimatedTime}
            </span>
          </div>
          {teachingModule.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {teachingModule.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}