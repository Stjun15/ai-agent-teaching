/**
 * Skill: 校验核心代码
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 4. validate-code.md」。原文照搬。
 *
 * 注意原文限定「核心逻辑代码（3-5 行）」—— 这不是偷懒，是刻意的：
 * 本项目的教学目标是 AI 协作能力（让 AI 写代码），不是编程能力，
 * 所以只校验「学生能否判断 AI 写的代码对不对」，不校验大段实现。
 */

import type { SkillDefinition } from "../types";

/** 校验核心代码技能。 */
export const VALIDATE_CODE_SKILL: SkillDefinition = {
  id: "validate-code",
  label: "校验核心代码",
  content: `# Skill: 校验核心代码

## 触发条件

学生提交核心逻辑代码（3-5 行）。

## 执行步骤

1. 读取 \`validation/code-rubric.md\`。
2. 读取 \`anti-patterns/no-error-handling.md\`。
3. 逐维度打分。
4. 生成 issues 和 suggestions。
5. 写入 \`students/{id}/prompts.md\`、\`errors.md\`。
6. 更新 \`students/{id}/mastery.md\`。

## 评分维度

| 维度 | 权重 |
|---|---|
| 参数使用 | 30% |
| 返回值 | 30% |
| 边界处理 | 20% |
| 可读性 | 20% |

## 通过条件

- total_score >= 75
- is_correct = true
- 无严重错误

## 通过后

返回 \`{ "is_correct": true, "next_action": "visualize" }\`，触发可视化场景。
`,
};
