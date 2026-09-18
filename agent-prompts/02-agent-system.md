# B 阶段：Agent 系统

## 目标

实现 4 个 AI 导师 Agent + 7 个 Skill + 编排层。

## 4 个 Agent

| Agent | 职责 | 触发时机 |
|---|---|---|
| 讲解 Agent | 讲概念、做类比、可视化引导 | 进入新模块 |
| 点评 Agent | 评 Prompt、评代码、评项目设计 | 学生提交作业 |
| 出题 Agent | 生成练习、变式题、测验题 | 完成学习后 |
| 答疑 Agent | 回答任意问题、排查错误、给提示 | 学生主动提问 |

## 7 个 Skill

| Skill | 用途 |
|---|---|
| explain-concept | 怎么讲概念 |
| validate-prompt | 怎么校验 Prompt |
| validate-tool | 怎么校验工具定义 |
| validate-code | 怎么校验代码 |
| generate-question | 怎么出题 |
| answer-question | 怎么答疑 |
| trigger-visualization | 怎么触发可视化 |

## 四层执行架构

| 层 | 载体 | 内容 |
|---|---|---|
| 1. 身份层 | System Prompt | Agent 是谁、职责、行为准则 |
| 2. 技能层 | Skill 文件 | 具体任务怎么做 |
| 3. 知识层 | LLM Wiki | 概念、评分标准、学生画像 |
| 4. 编排层 | 工作流代码 | 什么时候调用谁、读哪些页面 |

## Agent 之间状态传递

- **通过 LLM Wiki 共享**，不直接消息传递。

- 所有 Agent 都能读学生画像。

- 只有对应 Agent 能写。

- 写入权限表：

  | Agent | 写入 |
  |---|---|
  | 讲解 | learning-path |
  | 点评 | prompts, errors, mastery |
  | 出题 | learning-path, examiner |
  | 答疑 | log, assistant |

## 异常处理

| 异常 | 处理 |
|---|---|
| Agent 输出格式错误 | Zod 校验失败 → 附带错误重试 → 兜底 |
| 校验不通过 3 次 | 降低难度 + 换类比 + 记录 errors |
| API 失败 | 429 退避重试，5xx 切换备用模型 |
| 学生卡住 3 轮 | 给 L2 提示 |
| 学生卡住 5 轮 | 给 L3 提示 + 回顾前置 |
| 学生跑偏 | 温和拉回 + 记录 |

## Trace 记录

每次 Agent 调用记录：

```typescript
interface AgentTrace {
  traceId: string;
  timestamp: string;
  studentId: string;
  sessionId: string;
  agent: string;
  skill: string;
  input: object;
  output: object;
  wikiReads: string[];
  wikiWrites: string[];
  durationMs: number;
  tokens: { input: number; output: number };
  retries: number;
  success: boolean;
  error?: string;
}

```
