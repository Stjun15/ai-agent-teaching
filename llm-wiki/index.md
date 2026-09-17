---
type: index
last_updated: 2026-09-17
---

# LLM Wiki 索引

本文件是 LLM Wiki 的**页面目录**。规范见 [SCHEMA.md](./SCHEMA.md)。

维护方式：由 `wiki-ingest` 与 `wiki-maintain` 在每次编译或维护后更新。下方列出全部**规划页面**，`状态` 列标记其是否已落地 —— 这样索引同时可作为知识层的建设进度表。

## 概念（concepts/）

概念之间有先后依赖，按下列顺序学习：

`llm-api` → `system-prompt` → `agent-loop` → `tool-calling` → `rag` → `llm-wiki` → `multi-agent` → `mcp` → `ai-safety`

| 页面                                         | 名称               | 难度 | 状态 |
| -------------------------------------------- | ------------------ | ---- | ---- |
| [llm-api](./concepts/llm-api.md)             | LLM API 入门       | 1    | 待建 |
| [system-prompt](./concepts/system-prompt.md) | System Prompt 设计 | 1    | 待建 |
| [agent-loop](./concepts/agent-loop.md)       | Agent Loop         | 2    | 待建 |
| [tool-calling](./concepts/tool-calling.md)   | 工具调用           | 3    | 待建 |
| [rag](./concepts/rag.md)                     | RAG 检索增强生成   | 3    | 待建 |
| [llm-wiki](./concepts/llm-wiki.md)           | LLM Wiki 知识编译  | 4    | 待建 |
| [multi-agent](./concepts/multi-agent.md)     | 多 Agent 协作      | 4    | 待建 |
| [mcp](./concepts/mcp.md)                     | MCP 工具集成       | 4    | 待建 |
| [ai-safety](./concepts/ai-safety.md)         | AI 安全与可控性    | 5    | 待建 |

## 设计模式（patterns/）

| 页面                                                     | 名称        | 状态 |
| -------------------------------------------------------- | ----------- | ---- |
| [prompt-structure](./patterns/prompt-structure.md)       | Prompt 结构 | 待建 |
| [tool-definition](./patterns/tool-definition.md)         | 工具定义    | 待建 |
| [agent-orchestration](./patterns/agent-orchestration.md) | Agent 编排  | 待建 |
| [rag-pipeline](./patterns/rag-pipeline.md)               | RAG 流水线  | 待建 |
| [safety-layer](./patterns/safety-layer.md)               | 安全层      | 待建 |

## 反模式（anti-patterns/）

| 页面                                                            | 名称         | 状态 |
| --------------------------------------------------------------- | ------------ | ---- |
| [vague-prompt](./anti-patterns/vague-prompt.md)                 | 模糊 Prompt  | 待建 |
| [weak-role-definition](./anti-patterns/weak-role-definition.md) | 角色定义薄弱 | 待建 |
| [missing-params](./anti-patterns/missing-params.md)             | 参数缺失     | 待建 |
| [no-error-handling](./anti-patterns/no-error-handling.md)       | 缺少错误处理 | 待建 |
| [infinite-loop](./anti-patterns/infinite-loop.md)               | 无限循环     | 待建 |
| [token-explosion](./anti-patterns/token-explosion.md)           | Token 爆炸   | 待建 |
| [prompt-injection](./anti-patterns/prompt-injection.md)         | Prompt 注入  | 待建 |
| [over-retrieval](./anti-patterns/over-retrieval.md)             | 过度检索     | 待建 |
| [role-overlap](./anti-patterns/role-overlap.md)                 | 角色重叠     | 待建 |

## 评分标准（validation/）

| 页面                                                     | 名称              | 状态 |
| -------------------------------------------------------- | ----------------- | ---- |
| [prompt-rubric](./validation/prompt-rubric.md)           | Prompt 评分标准   | 待建 |
| [tool-rubric](./validation/tool-rubric.md)               | 工具定义评分标准  | 待建 |
| [code-rubric](./validation/code-rubric.md)               | 代码评分标准      | 待建 |
| [question-rubric](./validation/question-rubric.md)       | 出题评分标准      | 待建 |
| [wiki-page-rubric](./validation/wiki-page-rubric.md)     | Wiki 页面评分标准 | 待建 |
| [multi-agent-rubric](./validation/multi-agent-rubric.md) | 多 Agent 评分标准 | 待建 |
| [mcp-rubric](./validation/mcp-rubric.md)                 | MCP 评分标准      | 待建 |
| [safety-rubric](./validation/safety-rubric.md)           | 安全评分标准      | 待建 |

## 项目模板（projects/）

| 页面                                                       | 名称          | 状态 |
| ---------------------------------------------------------- | ------------- | ---- |
| [01-chatbot](./projects/01-chatbot/)                       | 聊天机器人    | 待建 |
| [02-persona-bot](./projects/02-persona-bot/)               | 人格机器人    | 待建 |
| [03-weather-agent](./projects/03-weather-agent/)           | 天气 Agent    | 待建 |
| [04-multi-tool-agent](./projects/04-multi-tool-agent/)     | 多工具 Agent  | 待建 |
| [05-rag-agent](./projects/05-rag-agent/)                   | RAG Agent     | 待建 |
| [06-wiki-agent](./projects/06-wiki-agent/)                 | Wiki Agent    | 待建 |
| [07-multi-agent-system](./projects/07-multi-agent-system/) | 多 Agent 系统 | 待建 |
| [08-mcp-agent](./projects/08-mcp-agent/)                   | MCP Agent     | 待建 |
| [09-safe-agent](./projects/09-safe-agent/)                 | 安全 Agent    | 待建 |

## 测验（assessments/）

| 页面                                    | 名称     | 状态 |
| --------------------------------------- | -------- | ---- |
| [quiz-bank](./assessments/quiz-bank.md) | 测验题库 | 待建 |

## Agent 共享记忆（agents/）

| 页面                               | 名称            | 状态 |
| ---------------------------------- | --------------- | ---- |
| [teacher](./agents/teacher.md)     | 讲解 Agent 记忆 | 待建 |
| [reviewer](./agents/reviewer.md)   | 点评 Agent 记忆 | 待建 |
| [examiner](./agents/examiner.md)   | 出题 Agent 记忆 | 待建 |
| [assistant](./agents/assistant.md) | 答疑 Agent 记忆 | 待建 |

## 学生（students/）

学生目录按需创建，每个学生 6 个页面，不在本索引中逐一列出：

`profile.md`、`mastery.md`、`learning-path.md`、`errors.md`、`prompts.md`、`projects.md`

模板见 `agent-prompts/references/wiki-schema.md`「四、学生画像 6 个页面完整模板」。
