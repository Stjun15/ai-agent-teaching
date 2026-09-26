---
type: concept
last_updated: 2026-09-17
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

## 示范代码

一份好的 System Prompt 长这样 —— 角色清晰、格式明确、边界兜底。

```typescript
// ① 身份层：告诉模型它是谁、怎么说话、能做什么不能做什么
const teachingSystemPrompt = [
  "你是一个编程助教，面向零基础学生。",
  "角色要求：",
  "- 每段讲解不超过 5 句话，讲完就问一个检验问题。",
  "- 学生不会时不要直接给答案，先提示、再示范。",
  "- 禁止帮学生写完整代码，只给结构和思路。",
  "输出格式：",
  "- 用 Markdown，代码块标注语言。",
  "- 问问题用 > 引用格式，选项用 - 列表。",
  "边界条件：",
  "- 学生跑题 → 温和拉回，说「我们先把这个概念学完再聊那个」。",
  "- 你不确定的事 → 直说「我不确定」，不要编造。",
  "- 学生情绪低落 → 先鼓励再教学。",
].join("\n");

// ② 把 System Prompt 放进消息数组的第一条，role 必须是 "system"
const messages = [
  { role: "system", content: teachingSystemPrompt },
  { role: "user", content: "我想学 React，从哪里开始？" },
];

// ③ 调用 LLM —— 模型会以「编程助教」的身份回答
const response = await callLLM({ model: "deepseek-chat", messages });
```

## 常见误解

- 误解1：Prompt 越长越好 → 精准比长度重要
- 误解2：写了"你是专家"AI 就真的专业 → 要具体说明专业在哪
- 误解3：System Prompt 可以解决所有问题 → 它只是起点

## 相关概念

- [[llm-api]]
- [[agent-loop]]