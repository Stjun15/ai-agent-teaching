---
type: concept
last_updated: 2026-10-10
id: mcp
name: MCP 工具集成
prerequisites: [multi-agent]
difficulty: 4
estimated_time: 50min
tags: [core, mcp, protocol, tool]
---

# MCP 工具集成

## 先来一个故事：你家的插座，所有电器都插同一个孔

你回到家，手机没电了。你拿起充电器，往墙上一插——充上了。

你换台灯：同一个孔，插上就亮。换吹风机：还是那个孔。

你不需要每买一个电器就找电工来重新走线。为什么？因为**所有电器都遵守同一个标准：两孔或三孔插座**。

MCP 就是这个插座。它不是某一个工具的接口——它是**所有工具共用的标准插孔**。Agent 只要学会"怎么插电"，就能用所有接了这个标准的工具，不用每学一个新工具就重新学怎么接入。

**MCP 不是"又一个新工具"。它是"工具的USB接口"——一次学会怎么插，所有工具随插随用。**

---

## 定义

MCP（Model Context Protocol）是连接 AI 和外部工具的开放协议。
它让 Agent 能调用外部服务：文件、数据库、搜索、API。

## 为什么需要 MCP

- 工具太多，每个都自己写太累
- MCP 提供标准接口
- 一次接入，到处可用

## 关键步骤：三个核心概念

> 本节的 `###` 子节是**这一讲必须掌握的步骤清单**，讲稿应当逐步覆盖。
> 结构与 `platform-replica.md` 一致，便于自动检测「讲稿漏讲了哪一步」。

### 一 · MCP Server（提供工具的服务）

**是什么：** 一端提供服务与工具能力的一方。

### 二 · MCP Client（Agent 端的连接器）

**是什么：** Agent 那一端负责连接、发现并调用这些工具的连接器。

### 三 · 工具发现

**是什么：** Agent **自动知道**有哪些工具可用，不用逐个硬编码。

**少了会怎样：** 每加一个工具都要改一遍 Agent 代码，规模一大就撑不住。

## 常见 MCP 工具

- 文件读写
- 网络搜索
- 数据库查询
- GitHub 操作

## 示范代码

接入 MCP Server → 看有哪些工具 → 调用工具 → 拿到结果。一次配置，到处可用。

> 👉 `connectMCP()` 在背后做的事：打开一个到工具服务器的连接（类似打开浏览器访问一个网站），握手确认双方用同一种协议，然后维持这条通道。**你不需要知道里面是 WebSocket 还是 HTTP——你只需要知道连上之后，Agent 就能"看到"远程的工具列表。**

```typescript
// ① 连接到 MCP Server：建立与工具服务器的通道
const mcpClient = await connectMCP({
  server: "search-server", // 服务名：想接哪个 MCP Server
  url: "mcp://search.example.com", // 连接地址：MCP 协议的标准 URL 格式
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
  query: "最新 AI 新闻", // 搜索关键词
});
// 调用链路：Agent → MCP Client → MCP Server → 外部服务 → 结果原路返回

// ④ Agent 拿到搜索结果后继续处理——整个过程对 Agent 透明
console.log(result);
// → { results: ["新闻1: ...", "新闻2: ..."], total: 42 }
```

## 自己动手：你来说

> 用"插座和插头"的例子，解释 MCP 协议为什么能"一次连接，到处可用"。
>
> 然后：**设计一个"本地文件管理"的 MCP Server。** 列出至少 3 个工具——写清每个工具的 `name`、`description`、`parameters`（参照示范代码里的 `webSearch` 格式）。

---

## 相关概念

- [[multi-agent]]
- [[ai-safety]]
