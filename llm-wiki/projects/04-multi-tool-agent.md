---
type: project
last_updated: 2026-09-18
id: 04-multi-tool-agent
name: 多工具 Agent
difficulty: 3
estimated_time: 90min
module_id: tool-calling
tags: [tool-calling, function, json]
---

## 概述

在 [[03-weather-agent]] 之上接多个工具（天气、计算器、当前时间），并让模型在它们之间正确选型。重点是把 [[tool-calling]] 的函数描述写清楚——名字、参数、含义——否则模型要么不调，要么调错。

## 目标

- 能给每个工具写一份无歧义的函数描述（名称、参数、类型、用途）。
- 能在一个回合里组合多个工具的结果来作答。
- 能在工具失败时给出可理解的提示，而不是崩溃。

## 起步 Prompt

```text
你有三个工具：get_weather(city)、calculate(expression)、now()。
根据问题选择合适的工具；需要计算时优先用 calculate，
不要把算式交给模型心算。工具失败时如实告诉用户。
```

## 检查清单

- [ ] 每个工具的描述都含参数类型与含义
- [ ] 复杂问题会串联多个工具（例如「北京现在比伦敦热几度」）
- [ ] 工具报错时程序不崩溃，并把错误转述给用户

## 验收要点

- 提一个需要两步工具调用的问题，程序应自主完成两次调用再作答。
