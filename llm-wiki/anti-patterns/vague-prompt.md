---
type: anti-pattern
last_updated: 2026-09-17
id: vague-prompt
name: 模糊 Prompt
related_concepts: [system-prompt]
severity: high
---

# 模糊 Prompt

## 表现

- "你是一个助手"
- "尽量回答好"
- "帮我查一下"
- "随便给我点建议"
- "你是一个 AI"

## 为什么错

Agent 无法确定角色、能力边界、输出格式，导致行为不可控。
学生看似写了 Prompt，实际上 AI 什么都不知道。

## 校验规则

| 检测项                                       | 扣分  |
| -------------------------------------------- | ----- |
| 检测到"尽量""可能""随便""大概""也许"等模糊词 | -5/处 |
| 角色定义少于 10 字                           | -10   |
| 未说明能力边界                               | -10   |
| 未说明输出格式                               | -10   |

## 正确示范

```

你是一个天气助手，能调用 getWeather 工具。

规则：

1. 用户问天气时调用 getWeather

2. 输出格式：{ city, temp, condition }

3. 查不到时告知用户

```

## 相关概念

- [[system-prompt]]
