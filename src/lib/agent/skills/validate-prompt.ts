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

1. 读取 \`validation/prompt-rubric.md\`。
2. 读取 \`anti-patterns/vague-prompt.md\`、\`anti-patterns/weak-role-definition.md\`。
3. 读取 \`students/{id}/prompts.md\`，获取历史。
4. 逐维度打分。
5. 生成 issues 和 suggestions。
6. 写入 \`students/{id}/prompts.md\`。
7. 如果有错题，写入 \`students/{id}/errors.md\`。
8. 更新 \`students/{id}/mastery.md\`。

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
