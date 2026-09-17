# LLM Wiki 完整 SCHEMA

## 一、目录结构

```
llm-wiki/
├── SCHEMA.md
├── index.md
├── log.md
│
├── concepts/
│   ├── llm-api.md
│   ├── system-prompt.md
│   ├── agent-loop.md
│   ├── tool-calling.md
│   ├── rag.md
│   ├── llm-wiki.md
│   ├── multi-agent.md
│   ├── mcp.md
│   └── ai-safety.md
│
├── patterns/
│   ├── prompt-structure.md
│   ├── tool-definition.md
│   ├── agent-orchestration.md
│   ├── rag-pipeline.md
│   └── safety-layer.md
│
├── anti-patterns/
│   ├── vague-prompt.md
│   ├── weak-role-definition.md
│   ├── missing-params.md
│   ├── no-error-handling.md
│   ├── infinite-loop.md
│   ├── token-explosion.md
│   ├── prompt-injection.md
│   ├── over-retrieval.md
│   └── role-overlap.md
│
├── validation/
│   ├── prompt-rubric.md
│   ├── tool-rubric.md
│   ├── code-rubric.md
│   ├── question-rubric.md
│   ├── wiki-page-rubric.md
│   ├── multi-agent-rubric.md
│   ├── mcp-rubric.md
│   └── safety-rubric.md
│
├── students/
│   └── {student-id}/
│       ├── profile.md
│       ├── mastery.md
│       ├── learning-path.md
│       ├── errors.md
│       ├── prompts.md
│       └── projects.md
│
├── projects/
│   ├── 01-chatbot/
│   ├── 02-persona-bot/
│   ├── 03-weather-agent/
│   ├── 04-multi-tool-agent/
│   ├── 05-rag-agent/
│   ├── 06-wiki-agent/
│   ├── 07-multi-agent-system/
│   ├── 08-mcp-agent/
│   └── 09-safe-agent/
│
├── assessments/
│   ├── quiz-bank.md
│   └── results/{student-id}.md
│
└── agents/
    ├── teacher.md
    ├── reviewer.md
    ├── examiner.md
    └── assistant.md
```

## 二、SCHEMA.md 维护规范

```markdown
# LLM Wiki SCHEMA
## 页面类型
| 类型 | 目录 | 用途 |
|---|---|---|
| concept | concepts/ | 教学概念 |
| pattern | patterns/ | 设计模式 |
| anti-pattern | anti-patterns/ | 反模式 |
| rubric | validation/ | 评分标准 |
| student-profile | students/{id}/profile.md | 学生基本信息 |
| student-mastery | students/{id}/mastery.md | 掌握度 |
| student-learning-path | students/{id}/learning-path.md | 学习路径 |
| student-errors | students/{id}/errors.md | 错题记录 |
| student-prompts | students/{id}/prompts.md | Prompt 历史 |
| student-projects | students/{id}/projects.md | 项目进度 |
| assessment | assessments/ | 测验 |
| agent-memory | agents/ | Agent 共享记忆 |
## 命名规范
- 概念：kebab-case，如 agent-loop.md
- 学生目录：s001/、s002/
- 日期：YYYY-MM-DD
- 题目 ID：q-{module}-{序号}
- 场景 ID：scene-{module}
## Frontmatter 必填字段
### 所有页面
---
type: <页面类型>
last_updated: YYYY-MM-DD
---
### 概念页面额外
---
id: <kebab-case>
name: <显示名>
prerequisites: [<前置概念 ID>]
difficulty: 1-5
estimated_time: <分钟>
tags: [<标签>]
---
### 学生页面额外
---
student_id: <学生 ID>
---
## 交叉引用
- 用 [[wiki-link]] 语法
- 概念之间必须互相链接
- 错题必须关联概念
- 反模式必须关联概念
- 评分标准必须关联概念
## 更新规则
| 事件 | 更新页面 | 更新者 |
|---|---|---|
| 模块开始 | learning-path | 讲解 Agent |
| 概念讲解完 | learning-path | 讲解 Agent |
| Prompt 提交 | prompts, errors | 点评 Agent |
| 工具定义提交 | prompts, errors | 点评 Agent |
| 代码提交 | prompts, errors | 点评 Agent |
| 校验通过 | mastery | 点评 Agent |
| 出题 | learning-path, examiner | 出题 Agent |
| 学生提问 | log, assistant | 答疑 Agent |
| 项目里程碑 | projects | 编排层 |
## 维护任务
- 每周检查交叉引用完整性
- 每月汇总学习报告
- 发现矛盾时标记并通知导师 Agent
- 定期清理过期的临时页面
```

