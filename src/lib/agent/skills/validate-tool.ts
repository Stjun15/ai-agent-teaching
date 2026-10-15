/**
 * Skill: 校验工具定义
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 3. validate-tool.md」。原文照搬。
 *
 * 与 `validate-prompt` 的差异：这里「描述」与「参数」合计 60%，因为工具定义
 * 最常见的失败模式就是描述含糊导致模型不知道何时调用、参数缺失导致调用不完整
 * （对应反模式 `missing-params`）。
 */

import type { SkillDefinition } from "../types";

/** 校验工具定义技能。 */
export const VALIDATE_TOOL_SKILL: SkillDefinition = {
  id: "validate-tool",
  label: "校验工具定义",
  content: `# Skill: 校验工具定义

## 触发条件

学生提交工具定义（名称、描述、参数、核心逻辑）。

## 执行步骤

1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则、通过条件均以此为准。
2. 阅读 module_context（本模块教了什么）。评分边界不得超出 module_context 中列出的知识点。
3. 将 student_answer 对照 rubric_context 逐维度打分。
4. 生成 issues（扣分依据引用 rubric_context 中的具体规则）和 suggestions。
5. 计算 total_score，按 rubric_context 中的通过条件判定 is_correct。

## 评分维度

| 维度 | 权重 |
|---|---|
| 名称 | 20% |
| 描述 | 30% |
| 参数 | 30% |
| 错误处理 | 20% |

## 通过条件

- total_score >= 75
- 参数 >= 70% 权重分
- 无严重错误
`,
};