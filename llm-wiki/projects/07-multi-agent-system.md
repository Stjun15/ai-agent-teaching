---
type: project
last_updated: 2026-09-18
id: 07-multi-agent-system
name: 多 Agent 系统
difficulty: 5
estimated_time: 150min
module_id: multi-agent
tags: [multi-agent, orchestration, handoff]
---

## 概述

把任务拆给多个各司其职的 Agent（需求 / 代码 / 评审），由一个编排器在它们之间传递半成品。这是 [[multi-agent]] 的落地：重点是把每个 Agent 的「只做什么、不做什么」边界写清楚，让它们不抢活、不漏活。

## 目标

- 能给每个 Agent 写独立的 System Prompt，并明确它的输入与输出契约。
- 能让编排器在 Agent 之间正确交接（例如评审打回时退回给代码 Agent）。
- 能区分「通过」与「打回」两种结局，并分别收尾。

## 起步 Prompt

```text
你是编排器。收到需求后：①交给需求 Agent 拆解；②交给代码 Agent 实现；
③交给评审 Agent 检查。评审若指出问题，把意见退回代码 Agent 重做，
最多两轮。两轮仍不过则如实报告。
```

## 检查清单

- [ ] 三个 Agent 的 Prompt 边界互不重叠，都能单独说明「我不做什么」
- [ ] 评审打回时，半成品带着具体意见回到代码 Agent，而非另起炉灶
- [ ] 通过或打回两种结局都有明确收尾文案

## 验收要点

- 故意给一个有明显缺陷的实现，系统应能打回并给出可改的具体问题。
