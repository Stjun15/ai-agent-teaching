import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * 掌握度指示（模块页左栏）。
 *
 * 一个刻意的设计选择：**未测评就显示「尚未测评」，不显示 0%**
 * ---------------------------------------------------------
 * 0% 和「没测过」是两件事。学生还没做过任何练习时给出一个 0 的进度条，
 * 传达的是「你很差」，而事实是「还没有数据」。掌握式学习（`00-MASTER.md`
 * 的总框架）尤其不能这样 —— 它的前提是「先测、再判、再补」。
 * 所以本组件的取值类型是 `number | null`，`null` 有专门的分支。
 *
 * 掌握度门槛取自 `rubrics.md` 的四档（优秀 / 良好 / 及格 / 不及格）中的
 * 「及格」线；调用方传入的 `level` 由校验结果直接带过来，不在这里重算
 * —— 档位口径只应有一处（`rubrics.md` → 校验 Agent）。
 */
export function MasteryIndicator({
  moduleName,
  mastery,
  level,
  caption,
  className,
}: {
  moduleName: string;
  /** 0~100；`null` 表示尚无测评数据。 */
  mastery: number | null;
  /** 与 `rubrics.md` 四档一致；无数据时省略。 */
  level?: "优秀" | "良好" | "及格" | "不及格";
  /**
   * 口径说明（2026-09-19 加）：零基础走查发现学生分不清「模块页 80 分」
   * 与「报告页平均 47 分」—— 前者是本概念的分数换算，后者是全部概念的
   * 平均。数据都对，但页面不解释口径，看起来就像数字打架。
   */
  caption?: string;
  className?: string;
}) {
  const hasData = mastery !== null;

  return (
    <section
      aria-label="掌握度"
      className={cn("flex flex-col gap-2", className)}
    >
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        掌握度
      </h2>

      {hasData ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-semibold tabular-nums">
              {Math.round(mastery)}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / 100
              </span>
            </span>
            {level ? (
              <Badge
                variant={
                  level === "优秀" || level === "良好"
                    ? "levelLow"
                    : level === "及格"
                      ? "levelMid"
                      : "levelHigh"
                }
              >
                {level}
              </Badge>
            ) : null}
          </div>
          <Progress
            value={mastery}
            label={`${moduleName} 的掌握度 ${Math.round(mastery)} 分`}
            indicatorClassName={
              mastery >= 60 ? "bg-emerald-500" : "bg-amber-500"
            }
          />
          {caption ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {caption}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          尚未测评。
          <br />
          完成一次「校验点评」后这里会显示分项得分。
        </p>
      )}
    </section>
  );
}
