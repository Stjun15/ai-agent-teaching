# C 阶段：知识层（LLM Wiki）

## 目标

实现 LLM Wiki 的完整 SCHEMA、学生画像、评分标准、反模式库。

## 目录结构

llm-wiki/

├── SCHEMA.md

├── index.md

├── log.md

├── concepts/ # 9 个概念页面

├── patterns/ # 5 个设计模式

├── anti-patterns/ # 9 个反模式

├── validation/ # 8 个评分标准

├── students/ # 学生画像

│ └── {id}/

│ ├── profile.md

│ ├── mastery.md

│ ├── learning-path.md

│ ├── errors.md

│ ├── prompts.md

│ └── projects.md

├── projects/ # 9 个项目模板

├── assessments/ # 测验题库

└── agents/ # 4 个 Agent 共享记忆

text

## 概念依赖关系

llm-api → system-prompt → agent-loop → tool-calling

→ rag → llm-wiki → multi-agent → mcp → ai-safety

text

## 学生画像 6 个页面

| 页面 | 内容 |
|---|---|
| profile.md | 基本信息、偏好、行为特征 |
| mastery.md | 9 个概念掌握度 + 6 个子能力雷达 |
| learning-path.md | 模块顺序、状态、练习记录、路径调整 |
| errors.md | 错题记录、关联概念、订正状态 |
| prompts.md | Prompt 历史、评分、改进建议 |
| projects.md | 项目进度、检查清单、Prompt 链接、项目链接 |

## 9 个反模式

vague-prompt, weak-role-definition, missing-params, no-error-handling,

infinite-loop, token-explosion, prompt-injection, over-retrieval, role-overlap

## 8 个评分标准

prompt-rubric, tool-rubric, code-rubric, question-rubric,

wiki-page-rubric, multi-agent-rubric, mcp-rubric, safety-rubric

## 完整 SCHEMA

见 `references/wiki-schema.md`。

## 完整评分标准

见 `references/rubrics.md`。

## 完整反模式库

见 `references/anti-patterns.md`。

## 交付物

- `llm-wiki/` 完整目录和内容

- `llm-wiki/SCHEMA.md` 维护规范

- `src/wiki/` LLM Wiki 集成代码

- `scripts/seed-wiki.ts` 初始化脚本

## 验收标准

- SCHEMA 完整，所有页面有 frontmatter

- 交叉引用正确，无死链

- 学生画像 6 个页面模板可用

- 评分标准可被点评 Agent 读取

- 反模式可被校验规则引用

- LLM Wiki 的 ingest / query / maintain 三个操作可用
