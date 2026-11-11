"use client";

/**
 * 首屏的「你现在在哪」块。
 *
 * 它回答的不是「从哪里开始」，而是**「我学到哪了、下一步做什么」**。
 * 数据全部来自真实来源：
 *
 * - 课程顺序：由服务端 `loadModules()` 算好传进来（按前置依赖排序）。
 *   这里不重新排序，也不在客户端读 frontmatter —— 两份顺序一定会漂移。
 * - 当前进度：`StudentStore.learningPath.currentModule`，由
 *   `useStudentHydrate` 在页面外壳里灌进来（全站已挂）。
 * - 已掌握几讲：`StudentStore.mastery` 里 `score >= MASTERY_PASS_SCORE` 的条数，
 *   与「掌握度达标才解锁下一讲」用的是同一个门槛（`lib/scores.ts`）。
 *
 * **没数据就不编**。`loaded === false`（还没取到）与「取到了但没学过任何一讲」
 * 是两种不同的事实，前者不显示任何进度数字，后者退回「从头开始」。
 * 这正是项目里反复写的那条规矩：0 与「没测过」是两件事。
 *
 * 水合安全：服务端渲染时 store 一定是空的，所以首帧是「从头开始」，
 * 客户端拿到真实进度后才切换。这条路径不会抛水合错——
 * 因为首帧与 hydration 的首个客户端渲染读的是同一份空 store。
 */

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";

import { MASTERY_PASS_SCORE, masteryToPercent } from "@/lib/scores";
import { useStudentStore } from "@/stores";

/** 服务端按依赖顺序算好的一份最小课程表。字段刚好够这个块用。 */
export interface PlanLesson {
  id: string;
  href: string;
  orderLabel: string;
  name: string;
}

/** 「第 N 讲」——两个数字并排时必须各自带单位，否则「6/12」与「第 5 讲」像自相矛盾。 */
function orderOf(lesson: PlanLesson): string {
  return `第 ${lesson.orderLabel} 讲`;
}

export function StudyProgress({ lessons }: { lessons: PlanLesson[] }) {
  const loaded = useStudentStore((state) => state.loaded);
  const mastery = useStudentStore((state) => state.mastery);
  const learningPath = useStudentStore((state) => state.learningPath);

  if (lessons.length === 0) return null;

  const passedCount = lessons.filter(
    (lesson) => (mastery[lesson.id]?.score ?? -1) >= MASTERY_PASS_SCORE,
  ).length;

  // 当前讲：优先用学习路径给出的定位；没有路径时按「已掌握几讲」推进
  const currentId = learningPath?.currentModule;
  const currentIndex = currentId
    ? lessons.findIndex((lesson) => lesson.id === currentId)
    : -1;
  const index = currentIndex >= 0 ? currentIndex : passedCount;
  const current = lessons[Math.min(index, lessons.length - 1)];
  const started = loaded && (currentIndex >= 0 || passedCount > 0);

  return (
    <div className="mt-10">
      {/* 进度条：纯色填充，直接把「走了多少」画出来 */}
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium text-muted-foreground">
          {started ? `当前停在${orderOf(current)}` : "从头开始"}
        </span>
        <span
          aria-hidden
          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${(passedCount / lessons.length) * 100}%` }}
          />
        </span>
        <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
          {loaded ? (
            <>
              已掌握{" "}
              <strong className="font-mono font-semibold text-foreground">
                {passedCount}
              </strong>{" "}
              / {lessons.length}
            </>
          ) : (
            <>— / {lessons.length}</>
          )}
        </span>
      </div>

      {/* 纯色块：整块实底，把「下一步」从满屏纹理里拎出来 */}
      <div className="mt-4 rounded-xl bg-primary px-6 py-5 text-primary-foreground">
        <p className="flex items-center gap-2 text-[13px] font-medium text-primary-foreground/75">
          <BookOpen className="size-4 shrink-0" />
          {started ? `接下来 · 第 ${current.orderLabel} 讲` : "从这一讲开始"}
        </p>
        <p className="mt-2 text-[1.45rem] leading-tight font-semibold tracking-tight text-balance sm:text-[1.75rem]">
          {current.name}
        </p>
        {started && mastery[current.id] ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-primary-foreground/80">
            <CheckCircle2 className="size-3.5 shrink-0" />
            上一轮这里 {masteryToPercent(mastery[current.id].score)}/100
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-primary-foreground/80">
            过掌握度才解锁下一讲
          </p>
        )}
        <Link
          href={current.href}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-foreground px-4 py-2 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
        >
          {started ? "继续这一讲" : "开始第一讲"}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <Link
        href="#modules"
        className="group mt-3 inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        先看完整课程大纲
        <span
          aria-hidden
          className="h-px w-8 bg-border transition-all group-hover:w-12 group-hover:bg-primary"
        />
      </Link>
    </div>
  );
}

/** 取数期间的骨架。高度贴近真实块，避免内容跳一下。 */
export function StudyProgressSkeleton() {
  return (
    <div className="mt-10">
      <div className="flex items-center gap-3">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-1.5 flex-1 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-10 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 h-[11.5rem] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
