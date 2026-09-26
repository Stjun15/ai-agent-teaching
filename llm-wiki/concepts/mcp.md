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

## 示范代码

接入 MCP Server → 看有哪些工具 → 调用工具 → 拿到结果。一次配置，到处可用。

```typescript
// ① 连接到 MCP Server：建立与工具服务器的通道
const mcpClient = await connectMCP({
  server: "search-server",               // 服务名：想接哪个 MCP Server
  url: "mcp://search.example.com",       // 连接地址：MCP 协议的标准 URL 格式
});
// 连接成功后，Agent 和外部工具之间就多了一条「专线」

// ② 列出可用工具：问 Server「你有哪些工具？」
const tools = await mcpClient.listTools();
// tools = [
//   { name: "webSearch",   description: "搜索互联网最新信息" },
//   { name: "readFile",    description: "读取本地文件内容" },
//   { name: "queryDB",     description: "执行数据库查询" },
// ]
// Agent 拿到这份清单后，自动知道现在能做什么

// ③ 调用工具：Agent 选工具、传参数，MCP Client 转发请求给 MCP Server
const result = await mcpClient.callTool("webSearch", {
  query: "最新 AI 新闻",                 // 搜索关键词
});
// 调用链路：Agent → MCP Client → MCP Server → 外部服务 → 结果原路返回

// ④ Agent 拿到搜索结果后继续处理——整个过程对 Agent 透明
console.log(result);
// → { results: ["新闻1: ...", "新闻2: ..."], total: 42 }
```

## 相关概念

- [[multi-agent]]
- [[ai-safety]]