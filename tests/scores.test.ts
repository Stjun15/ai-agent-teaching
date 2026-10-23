import { describe, expect, it } from "vitest";

import {
  MASTERY_MAX_SCORE,
  MASTERY_PASS_SCORE,
  PROMPT_SCORE_MAX,
  levelOfMastery,
  masteryScoreFromPromptScore,
  masteryToPercent,
} from "@/lib/scores";

describe("分数量纲", () => {
  it("掌握度 0~5 转百分比时夹在边界内", () => {
    expect(masteryToPercent(5)).toBe(100);
    expect(masteryToPercent(3)).toBe(60);
    expect(masteryToPercent(-1)).toBe(0);
    expect(masteryToPercent(10)).toBe(100);
    expect(masteryToPercent(Number.NaN)).toBe(0);
  });

  it("掌握度分档与达标线一致", () => {
    expect(levelOfMastery(4)).toBe("优秀");
    expect(levelOfMastery(MASTERY_PASS_SCORE)).toBe("良好");
    expect(levelOfMastery(2)).toBe("及格");
    expect(levelOfMastery(0)).toBe("不及格");
  });

  it("点评分 0~100 转掌握度并夹到 [0, 5]", () => {
    expect(masteryScoreFromPromptScore(PROMPT_SCORE_MAX)).toBe(
      MASTERY_MAX_SCORE,
    );
    // 75 分是点评通过线：必须落在「良好」这一档，两条门槛不能打架。
    expect(masteryScoreFromPromptScore(75)).toBe(4);
    expect(masteryScoreFromPromptScore(50)).toBe(3);
    expect(masteryScoreFromPromptScore(-10)).toBe(0);
    expect(masteryScoreFromPromptScore(200)).toBe(MASTERY_MAX_SCORE);
    expect(masteryScoreFromPromptScore(Number.NaN)).toBe(0);
  });
});
