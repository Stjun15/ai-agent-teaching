/**
 * Skill: 触发可视化
 *
 * 内容来源：`agent-prompts/references/agent-prompts-lib.md`「二、7 个 Skill 文件
 * → 7. trigger-visualization.md」。原文照搬。
 *
 * 场景 ID 这张表与 `01-teaching-system.md`「可视化场景（9 个）」**逐条一致**，
 * 也必须与前端 `src/lib/modules.ts` 的 `MODULE_SCENE_IDS` 一致 —— 三处口径
 * 若漂移，模型会点播一个前端不存在的场景，界面就变成空白。
 * 编译期校验见 `../scene-ids.ts`。
 */

import type { SkillDefinition } from "../types";

/** 触发可视化技能。 */
export const TRIGGER_VISUALIZATION_SKILL: SkillDefinition = {
  id: "trigger-visualization",
  label: "触发可视化",
  content: `# Skill: 触发可视化

## 触发条件

- 讲解 Agent 讲完概念需要演示。
- 点评 Agent 校验通过。
- 学生主动请求"看动画"。

## 场景映射

| 模块 | 场景 ID | 动画内容 |
|---|---|---|
| llm-api | scene-request-response | 请求-响应流程 |
| system-prompt | scene-role-filter | 角色滤镜对比 |
| agent-loop | scene-loop-weather | Agent Loop 天气查询 |
| tool-calling | scene-tool-chain | 工具调用链 |
| rag | scene-retrieve-generate | 检索-生成流程 |
| llm-wiki | scene-rag-vs-wiki | RAG vs Wiki 对比 |
| multi-agent | scene-orchestration | 多 Agent 通信 |
| mcp | scene-mcp-flow | MCP 调用流程 |
| ai-safety | scene-attack-defense | 攻击-防护对比 |

## 输出

\`\`\`json
{
  "scene_id": "...",
  "initial_params": {...}
}
\`\`\`
`,
};
