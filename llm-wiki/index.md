---
type: index
last_updated: 2026-10-05
---

# LLM Wiki 索引

本文件是 LLM Wiki 的**页面目录**。规范见 [SCHEMA.md](./SCHEMA.md)。

维护方式：由 `wiki-ingest` 与 `wiki-maintain` 在每次编译或维护后更新。下方列出全部**规划页面**，`状态` 列标记其是否已落地 —— 这样索引同时可作为知识层的建设进度表。

## 概念（concepts/）

概念之间有先后依赖，按下列顺序学习：

`llm-api` → `system-prompt` → `agent-loop` → `tool-calling` → `rag` → `llm-wiki` → `multi-agent` → `mcp` → `ai-safety`

| 页面                                               | 名称               | 难度 | 状态 |
| -------------------------------------------------- | ------------------ | ---- | ---- |
| [llm-api](./concepts/llm-api.md)                   | LLM API 入门       | 1    | 已建 |
| [system-prompt](./concepts/system-prompt.md)       | System Prompt 设计 | 2    | 已建 |
| [agent-loop](./concepts/agent-loop.md)             | Agent Loop         | 3    | 已建 |
| [tool-calling](./concepts/tool-calling.md)         | 工具调用           | 3    | 已建 |
| [rag](./concepts/rag.md)                           | RAG 检索增强生成   | 4    | 已建 |
| [llm-wiki](./concepts/llm-wiki.md)                 | LLM Wiki 知识编译  | 4    | 已建 |
| [multi-agent](./concepts/multi-agent.md)           | 多 Agent 协作      | 5    | 已建 |
| [mcp](./concepts/mcp.md)                           | MCP 工具集成       | 4    | 已建 |
| [ai-safety](./concepts/ai-safety.md)               | AI 安全与可控性    | 4    | 已建 |
| [python-basics](./concepts/python-basics.md)       | Python 基础        | 1    | 已建 |
| [ts-basics](./concepts/ts-basics.md)               | TypeScript 基础    | 1    | 已建 |
| [platform-replica](./concepts/platform-replica.md) | 平台复刻           | 5    | 已建 |

## 设计模式（patterns/）

> 一个模块一个模式，与 `concepts/` 的 9 页一一对应，每页都交叉引用了至少一个
> 反模式 —— 模式与反模式是同一件事的两面，分开看都不完整。

| 页面                                                         | 名称             | 对应模块      | 状态 |
| ------------------------------------------------------------ | ---------------- | ------------- | ---- |
| [request-skeleton](./patterns/request-skeleton.md)           | 最小请求骨架     | llm-api       | 已建 |
| [role-contract](./patterns/role-contract.md)                 | 角色契约四段     | system-prompt | 已建 |
| [stop-condition](./patterns/stop-condition.md)               | 显式停止条件     | agent-loop    | 已建 |
| [schema-first-tool](./patterns/schema-first-tool.md)         | 先定契约再写工具 | tool-calling  | 已建 |
| [cite-then-answer](./patterns/cite-then-answer.md)           | 先引用后作答     | rag           | 已建 |
| [write-back](./patterns/write-back.md)                       | 结论回写知识库   | llm-wiki      | 已建 |
| [single-writer](./patterns/single-writer.md)                 | 单一出口         | multi-agent   | 已建 |
| [least-privilege-tools](./patterns/least-privilege-tools.md) | 最小权限工具集   | mcp           | 已建 |
| [two-gate](./patterns/two-gate.md)                           | 输入输出双闸门   | ai-safety     | 已建 |

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

> 一模块一份，含选择 / 填空 / 简答与判分要点。客观题走规则判分，
> 简答题交给点评 Agent 按维度打分（维度名不固定，见 `agents/reviewer-memory.md`）。

| 页面                                                   | 名称               | 对应模块      | 状态 |
| ------------------------------------------------------ | ------------------ | ------------- | ---- |
| [assess-llm-api](./assessments/llm-api.md)             | LLM API 测验       | llm-api       | 已建 |
| [assess-system-prompt](./assessments/system-prompt.md) | System Prompt 测验 | system-prompt | 已建 |
| [assess-agent-loop](./assessments/agent-loop.md)       | Agent Loop 测验    | agent-loop    | 已建 |
| [assess-tool-calling](./assessments/tool-calling.md)   | 工具调用测验       | tool-calling  | 已建 |
| [assess-rag](./assessments/rag.md)                     | RAG 测验           | rag           | 已建 |
| [assess-llm-wiki](./assessments/llm-wiki.md)           | LLM Wiki 测验      | llm-wiki      | 已建 |
| [assess-multi-agent](./assessments/multi-agent.md)     | 多 Agent 测验      | multi-agent   | 已建 |
| [assess-mcp](./assessments/mcp.md)                     | MCP 测验           | mcp           | 已建 |
| [assess-ai-safety](./assessments/ai-safety.md)         | AI 安全测验        | ai-safety     | 已建 |

## Agent 共享记忆（agents/）

| 页面                                                 | 名称                  | 状态 |
| ---------------------------------------------------- | --------------------- | ---- |
| [shared-conventions](./agents/shared-conventions.md) | 四个 Agent 的共同约定 | 已建 |
| [teacher-memory](./agents/teacher-memory.md)         | 讲解 Agent 的观察     | 已建 |
| [reviewer-memory](./agents/reviewer-memory.md)       | 点评 Agent 的观察     | 已建 |
| [examiner-memory](./agents/examiner-memory.md)       | 出题 Agent 的观察     | 已建 |

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