## 三、概念页面完整模板

### concepts/llm-api.md

```markdown
---
type: concept
id: llm-api
name: LLM API 入门
prerequisites: []
difficulty: 1
estimated_time: 30min
tags: [core, api, prompt, token]
---
# LLM API 入门
## 定义
LLM API 是你和 AI 模型之间的"对话通道"。
你发送一段文字（Prompt），AI 返回一段文字（Response）。
## 关键点
### 1. 消息格式
一次 API 调用包含一组消息，每条消息有角色：
- system：告诉 AI 它是谁、要做什么
- user：用户说的话
- assistant：AI 的回复
### 2. Token
Token 是 AI 处理文本的最小单位。
一个中文字约 1-2 个 Token，一个英文单词约 1 个 Token。
Token 数量决定成本和速度。
### 3. 请求-响应模型
你发请求 → AI 处理 → 返回结果。
每次调用都是独立的，AI 不记得上次说了什么。
### 4. 流式输出
AI 可以一个字一个字地返回，而不是等全部生成完。
## 常见误解
- 误解1：AI 记得我说过的话 → 其实每次调用都是独立的
- 误解2：Prompt 越长越好 → 其实越精准越好
- 误解3：AI 理解我的意思 → 其实它只理解你写出来的字
## 相关概念
- [[system-prompt]]
- [[agent-loop]]
```

### concepts/system-prompt.md

```markdown
---
type: concept
id: system-prompt
name: System Prompt 设计
prerequisites: [llm-api]
difficulty: 2
estimated_time: 40min
tags: [core, prompt, role]
---
# System Prompt 设计
## 定义
System Prompt 是给 AI 的"身份说明书"。
它告诉 AI：你是谁、你能做什么、你不能做什么、你怎么回答。
## 关键点
### 1. 角色定义
- 身份：你是谁（编程导师 / 天气助手 / 代码评审员）
- 风格：你怎么说话（耐心 / 严格 / 简洁）
- 能力边界：你能做什么、不能做什么
### 2. 输出格式
- 结构化：JSON / Markdown / 表格
- 长度：简短 / 详细
- 语气：正式 / 友好 / 鼓励
### 3. 边界条件
- 不知道时怎么办
- 用户跑题时怎么办
- 输入为空时怎么办
## 常见误解
- 误解1：Prompt 越长越好 → 精准比长度重要
- 误解2：写了"你是专家"AI 就真的专业 → 要具体说明专业在哪
- 误解3：System Prompt 可以解决所有问题 → 它只是起点
## 相关概念
- [[llm-api]]
- [[agent-loop]]
```

### concepts/agent-loop.md

```markdown
---
type: concept
id: agent-loop
name: Agent Loop
prerequisites: [llm-api, system-prompt]
difficulty: 3
estimated_time: 50min
tags: [core, agent, loop, react]
---
# Agent Loop
## 定义
Agent Loop 是 Agent 的核心运行机制：
思考 → 行动 → 观察 → 重复，直到任务完成。
## 关键步骤
1. 思考（Reasoning）：分析当前状态，决定下一步
2. 行动（Action）：调用工具或直接回答
3. 观察（Observation）：获取工具返回结果
4. 重复：带着新信息回到思考步骤
## 和普通聊天的区别
| | 普通聊天 | Agent |
|---|---|---|
| 流程 | 输入 → 输出 | 输入 → 思考 → 行动 → 观察 → ... → 输出 |
| 工具 | 无 | 有 |
| 多轮 | 无 | 有 |
| 自主决策 | 无 | 有 |
## 常见误解
- 误解1：Agent Loop 就是 while 循环 → 它是 LLM 驱动的决策循环
- 误解2：Agent 一次就能做对 → 它可能多轮才完成
- 误解3：观察步骤不重要 → 观察决定下一步怎么走
## 相关概念
- [[system-prompt]]
- [[tool-calling]]
```

### concepts/tool-calling.md

