"use client";

/**
 * 掌握判定面板（2026-09-19 接线）
 *
 * 为什么要有这个组件
 * ----------------
 * 零基础走查发现：七步的终点「掌握判定」点进去没有界面内容。掌握度数据
 * 与档位口径（`scores.ts`）早就齐了，左栏掌握度卡也一直在显示——但那是
 * 「现在的分数」，不是「判定」。这一步学生需要回答的问题是：
 * **「我过没过？过了去哪，没过怎么办？」** 本组件就是给这个答案的。
 *
 * 判定口径只有一条
 * --------------
 * 「达标」= `mastery.score >= MASTERY_PASS_SCORE`（3 分，即「良好」档）。
 * 这与学习路径推进用的 `PREREQUISITE_MIN_MASTERY`（=3）是同一档 ——
 * 「判定过关」与「解锁下一讲」必须是同一条线，否则学生会问
 * 「为什么这里说我过了，下一讲却不让进」。两处共用 `scores.ts` 的常量。
 *
 * 数据从哪来
 * ---------
 * `StudentStore`（`StudentBootstrap` 每页 hydrate）。本组件**不自己发请求**
 * —— 同一份掌握度左栏卡片也在用，多一处取数就多一处「两边数字不一样」的可能。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowRight, BookOpen, CircleCheck, RotateCcw } from "lucide-react";

import { MasteryIndicator } from "@/components/learn/mastery-indicator";
import { Button } from "@/components/ui/button";
import {
  levelOfMastery,
  masteryToPercent,
  MASTERY_PASS_SCORE,
} from "@/lib/scores";
import { selectMastery, useStudentStore } from "@/stores";
import type { TeachingModule } from "@/lib/modules";

export function MasteryCheck({
  teachingModule,
  nextModule,
}: {
  teachingModule: TeachingModule;
  /** 依赖顺序的下一讲；当前已是最后一讲时为 null。 */
  nextModule: TeachingModule | null;
}) {
  const router = useRouter();
  const ran = useRef(false);

  const mastery = useStudentStore((state) =>
    selectMastery(state, teachingModule.id),
  );

  // 进入掌握判定这一步时刷新服务端数据：前面几步（校验点评、变式练习）
  // 可能已经把掌握度写进数据库了，只有这一步需要拿到最新分数做判定。
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    router.refresh();
  }, [router]);

  const passed = mastery !== null && mastery.score >= MASTERY_PASS_SCORE;
  const notStarted = mastery === null;

  return (
    <div className="flex flex-col gap-4">
      <MasteryIndicator
        moduleName={teachingModule.name}
        mastery={mastery === null ? null : masteryToPercent(mastery.score)}
        level={mastery === null ? undefined : levelOfMastery(mastery.score)}
        caption={
          mastery === null
            ? undefined
            : `判定线是 ${MASTERY_PASS_SCORE} / 5（良好档）：达到它才算过关、才能解锁下一讲。`
        }
      />

      {notStarted ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <BookOpen className="size-4" aria-hidden />
            还没有判定数据
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            先完成前面的「变式练习」或「动手模仿 → 校验点评」，系统会按你的表现
            给出掌握度，这里就会显示判定结果。
          </p>
        </div>
      ) : passed ? (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CircleCheck className="size-4" aria-hidden />
            恭喜，「{teachingModule.name}」判定通过。
          </p>
          {nextModule !== null ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm leading-relaxed text-muted-foreground">
                下一讲是「{nextModule.name}」，随时可以开始。
              </p>
              <Button asChild className="self-start">
                <Link href={nextModule.href}>
                  进入下一讲
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              这已经是最后一讲 —— 到报告页看看整条学习路径的完成情况吧。
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <RotateCcw className="size-4" aria-hidden />
            还差一点 —— 判定线是 {MASTERY_PASS_SCORE} / 5，继续练就能过。
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            建议：回「变式练习」再做一组，或把「动手模仿」的作业改一改重新提交点评
            —— 答错的题都会进报告页的错题本，先看解析再动手会快很多。
          </p>
        </div>
      )}
    </div>
  );
}