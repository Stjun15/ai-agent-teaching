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
 * 关于「通过条件」实现到哪一层（2026-10-21 重构）
 * --------------------------------------------------
 * 此前通过条件按 task_type 分四档（prompt/tool/code/qa），代码里硬编码
 * "code 类无条件通过"。2026-10-21 为 11 个教学模块各写了一份专属 Skill，
 * 每个 Skill 自带通过条件（skill_condition_check）。代码层不再区分 task_type，
 * 只守共性三条 + 尊重模型在 skill_condition_check 中的判定。
 */

import { readPageSync } from "@/wiki";
import { selectSections } from "@/lib/teaching-script";
import { lowerDifficultyInstruction, reviewerFallback } from "../fallback";
import { runAgent } from "../runtime";
import { moduleRubricSupplement } from "../skills/module-rubric";
import type { ReviewerOutput } from "../outputs";
import type { SkillId } from "../types";
import type { DashScopeEnv } from "../dashscope";
import type { TraceContext } from "../trace";

/** 通过线。三个校验 Skill 的通过条件一致。 */
export const PASS_SCORE = 75;

/** 模块 ID → 校验 Skill。每个教学模块有自己专属的点评方式。 */
export const VALIDATION_SKILLS: Record<string, SkillId> = {
  "ts-basics": "validate-ts-basics",
  "vibe-coding": "validate-vibe-coding",
  "llm-api": "validate-llm-api",
  "system-prompt": "validate-system-prompt",
  "tool-calling": "validate-tool-calling",
  "agent-loop": "validate-agent-loop",
  rag: "validate-rag",
  "llm-wiki": "validate-llm-wiki",
  "multi-agent": "validate-multi-agent",
  mcp: "validate-mcp",
  "ai-safety": "validate-ai-safety",
  // platform-replica 保留通用 code skill + supplement 兜底，不建专属 skill
  "platform-replica": "validate-code",
};

/** 向后兼容别名：taskType → Skill（platform-replica 的旧路由仍依赖此映射）。 */
export const VALIDATION_SKILLS_BY_TYPE: Record<string, SkillId> = {
  prompt: "validate-prompt",
  tool: "validate-tool",
  code: "validate-code",
  qa: "validate-qa",
};

/** 可被点评 Agent 校验的四种任务。取值与 `ValidationResult.taskType` 一致。 */
export type ValidationTaskType = "prompt" | "tool" | "code" | "qa";

export interface ValidationLoopInput {
  taskType: ValidationTaskType;
  /** 学生这次提交的内容。 */
  studentAnswer: string;
  moduleId: string;
  conceptId?: string;
  /**
   * 这次提交对应的题目原文（题面）。给了它，点评 Agent 才能对着
   * 「题面要求了什么」评分；不给（自主提交的作业没有题面），它只能按
   * 模块通用 rubric 评 —— 实测会把「答自己组织语言」误判成跑题。
   */
  questionText?: string;
  /**
   * 示范内容（code / tool 类任务的参考答案）。
   *
   * 来自概念页"示范代码"节 —— 观察步展示过的 demo。
   * 给了它，reviewer 评分时就有东西可对照：不是用"我猜的对不对"来评，
   * 而是用"demo 长这样，学生的和它比差在哪"来评。
   *
   * code / tool 类传此字段，qa 类不传（逐字比对会破坏"用自己的话"的教学目标）。
   * 空串视为未提供。
   */
  demoContent?: string;
  /** 学生上一次提交的内容。给了才能生成 `progress_note` 的对比。 */
  previousAnswer?: string;
  /**
   * 强制指定 Skill（覆盖 moduleId → Skill 路由）。
   *
   * 变式练习评分时使用：练习的题目是出题 Agent 动态生成的，
   * 与模块专属的动手题不是同一道题，不能走模块专属 Skill。
   * 设置此字段后，runValidationLoop 直接用它，不再查 VALIDATION_SKILLS 映射表。
   */
  forceSkill?: SkillId;
  /** 该生在这道题上的尝试次数（1 起）。>= 3 时触发降难度指令。 */
  attemptNumber?: number;
  maxRetries?: number;
  env?: DashScopeEnv;
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
 *
 * 判定分两层：
 * 1. 共性三条（得分 >= 75、is_correct、无严重错误）
 * 2. Skill 个性条件（skill_condition_check.met）
 *
 * 第二层交给模型判定（它读的就是那份评分标准 + Skill 内容，最清楚自己
 * 给每个维度的分数是否满足通过线）。代码只检查模型是否做了这个判断，
 * 不再按 task_type 硬编码额外条件。
 */
export function isPassing(review: ReviewerOutput): boolean {
  const hasSevereIssue = review.issues.some((i) => i.type === "严重错误");
  const commonPassed =
    review.total_score >= PASS_SCORE && review.is_correct && !hasSevereIssue;

  if (!commonPassed) return false;

  const check = review.skill_condition_check;
  if (!check) {
    // 模型未输出 skill_condition_check（旧版 prompt / 兜底）→ 仅共性三条
    return true;
  }

  return check.met;
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
    questionText,
    demoContent,
    previousAnswer,
    forceSkill,
    attemptNumber = 1,
    maxRetries,
    env,
    signal,
    trace,
  } = input;

  const lower = lowerDifficultyInstruction(attemptNumber);
  const rubricSupplement = moduleRubricSupplement(moduleId);

  let moduleContext = "";
  try {
    const page = readPageSync(`concepts/${moduleId}.md`);
    const sections = selectSections(page.body, [
      "definition",
      "keyPoints",
      "misconceptions",
    ]);
    moduleContext = sections.join("\n\n");
  } catch {
    // 概念页缺失时静默降级。
  }

  let rubricContext = "";
  try {
    const rubricPage = readPageSync(`validation/${moduleId}-rubric.md`);
    rubricContext = rubricPage.body;
  } catch {
    try {
      const rubricPage = readPageSync(`validation/${taskType}-rubric.md`);
      rubricContext = rubricPage.body;
    } catch {
      // rubric 文件缺失时静默降级。
    }
  }

  // forceSkill 优先：变式练习评分需要走通用评分 Skill，不能走模块专属 Skill。
  // 其次是模块专属 Skill；未注册的 moduleId 回退 taskType 路由。
  const skill: SkillId =
    forceSkill ??
    VALIDATION_SKILLS[moduleId] ??
    VALIDATION_SKILLS_BY_TYPE[taskType] ??
    "validate-code";

  const result = await runAgent({
    agent: "reviewer",
    skill,
    ...(rubricSupplement === undefined
      ? {}
      : { skillSupplement: rubricSupplement }),
    input: {
      task_type: taskType,
      student_answer: studentAnswer,
      module_id: moduleId,
      module_context: moduleContext,
      rubric_context: rubricContext,
      ...(conceptId ? { concept_id: conceptId } : {}),
      ...(questionText ? { question_text: questionText } : {}),
      ...(demoContent ? { demo_content: demoContent } : {}),
      ...(previousAnswer ? { previous_answer: previousAnswer } : {}),
      attempt_number: attemptNumber,
      ...(lower ? { teaching_strategy: lower } : {}),
    },
    ...(maxRetries === undefined ? {} : { maxRetries }),
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