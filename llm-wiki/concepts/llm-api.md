---
type: concept
last_updated: 2026-09-17
id: llm-api
name: LLM API 入门
prerequisites: [python-basics, ts-basics]
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
