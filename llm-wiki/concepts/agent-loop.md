---
type: concept
last_updated: 2026-09-17
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

|          | 普通聊天    | Agent                                  |
| -------- | ----------- | -------------------------------------- |
| 流程     | 输入 → 输出 | 输入 → 思考 → 行动 → 观察 → ... → 输出 |
| 工具     | 无          | 有                                     |
| 多轮     | 无          | 有                                     |
| 自主决策 | 无          | 有                                     |

## 常见误解

- 误解1：Agent Loop 就是 while 循环 → 它是 LLM 驱动的决策循环
- 误解2：Agent 一次就能做对 → 它可能多轮才完成
- 误解3：观察步骤不重要 → 观察决定下一步怎么走

## 相关概念

- [[system-prompt]]
- [[tool-calling]]
