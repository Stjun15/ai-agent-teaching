/**
 * Skill: 校验 Prompt
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 2. validate-prompt.md」。原文照搬。
 *
 * 五维评分权重合计 100%（25+25+20+15+15）。这个合计不是装饰：运行时若发现
 * 权重和不为 1，说明评分标准被改坏了 —— 见 `../runtime.ts` 的校验。
 */

import type { SkillDefinition } from "../types";

/** 校验 Prompt 技能。 */
export const VALIDATE_PROMPT_SKILL: SkillDefinition = {
  id: "validate-prompt",
  label: "校验 Prompt",
  content: `# Skill: 校验 Prompt

## 触发条件

学生提交 System Prompt 或角色定义。

## 执行步骤

1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则、通过条件均以此为准。
2. 阅读 module_context（本模块教了什么）。评分边界不得超出 module_context 中列出的知识点。
3. 将 student_answer 对照 rubric_context 逐维度打分。
4. 生成 issues（扣分依据引用 rubric_context 中的具体规则）和 suggestions。
5. 计算 total_score，按 rubric_context 中的通过条件判定 is_correct。

## 评分维度

| 维度 | 权重 |
|---|---|
| 角色定义 | 25% |
| 工具描述 | 25% |
| 输出格式 | 20% |
| 边界条件 | 15% |
| 简洁性 | 15% |

## 通过条件

- total_score >= 75
- 角色定义 >= 60% 权重分
- 无严重错误
`,
};