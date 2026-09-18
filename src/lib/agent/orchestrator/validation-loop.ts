/**
 * 编排层：校验循环
 *
 * 设计依据 `agent-prompts-lib.md`「三、编排层提示词 → validation-loop.md」：
 *   1. 调用点评 Agent
 *   2. Zod 校验输出格式
 *   3. 格式错误 → 附带错误重试（最多 2 次）
 *   4. 格式正确 → 判断 is_correct
 *   5. 通过 → 返回 success
 *   6. 不通过 → 给反馈，等待修改
 *   7. 3 次未通过 → 降难度
 *
 * 第 2、3 步 `runAgent` 已经承担（见 `runtime.ts`），本文件负责第 1、4~7 步。
 *
 * 关于「通过条件」实现到哪一层
 * ----------------------
 * 三个校验 Skill 各有通过条件，共性三条与个性一条：
 *   共性：total_score >= 75、is_correct = true、无严重错误。
 *   个性：validate-prompt 另要求「角色定义 >= 60% 权重分」，
 *         validate-tool 另要求「参数 >= 70% 权重分」。
 * **这里只实现共性三条**。个性那条依赖模型返回的维度名与提示词里的措辞
 * 完全一致（"角色定义" 一个字都不能差），而实践中模型会写成「角色设定」
 * 「角色设定清晰度」等变体 —— 用代码去匹配会把「其实通过了」判成不通过，
 * 或反过来。这类判断交给模型（它读的就是那份评分标准），代码只守住
 * 不依赖措辞的三条硬条件。
 */

import { lowerDifficultyInstruction, reviewerFallback } from "../fallback";
import { runAgent } from "../runtime";
import type { ReviewerOutput } from "../outputs";
import type { SkillId } from "../types";
import type { ArkEnv } from "../ark";
import type { TraceContext } from "../trace";

/** 通过线。三个校验 Skill 的通过条件一致。 */
export const PASS_SCORE = 75;

/** 任务类型 → 校验 Skill。 */
export const VALIDATION_SKILLS: Record<ValidationTaskType, SkillId> = {
  prompt: "validate-prompt",
  tool: "validate-tool",
  code: "validate-code",
};

/** 可被点评 Agent 校验的三种任务。取值与 `ValidationResult.taskType` 一致。 */
export type ValidationTaskType = "prompt" | "tool" | "code";

export interface ValidationLoopInput {
  taskType: ValidationTaskType;
  /** 学生这次提交的内容。 */
  studentAnswer: string;
  moduleId: string;
  conceptId?: string;
  /** 学生上一次提交的内容。给了才能生成 `progress_note` 的对比。 */
  previousAnswer?: string;
  /** 该生在这道题上的尝试次数（1 起）。>= 3 时触发降难度指令。 */
  attemptNumber?: number;
  maxRetries?: number;
  env?: ArkEnv;
  signal?: AbortSignal;
  /** Trace 上下文。由 HTTP 路由层构造，编排层只透传；见 question-loop.ts 同名参数。 */
  trace?: TraceContext;
}

export interface ValidationLoopResult {
  /** 是否通过：分数达标 + is_correct + 无严重错误。 */
  success: boolean;
  review: ReviewerOutput;
  /** 编排层的下一步动作。 */
  nextAction: "pass" | "retry" | "lower_difficulty";
  /** runAgent 的实际尝试次数。 */
  attempts: number;
  /** 是否用了兜底输出。**用了兜底时必须跳过掌握度更新**。 */
  usedFallback: boolean;
  tokens: { input: number; output: number };
  durationMs: number;
}

/**
 * 判断一份点评结果是否通过。
 *
 * 单独导出为纯函数：通过条件是**规则**，不是过程，必须能脱离模型直接断言。
 */
export function isPassing(review: ReviewerOutput): boolean {
  const hasSevereIssue = review.issues.some((i) => i.type === "严重错误");
  return (
    review.total_score >= PASS_SCORE && review.is_correct && !hasSevereIssue
  );
}

/**
 * 跑一次校验。
 *
 * 注意 `success` 与 `nextAction` 的区别：`success` 是**这次是否通过**，
 * `nextAction` 是**接下来做什么**。两者在「兜底」时不同步 ——
 * 兜底一定不通过（不能拿编的分数当通过），但动作是 retry 而不是 lower_difficulty，
 * 因为学生还没真正失败，是系统没评出来。
 */
export async function runValidationLoop(
  input: ValidationLoopInput,
): Promise<ValidationLoopResult> {
  const {
    taskType,
    studentAnswer,
    moduleId,
    conceptId,
    previousAnswer,
    attemptNumber = 1,
    maxRetries,
    env,
    signal,
    trace,
  } = input;

  const lower = lowerDifficultyInstruction(attemptNumber);

  const result = await runAgent({
    agent: "reviewer",
    skill: VALIDATION_SKILLS[taskType],
    input: {
      task_type: taskType,
      student_answer: studentAnswer,
      module_id: moduleId,
      ...(conceptId ? { concept_id: conceptId } : {}),
      ...(previousAnswer ? { previous_answer: previousAnswer } : {}),
      attempt_number: attemptNumber,
      ...(lower ? { teaching_strategy: lower } : {}),
    },
    ...(maxRetries === undefined ? {} : { maxRetries }),
    // 兜底：重试用尽时给一个「未评分」的安全输出，而不是让学生面对报错。
    fallback: () => reviewerFallback("模型输出未通过校验"),
    env,
    signal,
    trace,
  });

  // 兜底路径下 data 一定存在（fallback 提供了）；非兜底失败时不应发生，
  // 但类型上 data 仍可选，这里显式兜住，避免把 undefined 传给下游。
  const review = result.data ?? reviewerFallback(result.error ?? "未知原因");

  if (result.usedFallback) {
    return {
      success: false,
      review,
      nextAction: "retry",
      attempts: result.attempts,
      usedFallback: true,
      tokens: result.tokens,
      durationMs: result.durationMs,
    };
  }

  const success = isPassing(review);
  const nextAction = success
    ? "pass"
    : attemptNumber >= 3
      ? "lower_difficulty"
      : "retry";

  return {
    success,
    review,
    nextAction,
    attempts: result.attempts,
    usedFallback: false,
    tokens: result.tokens,
    durationMs: result.durationMs,
  };
}
