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
| [llm-api](./concepts/llm-api.md)             | LLM API 入门       | 1    | 已建 |
| [system-prompt](./concepts/system-prompt.md) | System Prompt 设计 | 2    | 已建 |
| [agent-loop](./concepts/agent-loop.md)       | Agent Loop         | 3    | 已建 |
| [tool-calling](./concepts/tool-calling.md)   | 工具调用           | 3    | 已建 |
| [rag](./concepts/rag.md)                     | RAG 检索增强生成   | 4    | 已建 |
| [llm-wiki](./concepts/llm-wiki.md)           | LLM Wiki 知识编译  | 4    | 已建 |
| [multi-agent](./concepts/multi-agent.md)     | 多 Agent 协作      | 5    | 已建 |
| [mcp](./concepts/mcp.md)                     | MCP 工具集成       | 4    | 已建 |
| [ai-safety](./concepts/ai-safety.md)         | AI 安全与可控性    | 4    | 已建 |

## 设计模式（patterns/）

| 页面                                                     | 名称        | 状态 |
| -------------------------------------------------------- | ----------- | ---- |
| [prompt-structure](./patterns/prompt-structure.md)       | Prompt 结构 | 待建 |
| [tool-definition](./patterns/tool-definition.md)         | 工具定义    | 待建 |
| [agent-orchestration](./patterns/agent-orchestration.md) | Agent 编排  | 待建 |
| [rag-pipeline](./patterns/rag-pipeline.md)               | RAG 流水线  | 待建 |
| [safety-layer](./patterns/safety-layer.md)               | 安全层      | 待建 |

## 反模式（anti-patterns/）

| 页面                                                            | 名称         | 严重程度 | 状态 |
| --------------------------------------------------------------- | ------------ | -------- | ---- |
| [vague-prompt](./anti-patterns/vague-prompt.md)                 | 模糊 Prompt  | high     | 已建 |
| [weak-role-definition](./anti-patterns/weak-role-definition.md) | 角色定义薄弱 | high     | 已建 |
| [missing-params](./anti-patterns/missing-params.md)             | 参数定义缺失 | high     | 已建 |
| [no-error-handling](./anti-patterns/no-error-handling.md)       | 无错误处理   | medium   | 已建 |
| [infinite-loop](./anti-patterns/infinite-loop.md)               | 无限循环     | high     | 已建 |
| [token-explosion](./anti-patterns/token-explosion.md)           | Token 爆炸   | medium   | 已建 |
| [prompt-injection](./anti-patterns/prompt-injection.md)         | 提示注入     | high     | 已建 |
| [over-retrieval](./anti-patterns/over-retrieval.md)             | 过度检索     | medium   | 已建 |
| [role-overlap](./anti-patterns/role-overlap.md)                 | 角色重叠     | medium   | 已建 |

## 评分标准（validation/）

| 页面                                                     | 名称              | 状态 |
| -------------------------------------------------------- | ----------------- | ---- |
| [prompt-rubric](./validation/prompt-rubric.md)           | Prompt 评分标准   | 已建 |
| [tool-rubric](./validation/tool-rubric.md)               | 工具定义评分标准  | 已建 |
| [code-rubric](./validation/code-rubric.md)               | 核心代码评分标准  | 已建 |
| [question-rubric](./validation/question-rubric.md)       | 出题评分标准      | 已建 |
| [wiki-page-rubric](./validation/wiki-page-rubric.md)     | Wiki 页面评分标准 | 已建 |
| [multi-agent-rubric](./validation/multi-agent-rubric.md) | 多 Agent 评分标准 | 已建 |
| [mcp-rubric](./validation/mcp-rubric.md)                 | MCP 评分标准      | 已建 |
| [safety-rubric](./validation/safety-rubric.md)           | AI 安全评分标准   | 已建 |

## 项目模板（projects/）

| 页面                                                       | 名称          | 状态 |
| ---------------------------------------------------------- | ------------- | ---- |
| [01-chatbot](./projects/01-chatbot/)                       | 聊天机器人    | 已建 |
| [02-persona-bot](./projects/02-persona-bot/)               | 人格机器人    | 已建 |
| [03-weather-agent](./projects/03-weather-agent/)           | 天气 Agent    | 已建 |
| [04-multi-tool-agent](./projects/04-multi-tool-agent/)     | 多工具 Agent  | 已建 |
| [05-rag-agent](./projects/05-rag-agent/)                   | RAG Agent     | 已建 |
| [06-wiki-agent](./projects/06-wiki-agent/)                 | Wiki Agent    | 已建 |
| [07-multi-agent-system](./projects/07-multi-agent-system/) | 多 Agent 系统 | 已建 |
| [08-mcp-agent](./projects/08-mcp-agent/)                   | MCP Agent     | 已建 |
| [09-safe-agent](./projects/09-safe-agent/)                 | 安全 Agent    | 已建 |

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

学生目录按需创建（命名依 SCHEMA.md「命名规范」：`s001/`、`s002/`），每个学生 6 个页面：

| 页面                                                 | 用途                                      |
| ---------------------------------------------------- | ----------------------------------------- |
| [profile.md](./students/s001/profile.md)             | 基本信息、偏好、行为特征                  |
| [mastery.md](./students/s001/mastery.md)             | 9 个概念掌握度 + 6 个子能力雷达           |
| [learning-path.md](./students/s001/learning-path.md) | 模块顺序、状态、练习记录、路径调整        |
| [errors.md](./students/s001/errors.md)               | 错题记录、关联概念、订正状态              |
| [prompts.md](./students/s001/prompts.md)             | Prompt 历史、评分、改进建议               |
| [projects.md](./students/s001/projects.md)           | 项目进度、检查清单、Prompt 链接、项目链接 |

当前 `s001/` 是**模板样例**：日期类字段保留 `YYYY-MM-DD` 占位符，供新建学生目录时复制填充。模板出处见 `references/wiki-schema.md`「四、学生画像 6 个页面完整模板」。
