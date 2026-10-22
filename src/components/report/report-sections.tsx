"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import {
  MASTERY_MAX_SCORE,
  MASTERY_PASS_SCORE,
  PROMPT_SCORE_MAX,
  masteryToPercent,
} from "@/lib/scores";
import type { PathAdjustment, ReportResponse } from "@/schemas";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpenCheck,
  Hash,
  Lightbulb,
  RotateCcw,
  TrendingUp,
} from "lucide-react";

const TrendChart = dynamic(
  () => import("@/components/report/trend-chart").then((mod) => mod.TrendChart),
  {
    ssr: false,
    loading: () => <SkeletonCard className="h-48" />,
  },
);

/**
 * 学习报告的四个区块（总览 / 子能力 / 趋势 / 薄弱点与建议）。
 *
 * 纯 props 组件：给一份 `ReportResponse` 就画出来，不取数、不管加载与错误状态。
 * 与 `report-view.tsx` 分开的理由是那一边要处理「正在加载 / 取数失败 /
 * 不可恢复错误不给重试按钮 / 一条数据都没有」四种情况，混在一起会淹掉这里的
 * 渲染逻辑；而这里的每个数字都有**量纲**要交代，本身也需要空间写清楚。
 *
 * 本文件处处在处理量纲，这是刻意的
 * ---------------------------------
 * `ReportResponse` 里有两个不同的 `number` 量纲（掌握度 0~5、点评分 0~100）。
 * 所以每个数字要么经过 `masteryToPercent`，要么明确带上 `/ 100` 的单位，
 * 并在 `hint` 里写出原始值 —— 读者不该需要翻代码才知道「2.5」是什么意思。
 */
export function ReportSections({ report }: { report: ReportResponse }) {
  const hasMastery = report.masteryTrend.length > 0;
  const masteryPercent = masteryToPercent(report.overview.averageMastery);
  const measuredAbilities = report.subAbilityEvidence.filter(
    (ability) => ability.score !== null,
  ).length;

  return (
    <div className="flex flex-col gap-8">
      {/* ---------- 总览 ---------- */}
      <section aria-label="总览">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="已掌握模块"
            value={String(report.overview.completedModules)}
            hint={`掌握度达到 ${MASTERY_PASS_SCORE} / ${MASTERY_MAX_SCORE} 的模块数`}
          />
          <StatCard
            label="平均掌握度"
            value={hasMastery ? String(masteryPercent) : "—"}
            unit={hasMastery ? "/ 100" : undefined}
            hint={
              hasMastery
                ? `百分制；原始值 ${report.overview.averageMastery} / ${MASTERY_MAX_SCORE}`
                : "尚无掌握度记录（不是 0 分）"
            }
          />
          <StatCard
            label="累计答题"
            value={String(report.overview.totalQuestions)}
            unit="题"
          />
          <StatCard
            label="Prompt 平均分"
            value={String(report.overview.averagePromptScore)}
            unit={`/ ${PROMPT_SCORE_MAX}`}
            hint="点评 Agent 的 rubric 总分，与上面的掌握度不是同一量纲"
          />
        </div>
      </section>

      {/* ---------- 子能力 ---------- */}
      <section aria-label="子能力">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">六项子能力</h2>
          <span className="text-[11px] text-muted-foreground">
            由对应教学模块的真实掌握度聚合，{measuredAbilities} / 6 项有证据
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {report.subAbilityEvidence.map((ability) => (
            <li key={ability.key} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs">{ability.label}</span>
              {ability.score === null ? (
                <span className="flex-1 text-[11px] leading-relaxed text-muted-foreground">
                  未测评 —— 学完 {ability.modules.join(" / ")}{" "}
                  中任意一讲并留下掌握度记录后出现
                </span>
              ) : (
                <>
                  <Progress
                    value={masteryToPercent(ability.score)}
                    label={`${ability.label} ${ability.score} / ${MASTERY_MAX_SCORE}`}
                  />
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {ability.score}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                    {ability.samples} 条
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- 评分维度（真实） ---------- */}
      <section aria-label="评分维度">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">评分维度</h2>
          <span className="text-[11px] text-muted-foreground">
            点评 Agent 实际打过的维度，满分 {PROMPT_SCORE_MAX}
          </span>
        </div>
        {report.promptDimensions.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            还没有点评记录，维度要等点评 Agent 打过分才会出现。
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {report.promptDimensions.map((dimension) => (
              <li key={dimension.name} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs">{dimension.name}</span>
                {/* 维度分本身就是 0~100（`ReviewerOutputSchema`），
                    不再过 `masteryToPercent` —— 那是给 0~5 的掌握度用的。 */}
                <Progress
                  value={dimension.averageScore}
                  label={`${dimension.name} ${dimension.averageScore} / ${PROMPT_SCORE_MAX}`}
                />
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {dimension.averageScore} / {PROMPT_SCORE_MAX}
                </span>
                <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                  {dimension.samples} 次
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- 趋势 ---------- */}
      <section aria-label="掌握度趋势">
        <h2 className="text-sm font-semibold">掌握度趋势</h2>
        <div className="mt-3">
          <TrendChart points={report.masteryTrend} />
        </div>
      </section>

      {/* ---------- 薄弱点与建议 ---------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="薄弱点">
          <h2 className="text-sm font-semibold">薄弱点</h2>
          {report.weaknesses.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              还没有错题记录。
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {report.weaknesses.map((weak) => (
                <li key={weak.concept}>
                  <Link
                    href={`/learn/${weak.concept}`}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:border-ring/60"
                  >
                    <span className="font-medium">{weak.concept}</span>
                    <Badge variant="levelMid">{weak.issue}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="学习建议">
          <h2 className="text-sm font-semibold">建议</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {report.recommendations.map((recommendation) => (
              <li
                key={recommendation}
                className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
              >
                {recommendation}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------- 路径调整记录 ---------- */}
      {report.adjustments.length > 0 && (
        <section aria-label="路径调整记录">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">路径调整记录</h2>
            <span className="text-[11px] text-muted-foreground">
              系统自动检测并按紧迫性排序的建议，来自答题评分时的实时分析
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.adjustments.map((adj, i) => (
              <div
                key={`${adj.date}-${i}`}
                className="flex gap-2.5 rounded-lg border bg-muted/20 px-4 py-3"
              >
                <span className="mt-0.5">{pickAdjustmentIcon(adj)}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {adj.reason}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {adj.action}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {adj.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function pickAdjustmentIcon(adj: PathAdjustment) {
  if (adj.reason.includes("连续") && adj.reason.includes("校验")) {
    return <AlertTriangle className="size-4 shrink-0 text-amber-500" />;
  }
  if (adj.reason.includes("错题")) {
    return <Lightbulb className="size-4 shrink-0 text-blue-500" />;
  }
  if (adj.reason.includes("下降")) {
    return <RotateCcw className="size-4 shrink-0 text-rose-500" />;
  }
  return <ArrowRight className="size-4 shrink-0 text-emerald-500" />;
}

/** 一个总览数字。`hint` 用来交代这个数量纲是什么，避免读者自己猜。 */
const STAT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  已掌握模块: BookOpenCheck,
  平均掌握度: TrendingUp,
  累计答题: Hash,
  "Prompt 平均分": Award,
};

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  const Icon = STAT_ICONS[label];

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <Icon className="size-3.5" />
            </span>
          ) : null}
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
          {unit ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </p>
        {hint ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