```markdown
---
type: concept
id: tool-calling
name: 工具调用
prerequisites: [agent-loop]
difficulty: 3
estimated_time: 50min
tags: [core, tool, function-calling]
---
# 工具调用
## 定义
工具调用是 Agent 使用外部能力的机制。
你定义工具，Agent 决定什么时候调用、传什么参数。
## 工具定义三要素
1. 名称：动词+名词，如 getWeather
2. 描述：用途、适用场景、返回什么
3. 参数：类型、必填、描述、默认值
## 常见问题
- 名称模糊：weather → 应该叫 getWeather
- 描述不清：AI 不知道什么时候用
- 参数缺失：AI 不知道该传什么
- 没有错误处理：工具失败时 Agent 不知道怎么办
## 相关概念
- [[agent-loop]]
- [[rag]]
```

### concepts/rag.md

```markdown
---
type: concept
id: rag
name: RAG 检索增强生成
prerequisites: [tool-calling]
difficulty: 4
estimated_time: 60min
tags: [core, rag, retrieval]
---
# RAG 检索增强生成
## 定义
RAG = Retrieval + Augmented + Generation
先检索相关资料，再让 AI 基于资料生成回答。
## 为什么需要 RAG
- AI 不知道你的私有资料
- AI 的知识有截止日期
- AI 会幻觉，编造不存在的内容
## 核心流程
1. 用户提问
2. 检索相关资料（向量检索）
3. 把资料和问题一起发给 AI
4. AI 基于资料生成回答
5. 标注引用来源
## 关键概念
- 向量检索：把文本转成向量，找最相似的
- 知识边界：AI 只能基于检索到的内容回答
- 引用溯源：每条回答都要能追溯到来源
## 常见误解
- 误解1：RAG 就是搜索 → 它比搜索多了生成
- 误解2：检索越多越好 → 太多会干扰 AI
- 误解3：RAG 能解决幻觉 → 它减少幻觉，但不能消除
## 相关概念
- [[tool-calling]]
- [[llm-wiki]]
```

### concepts/llm-wiki.md

```markdown
---
type: concept
id: llm-wiki
name: LLM Wiki 知识编译
prerequisites: [rag]
difficulty: 4
estimated_time: 60min
tags: [core, wiki, knowledge]
---
# LLM Wiki 知识编译
## 定义
LLM Wiki 是 RAG 的升级形态。
不是每次查询都重新检索，而是把知识一次性"编译"成结构化 Wiki。
## RAG vs LLM Wiki
| | RAG | LLM Wiki |
|---|---|---|
| 模式 | 解释器 | 编译器 |
| 每次查询 | 重新检索 | 读已编译知识 |
| 积累 | 无 | 有复利效应 |
| 成本 | 随查询线性增长 | 一次编译，持续复用 |
## 核心操作
- Ingest：摄入新资料，编译进 Wiki
- Query：基于已编译 Wiki 回答
- Maintain：自动维护交叉引用、标记矛盾
## 复利效应
第 100 份资料编译时，建立在前面 99 份蒸馏出的知识结构上。
## 相关概念
- [[rag]]
- [[multi-agent]]
```

### concepts/multi-agent.md

```markdown
---
type: concept
id: multi-agent
name: 多 Agent 协作
prerequisites: [llm-wiki]
difficulty: 5
estimated_time: 60min
tags: [core, multi-agent, orchestration]
---
# 多 Agent 协作
## 定义
多个 Agent 各自负责不同角色，协作完成复杂任务。
## 为什么要多 Agent
- 单个 Agent 能力有限
- 复杂任务需要不同专长
- 分工可以提高质量
## 常见模式
- 流水线：A 做完给 B，B 做完给 C
- 并行：A、B、C 同时做，最后合并
- 辩论：A、B 给不同方案，C 评判
- 监督：A 做，B 检查，不合格打回
## 关键问题
- 角色怎么分？
- 信息怎么传？
- 冲突怎么解决？
- 什么时候结束？
## 相关概念
- [[llm-wiki]]
- [[mcp]]
```

### concepts/mcp.md

```markdown
---
type: concept
id: mcp
name: MCP 工具集成
prerequisites: [multi-agent]
difficulty: 4
estimated_time: 50min
tags: [core, mcp, protocol, tool]
---
# MCP 工具集成
## 定义
MCP（Model Context Protocol）是连接 AI 和外部工具的开放协议。
它让 Agent 能调用外部服务：文件、数据库、搜索、API。
## 为什么需要 MCP
- 工具太多，每个都自己写太累
- MCP 提供标准接口
- 一次接入，到处可用
## 核心概念
- MCP Server：提供工具的服务
- MCP Client：Agent 端的连接器
- 工具发现：Agent 自动知道有哪些工具可用
## 常见 MCP 工具
- 文件读写
- 网络搜索
- 数据库查询
- GitHub 操作
## 相关概念
- [[multi-agent]]
- [[ai-safety]]
```

