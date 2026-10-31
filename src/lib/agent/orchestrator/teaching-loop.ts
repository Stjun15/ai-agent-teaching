/**
 * 编排层：教学主循环
 *
 * 设计依据 `agent-prompts-lib.md`「三、编排层提示词 → teaching-loop.md」九步：
 *   1. 前置检查（前置模块掌握度 ≥ 3）
 *   2. 讲解 Agent：讲概念 + 可视化
 *   3. 检验问题：等待学生回答
 *   4. 出题 Agent：生成 3 道题
 *   5. 学生作答 → 校验循环（最多 3 次）
 *   6. 通过 → 触发可视化
 *   7. 更新掌握度
 *   8. 更新学习路径
 *   9. 掌握度 ≥ 4 → 进入下一模块
 *
 * 本文件实现 1~6。第 7~9 步要写数据库（`mastery` / `learning_paths`），
 * 属 Phase 5「数据与接口」，此处**刻意不发明接口** —— 编排层只返回
 * 「该更新成什么」，由接入数据库的调用方执行。
 *
 * 为什么做成状态机而不是一个长函数
 * --------------------------
 * 教学循环跨多次 HTTP 请求（讲完要等学生回答、出完题要等学生提交），
 * 不可能在一个请求里跑完。所以每一步都是一个**可独立调用的函数**：
 * 调用方把上一步的状态存起来，下一步再传进来。
 * 状态用普通对象而不是类：它要能被序列化进会话/数据库。
 */

import { isSceneId, type SceneId } from "../scene-ids";
import { MODULE_SCENE_IDS } from "@/lib/modules";
import { teacherFallback } from "../fallback";
import type { TeacherOutput } from "../outputs";
import { runAgent } from "../runtime";
import type { DashScopeEnv } from "../dashscope";
import type { TraceContext } from "../trace";

import { runQuestionLoop, type QuestionLoopResult } from "./question-loop";
import {
  runValidationLoop,
  type ValidationLoopResult,
  type ValidationTaskType,
} from "./validation-loop";

/** 进入下一模块所需的掌握度。teaching-loop.md 第 9 步。 */
export const MASTERY_TO_ADVANCE = 4;

/** 前置模块的最低掌握度。teaching-loop.md 第 1 步。 */
export const PREREQUISITE_MIN_MASTERY = 3;

/** 校验循环的最大尝试次数。teaching-loop.md 第 5 步。 */
export const MAX_VALIDATION_ATTEMPTS = 3;

/** 教学循环的阶段。 */
export type TeachingPhase =
  "explain" | "check" | "practice" | "validate" | "visualize" | "complete";

/** 跨请求保存的教学状态。可序列化。 */
export interface TeachingState {
  moduleId: string;
  conceptId: string;
  phase: TeachingPhase;
  /** 当前任务的尝试次数（1 起）。 */
  attemptNumber: number;
  /** 学生对该概念的掌握度（0-5）；null = 尚未测评。 */
  mastery?: number | null;
}

/** 每一步的产出。字段按阶段可选，调用方按 `phase` 取。 */
export interface TeachingStepResult {
  /** 下一步的状态。**调用方必须持久化它**，否则循环断。 */
  state: TeachingState;
  /** 讲解阶段：讲解 Agent 的输出。 */
  teaching?: TeacherOutput;
  /** 讲解是否动用了兜底（模型输出未通过校验）。 */
  usedFallback?: boolean;
  /** 练习阶段：生成的题目。 */
  questions?: QuestionLoopResult;
  /** 校验阶段：点评结果。 */
  validation?: ValidationLoopResult;
  /** 可视化阶段：要点播的场景。 */
  sceneId?: SceneId | null;
}

/**
 * 讲解阶段。
 *
 * 前置检查合在这里做：掌握度不足时给讲解 Agent 加一段「先回顾前置」的指令，
 * 而不是另开一个阶段 —— 两者最终都是「讲一遍」，只是讲的内容不同。
 */
export async function runExplainStep(options: {
  state: TeachingState;
  /** 前置模块的掌握度；不传视为「无前置」。 */
  prerequisiteMastery?: number | null;
  env?: DashScopeEnv;
  signal?: AbortSignal;
  /** Trace 上下文。由 HTTP 路由层构造（那里才知道学生身份），编排层只透传。 */
  trace?: TraceContext;
}): Promise<TeachingStepResult> {
  const { state, prerequisiteMastery, env, signal, trace } = options;

  const needsReview =
    prerequisiteMastery !== undefined &&
    prerequisiteMastery !== null &&
    prerequisiteMastery < PREREQUISITE_MIN_MASTERY;

  const result = await runAgent({
    agent: "teacher",
    skill: "explain-concept",
    input: {
      module_id: state.moduleId,
      concept_id: state.conceptId,
      ...(state.mastery === undefined ? {} : { mastery: state.mastery }),
      ...(prerequisiteMastery === undefined
        ? {}
        : { prerequisite_mastery: prerequisiteMastery }),
      ...(needsReview
        ? {
            instruction: `学生前置模块掌握度为 ${prerequisiteMastery}（低于 ${PREREQUISITE_MIN_MASTERY}）。请先回顾前置概念，再讲当前概念。`,
          }
        : {}),
    },
    fallback: () => teacherFallback(state.conceptId),
    env,
    signal,
    trace,
  });

  const teaching = result.data ?? teacherFallback(state.conceptId);

  return {
    state: { ...state, phase: "check" },
    teaching,
    usedFallback: result.usedFallback,
  };
}

