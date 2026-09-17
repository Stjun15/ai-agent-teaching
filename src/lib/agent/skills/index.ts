/**
 * Skill 注册表（技能层出口）
 *
 * 上层只从这里取 Skill 定义，与 `./prompts/index.ts` 同构。
 *
 * `Record<SkillId, SkillDefinition>` 的约束让「7 个 Skill 齐全」成为编译期保证：
 * 少一个、多一个、或 id 与键名不一致，tsc 立刻报错。这对应
 * `02-agent-system.md` 验收标准里的「7 个 Skill 能被正确加载」。
 */

import type { SkillDefinition, SkillId } from "../types";

import { ANSWER_QUESTION_SKILL } from "./answer-question";
import { EXPLAIN_CONCEPT_SKILL } from "./explain-concept";
import { GENERATE_QUESTION_SKILL } from "./generate-question";
import { TRIGGER_VISUALIZATION_SKILL } from "./trigger-visualization";
import { VALIDATE_CODE_SKILL } from "./validate-code";
import { VALIDATE_PROMPT_SKILL } from "./validate-prompt";
import { VALIDATE_TOOL_SKILL } from "./validate-tool";

/** 7 个 Skill 的定义。 */
export const SKILLS = {
  "explain-concept": EXPLAIN_CONCEPT_SKILL,
  "validate-prompt": VALIDATE_PROMPT_SKILL,
  "validate-tool": VALIDATE_TOOL_SKILL,
  "validate-code": VALIDATE_CODE_SKILL,
  "generate-question": GENERATE_QUESTION_SKILL,
  "answer-question": ANSWER_QUESTION_SKILL,
  "trigger-visualization": TRIGGER_VISUALIZATION_SKILL,
} as const satisfies Record<SkillId, SkillDefinition>;

/** 取一个 Skill 的定义。 */
export function getSkill(id: SkillId): SkillDefinition {
  return SKILLS[id];
}
