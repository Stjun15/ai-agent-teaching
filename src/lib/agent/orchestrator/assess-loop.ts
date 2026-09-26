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
import type { TraceContext } from "../trace";
import type { ValidationTaskType } from "./validation-loop";
import type { ReviewerOutput } from "../outputs";

/** 评分结论。 */
export interface Assessment {
  isCorrect: boolean;
  score: number;
  feedback: string;
  /** 判分来源：规则（客观题）或模型（主观题）。 */
  gradedBy: "rule" | "model";
  /**
   * 兜底结论：这不是模型的真实判断（`fallback.ts` 的 0 分只是「没有分数」），
   * 调用方**不得**据此写 question_results 或 errors —— 编的失败不是学生的失败。
   */
  usedFallback: boolean;
  /**
   * 主观题时携带点评任务类型与完整点评输出，供调用方写错题（problems、
   * correct_example 这些字段只有点评输出里有）；客观题走规则，为 undefined。
   */
  review?: { taskType: ValidationTaskType; output: ReviewerOutput };
}

/** 评分所需的题目最小信息（来自题库行或出题输出）。 */
export interface GradeableQuestion {
  type: string;
  /**
   * 题面原文。主观题评分必须把它带给点评 Agent（question_text）——
   * 不带的话模型只能按模块通用 rubric 猜题目要求，实测会判出
   * 「题面让说明改进思路，点评却要求交出 prompt 文本」这类脱节结论。
   */
  text: string;
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
 * 剥离答案里的括号备注。
 *
 * 出题 Agent 实测会把可接受变体的说明写进 correct_answer（如
 * 「晴（或任何合理的天气描述，如多云、小雨等）」）—— 备注不是答案本身，
 * 拿整串去比对，学生答「晴，东南风 3 级」也会被判错。生成侧已在提示词
 * 约束（见 examiner.ts），这里兜住存量题与漏网之鱼。
 */
function canonicalAnswer(correct: string): string {
  return correct.replace(/[（(][^（）()]*[）)]/g, "");
}

/**
 * 从选项文本开头提取选项字母（「A. …」「B、…」→ a/b），没有字母前缀返回 null。
 *
 * 出题 Agent 生成的选择题，题库里 correct_answer 存选项字母、options 存
 * 「A. 整段文本」，而界面上送的是整段选项文本 —— 两种形态必须在这里对账，
 * 否则**答对也判 0 分**（2026-09-19 生产走查实测）。从原始文本提取而不从
 * 归一化后的文本提取：归一化会剥掉字母后的分隔符，前缀就认不出来了。
 */
function leadingOptionLetter(text: string): string | null {
  const match = text.trim().match(/^([A-Da-d])\s*[.．、。:：]/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * 客观题规则判分（纯函数，可脱离模型直接断言）。
 *
 * 为什么不只用归一化精确比对
 * ------------------------
 * 三层放行，各自兜一类实测失败模式：
 *   1. 精确比对 —— 基线；
 *   2. 选择题的字母对账 —— 题库存字母、界面送整段选项文本（见
 *      leadingOptionLetter）；
 *   3. 填空题的包含比对 —— 学生填空常写成完整短句，覆盖标准答案即算对。
 * 方向是单向的：标准答案比学生答案长仍然判错（少答不算对）。
 *
 * 简答题的正确答案是模型给出的参考文本，逐字比对必误，因此交给模型
 * （见 runAssessLoop）。
 */
export function gradeObjective(
  question: GradeableQuestion,
  studentAnswer: string,
): Assessment {
  const correct = normalize(canonicalAnswer(question.correctAnswer));
  const given = normalize(studentAnswer);
  // 选择题：correct_answer 是单个选项字母时，比对界面送来的选项前缀字母。
  const isBareLetter = /^[a-d]$/.test(correct);
  const givenLetter = leadingOptionLetter(studentAnswer);
  const letterMatch =
    isBareLetter && givenLetter !== null && givenLetter === correct;
  const isCorrect =
    correct.length > 0 &&
    (correct === given ||
      letterMatch ||
      (question.type === "填空题" && given.includes(correct)));
  return {
    isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect
      ? `回答正确。${question.explanation}`
      : `回答有误。正确答案：${question.correctAnswer}。${question.explanation}`,
    gradedBy: "rule",
    usedFallback: false,
  };
}

export interface AssessLoopInput {
  question: GradeableQuestion;
  studentAnswer: string;
  moduleId: string;
  conceptId?: string;
  env?: ArkEnv;
  signal?: AbortSignal;
  /** Trace 上下文。客观题走规则判分、不调模型，此时无 trace 产生；主观题透传给点评 Agent。 */
  trace?: TraceContext;
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
    questionText: input.question.text,
    attemptNumber: 1,
    env: input.env,
    signal: input.signal,
    trace: input.trace,
  });

  const review = result.review;
  return {
    isCorrect: review.is_correct,
    score: review.total_score,
    feedback:
      review.progress_note ??
      `${review.level}：评分 ${review.total_score} / 100`,
    gradedBy: "model",
    usedFallback: result.usedFallback,
    // 兜底时不携带 review：调用方靠它区分「真判不通过」与「没评出来」，
    // 只有前者才该写错题。
    ...(result.usedFallback ? {} : { review: { taskType, output: review } }),
  };
}