### concepts/ai-safety.md

```markdown
---
type: concept
id: ai-safety
name: AI 安全与可控性
prerequisites: [mcp]
difficulty: 4
estimated_time: 50min
tags: [core, safety, security]
---
# AI 安全与可控性
## 定义
让 Agent 在安全边界内运行，不产生有害输出，不执行危险操作。
## 核心风险
- 幻觉：编造不存在的信息
- 提示注入：用户诱导 Agent 越权
- 危险操作：删除文件、执行恶意代码
- 成本失控：无限循环、Token 爆炸
- 隐私泄露：把用户数据发给第三方
## 防护机制
- 内容过滤：输入输出都过滤
- 沙箱：危险操作隔离
- 限流：限制调用次数和 Token
- 兜底：出错时给友好提示
- 引用溯源：回答能追溯来源
## 相关概念
- [[mcp]]
- [[rag]]
```

## 四、学生画像 6 个页面完整模板

### students/{id}/profile.md

```markdown
---
type: student-profile
student_id: s001
last_updated: YYYY-MM-DD
---
# 学生画像
## 基本信息
| 字段 | 值 |
|---|---|
| 学生 ID | s001 |
| 昵称 | 小明 |
| 注册时间 | YYYY-MM-DD |
| 编程基础 | 零基础 |
| 学习目标 | 学会做 Agent |
| 目标语言 | TypeScript |
## 偏好
| 字段 | 值 |
|---|---|
| 学习节奏 | 每天 30 分钟 |
| 讲解风格 | 喜欢类比 |
| 提示偏好 | 先自己试，卡住再要提示 |
| 反馈偏好 | 鼓励式 |
| 视觉偏好 | 喜欢动画演示 |
## 行为特征
| 字段 | 值 |
|---|---|
| 平均答题次数 | 2.3 次 |
| 平均修正次数 | 1.5 次 |
| 最长卡住时长 | 15 分钟 |
| 提问频率 | 高 |
| 跑偏频率 | 低 |
## 学习日志
| 日期 | 事件 |
|---|---|
| YYYY-MM-DD | 注册，开始 llm-api |
| YYYY-MM-DD | 完成 llm-api，掌握度 5/5 |
```

### students/{id}/mastery.md

```markdown
---
type: student-mastery
student_id: s001
last_updated: YYYY-MM-DD
---
# 掌握度总览
| 概念 | 掌握度 | 最后复习 | 错题数 | 状态 |
|---|---|---|---|---|
| llm-api | 5/5 | YYYY-MM-DD | 0 | 已掌握 |
| system-prompt | 4/5 | YYYY-MM-DD | 1 | 接近掌握 |
| agent-loop | 3/5 | YYYY-MM-DD | 2 | 需巩固 |
| tool-calling | 2/5 | YYYY-MM-DD | 3 | 薄弱 |
| rag | 0/5 | - | 0 | 未开始 |
| llm-wiki | 0/5 | - | 0 | 未开始 |
| multi-agent | 0/5 | - | 0 | 未开始 |
| mcp | 0/5 | - | 0 | 未开始 |
| ai-safety | 0/5 | - | 0 | 未开始 |
## 子能力雷达
| 子能力 | 得分 |
|---|---|
| 意图表达 | 4/5 |
| 任务分解 | 2/5 |
| 上下文管理 | 3/5 |
| 质量判断 | 2/5 |
| 迭代调优 | 3/5 |
| 理解 AI 行为 | 4/5 |
## 薄弱点分析
- tool-calling：参数定义经常遗漏 required 字段
- tool-calling：错误处理未考虑
- agent-loop：对"观察"步骤理解不清
## 推荐下一步
1. 重做 tool-calling 变式题（3 道）
2. 回放 agent-loop 可视化
3. 通过后进入 rag
```

### students/{id}/learning-path.md

