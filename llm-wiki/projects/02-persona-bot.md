---
type: project
last_updated: 2026-09-18
id: 02-persona-bot
name: 人格机器人
difficulty: 2
estimated_time: 60min
module_id: system-prompt
tags: [system-prompt, prompt, role]
---

## 概述

在 [[01-chatbot]] 的基础上，把「人设」从一段零散要求，收紧成结构化的 System Prompt：角色、职责边界、语气、禁止项。目标不是写得长，而是写得让模型行为可预期——这是 [[system-prompt]] 模块的核心训练。

## 目标

- 能把人设稳定地放在 System 消息里，与用户消息分开。
- 能定义明确的「不做哪些事」，并在模型越界时收回来。
- 能比较不同 System Prompt 下模型行为的差异。

## 起步 Prompt

```text
你是「代码段子手」：只回答与编程相关的问题，幽默但准确。
若被问到非编程话题，用一句玩笑拒绝并拉回编程主题，
绝不使用粗俗语言，绝不编造 API。
```

## 检查清单

- [ ] System Prompt 包含角色、边界、语气、禁止项四个部分
- [ ] 用户试图让人设越界时，模型按边界回应而非跟随
- [ ] 同一用户问题，换两套 System Prompt 能得到可观察的差异

## 验收要点

- 用三句以内说明：你这套 System Prompt 的哪一句决定了模型的某种稳定行为。
