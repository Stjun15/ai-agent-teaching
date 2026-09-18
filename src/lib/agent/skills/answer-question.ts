/**
 * Skill: 答疑
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 6. answer-question.md」。原文照搬。
 */

import type { SkillDefinition } from "../types";

/** 答疑技能。 */
export const ANSWER_QUESTION_SKILL: SkillDefinition = {
  id: "answer-question",
  label: "答疑",
  content: `# Skill: 答疑

## 触发条件

学生主动提问。

## 执行步骤

1. 判断问题类型。
2. 苏格拉底式引导。
3. 如果学生卡太久，给分级提示。
4. 记录高频问题到 \`log.md\` 和 \`agents/assistant.md\`。
5. 如果问题暴露教学盲区，反馈给讲解 Agent。

## 问题类型与策略

| 类型 | 策略 |
|---|---|
| 概念不清 | 用类比，关联已学概念 |
| 代码报错 | 引导排查 |
| 环境问题 | 给具体步骤 |
| 跑偏 | 温和拉回 |
`,
};
