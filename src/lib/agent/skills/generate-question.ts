/**
 * Skill: 生成题目
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 5. generate-question.md」。原文照搬。
 */

import type { SkillDefinition } from "../types";

/** 生成题目技能。 */
export const GENERATE_QUESTION_SKILL: SkillDefinition = {
  id: "generate-question",
  label: "生成题目",
  content: `# Skill: 生成题目

## 触发条件

学生完成一个概念的讲解，或需要变式练习。

## 执行步骤

1. 读取 \`students/{id}/mastery.md\`，确定薄弱点。
2. 读取 \`students/{id}/errors.md\`，确定错题类型。
3. 读取 \`assessments/quiz-bank.md\`，避免重复。
4. 按难度递进生成 3 道题。
5. 每题附带 hint_levels 和 answer。
6. 写入 \`agents/examiner.md\`。

## 出题策略

| 题型 | 用途 |
|---|---|
| 选择题 | 考概念理解 |
| 填空题 | 考关键代码 |
| 简答题 | 考设计思路 |
| 实战题 | 给场景写 Prompt/工具/代码 |

## 难度递进

- 第 1 题：基础，考概念
- 第 2 题：应用，换场景
- 第 3 题：综合，多概念组合
`,
};
