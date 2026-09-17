/**
 * 编排层：出题循环
 *
 * 设计依据 `agent-prompts-lib.md`「三、编排层提示词 → question-loop.md」：
 *   1. 调用出题 Agent
 *   2. Zod 校验输出
 *   3. 格式错误 → 重试
 *   4. 格式正确 → 返回题目
 *   5. 学生作答 → 进入校验循环
 *
 * 本文件负责第 1、4 步（2、3 在 `runAgent` 里），第 5 步由 `teaching-loop.ts` 编排。
 *
 * 「不重复已有题目」为什么要在代码里再拦一道
 * ---------------------------------
 * 出题 Agent 的 system prompt 里写了这条约束，执行步骤里也要求先读
 * `quiz-bank`，但模型仍会重复 —— 它看不到完整题库，或看到了也没比对上。
 * 所以这里把**已有的题干原文**一并喂进去（`existingQuestions`），并在拿到结果后
 * 用**归一化文本**比对做一次过滤：真重复的直接剔除。
 * 两道防线都失效时，宁可少给一道题也不给重题 —— 重复练习对掌握度没有增量。
 */

import { examinerFallback } from "../fallback";
import type { ExaminerOutput } from "../outputs";
import { runAgent } from "../runtime";
import type { ArkEnv } from "../ark";

/** 一次生成的题目数量。`02-agent-system.md` 与各 Skill 均按 3 道设计。 */
export const DEFAULT_QUESTION_COUNT = 3;

export interface QuestionLoopInput {
  moduleId: string;
  conceptId: string;
  /** 学生掌握度（0-5）。出题 Agent 据此定难度。 */
  mastery?: number;
  /** 已有题目的题干，用于去重。 */
  existingQuestions?: readonly string[];
  count?: number;
  maxRetries?: number;
  env?: ArkEnv;
  signal?: AbortSignal;
}

export interface QuestionLoopResult {
  questions: ExaminerOutput["questions"];
  /** 被去重逻辑剔除的题目数。非 0 说明模型重复出题了。 */
  duplicatesRemoved: number;
  attempts: number;
  usedFallback: boolean;
  tokens: { input: number; output: number };
  durationMs: number;
}

/**
 * 题干归一化，用于比对是否重复。
 *
 * 去掉空白与标点：同一个意思的题，模型换个标点或换行就会写成不同字符串，
 * 用原文比对几乎必然漏判。
 */
export function normalizeQuestion(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]/gu, "");
}

/**
 * 跑一次出题。
 *
 * 去重在**拿到结果之后**再做一次：把题干喂给模型只是降低概率，不是保证。
 */
export async function runQuestionLoop(
  input: QuestionLoopInput,
): Promise<QuestionLoopResult> {
  const {
    moduleId,
    conceptId,
    mastery,
    existingQuestions = [],
    count = DEFAULT_QUESTION_COUNT,
    maxRetries,
    env,
    signal,
  } = input;

  const result = await runAgent({
    agent: "examiner",
    skill: "generate-question",
    input: {
      module_id: moduleId,
      concept_id: conceptId,
      ...(mastery === undefined ? {} : { mastery }),
      count,
      // 把已有题干原文交给模型：让它自己先避开，比事后剔除更省 token。
      existing_questions: existingQuestions,
    },
    ...(maxRetries === undefined ? {} : { maxRetries }),
    fallback: examinerFallback,
    env,
    signal,
  });

  const output = result.data ?? examinerFallback();

  const seen = new Set(existingQuestions.map(normalizeQuestion));
  const kept = [];
  let duplicatesRemoved = 0;
  for (const question of output.questions) {
    const key = normalizeQuestion(question.question);
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(key);
    kept.push(question);
  }

  return {
    questions: kept,
    duplicatesRemoved,
    attempts: result.attempts,
    usedFallback: result.usedFallback,
    tokens: result.tokens,
    durationMs: result.durationMs,
  };
}