```markdown
---
type: student-learning-path
student_id: s001
last_updated: YYYY-MM-DD
current_module: tool-calling
next_module: rag
---
# 学习路径
## 总览
| 顺序 | 模块 | 状态 | 开始 | 完成 | 掌握度 |
|---|---|---|---|---|---|
| 1 | llm-api | 已完成 | YYYY-MM-DD | YYYY-MM-DD | 5/5 |
| 2 | system-prompt | 已完成 | YYYY-MM-DD | YYYY-MM-DD | 4/5 |
| 3 | agent-loop | 已完成 | YYYY-MM-DD | YYYY-MM-DD | 3/5 |
| 4 | tool-calling | 进行中 | YYYY-MM-DD | - | 2/5 |
| 5 | rag | 未开始 | - | - | 0/5 |
| 6 | llm-wiki | 未开始 | - | - | 0/5 |
| 7 | multi-agent | 未开始 | - | - | 0/5 |
| 8 | mcp | 未开始 | - | - | 0/5 |
| 9 | ai-safety | 未开始 | - | - | 0/5 |
## 当前路径调整
- tool-calling 掌握度不足，插入 3 道变式题
- agent-loop 需要回放可视化，巩固"观察"步骤
- 若 tool-calling 达到 4/5，进入 rag
## 练习记录
| 日期 | 模块 | 题型 | 得分 | 是否通过 |
|---|---|---|---|---|
| YYYY-MM-DD | tool-calling | 选择题 | 100 | 是 |
| YYYY-MM-DD | tool-calling | 填空题 | 60 | 否 |
## 推荐节奏
- 每天 30 分钟
- 每完成一个模块，做一次小测验
- 每三个模块，做一个综合项目
```

### students/{id}/errors.md

```markdown
---
type: student-errors
student_id: s001
last_updated: YYYY-MM-DD
---
# 错题记录
## YYYY-MM-DD | tool-calling | 参数定义
**题目：** 定义一个查询汇率的工具
**学生答案：**
```typescript

const tool = {

  name: "getRate",

  description: "查汇率",

  parameters: { from: "string", to: "string" }

}

```
**问题：**
- 缺少参数类型说明
- 缺少 required 字段
- description 不够具体
**正确示范：**
```typescript

const tool = {

  name: "getExchangeRate",

  description: "查询两种货币之间的实时汇率",

  parameters: {

    type: "object",

    properties: {

      from: { type: "string", description: "源货币代码，如 USD" },

      to: { type: "string", description: "目标货币代码，如 CNY" }

    },

    required: ["from", "to"]

  }

}

```
**关联概念：** [[tool-calling]]
**关联反模式：** [[missing-params]]
**是否已订正：** 是
**变式练习：** 已生成 3 道
**下次复习：** YYYY-MM-DD
```

### students/{id}/prompts.md

```markdown
---
type: student-prompts
student_id: s001
last_updated: YYYY-MM-DD
---
# Prompt 历史
## YYYY-MM-DD | 天气 Agent | 评分 72/100
**Prompt:**
```

你是一个天气助手，帮用户查天气。

```
**评分：**
| 维度 | 得分 | 权重 | 加权分 | 问题 |
|---|---|---|---|---|
| 角色定义 | 20/25 | 25% | 20 | 缺少能力边界说明 |
| 工具描述 | 15/25 | 25% | 15 | 没有说明有哪些工具 |
| 输出格式 | 10/20 | 20% | 10 | 没有要求结构化输出 |
| 边界条件 | 12/15 | 15% | 12 | 没考虑查不到的情况 |
| 简洁性 | 15/15 | 15% | 15 | 简洁 |
| **总分** | | | **72** | 不及格 |
**改进建议：**
- 明确 Agent 能调用 getWeather 工具
- 要求输出格式：{ city, temp, condition }
- 加上"如果查不到，告知用户"
**学生修改后：** 85/100（见下一条记录）
## YYYY-MM-DD | 天气 Agent（修改版）| 评分 85/100
**Prompt:**
```

你是一个天气助手，能调用 getWeather 工具查询指定城市的天气。

规则：

1. 如果用户问天气，调用 getWeather

2. 输出格式：{ city, temp, condition }

3. 如果查不到，告知用户"暂时查不到该城市天气"

4. 语气友好，简洁

```
**评分：**
| 维度 | 得分 | 权重 | 加权分 |
|---|---|---|---|
| 角色定义 | 23/25 | 25% | 23 |
| 工具描述 | 22/25 | 25% | 22 |
| 输出格式 | 18/20 | 20% | 18 |
| 边界条件 | 13/15 | 15% | 13 |
| 简洁性 | 9/15 | 15% | 9 |
| **总分** | | | **85** |
**进步：** 从 72 到 85，角色定义和工具描述明显改善。
**仍需改进：** 规则可以更简洁，合并第 3、4 条。
```

### students/{id}/projects.md

