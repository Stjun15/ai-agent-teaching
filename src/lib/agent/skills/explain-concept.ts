/**
 * Skill: 讲解概念
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 1. explain-concept.md」。原文照搬。
 *
 * 这个 Skill 是**唯一会读学生画像**的讲解入口：掌握度决定讲多深，
 * 讲解策略矩阵（0-1 / 2-3 / 4-5）就是 `02-agent-system.md`「行为准则 2」的展开。
 */

import type { SkillDefinition } from "../types";

/** 讲解概念技能。 */
export const EXPLAIN_CONCEPT_SKILL: SkillDefinition = {
  id: "explain-concept",
  label: "讲解概念",
  content: `# Skill: 讲解概念

## 触发条件

学生进入新模块，或讲解 Agent 判断需要回顾前置概念。

## 执行步骤

1. 读取 \`concepts/{concept_id}.md\`。
2. 读取 \`students/{id}/mastery.md\`，获取当前掌握度。
3. 读取 \`students/{id}/errors.md\`，获取相关错题。
4. 读取 \`students/{id}/profile.md\`，获取偏好和节奏。
5. 根据掌握度决定讲解策略。
6. 生成讲解内容 + 检验问题。
7. 如果概念适合可视化，触发对应场景。
8. 写入 \`students/{id}/learning-path.md\`，标记模块开始。

## 讲解策略矩阵

| 掌握度 | 策略 |
|---|---|
| 0-1 | 从零讲，用类比，先回顾前置 |
| 2-3 | 重点讲易错点，用对比 |
| 4-5 | 快速过，直接进练习 |

## 输出

按讲解 Agent 的 JSON 格式返回。
`,
};
