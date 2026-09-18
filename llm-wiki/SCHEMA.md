# LLM Wiki SCHEMA

## 页面类型

| 类型                  | 目录                           | 用途           |
| --------------------- | ------------------------------ | -------------- |
| concept               | concepts/                      | 教学概念       |
| pattern               | patterns/                      | 设计模式       |
| anti-pattern          | anti-patterns/                 | 反模式         |
| rubric                | validation/                    | 评分标准       |
| student-profile       | students/{id}/profile.md       | 学生基本信息   |
| student-mastery       | students/{id}/mastery.md       | 掌握度         |
| student-learning-path | students/{id}/learning-path.md | 学习路径       |
| student-errors        | students/{id}/errors.md        | 错题记录       |
| student-prompts       | students/{id}/prompts.md       | Prompt 历史    |
| student-projects      | students/{id}/projects.md      | 项目进度       |
| assessment            | assessments/                   | 测验           |
| agent-memory          | agents/                        | Agent 共享记忆 |
| project               | projects/                      | 项目模板       |

项目模板（`projects/`）承载「实践步骤」的起步工程：每个模板对应一个教学模块，给出可粘贴的 Prompt、检查清单与验收要点。它不进入 `students/{id}/` 目录，而是被 `[[wiki-link]]` 由对应概念页引用，并被 `/api/project/template/[id]` 直接读出（无需新建数据表——与 `concepts/` 现读同源）。

## 命名规范

- 概念：kebab-case，如 agent-loop.md
- 学生目录：s001/、s002/
- 日期：YYYY-MM-DD
- 题目 ID：q-{module}-{序号}
- 场景 ID：scene-{module}

## Frontmatter 必填字段

### 所有页面

```yaml
---
type: <页面类型>
last_updated: YYYY-MM-DD
---
```

### 概念页面额外

```yaml
---
id: <kebab-case>
name: <显示名>
prerequisites: [<前置概念 ID>]
difficulty: 1-5
estimated_time: <分钟>
tags: [<标签>]
---
```

### 学生页面额外

```yaml
---
student_id: <学生 ID>
---
```

## 交叉引用

- 用 [[wiki-link]] 语法
- 概念之间必须互相链接
- 错题必须关联概念
- 反模式必须关联概念
- 评分标准必须关联概念

## 更新规则

| 事件         | 更新页面                | 更新者     |
| ------------ | ----------------------- | ---------- |
| 模块开始     | learning-path           | 讲解 Agent |
| 概念讲解完   | learning-path           | 讲解 Agent |
| Prompt 提交  | prompts, errors         | 点评 Agent |
| 工具定义提交 | prompts, errors         | 点评 Agent |
| 代码提交     | prompts, errors         | 点评 Agent |
| 校验通过     | mastery                 | 点评 Agent |
| 出题         | learning-path, examiner | 出题 Agent |
| 学生提问     | log, assistant          | 答疑 Agent |
| 项目里程碑   | projects                | 编排层     |

## 维护任务

- 每周检查交叉引用完整性
- 每月汇总学习报告
- 发现矛盾时标记并通知导师 Agent
- 定期清理过期的临时页面
