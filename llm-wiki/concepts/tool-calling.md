---
type: concept
last_updated: 2026-09-17
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
