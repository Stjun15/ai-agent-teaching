/**
 * Skill: 校验问答
 *
 * Q&A 类模块（ts-basics、agent-loop、ai-safety）的动手环节点评。
 * 学生提交的是纯文本回答（解释、标注、类比），不是代码/Prompt/工具定义。
 * 评分维度：理解准确度 40% + 表达清晰度 30% + 完整覆盖 30%。
 */

import type { SkillDefinition } from "../types";

/** 校验问答技能。 */
export const VALIDATE_QA_SKILL: SkillDefinition = {
  id: "validate-qa",
  label: "校验问答",
  content: `# Skill: 校验问答

## 触发条件

学生提交文本回答（解释代码、标注练习、类比说明）。

## 执行步骤

1. 阅读 rubric_context（qa-rubric 评分标准的完整原文）。维度、权重、扣分细则、通过条件均以此为准。
2. 阅读 module_context（本模块教了什么——定义、关键点、常见误解）。评分时以此为事实基准，评判 student_answer 的理解是否准确。
3. 将 student_answer 对照 rubric_context 逐维度打分。特别注意：
   - 不要按代码/Prompt/工具的维度去评（这不是代码作业）；
   - 评的是"学生有没有真正理解"，不是"格式是否规范"。
4. 生成 issues（扣分依据引用 rubric_context 中的具体规则）和 suggestions。
5. 计算 total_score，按 rubric_context 中的通过条件判定 is_correct。

## 评分维度

| 维度       | 权重 |
| ---------- | ---- |
| 理解准确度 | 40%  |
| 表达清晰度 | 30%  |
| 完整覆盖   | 30%  |

权重合计 100%，通过条件：total_score >= 75、理解准确度 >= 60% 权重分、无严重错误。
`,
};