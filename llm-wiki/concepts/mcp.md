---
type: concept
last_updated: 2026-09-17
id: mcp
name: MCP 工具集成
prerequisites: [multi-agent]
difficulty: 4
estimated_time: 50min
tags: [core, mcp, protocol, tool]
---

# MCP 工具集成

## 定义

MCP（Model Context Protocol）是连接 AI 和外部工具的开放协议。
它让 Agent 能调用外部服务：文件、数据库、搜索、API。

## 为什么需要 MCP

- 工具太多，每个都自己写太累
- MCP 提供标准接口
- 一次接入，到处可用

## 核心概念

- MCP Server：提供工具的服务
- MCP Client：Agent 端的连接器
- 工具发现：Agent 自动知道有哪些工具可用

## 常见 MCP 工具

- 文件读写
- 网络搜索
- 数据库查询
- GitHub 操作

## 相关概念

- [[multi-agent]]
- [[ai-safety]]
