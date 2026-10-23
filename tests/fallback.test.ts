import { describe, expect, it } from "vitest";

import {
  assistantFallback,
  examinerFallback,
  lowerDifficultyInstruction,
  reviewerFallback,
  teacherFallback,
} from "@/lib/agent/fallback";

/**
 * 兜底输出的两条铁律：「诚实」（能被识别是兜底、绝不冒充真实评分）与
 * 「不阻断」（给学生下一步动作）。这组用例钉的就是这两条 ——
 * 兜底一旦开始冒充真实评分，学生的掌握度就会被编出来的分数污染。
 */
describe("fallback：兜底必须诚实且可识别", () => {
  it("点评兜底带 usedFallback 语义的文案，并明确「不计入掌握度」", () => {
    const out = reviewerFallback("模型连续两次输出不合法");
    expect(out.total_score).toBe(0);
    expect(out.progress_note).toContain("本次自动评分未生效");
    expect(out.progress_note).toContain("不计入掌握度");
    // 具体原因落在维度说明里，界面能据此告诉学生「这次为什么没评」
    expect(out.dimensions[0]?.comment).toContain("模型连续两次输出不合法");
    expect(out.next_action).toBe("retry");
    expect(out.skill_condition_check?.met).toBe(false);
  });

  it("点评兜底不编造问题清单（没有证据就不列扣分项）", () => {
    expect(reviewerFallback("x").issues).toEqual([]);
  });

  it("讲解兜底给方向而不是编知识点，概念 id 原样带回", () => {
    const out = teacherFallback("agent-loop");
    expect(out.concept_id).toBe("agent-loop");
    expect(out.type).toBe("question");
    expect(out.next_action).toBe("continue");
  });

  it("出题兜底不出一题 —— 出错了题等于直接教错", () => {
    const out = examinerFallback();
    expect(out.questions).toEqual([]);
    expect(out.total_count).toBe(0);
  });

  it("答疑兜底把这次失败记成一条信号（should_log）", () => {
    const out = assistantFallback();
    expect(out.should_log).toBe(true);
    expect(out.log_category).toBe("概念困惑");
    expect(out.hint_level).toBeNull();
  });
});

describe("fallback：连续失败三次才降难度", () => {
  it("前两次不附加任何指令", () => {
    expect(lowerDifficultyInstruction(1)).toBe("");
    expect(lowerDifficultyInstruction(2)).toBe("");
  });

  it("第三次开始给换类比、拆步骤、留一处让学生补", () => {
    const text = lowerDifficultyInstruction(3);
    expect(text).toContain("连续 3 次没有通过");
    expect(text).toContain("换一个更贴近日常的类比");
    expect(text).toContain("拆成更小的步骤");
    expect(text).toContain("只留最关键的一处");
  });

  it("次数原样写进指令，学生看到的是真实尝试次数", () => {
    expect(lowerDifficultyInstruction(7)).toContain("连续 7 次没有通过");
  });
});
