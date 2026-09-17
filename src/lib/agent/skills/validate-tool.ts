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

1. 读取 \`validation/tool-rubric.md\`。
2. 读取 \`anti-patterns/missing-params.md\`。
3. 读取 \`students/{id}/prompts.md\`。
4. 逐维度打分。
5. 生成 issues 和 suggestions。
6. 写入 \`students/{id}/prompts.md\`、\`errors.md\`。
7. 更新 \`students/{id}/mastery.md\`。

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
