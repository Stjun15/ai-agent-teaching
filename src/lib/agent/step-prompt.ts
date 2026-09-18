/**
 * 学习步骤 → 对话身份层的映射
 *
 * 为什么抽成独立文件
 * ----------------
 * 路由文件（`session/[id]/message`）带着鉴权、限流、SSE 一堆副作用，
 * 测试脚本没法安全地 import 它。这里只有一张表和一个纯函数 ——
 * 「哪些步骤该由讲解导师接管」这条规则因此可以被单独钉住。
 *
 * 为什么只覆盖三个步骤
 * ----------------
 * `StepType` 有七个取值，其中 `validate` / `practice` / `mastery`
 * 对应的点评、出题 Agent **输出是严格 JSON**（`ReviewerOutput` /
 * `ExaminerOutput`）。它们不是用来聊天的：那些 visitor output 要进数据库、
 * 要被 Zod 校验，而 SSE 对话流是把模型的每一个字直接吐给学生的 ——
 * 让点评 Agent 上对话流，学生看到的就是一坨 JSON 原文。
 *
 * 所以这三个步骤的正式接入方式是 `/api/agent/validate` 与
 * `/api/agent/generate-question`（结构化端点），不是这里。
 * 此处**刻意留白**：它们的轮次仍走通用答疑口径，等 `imitate` 之后
 * 由上层编排推进到结构化端点。这不是忘了接，是接错了会坏。
 *
 * 剩下两个：`visualize` 走 `/api/visualization/[sceneId]`（前端组件订阅），
 * `explain` / `observe` / `imitate` 是**连续的一段对话** —— 讲完给例子、
 * 给完例子让学生动手，本来就该在同一个对话里发生，所以这三个共用一个身份。
 */

import {
  TEACHING_AGENT_ID,
  TEACHING_CHAT_SYSTEM_PROMPT,
} from "./prompts/teaching-chat";
import type { StepType } from "@/lib/db";

/** 由讲解导师接管的步骤。 */
const TEACHING_STEPS: readonly StepType[] = ["explain", "observe", "imitate"];

/** 一轮对话要用的身份层描述。 */
export interface StepAgentSpec {
  /** SSE `thinking` 事件里的 agent 标识。 */
  id: string;
  /** 系统提示词。 */
  systemPrompt: string;
  /** 是否为讲解导师。前端据此显示不同的阶段提示（可选，不强制）。 */
  teaching: boolean;
}

/**
 * 通用答疑口径。与 `loop.ts` 的 `PROVISIONAL_SYSTEM_PROMPT` 同义 ——
 * 这里不再声明第二份默认值，改由调用方不传 `systemPrompt` 让 loop 自己兜底，
 * 避免两处文案各自漂移。
 */
const GENERAL_SPEC: StepAgentSpec = {
  id: "chat",
  systemPrompt: "",
  teaching: false,
};

/**
 * 按当前学习步骤取对话身份层。
 *
 * `systemPrompt` 为空串时调用方应**不传**该参数，让 `runAgentLoop` 用
 * 它自己的默认提示词 —— 返回空串而不是把 loop 的默认值抄一份过来，
 * 是为了守住「同一句文案只有一处定义」。
 */
export function resolveStepAgent(step: StepType): StepAgentSpec {
  if (TEACHING_STEPS.includes(step)) {
    return {
      id: TEACHING_AGENT_ID,
      systemPrompt: TEACHING_CHAT_SYSTEM_PROMPT,
      teaching: true,
    };
  }
  return GENERAL_SPEC;
}
