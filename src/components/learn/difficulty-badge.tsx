import { Badge } from "@/components/ui/badge";
import { MAX_DIFFICULTY } from "@/lib/modules";

/**
 * 难度徽标。
 *
 * 三档阈值（1~2 入门 / 3 进阶 / 4~5 挑战）在此**唯一处**定义：
 * 学习中心的卡片、模块页的标题栏、将来的学习路径缩略图都要用同一个口径。
 */

const LOW_MAX = 2;
const MID_MAX = 3;

function levelOf(difficulty: number): "low" | "mid" | "high" {
  if (difficulty <= LOW_MAX) return "low";
  if (difficulty <= MID_MAX) return "mid";
  return "high";
}

const LEVEL_TEXT = {
  low: "入门",
  mid: "进阶",
  high: "挑战",
} as const;

const LEVEL_VARIANT = {
  low: "levelLow",
  mid: "levelMid",
  high: "levelHigh",
} as const;

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: number;
  className?: string;
}) {
  const level = levelOf(difficulty);

  return (
    <Badge variant={LEVEL_VARIANT[level]} className={className}>
      难度 {difficulty}/{MAX_DIFFICULTY} · {LEVEL_TEXT[level]}
    </Badge>
  );
}
