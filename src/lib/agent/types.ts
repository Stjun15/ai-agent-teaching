/**
 * Agent 系统的类型地基
 *
 * 设计依据
 * --------
 * - `02-agent-system.md`：4 个 Agent（讲解 / 点评 / 出题 / 答疑）+ 7 个 Skill，
 *   四层执行架构（身份层 = System Prompt、技能层 = Skill 文件、
 *   知识层 = LLM Wiki、编排层 = 工作流代码）。本文件是这四层的公共词汇表。
 * - `references/data-models.md`：`AgentEvent.agent` 与 `AgentTrace.agent` 都把
 *   Agent 取值写死为 `"teacher" | "reviewer" | "examiner" | "assistant"`。
 *   **这是数据库契约**，不是教学文档里的称呼（`02-agent-system.md` 用的是
 *   「讲解 / 点评 / 出题 / 答疑」）。两者必须指向同一组东西。
 *
 * 为什么 ID 用英文而不是中文
 * ------------------------
 * Agent 与 Skill 的 ID 会同时出现在四处：数据库字段、SSE 事件的 `agent` 字段、
 * 前端 Store、Git 里的文件名。中文 ID 会让 URL / 字段名 / 文件名全线出现非 ASCII，
 * 排查时难以 grep。中文称呼保留在 `AGENT_LABELS` 里，只用于界面展示。
 *
 * 为什么不直接复用 `src/lib/db` 里的类型
 * -----------------------------------
 * `AgentEvent["agent"]` 是**消息事件**里的字段类型，拿它当 Agent 系统的 ID 类型
 * 属于「借用别人家的枚举」。但两边必须一致，所以用下面两条 `Expect` 断言在编译期
 * 钉死：任一侧增删取值，tsc 立刻报错。这样既避免了错误的依赖方向，
 * 又不会像「手抄一份」那样悄悄漂移。
 */

import type { AgentEvent, AgentTrace } from "@/lib/db";

import type { Expect } from "@/lib/type-assert";

/** 4 个 Agent 的标识。与 `AgentEvent["agent"]` / `AgentTrace["agent"]` 同值域。 */
export type AgentId = "teacher" | "reviewer" | "examiner" | "assistant";

/** 界面展示用的中文称呼。与 `02-agent-system.md` 的表格逐条对应。 */
export const AGENT_LABELS: Record<AgentId, string> = {
  teacher: "讲解 Agent",
  reviewer: "点评 Agent",
  examiner: "出题 Agent",
  assistant: "答疑 Agent",
};

/** 全部 Agent ID。顺序即 `02-agent-system.md` 表格里的顺序（讲解→点评→出题→答疑）。 */
export const AGENT_IDS = [
  "teacher",
  "reviewer",
  "examiner",
  "assistant",
] as const satisfies readonly AgentId[];

// --- 双向钉死：AgentId ↔ 数据库契约 ---------------------------------------
// 这几条断言是**活**的（形式见 `src/lib/type-assert.ts`）：故意删掉 AGENT_IDS
// 里的一个值，tsc 会报 TS2344，不会静默通过。必须 export，否则 `noUnusedLocals`
// 会把未使用的别名报成 TS6196（既有两处断言同样靠 export 规避）。
export type __AssertAgentMatchesDbEvent = Expect<
  AgentId extends AgentEvent["agent"] ? true : false
>;
export type __AssertDbEventMatchesAgent = Expect<
  AgentEvent["agent"] extends AgentId ? true : false
>;
export type __AssertAgentMatchesDbTrace = Expect<
  AgentId extends AgentTrace["agent"] ? true : false
>;
export type __AssertDbTraceMatchesAgent = Expect<
  AgentTrace["agent"] extends AgentId ? true : false
>;
export type __AssertIdsMatchUnion = Expect<
  (typeof AGENT_IDS)[number] extends AgentId ? true : false
>;
export type __AssertUnionMatchesIds = Expect<
  AgentId extends (typeof AGENT_IDS)[number] ? true : false
>;

/**
 * 7 个 Skill 的标识。取自 `02-agent-system.md` 的 Skill 表格。
 *
 * Skill 是**任务方法**，不是 Agent 的属性：同一个 Skill 可以被多个 Agent 使用
 * （例如 `explain-concept` 讲解 Agent 用，答疑 Agent 在「概念不清」分支也会用）。
 * 所以 ID 与 Agent 平级，不挂在 Agent 下面。
 */
export type SkillId =
  | "explain-concept"
  | "validate-prompt"
  | "validate-tool"
  | "validate-code"
  | "generate-question"
  | "answer-question"
  | "trigger-visualization";

/** 全部 Skill ID。顺序即 `02-agent-system.md` Skill 表格的顺序。 */
export const SKILL_IDS = [
  "explain-concept",
  "validate-prompt",
  "validate-tool",
  "validate-code",
  "generate-question",
  "answer-question",
  "trigger-visualization",
] as const satisfies readonly SkillId[];

export type __AssertSkillIdsMatchUnion = Expect<
  (typeof SKILL_IDS)[number] extends SkillId ? true : false
>;
export type __AssertSkillUnionMatchesIds = Expect<
  SkillId extends (typeof SKILL_IDS)[number] ? true : false
>;

/**
 * Agent 定义：身份层（System Prompt）+ 默认技能。
 *
 * `defaultSkill` 是**默认**而非唯一：编排层可以按情境换 Skill
 * （例如答疑 Agent 判断「概念不清」时改用 `explain-concept`）。
 */
export interface AgentDefinition {
  id: AgentId;
  /** 中文称呼，来自 `AGENT_LABELS`。 */
  label: string;
  /** 身份层内容。 */
  systemPrompt: string;
  /** 没有显式指定 Skill 时用它。 */
  defaultSkill: SkillId;
  /**
   * 该 Agent 允许使用的 Skill。对应铁律「Agent 权限由代码控制」——
   * 与工具白名单同理，Skill 也不是 Agent 想用就能用。
   */
  allowedSkills: readonly SkillId[];
}

/** Skill 定义：技能层内容 + 归属说明。 */
export interface SkillDefinition {
  id: SkillId;
  /** 中文名。 */
  label: string;
  /** 技能层内容（执行步骤 / 评分维度 / 通过条件等）。 */
  content: string;
}
