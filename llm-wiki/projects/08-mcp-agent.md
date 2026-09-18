---
type: project
last_updated: 2026-09-18
id: 08-mcp-agent
name: MCP Agent
difficulty: 4
estimated_time: 120min
module_id: mcp
tags: [mcp, integration, tool]
---

## 概述

让 Agent 通过 MCP 协议连上一个外部服务，而不是直接把 API 写死在代码里。这是 [[mcp]] 的落地：理解「客户端发现工具 → 选中工具 → 服务端对接外部系统 → 结果流回」这条链路，并体会解耦带来的可替换性。

## 目标

- 能描述 MCP Server 暴露的工具（名称、参数、含义）。
- 能让 Agent 根据工具描述自主决定是否调用、调用哪个。
- 能在工具描述缺失时，让链路停在「选工具」这一步而不是硬闯。

## 起步 Prompt

```text
你可以通过 MCP 连接一个数据服务，它暴露 get_records(filter) 与
save_record(item) 两个工具。只在该用的时候用，调用前先向用户说明意图。
若某工具描述为空，不要猜测参数，直接告知无法使用该工具。
```

## 检查清单

- [ ] 工具描述清晰，模型能据此自主选型
- [ ] 调用前模型先说明意图，再发请求
- [ ] 工具描述为空时链路停止并提示，而非编造参数

## 验收要点

- 把一个工具的描述清空，系统应停在选工具处并说明，而非报错崩溃。
