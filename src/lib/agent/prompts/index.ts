/**
 * Agent 注册表（身份层出口）
 *
 * 上层只从这里取 Agent 定义，不直接 import 单个提示词文件 —— 与
 * `src/lib/db/index.ts`、`src/wiki/index.ts`、`src/schemas/index.ts` 同构。
 *
 * 关于「Agent 权限由代码控制」这条铁律
 * -------------------------------
 * `allowedSkills` 与内核的工具白名单是同一种约束：Agent **不是**想用哪个 Skill
 * 就用哪个。例如出题 Agent 不应具备 `validate-code`（那是点评 Agent 的活），
 * 讲解 Agent 也不应触发 `validate-prompt`。把白名单写在这里，越权调用在
 * `runAgent` 入口就被拒（见 `../runtime.ts`），而不是等模型自己"守规矩"。
 * 这一条对应 `02-agent-system.md` 的写入权限表。
 */

import { ASSISTANT_SYSTEM_PROMPT } from "./assistant";
import { EXAMINER_SYSTEM_PROMPT } from "./examiner";
import { REVIEWER_SYSTEM_PROMPT } from "./reviewer";
import { TEACHER_SYSTEM_PROMPT } from "./teacher";
import { AGENT_LABELS, type AgentDefinition, type AgentId } from "../types";

/**
 * 4 个 Agent 的定义。
 *
 * `satisfies Record<AgentId, AgentDefinition>` 而不是 `Record<AgentId, ...>` 标注：
 * 前者既保证**键齐全且不多余**，又保留每个值自身的字面量类型（`id: "teacher"`），
 * 后者会把 `id`  widen 成 `AgentId`，下游做穷举判断时失去精度。
 */
export const AGENTS = {
  teacher: {
    id: "teacher",
    label: AGENT_LABELS.teacher,
    systemPrompt: TEACHER_SYSTEM_PROMPT,
    defaultSkill: "explain-concept",
    // 讲解时若判断学生前置薄弱，需要回顾概念；讲完要能触发可视化。
    allowedSkills: [
      "explain-concept",
      "trigger-visualization",
      "answer-question",
    ],
  },
  reviewer: {
    id: "reviewer",
    label: AGENT_LABELS.reviewer,
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    defaultSkill: "validate-prompt",
    // 点评 Agent 覆盖三种校验任务；通过后要能触发可视化。
    allowedSkills: [
      "validate-prompt",
      "validate-tool",
      "validate-code",
      "validate-qa",
      "trigger-visualization",
    ],
  },
  examiner: {
    id: "examiner",
    label: AGENT_LABELS.examiner,
    systemPrompt: EXAMINER_SYSTEM_PROMPT,
    defaultSkill: "generate-question",
    allowedSkills: ["generate-question"],
  },
  assistant: {
    id: "assistant",
    label: AGENT_LABELS.assistant,
    systemPrompt: ASSISTANT_SYSTEM_PROMPT,
    defaultSkill: "answer-question",
    // 答疑判断「概念不清」时要能讲概念，这是它区别于纯问答的关键。
    allowedSkills: ["answer-question", "explain-concept"],
  },
} as const satisfies Record<AgentId, AgentDefinition>;

/** 取一个 Agent 的定义。ID 来自类型系统，取不到说明调用方写错了。 */
export function getAgent(id: AgentId): AgentDefinition {
  return AGENTS[id];
}