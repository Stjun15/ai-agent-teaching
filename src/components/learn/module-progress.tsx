"use client";

import { Progress } from "@/components/ui/progress";
import {
  levelOfMastery,
  MASTERY_MAX_SCORE,
  MASTERY_PASS_SCORE,
} from "@/lib/scores";
import { selectMastery, useStudentStore } from "@/stores";

/**
 * 模块卡片的学习进度条。
 *
 * 订阅 StudentStore 取学生在该模块上的掌握度，
 * 在卡片上展示实际学习进度而非静态难度值。
 */
export function ModuleProgress({
  moduleId,
  moduleName,
}: {
  moduleId: string;
  moduleName: string;
}) {
  const mastery = useStudentStore((state) => selectMastery(state, moduleId));

  if (mastery === null) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">学习进度</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            0 / {MASTERY_MAX_SCORE}
          </span>
        </div>
        <Progress
          value={0}
          max={MASTERY_MAX_SCORE}
          label={`${moduleName} 的学习进度`}
          className="h-1.5"
        />
      </div>
    );
  }

  const score = mastery.score;
  const level = levelOfMastery(score);
  const passed = score >= MASTERY_PASS_SCORE;

  const levelLabel: Record<string, string> = {
    优秀: "已精通",
    良好: "已达标",
    及格: "学习中",
    不及格: "需加强",
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">学习进度</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {score} / {MASTERY_MAX_SCORE}
        </span>
      </div>
      <Progress
        value={score}
        max={MASTERY_MAX_SCORE}
        label={`${moduleName} 的学习进度 ${score} / ${MASTERY_MAX_SCORE}`}
        className="h-1.5"
        indicatorClassName={passed ? "bg-emerald-500" : "bg-amber-500"}
      />
      <span
        className={`text-[11px] ${passed ? "text-emerald-600" : "text-amber-600"}`}
      >
        {levelLabel[level ?? ""] ?? level}
      </span>
    </div>
  );
}
