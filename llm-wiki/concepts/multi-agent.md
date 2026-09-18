---
type: concept
last_updated: 2026-09-17
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
