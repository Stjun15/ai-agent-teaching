/**
 * 编排层：作答评分循环
 *
 * 教学七步里「练习 → 作答 → 评分」这一步此前在代码里是缺位的：
 * - generate-question 只出题不落库（questions 表无写入，见 question-results.ts 的说明）；
 * - 没有任何函数把学生作答判对错、算分、写回 question_results。
 * 本文件补齐「评分」这一环，并区分两类题的评分策略：
 *
 *   客观题（选择题 / 填空题）：纯规则判分（归一化后精确比对 correct_answer）。
 *     确定性、零模型开销、可单测 —— 走 gradeObjective 纯函数。
 *   主观题（简答题 / 实战题）：复用点评 Agent（reviewer，validate 已落地）做 AI 批改，
 *     复用现有模型路径，不新增 Agent。
 *
 * 评分结果统一为 Assessment，由调用方（answer-grade 路由）写入 question_results。
 */

import { runValidationLoop } from "./validation-loop";
import type { ArkEnv } from "../ark";
import type { ValidationTaskType } from "./validation-loop";

/** 评分结论。 */
export interface Assessment {
  isCorrect: boolean;
  score: number;
  feedback: string;
  /** 判分来源：规则（客观题）或模型（主观题）。 */
  gradedBy: "rule" | "model";
}

/** 评分所需的题目最小信息（来自题库行或出题输出）。 */
export interface GradeableQuestion {
  type: string;
  correctAnswer: string;
  explanation: string;
}

/** 客观题类型：可规则判分。 */
const OBJECTIVE_TYPES = new Set(["选择题", "填空题"]);

/**
 * 主观题 → 点评任务类型映射。
 *
 * 点评 Agent 只有 prompt / tool / code 三种技能；简答题贴近「表达/表述」用 prompt，
 * 实战题贴近「动手实现」用 code。这只是粗略归并 —— 评分质量由模型根据
 * student_answer 与 module 语境把握，归类只决定走哪个 skill。
 */
const SUBJECTIVE_TASK_TYPE: Record<string, ValidationTaskType> = {
  简答题: "prompt",
  实战题: "code",
};

/**
 * 归一化：去空白与标点后小写。
 * 与 question-loop.ts 的 normalizeQuestion 同一思路（避免标点/空格差异误判）。
 */
function normalize(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();
}

/**
 * 客观题规则判分（纯函数，可脱离模型直接断言）。
 *
 * 为什么只用归一化精确比对
 * ----------------------
 * 选择题/填空题的正确答案唯一且短，归一化后比对足够稳；简答题的正确答案
 * 是模型给出的参考文本，逐字比对必误，因此交给模型（见 runAssessLoop）。
 */
export function gradeObjective(
  question: GradeableQuestion,
  studentAnswer: string,
): Assessment {
  const correct = normalize(question.correctAnswer);
  const given = normalize(studentAnswer);
  const isCorrect = correct.length > 0 && correct === given;
  return {
    isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect
      ? `回答正确。${question.explanation}`
      : `回答有误。正确答案：${question.correctAnswer}。${question.explanation}`,
    gradedBy: "rule",
  };
}

export interface AssessLoopInput {
  question: GradeableQuestion;
  studentAnswer: string;
  moduleId: string;
  conceptId?: string;
  env?: ArkEnv;
  signal?: AbortSignal;
}

/**
 * 评分入口：客观题走规则，主观题复用点评 Agent。
 *
 * 主观题把题面类型映射成点评任务类型（简答题→prompt、实战题→code），
 * 交给 reviewer 点评 —— 复用 validate 已落地的模型路径，评分的 is_correct /
 * total_score 直接映射成答题结果。
 */
export async function runAssessLoop(
  input: AssessLoopInput,
): Promise<Assessment> {
  if (OBJECTIVE_TYPES.has(input.question.type)) {
    return gradeObjective(input.question, input.studentAnswer);
  }

  const taskType = SUBJECTIVE_TASK_TYPE[input.question.type] ?? "prompt";
  const result = await runValidationLoop({
    taskType,
    studentAnswer: input.studentAnswer,
    moduleId: input.moduleId,
    conceptId: input.conceptId ?? input.moduleId,
    attemptNumber: 1,
    env: input.env,
    signal: input.signal,
  });

  const review = result.review;
  return {
    isCorrect: review.is_correct,
    score: review.total_score,
    feedback:
      review.progress_note ??
      `${review.level}：评分 ${review.total_score} / 100`,
    gradedBy: "model",
  };
}
