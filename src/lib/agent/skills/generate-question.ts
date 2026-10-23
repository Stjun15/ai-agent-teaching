/**
 * Skill: 生成题目
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 5. generate-question.md」。原文照搬；
 * 例外：「难度起点与题型（按 mastery）」一节是 2026-09-19 的实测修正 ——
 * 出题管线已把学生掌握度作为 mastery 传入，但本节规则写死「从难度 1 递进」，
 * 模型照办导致掌握度 4 的学生永远抽不到简答题。设计文档已同步。
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

1. 阅读输入里的 \`module_context\`（本模块的教学内容：定义、关键点、常见误解），以它作为出题的**唯一知识范围**。题目中出现的所有概念、术语、技术细节都必须能在 module_context 中找到。
2. 阅读输入里的 \`mastery\`，确定薄弱点与难度起点。
3. 阅读输入里的 \`existing_questions\`，避免题干重复。
4. 严格基于 module_context 中的知识点，按难度递进生成题目。
5. 每题附带 hint_levels 和 answer。

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

## 难度起点与题型（按 mastery，2026-09-19 实测修正）

- 输入里的 mastery 是学生当前掌握度（1~5）。上面「难度递进」的**起点**跟着
  mastery 走：mastery=4 时三题从 4 附近起步，不要每次都从 1 开始——那是
  把已掌握的学生按回第一课。
- mastery >= 3 时，三题中至少 1 道简答题或实战题（考设计思路）；
  mastery <= 2 时以选择题、填空题为主。

## 范围约束

- module_context 中未出现的概念、术语不得出现在题目、选项或解析中。
- 如果 module_context 为空或只含无关内容（如只有 frontmatter 没有正文），
  返回 total_count: 0，不要编造题目。
`,
};