```markdown
---
type: student-projects
student_id: s001
last_updated: YYYY-MM-DD
---
# 项目进度
## 项目 1：天气 Agent
**状态：** 已完成
**开始：** YYYY-MM-DD
**完成：** YYYY-MM-DD
**Web 应用内：**
- [x] 观察导师代码
- [x] 完成场景（AI 校验通过）
- [x] 可视化运行
- [x] 变式练习（3/3）
**IDE 实战：**
- [x] 用 Claude Code 生成项目
- [x] 运行成功
- [ ] 添加错误处理（待完成）
**Prompt 记录：**
- 初始 Prompt：见 prompts.md YYYY-MM-DD
- 修改后：见 prompts.md YYYY-MM-DD
**项目链接：**
- GitHub: https://github.com/...
- 在线演示: https://...
**导师评语：**
工具定义掌握良好，下一步建议学习多工具协作。
```

## 五、Agent 共享记忆模板

### agents/teacher.md

```markdown
---
type: agent-memory
agent: teacher
last_updated: YYYY-MM-DD
---
# 讲解 Agent 记忆
## 教学策略记录
| 日期 | 模块 | 学生 | 策略 | 效果 |
|---|---|---|---|---|
| YYYY-MM-DD | tool-calling | s001 | 用"给新员工写工作手册"类比 | 良好 |
## 高效类比库
| 概念 | 类比 |
|---|---|
| llm-api | 写信 |
| system-prompt | 演员拿到剧本 |
| agent-loop | 快递员送货 |
| tool-calling | 给新员工写工作手册 |
| rag | 开卷考试 |
| llm-wiki | 编译器 vs 解释器 |
| multi-agent | 公司团队 |
| mcp | USB 接口 |
| ai-safety | 保安 |
```

### agents/reviewer.md

```markdown
---
type: agent-memory
agent: reviewer
last_updated: YYYY-MM-DD
---
# 点评 Agent 记忆
## 高频错误记录
| 错误 | 概念 | 出现次数 | 改进策略 |
|---|---|---|---|
| 参数缺少 required | tool-calling | 8 | 用反模式对比 |
| 角色定义薄弱 | system-prompt | 5 | 给正确示范 |
| 未考虑异常 | tool-calling | 6 | 用"边界条件"提醒 |
## 评分调整记录
| 日期 | 调整 | 原因 |
|---|---|---|
| YYYY-MM-DD | 角色定义权重从 20% 提到 25% | 发现学生普遍薄弱 |
```

### agents/examiner.md

```markdown
---
type: agent-memory
agent: examiner
last_updated: YYYY-MM-DD
---
# 出题 Agent 记忆
## 出题记录
| 日期 | 模块 | 学生 | 题数 | 题型 |
|---|---|---|---|---|
| YYYY-MM-DD | tool-calling | s001 | 3 | 选择、填空、实战 |
## 高效果题目
| 题目 | 概念 | 效果 |
|---|---|---|
| 定义汇率查询工具 | tool-calling | 暴露参数缺失问题 |
```

### agents/assistant.md

```markdown
---
type: agent-memory
agent: assistant
last_updated: YYYY-MM-DD
---
# 答疑 Agent 记忆
## 高频问题
| 问题 | 概念 | 出现次数 | 回答策略 |
|---|---|---|---|
| AI 为什么记不住 | llm-api | 5 | 用"每次都是新的"解释 |
| 为什么要多轮 Loop | agent-loop | 3 | 用快递员类比 |
| topK 怎么选 | rag | 2 | 给 3-5 建议 |
## 教学盲区反馈
| 问题 | 反馈给 | 状态 |
|---|---|---|
| 学生对"观察"步骤理解不清 | 讲解 Agent | 已反馈 |
```

## 六、LLM Wiki 操作接口

```typescript
// 编译：把资料变成 Wiki 页面
async function ingest(source: string, target: string, schema: string): Promise<void>;
// 查询：基于 Wiki 回答
async function query(question: string, options?: {
  related?: string;
  topK?: number;
}): Promise<WikiQueryResult>;
// 维护：自动更新交叉引用
async function maintain(): Promise<MaintainReport>;
// 读取单个页面
async function getPage(path: string): Promise<WikiPage>;
// 更新页面
async function updatePage(path: string, content: string): Promise<void>;
```

## 七、配置

`.pi/settings.json`：

```json
{
  "llm-wiki": {
    "synthesisLanguage": "zh",
    "taskModel": {
      "provider": "deepseek",
      "id": "deepseek-chat"
    },
    "auto_fix_lint": true,
    "trajectories": false,
    "batch_ingest_size": 3
  }
}
```