/**
 * 检验问题阶段：判断学生的回答是否达标。
 *
 * 判据是**关键词命中**（`expected_keywords` 里命中任一个即算过）。
 * 这是启发式，不是理解力判断 —— 更可靠的做法是让模型判，但那要再花一次调用。
 * 命中即过的取舍：宁可放过，也不要因为措辞不同把懂了的学生卡住。
 */
export function runCheckStep(options: {
  state: TeachingState;
  expectedKeywords: readonly string[];
  studentAnswer: string;
}): TeachingStepResult {
  const { state, expectedKeywords, studentAnswer } = options;

  const normalized = studentAnswer.toLowerCase();
  const hit = expectedKeywords.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );

  if (hit) {
    return { state: { ...state, phase: "practice", attemptNumber: 1 } };
  }

  // 没答对：回到讲解，并把尝试次数加一（连续答错会触发降难度）。
  return {
    state: {
      ...state,
      phase: "explain",
      attemptNumber: state.attemptNumber + 1,
    },
  };
}

/** 练习阶段：出 3 道题。 */
export async function runPracticeStep(options: {
  state: TeachingState;
  existingQuestions?: readonly string[];
  env?: DashScopeEnv;
  signal?: AbortSignal;
  /** Trace 上下文。见 runExplainStep 同名参数。 */
  trace?: TraceContext;
}): Promise<TeachingStepResult> {
  const { state, existingQuestions, env, signal, trace } = options;

  const questions = await runQuestionLoop({
    moduleId: state.moduleId,
    conceptId: state.conceptId,
    ...(state.mastery === undefined || state.mastery === null
      ? {}
      : { mastery: state.mastery }),
    ...(existingQuestions ? { existingQuestions } : {}),
    env,
    signal,
    trace,
  });

  return { state: { ...state, phase: "validate" }, questions };
}

/**
 * 校验阶段：学生提交作业后调用。
 *
 * 达到 `MAX_VALIDATION_ATTEMPTS` 仍不通过时，动作是「降难度」而不是无限重试 ——
 * 对应 teaching-loop.md 的异常处理第一条。
 */
export async function runValidateStep(options: {
  state: TeachingState;
  taskType: ValidationTaskType;
  studentAnswer: string;
  previousAnswer?: string;
  env?: DashScopeEnv;
  signal?: AbortSignal;
  /** Trace 上下文。见 runExplainStep 同名参数。 */
  trace?: TraceContext;
}): Promise<TeachingStepResult> {
  const { state, taskType, studentAnswer, previousAnswer, env, signal, trace } =
    options;

  const validation = await runValidationLoop({
    taskType,
    studentAnswer,
    moduleId: state.moduleId,
    conceptId: state.conceptId,
    ...(previousAnswer ? { previousAnswer } : {}),
    attemptNumber: state.attemptNumber,
    env,
    signal,
    trace,
  });

  if (validation.success) {
    return {
      state: { ...state, phase: "visualize", attemptNumber: 1 },
      validation,
    };
  }

  const exhausted = state.attemptNumber >= MAX_VALIDATION_ATTEMPTS;
  return {
    state: {
      ...state,
      // 重试次数用尽 → 回到讲解并降难度；否则留在练习阶段再来一次。
      phase: exhausted ? "explain" : "practice",
      attemptNumber: state.attemptNumber + 1,
    },
    validation,
  };
}

/**
 * 可视化阶段：解析要点播的场景。
 *
 * 场景来自两处，优先级：讲解 Agent 显式指定 > 模块默认场景。
 * 两处都要过 `isSceneId` —— 模型输出的场景 ID 是 `string`，
 * 直接透传会让前端拿到一个不存在的场景而**静默空白**。
 */
export function runVisualizeStep(options: {
  state: TeachingState;
  /** 讲解 Agent 输出里的 `visualize_scene`。 */
  preferredScene?: string;
}): TeachingStepResult {
  const { state, preferredScene } = options;

  const fallbackScene = MODULE_SCENE_IDS[state.moduleId];
  const sceneId =
    preferredScene !== undefined && isSceneId(preferredScene)
      ? preferredScene
      : fallbackScene !== undefined && isSceneId(fallbackScene)
        ? fallbackScene
        : null;

  return {
    state: { ...state, phase: "complete" },
    sceneId,
  };
}
