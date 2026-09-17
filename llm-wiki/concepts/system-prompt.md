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

## 常见误解

- 误解1：Prompt 越长越好 → 精准比长度重要
- 误解2：写了"你是专家"AI 就真的专业 → 要具体说明专业在哪
- 误解3：System Prompt 可以解决所有问题 → 它只是起点

## 相关概念

- [[llm-api]]
- [[agent-loop]]
