# Phase 4 AI能力 · MCP协议实战（v2.0）

> **一句话总结：** 用"一周接入4个外部服务"的紧急需求讲清 MCP 协议如何标准化工具接入，避免每个服务写一套适配代码。

> **前置文档**
>
> - `06-AI能力-Tools设计实战`（`06-AI能力/`）—— 先理解工具概念，再学 MCP 如何标准化接入工具。
> - `06-AI能力-Skill系统实战`（`06-AI能力/`）—— 理解能力注册机制。

> **后置文档**
>
> - `06-AI能力-Memory系统实战`（`06-AI能力/`）—— 本文"下一步"指定：学完 MCP 后进入 Agent 记忆系统。
> - `07-平台-MCP翻译层教学`（`07-平台治理与交付/`）—— 平台级 MCP 接入与通用翻译层。

> **架构定位（双工程）：** 本能力在双工程架构（agent-platform + ai-service）中属于**平台内核 agent-tools 子系统（TypeScript 实现）**，不是 HMall 业务。agent-platform 用 HTTP(axios) 调 ai-service 的 REST API；HMall（Java 业务层）只是第一个接入方，通过"工具协议/MCP 网关"接入平台，平台不直连业务数据库。
>
> **历史参考说明：** 文中 `hm-ai`（`com.hmall.ai.*`）Java 代码**仅作"原理等价"的历史参考，不是当前实现**。当前实现用 **TypeScript（编排层 agent-platform）** 实现 agent-tools 子系统的 MCP 模块，落地入口见 `07-平台-工程落地-从空目录搭agent-platform.md`。

> **AI角色：老师。** 你不是编码者，你是出题者+批改者+讲解者。目标是让学习者在45分钟内理解 MCP（Model Context Protocol）协议的核心概念，以及 agent-platform 中 MCP 模块的实际实现。
>
> **防什么失败？** 防"Agent 只能调用自己写的工具，无法接入外部工具"。防"不知道 MCP 是什么，面试被问住"。防"hm-ai 的 mcp/ 包看不懂"。
>
> **最新动态：** MCP 由 Anthropic 于 2024 年 11 月推出，2025 年 12 月捐赠给 Linux Foundation 旗下的 Agentic AI Foundation（AAIF）。**2026 年 7 月 28 日发布第五版规范 (2026-07-28)**，协议内核从有状态改为**无状态（Stateless）**——这是自协议问世以来最大的一次修订。MCP Server 现在可以运行在 Cloudflare Worker 等无状态基础设施上，无需维护会话状态。

---

## 为什么需要 MCP？

### 一个真实的翻车场景

```
周一早上 9:00，技术 Leader 在群里发消息：

"我们 Agent 要接入以下外部服务，本周五前上线：
  1. Google 搜索 → 让 Agent 能搜最新信息
  2. GitHub API → 让 Agent 能查代码仓库
  3. 公司内部文件系统 → 让 Agent 能读写文件
  4. PostgreSQL 数据库 → 让 Agent 能直接查数据"

你打开代码库，发现现有工具是这么加的：

// ❌ 差做法：每个外部服务写一套适配代码
class GoogleSearchTool {
  async search(query: string) {
    // 对接 Google API 的认证、请求、响应解析...
    // 200 行代码
  }
}

class GitHubTool {
  async searchRepo(query: string) {
    // 对接 GitHub API 的认证、请求、响应解析...
    // 又是 200 行代码
  }
}

// 每个服务都要：
// 1. 学习它的 API 文档
// 2. 写认证逻辑
// 3. 写请求/响应适配
// 4. 写错误处理
// 5. 写测试
// 每个服务 2-3 天，4 个服务 = 8-12 天，周五根本来不及！
```

**这就是没有 MCP 的后果：**

- 每个外部服务都是"定制接入"，成本线性增长
- 工具 Schema 格式不统一，Agent 理解困难
- 新加一个服务 = 新写一套代码，无法复用
- 工具发现靠硬编码，无法动态注册

**MCP 做的事情：**

- 定义一个标准协议，就像 USB 统一了外设接口
- 外部服务只要实现 MCP 协议 → Agent 就能自动发现和调用
- 接入新服务 = 启动一个 MCP Server，Agent 侧零代码改动

> **类比：充电接口的标准化。** 没有 MCP = 每个手机品牌有自己的充电口（Lightning、Micro-USB、30-pin...），出门要带一堆线。有 MCP = USB-C 一统天下，一根线充所有设备。MCP 就是 AI Agent 世界的 USB-C。

---

## 设计原理

| 原则             | 在本技能中的体现                                            |
| ---------------- | ----------------------------------------------------------- |
| **场景驱动**     | 从"Agent 需要接入外部搜索/数据库/文件系统"引出 MCP 的必要性 |
| **类比优先**     | MCP 类比 USB 接口标准，统一外部工具的连接方式               |
| **代码走读**     | 逐文件讲解 MCP 的 TypeScript 实现                           |
| **最小可行知识** | 只学 MCP 的核心概念 + 实现，不学完整的 MCP 规范             |

---

## 这个技能解决什么问题

Agent 工具生态的标准化接入。学完能回答：

- MCP 是什么？解决什么问题？
- MCP 的三个角色（Host/Client/Server）分别是什么？
- MCP 和直接调用 API 有什么区别？
- 怎么注册一个新的 MCP 工具？
- McpToolRegistry 是做什么的？
- MCP 2026 无状态内核改了什么？为什么重要？

---

## 前置要求

- 已完成 `06-AI能力-FunctionCalling实战`（理解工具调用）
- 已完成 `06-AI能力-ReAct模式实战`（理解 Agent 循环）
- 理解 TypeScript 基本语法

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止，提示先补前置。

---

## 概念讲解

---

### 第一讲：MCP 是什么

#### 1.1 类比：USB 统一了外设接口

```
┌──────────────────────────────────────────────────────────┐
│  类比：没有 MCP = 没有 USB 的时代                         │
│                                                          │
│  你的电脑（Agent）要连接：                                │
│                                                          │
│  打印机 ──→ 需要并口线（LPT）                             │
│  鼠标   ──→ 需要 PS/2 口                                 │
│  键盘   ──→ 需要 PS/2 口（和鼠标不通用！）               │
│  硬盘   ──→ 需要 SCSI 线                                 │
│  扫描仪 ──→ 需要专用扩展卡                                │
│                                                          │
│  每个外设都有自己的接口，互不兼容！                        │
│                                                          │
│  ═══════════════════════════════════════════════════════ │
│                                                          │
│  有了 USB 之后：                                          │
│                                                          │
│  打印机 ─┐                                               │
│  鼠标   ─┤                                               │
│  键盘   ─┼──→ 全部用 USB 口 ──→ 电脑自动识别             │
│  硬盘   ─┤                                               │
│  扫描仪 ─┘                                               │
│                                                          │
│  一个标准接口，所有外设通用！                              │
│                                                          │
│  ═══════════════════════════════════════════════════════ │
│                                                          │
│  MCP = AI 世界的 USB                                      │
│                                                          │
│  搜索服务 ─┐                                              │
│  数据库   ─┤                                              │
│  文件系统 ─┼──→ 全部实现 MCP 协议 ──→ Agent 自动发现     │
│  API服务  ─┤                                              │
│  代码仓库 ─┘                                              │
└──────────────────────────────────────────────────────────┘
```

#### 1.2 MCP 的三个角色

```
┌──────────────────────────────────────────────────────────┐
│  MCP 三层架构                                             │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Host（宿主）：你的 Agent 应用                       │ │
│  │  比如：agent-platform 的 agent-tools 子系统          │ │
│  │  职责：运行 AI，接收用户请求，调度工具               │ │
│  └────────────────────┬───────────────────────────────┘ │
│                       │                                  │
│                       ▼                                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Client（客户端）：MCP 客户端                        │ │
│  │  在 Host 内部运行，负责连接 Server                   │ │
│  │  职责：协议转换、连接管理、请求转发                  │ │
│  │  类比：电脑的 USB 控制器芯片                         │ │
│  └────────────────────┬───────────────────────────────┘ │
│                       │                                  │
│                       ▼                                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Server（服务端）：MCP 服务端                        │ │
│  │  暴露外部工具，如：                                  │ │
│  │  - 搜索服务（Google/Bing）                          │ │
│  │  - 数据库服务（MySQL/PostgreSQL）                   │ │
│  │  - 文件系统服务                                     │ │
│  │  - GitHub API 服务                                  │ │
│  │  类比：插在 USB 口的打印机、硬盘、键盘               │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

> **类比速记：** Host = 你的电脑，Client = USB 控制器，Server = 插入 USB 口的设备。

#### 1.3 MCP 提供什么

| 能力                      | 说明                      | 类比                             |
| ------------------------- | ------------------------- | -------------------------------- |
| **Tools（工具）**         | 服务端暴露的工具和 Schema | 打印机告诉你它能打印、扫描、复印 |
| **Resources（资源）**     | 服务端暴露的数据资源      | 硬盘告诉你里面有哪些文件         |
| **Prompts（提示词模板）** | 服务端预定义的 Prompt     | 扫描仪告诉你"最佳扫描设置"       |

> **AI：** 停下来确认"Host → Client → Server 三层模型——理解了吗？"，等回复后再继续。

---

### 第二讲：MCP 的完整调用流程

#### 2.1 类比：餐厅点外卖

```
┌──────────────────────────────────────────────────────────┐
│  类比：MCP 调用 = 餐厅通过外卖平台接单                     │
│                                                          │
│  1. 顾客（用户）："我想吃川菜"                            │
│     → 消息发到 Agent                                     │
│                                                          │
│  2. 餐厅前台（Agent）：                                   │
│     "我们自己做不了川菜，需要找外部川菜馆"                │
│     → 打开外卖平台（MCP Client），查看可用餐厅列表        │
│     → GET /api/mcp/tools → 返回：[川味轩, 蜀香阁, ...]  │
│                                                          │
│  3. 选择"川味轩"（匹配到 search 工具）                    │
│     → 下单："水煮鱼一份"（参数：query="水煮鱼"）          │
│     → POST /api/mcp/tools/search/execute                │
│                                                          │
│  4. "川味轩"（MCP Server）收到订单 → 做菜 → 出餐         │
│     → 返回结果："水煮鱼：辣度3星，价格68元..."           │
│                                                          │
│  5. 餐厅前台把菜端给顾客（Agent 返回结果给用户）          │
│     → "为您找到：水煮鱼，辣度3星，价格68元..."           │
└──────────────────────────────────────────────────────────┘
```

#### 2.2 技术视角：完整调用链路

```
用户："帮我搜索一下 GPT-5.6 最新评测"
  │
  ▼
agent-platform (TypeScript) 收到请求
  │
  ▼
TS 直连 LLM 决策"需要调用外部搜索工具"
  │
  ▼
agent-platform 向 MCP Gateway 发起请求：GET /api/mcp/tools
  │  返回：[{ name: "web_search", description: "搜索网页", ... }]
  │
  ▼
agent-platform 调用：POST /api/mcp/tools/web_search/execute
  │  body: { query: "GPT-5.6 最新评测 2026" }
  │
  ▼
MCP Gateway 转发请求到外部 MCP Server（Google Search）
  │
  ▼
Google Search 返回结果 → MCP Gateway → agent-platform
  │
  ▼
agent-platform 组装结果 → 生成最终回答给用户
```

#### 2.3 TypeScript 实现：MCP 工具注册表

```typescript
// agent-platform/src/agent-tools/mcp/McpToolRegistry.ts
// 核心职责：管理所有通过 MCP 协议注册的外部工具

interface McpToolInfo {
  name: string; // 工具名称："web_search"
  description: string; // 工具描述："搜索网页内容"
  serverName: string; // 来自哪个 MCP Server："google-search"
  inputSchema: Record<string, unknown>; // 参数 Schema（JSON Schema 格式）
  endpoint: string; // 实际调用的 HTTP 端点
}

export class McpToolRegistry {
  // 用 Map 存储所有已注册的 MCP 工具，key 是工具名称
  // 选 Map 而非 Object 的原因：Map 的 key 可以是任意类型，且查询性能更好
  private tools: Map<string, McpToolInfo> = new Map();

  /**
   * 注册工具
   * 当 MCP Server 启动时，会调用此方法注册自己提供的工具
   */
  registerTool(tool: McpToolInfo): void {
    if (this.tools.has(tool.name)) {
      console.warn(`MCP 工具 "${tool.name}" 已存在，将覆盖`);
    }
    this.tools.set(tool.name, tool);
    console.log(`🔧 MCP 工具注册: ${tool.name} (来自 ${tool.serverName})`);
  }

  /**
   * 获取所有工具列表（供 Agent 查询可用工具）
   * Agent 调用此方法获取工具目录，然后由 LLM 决定用哪个工具
   */
  listTools(): McpToolInfo[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取指定工具
   */
  getTool(toolName: string): McpToolInfo | undefined {
    return this.tools.get(toolName);
  }

  /**
   * 注销工具（MCP Server 下线时调用）
   */
  unregisterTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    if (removed) {
      console.log(`🔌 MCP 工具注销: ${toolName}`);
    }
    return removed;
  }

  /**
   * 按 Server 名称获取所有工具（用于管理某个 Server 的所有工具）
   */
  listToolsByServer(serverName: string): McpToolInfo[] {
    return this.listTools().filter((t) => t.serverName === serverName);
  }

  /**
   * 将工具列表转换为 OpenAI Function Calling 格式
   * 让 LLM 能理解每个工具的用途和参数
   */
  toOpenAIFunctions(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.listTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }
}
```

#### 2.4 TypeScript 实现：MCP 调用入口

```typescript
// agent-platform/src/agent-tools/mcp/McpController.ts
// 提供 HTTP API 供 Agent 调用 MCP 工具

import express, { Request, Response } from "express";
import axios from "axios";
import { McpToolRegistry } from "./McpToolRegistry";

export function createMcpRouter(registry: McpToolRegistry) {
  const router = express.Router();

  /**
   * 获取所有可用的 MCP 工具列表
   * GET /api/mcp/tools
   * Agent 先调用此接口获取"菜单"，再由 LLM 决定调用哪个工具
   */
  router.get("/tools", (_req: Request, res: Response) => {
    const tools = registry.listTools();
    // 返回 OpenAI Function Calling 兼容格式
    res.json({
      total: tools.length,
      tools: registry.toOpenAIFunctions(),
    });
  });

  /**
   * 调用指定工具
   * POST /api/mcp/tools/:toolName/execute
   * Agent 决定好工具后，通过此接口实际执行
   */
  router.post(
    "/tools/:toolName/execute",
    async (req: Request, res: Response) => {
      const { toolName } = req.params;
      const params = req.body;

      // 查找工具是否存在
      const tool = registry.getTool(toolName);
      if (!tool) {
        return res.status(404).json({
          error: "TOOL_NOT_FOUND",
          message: `MCP 工具 "${toolName}" 不存在`,
          availableTools: registry.listTools().map((t) => t.name),
        });
      }

      try {
        // 通过 HTTP 调用实际的 MCP Server
        // 超时设为 30 秒，防止外部服务无响应导致 Agent 卡死
        const response = await axios.post(tool.endpoint, params, {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            "Mcp-Method": "tools/call", // 2026 v5 规范必带头
            "Mcp-Name": toolName, // 网关可据此做限流
          },
        });

        res.json({
          success: true,
          toolName,
          serverName: tool.serverName,
          result: response.data,
        });
      } catch (err) {
        const error = err as Error & { response?: { status: number } };
        console.error(`MCP 工具调用失败: ${toolName}`, error.message);
        res.status(502).json({
          error: "MCP_SERVER_ERROR",
          message: `调用 MCP Server "${tool.serverName}" 失败: ${error.message}`,
          toolName,
        });
      }
    },
  );

  /**
   * 注册新工具（MCP Server 启动时自动调用）
   * POST /api/mcp/tools/register
   */
  router.post("/tools/register", (req: Request, res: Response) => {
    const tool: McpToolInfo = req.body;
    if (!tool.name || !tool.endpoint) {
      return res.status(400).json({ error: "name 和 endpoint 是必填字段" });
    }
    registry.registerTool(tool);
    res.json({ success: true, message: `工具 "${tool.name}" 注册成功` });
  });

  return router;
}
```

#### 2.5 TypeScript 实现：MCP Server 发现与连接

```typescript
// agent-platform/src/agent-tools/mcp/McpServerDiscovery.ts
// 负责自动发现和连接 MCP Server

interface McpServerConfig {
  name: string;
  command: string; // 启动命令："npx" 或 "python"
  args: string[]; // 启动参数
  transport: "stdio" | "sse" | "streamable-http"; // 传输方式
  env?: Record<string, string>;
}

export class McpServerDiscovery {
  private servers: Map<string, McpServerConfig> = new Map();
  private registry: McpToolRegistry;

  constructor(registry: McpToolRegistry) {
    this.registry = registry;
  }

  /**
   * 配置一个 MCP Server
   * 应用启动时从配置文件加载
   */
  addServer(config: McpServerConfig): void {
    this.servers.set(config.name, config);
  }

  /**
   * 启动所有已配置的 MCP Server 并注册其工具
   */
  async startAll(): Promise<void> {
    for (const [name, config] of this.servers) {
      try {
        console.log(`🚀 启动 MCP Server: ${name}`);
        // 通过 stdio/SSE/HTTP 连接 MCP Server
        // 调用 server/discover 获取工具列表（2026 v5 无状态方式）
        const tools = await this.discoverTools(config);
        for (const tool of tools) {
          this.registry.registerTool(tool);
        }
        console.log(
          `✅ MCP Server "${name}" 启动成功，注册 ${tools.length} 个工具`,
        );
      } catch (err) {
        console.error(
          `❌ MCP Server "${name}" 启动失败:`,
          (err as Error).message,
        );
      }
    }
  }

  /**
   * 从 MCP Server 发现可用工具
   * 2026 v5：使用 server/discover 方法，无需初始化握手
   */
  private async discoverTools(config: McpServerConfig): Promise<McpToolInfo[]> {
    // 简化实现：向 MCP Server 发送 server/discover 请求
    // 返回该 Server 提供的所有工具信息
    const response = await axios.post(`${config.command}/discover`, {
      _meta: {
        protocolVersion: "2026-07-28",
        clientInfo: { name: "agent-platform", version: "1.0.0" },
      },
    });
    return response.data.tools;
  }
}
```

#### 2.6 初始化配置示例

```typescript
// agent-platform/src/agent-tools/mcp/mcp.config.ts
// 应用启动时配置 MCP Server 列表

import { McpServerDiscovery } from "./McpServerDiscovery";
import { McpToolRegistry } from "./McpToolRegistry";

export async function initializeMcp(): Promise<McpToolRegistry> {
  const registry = new McpToolRegistry();
  const discovery = new McpServerDiscovery(registry);

  // 配置 Google 搜索 MCP Server
  discovery.addServer({
    name: "google-search",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-google-search"],
    transport: "stdio",
    env: {
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY!,
      GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID!,
    },
  });

  // 配置文件系统 MCP Server
  discovery.addServer({
    name: "filesystem",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/data/agent-files",
    ],
    transport: "stdio",
  });

  // 配置 PostgreSQL MCP Server
  discovery.addServer({
    name: "postgres",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-postgres",
      process.env.DATABASE_URL!,
    ],
    transport: "stdio",
  });

  // 启动所有 Server
  await discovery.startAll();

  return registry;
}
```

> **AI：** 停下来确认"McpToolRegistry 是工具注册表，McpController 是调用入口，McpServerDiscovery 自动发现工具——理解了吗？"，等回复后再继续。

---

### 第三讲：MCP vs 直接调用 API

#### 3.1 对比表

| 维度             | ❌ 直接调用 API          | ✅ MCP 协议                          |
| ---------------- | ------------------------ | ------------------------------------ |
| **工具发现**     | 手动配置，硬编码在代码里 | 自动发现，`server/discover` 动态获取 |
| **工具 Schema**  | 自己写，格式不统一       | 标准化 JSON Schema 2020-12           |
| **接入新工具**   | 写新代码，2-3 天/服务    | 启动 MCP Server，几分钟              |
| **工具版本管理** | 手动维护，容易遗漏       | MCP Server 自带版本                  |
| **安全控制**     | 自己实现，容易遗漏       | 协议层标准化，网关统一管控           |
| **水平扩展**     | 依赖具体实现             | 2026 v5 无状态，可部署 Serverless    |
| **适用场景**     | 内部固定工具             | 外部可扩展工具                       |

#### 3.2 什么时候用 MCP？

```
✅ 适合用 MCP：
  ┌─────────────────────────────────────────────────────┐
  │ • 接入外部第三方工具（搜索、数据库、文件系统）        │
  │ • 工具需要动态注册/注销（运行时增减工具）            │
  │ • 多团队协作，工具提供方和使用方分离                 │
  │ • 需要标准化工具 Schema，让 LLM 更好理解            │
  │ • 工具数量多（10+），需要统一管理                   │
  └─────────────────────────────────────────────────────┘

❌ 不需要 MCP：
  ┌─────────────────────────────────────────────────────┐
  │ • 内部固定工具（查订单、查商品），只有 2-3 个        │
  │ • 工具逻辑简单，不需要标准化                        │
  │ • 单独一个团队维护所有工具，没有协作需求            │
  │ • 对延迟极度敏感（MCP 多一层转发）                   │
  └─────────────────────────────────────────────────────┘
```

---

### 第四讲：MCP 最新规范（2026-07-28 无状态内核）

> **AI（老师）：** 这一讲是"加分题"，但也是**面试最容易被问到的当下热点**。2026 年 7 月 28 日发布的 MCP 第五版规范，是协议问世以来最大的一次修订——把内核从"有状态"改成了"无状态"。你不需要背全部细节，但要能讲清楚"为什么改、改了什么、对 Agent 平台意味着什么"。

#### 4.1 旧版（至 2025-11-25）为什么是"有状态"的？

```
┌──────────────────────────────────────────────────────────┐
│  有状态 MCP 的水平扩展困境                                │
│                                                          │
│  客户端 A ──→ 初始化握手 → 服务实例 1 返回 SessionId: abc │
│  客户端 A ──→ 后续调用 tools/call（带 SessionId）         │
│                                                          │
│  负载均衡器 ──→ 必须把带 abc 的请求"粘"回到实例 1         │
│                （sticky session / 共享 session 存储）     │
│                                                          │
│  否则：请求被转发到实例 2，实例 2 不认识 abc，直接报错！    │
│                                                          │
│  问题：                                                  │
│  • 不能部署到 Serverless（无状态环境）                    │
│  • 水平扩展需要 session 同步（复杂）                     │
│  • 实例 1 挂了 → 客户端必须重新握手                      │
└──────────────────────────────────────────────────────────┘
```

> **类比：** 就像你每次进同一个商场，都被要求先到总服务台"登记"领取一张绑定固定店员的名片，之后所有问题都只能找那一个店员——店员休假你就办不了事。

#### 4.2 新版（2026-07-28）怎么改成"无状态"？

```
┌──────────────────────────────────────────────────────────┐
│  无状态 MCP 的水平扩展                                    │
│                                                          │
│  客户端 A ──→ tools/call + _meta + Mcp-Method 头          │
│  负载均衡器 ──→ 轮询转发到"任意"实例                      │
│  实例 2 ──→ 返回结果 + ttlMs + cacheScope                │
│                                                          │
│  每个请求自包含：                                         │
│  • _meta 字段携带协议版本、客户端能力                     │
│  • Mcp-Method 头告诉网关这是哪个操作                     │
│  • 不需要 session，不需要 sticky                         │
│  • 可以部署到 Cloudflare Worker！                         │
└──────────────────────────────────────────────────────────┘
```

> **学生视角自问自答：**
> Q：无状态了，服务端怎么知道"我是谁、我有什么能力"？
> A：能力信息通过 `server/discover` 按需预取，协议版本和客户端能力放在每次请求的 `_meta` 里，一起传过去。
> Q：这对我做的 agent-platform 意味着什么？
> A：意味着 MCP Server 可以跑在 Cloudflare Worker、Serverless 这类无状态基础设施上，不用维护会话状态，水平扩展和容灾都简单得多。

#### 4.3 本次改版动了哪些关键点（学生版速记表）

| 改动                                       | 一句话解释                                                                   | 为什么重要                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **无状态内核**                             | 去掉初始化握手和 `Mcp-Session-Id`                                            | 服务端可跑在无状态基础设施，水平扩展变简单                    |
| **MRTR（多轮往返请求）**                   | 服务端需要额外输入时，返回一个不透明状态令牌，替代原来 SSE 长连接            | 协议从"长连接"走向"纯请求-响应"，更适配无状态                 |
| **响应缓存 `ttlMs`/`cacheScope`**          | 列表/资源读接口返回"多久内有效"和"缓存作用域"，语义借鉴 HTTP `Cache-Control` | 客户端可本地缓存工具目录，减少重复 `tools/list` 的 token 开销 |
| **扩展框架（Extensions）**                 | 用反域名标识符（如 `com.example.xxx`）的一级能力扩展，独立于核心协议版本     | 新能力（如 Tasks、MCP Apps）不再挤进核心协议，演进更干净      |
| **分布式追踪**                             | `_meta` 里统一 `traceparent`/`tracestate`/`baggage` 三个键                   | 跨 SDK 的链路追踪终于能对上，Agent 可观测性标准化             |
| **必带 HTTP 头 `Mcp-Method`/`Mcp-Name`**   | 网关只读头就能路由，不用解析 JSON body                                       | 网关/限流器路由更快，还能按工具名单独限流                     |
| **工具 Schema 升级到 JSON Schema 2020-12** | 支持 `oneOf`/`if-then-else`/`$ref` 组合                                      | 复杂工具签名表达能力更强                                      |

> **AI：** 这 7 行不用背，重点是能讲清楚"无状态内核"和"响应缓存"这两点，其余能说出"存在这些改动方向"即可。确认理解后进入下面的 Quiz。

> **📌 面试加分话术：** 当被问到 "MCP 最近有什么变化" 时，可以答："2026-07-28 的第五版把内核改成了无状态，去掉了初始化握手和会话头，每个请求通过 `_meta` 自包含，服务端能部署到 Cloudflare Worker 这类无状态环境；同时引入了 `ttlMs`/`cacheScope` 响应缓存和统一的反域名扩展框架，工具 Schema 也升级到了 JSON Schema 2020-12。" 这能体现你**持续跟进协议演进**，而不只是会用。

---

### 第五讲：Python MCP 实践——用 LangChain 集成 MCP

> 来自 AI 应用开发的核心洞察：MCP 不只是 TypeScript 后端的事，Python 生态也有成熟的集成方案。LangChain 的 `langchain-mcp-adapters` 能把 MCP Server 的工具自动转成 LangChain Tool。

#### 5.1 三步接入现成 MCP Server

```python
# ai-service/src/mcp_integration.py
# 在 Python AI 服务层集成 MCP Server

import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent

async def setup_mcp_agent():
    # 第一步：配置要连接的 MCP Server
    client = MultiServerMCPClient({
        "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:/项目目录"],
            "transport": "stdio",
        },
        "web_search": {
            "command": "npx",
            "args": ["-y", "@anthropic/mcp-server-google-search"],
            "transport": "stdio",
        },
    })

    # 第二步：加载工具，自动转为 LangChain Tool
    # get_tools() 返回的就是标准 LangChain BaseTool 列表
    # 和自己写的 @tool 装饰器完全一样，Agent 无区别对待
    tools = await client.get_tools()

    # 第三步：交给 Agent
    # 使用 GPT-5.6-mini 作为 Agent 大脑（$0.075/M input）
    llm = ChatOpenAI(
        model="gpt-5.6-mini",
        temperature=0.3,
    )
    agent = create_agent(llm, tools)

    return agent

# 使用
async def main():
    agent = await setup_mcp_agent()
    resp = await agent.ainvoke({
        "messages": [{"role": "user", "content": "列出当前目录下的所有文件"}]
    })
    print(resp)
```

**关键点**：`get_tools()` 返回的 MCP 工具和自己写的 `@tool` 完全一样，Agent 内部怎么选、怎么调，无区别。

#### 5.2 自己写一个最小 MCP Server

```python
# my_tools_server.py
# 一个极简的 MCP Server，提供天气查询和计算器功能

from mcp.server.fastmcp import FastMCP

# 创建 MCP Server 实例
mcp = FastMCP("我的工具箱")

@mcp.tool()
def get_weather(city: str) -> str:
    """查询指定城市的天气（模拟）"""
    # 实际项目中这里会调用天气 API
    weather_data = {
        "北京": "晴天，25°C，湿度 40%",
        "上海": "多云，28°C，湿度 65%",
        "深圳": "阵雨，30°C，湿度 80%",
    }
    return weather_data.get(city, f"抱歉，暂不支持查询 {city} 的天气")

@mcp.tool()
def calculate(expression: str) -> float:
    """计算数学表达式，例如：'2 + 3 * 4'"""
    # 注意：eval 有安全风险，生产环境应使用安全的表达式解析器
    # 这里仅作演示
    return eval(expression)

if __name__ == "__main__":
    # 启动 Server，等待 MCP Client 连接
    mcp.run()
```

然后在 `MultiServerMCPClient` 配置中，把 `args` 换成 `["python", "my_tools_server.py"]` 即可接入自己写的 Server。

#### 5.3 MCP 架构总结

```
┌──────────────────────────────────────────────────────────┐
│              MCP 架构全景图                                │
│                                                          │
│  ┌──────────────────────┐                                │
│  │  agent-platform (TS) │  ← MCP Host                    │
│  │  Agent 运行环境       │                                │
│  └──────────┬───────────┘                                │
│             │ HTTP/SSE/stdio                              │
│             ▼                                            │
│  ┌──────────────────────┐                                │
│  │  MCP Client (TS)     │  ← 协议引擎                    │
│  │  McpToolRegistry     │    管理工具注册表               │
│  │  McpServerDiscovery  │    自动发现 Server             │
│  └──────────┬───────────┘                                │
│             │                                            │
│     ┌───────┼───────┬──────────┐                        │
│     ▼       ▼       ▼          ▼                        │
│  ┌──────┐┌──────┐┌──────┐┌──────────┐                  │
│  │搜索  ││数据库││文件  ││自定义工具│  ← MCP Server     │
│  │Server││Server││Server││Server    │                    │
│  └──────┘└──────┘└──────┘└──────────┘                  │
│                                                          │
│  你写的代码              角色          做的事情           │
│  ─────────────────────────────────────────────────────  │
│  agent-platform          MCP Host      运行 AI，调度工具 │
│  McpToolRegistry 等      MCP Client    协议引擎，管理连接│
│  my_tools_server.py      MCP Server    提供具体工具能力  │
└──────────────────────────────────────────────────────────┘
```

> **核心理解**：MCP 就是 AI 世界的 HTTP——HTTP 让浏览器访问全世界的网站，MCP 让 AI 应用使用全世界的工具。

---

### 🔒 G2 讲解门禁

> **AI：** 确认以上讲解的学习者都表示理解。**必须等用户明确回复"没问题"/"理解了"等肯定词，未收到回复前不得出题。** 全部确认 → 放行。有任何疑问 → 回到对应讲，澄清后再确认。

---

## 阶段一：理解验证（Quiz 闭卷）

### 概念难度与题目配额

| 概念                                          |  难度  | 最少题数 | 出题说明  |
| --------------------------------------------- | :----: | :------: | --------- |
| MCP 是什么、解决什么核心问题                  |  ⭐⭐  |    2     | 选择+判断 |
| 三角色 Host/Client/Server                     |  ⭐⭐  |    2     | 选择+判断 |
| 工具发现与调用完整流程                        | ⭐⭐⭐ |    3     | 核心难点  |
| McpToolRegistry / McpToolInfo / McpController | ⭐⭐⭐ |    3     | 代码实践  |
| MCP vs 直接调用 API                           |  ⭐⭐  |    2     | 选择+场景 |
| MCP 2026 无状态内核（加分）                   | ⭐⭐⭐ |    2     | 选择+场景 |
| Python MCP 实践（LangChain集成）              |  ⭐⭐  |    2     | 选择+代码 |

### 题目池

#### 选择题

**Q-C1.** MCP（Model Context Protocol）解决的核心问题是？
A. 解决 LLM 上下文窗口不足的问题
B. 统一 Agent 接入外部工具（搜索/数据库/文件系统）的标准化方式
C. 替代 HTTP 成为更快的通信协议
D. 让多个 Agent 共享同一个模型

**Q-C2.** MCP 协议中的三个角色，正确的对应关系是？
A. Host=模型，Client=数据库，Server=前端
B. Host=Agent 应用，Client=MCP 客户端（连接 Server），Server=暴露外部工具的 MCP 服务端
C. Host=缓存，Client=接口，Server=爬虫
D. Host=LLM，Client=工具，Server=用户

**Q-C3.** 在 MCP 实现中，`McpToolRegistry` 内部使用什么数据结构存储已注册的工具？
A. `Map<string, McpToolInfo>`（高效的键值对查询）
B. `Array<McpToolInfo>`（顺序查找，慢）
C. `LinkedList<McpToolInfo>`
D. `Set<McpToolInfo>`

**Q-C4.** 当 Agent 需要调用某个外部工具（如 web_search）时，实际调用的入口是？
A. `McpToolRegistry.registerTool()`
B. `McpController` 的 `POST /api/mcp/tools/:toolName/execute`
C. `McpServerDiscovery` 的初始化逻辑
D. `McpToolInfo` 的构造函数

**Q-C5.** 以下哪种场景**不适合**使用 MCP？
A. 接入第三方搜索服务
B. 接入外部数据库查询
C. HMall 内部固定、只有 2-3 个的查订单/查商品工具
D. 多团队协作，工具提供方与使用方分离

#### 判断题

**Q-J1.** MCP 与直接调用 API 的主要区别在于：直接调用 API 需要手动硬编码配置每个外部工具，而 MCP 支持自动发现、动态注册和标准化 JSON Schema。

**Q-J2.** 在 MCP 实现中，`McpController` 的职责是负责把工具注册进 `McpToolRegistry`，而不是处理工具调用。

#### 场景分析题

**Q-S1.** HMall 客服 Agent 需要接入"第三方快递物流查询"服务来实时返回物流轨迹。请分析：为什么这种情况适合用 MCP 而不是把物流查询逻辑直接硬编码进系统？对比直接调用 API，MCP 在这里带来哪些收益（工具发现、Schema 标准化、接入成本、版本管理至少各说一点）？

**Q-S2.** 公司要把 MCP Server 从自建服务器迁移到 Cloudflare Worker（无状态 Serverless 环境）。基于 2026-07-28 规范，分析这次迁移为什么可行，需要重点关注协议里哪些机制的改变（内核状态、握手、`server/discover`、`_meta`）。

#### 代码/实践题

**Q-P1.** 请根据 MCP 实现，按顺序写出 Agent 调用一个外部 MCP 工具（假设叫 `track_logistics`）的完整流程管线（从用户请求到返回物流结果，至少列出 5 个环节，涉及 agent-platform、McpController、McpToolRegistry、外部 MCP Server）。

---

## 批改与补考机制

> **AI：** 题目池中的题目是最低基线。如果池中题目不够配额，必须自行生成新题补足，不得少于配额数。

### 补考规则

| 错误概念                                  | 补考出题方向                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| MCP 是什么/解决什么问题                   | 改问"没有 MCP 时接入外部工具的痛点"，用 USB 类比反推                                      |
| 三角色 Host/Client/Server                 | 改考"Client 运行在 Host 内部"这一层关系，或给一个具体部署图判断角色                       |
| 工具发现与调用流程                        | 改考"工具不存在时 executeTool 如何返回错误"，或画出时序图让考生标注角色                   |
| McpToolRegistry/McpToolInfo/McpController | 改考"新增一个工具需要改哪几个类哪些字段"，或 unregisterTool 的副作用                      |
| MCP vs 直接调用 API                       | 改考"内部固定工具为何无需 MCP"的正反论证，或给出新场景（如对接文件系统）让考生判断        |
| MCP 2026 无状态内核                       | 改考"为什么旧版握手+SessionId 导致水平扩展困难"，或给一份迁移决策让考生说明哪些改动要关注 |

---

### 🔒 G3 理解门禁

> **AI：** 确认所有概念点全部通过。全部通过 → 放行。有未通过 → 补考。

---

## 实践任务：走读 MCP 代码

> **说明：** 以下走读的是**旧 Java 参考**（`com.hmall.ai.mcp.*`），仅用于理解"原理等价"的 MCP 实现。新实现应在 **agent-platform 的 agent-tools 子系统**（TS）中走读/实现，对应概念（工具注册表、工具调用入口、Server 发现）一致，代码语言与工程结构不同。

### 目标

逐文件阅读 MCP 模块下的所有文件，理解每个类的职责。

### 步骤

1. 阅读 `McpToolInfo` 接口：
   - 哪些字段？各自什么含义？
   - inputSchema 是什么格式？

2. 阅读 `McpToolRegistry` 类：
   - 用的是什么数据结构存储工具？
   - 注册和注销的流程是什么？

3. 阅读 `McpController` 路由：
   - 有几个 REST 接口？
   - executeTool 的流程是什么？

4. 阅读 `McpServerDiscovery` 类：
   - 初始化时做了什么？
   - 注册了哪些 MCP Server？

### ✅ 验证

- 能说出 MCP 模块下 4 个文件的职责
- 能画出 MCP 工具注册→发现→调用的完整流程图
- 能说出 McpToolRegistry 和 McpController 的关系

---

### 🔒 G4 决策门禁

> **AI：** 确认学习者已完成动手环节。已完成 → 继续。未完成 → 回去做。

---

## 🎯 学完检查

| 检查项                                                         | 自己回答 |
| -------------------------------------------------------------- | -------- |
| MCP 的三个角色是什么？                                         |          |
| MCP 解决的核心问题是什么？                                     |          |
| McpToolRegistry 存储的是什么？                                 |          |
| MCP 和直接调用 API 有什么区别？                                |          |
| 什么场景适合用 MCP？什么场景不需要？                           |          |
| MCP 2026-07-28 无状态内核改了什么？为什么能部署到 Serverless？ |          |
| Agent 的 MCP 调用流程是什么？                                  |          |

---

> **下一步：** 完成后进入 `06-AI能力-Memory系统实战.md`，学习 Agent 如何记住对话历史。

---

<!-- 教学补全：P2-1 会话追加 -->

## Quiz（闭卷）

> **AI：** 出 5 道题考下面内容，每题先批改，不通过进入补考。学习者需用自己的话回答，不可照抄原文。

**Q1.** MCP 的三层架构（Host / Client / Server）中，Client 运行在 Host 内部。为什么不让 Host 直接连 Server，而要在中间加一层 Client？Client 承担了哪些 Host 不关心的职责？

**Q2.** `McpToolRegistry` 内部用 `Map<string, McpToolInfo>` 而不是 `Array` 存储工具。这个选择的依据是什么？如果工具数量从 5 个增长到 500 个，Array 方案会有什么性能问题？

**Q3.** `McpController` 中 `POST /api/mcp/tools/:toolName/execute` 返回 404 时，响应体里包含了 `availableTools` 字段。这个设计意图是什么？如果去掉这个字段，调用方排查问题会多花多少时间？

**Q4.** 2026 年 7 月 28 日 MCP 第五版规范的核心改动是"无状态内核"。请用你自己的话解释：① 旧版有状态设计为什么导致水平扩展困难？② 新版无状态设计通过什么机制替代了原来的 SessionId？③ 这对 agent-platform 的部署架构意味着什么？

**Q5.** MCP 和直接调用 API 的对比表中，你作为架构师，面对一个"内部固定、只有 3 个工具"的场景，你会选 MCP 还是直接调用？如果 3 个月后工具数量增长到 30 个，你的决策会变吗？为什么？

**答案：**

| 题号 | 参考答案要点                                                                                                                                                                                                                                                                                                                                                                                         |
| :--: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  Q1  | Client 承担了：① 协议转换（stdio/SSE/HTTP 统一为内部接口）；② 连接管理（建立/维持/重连）；③ 工具发现（调用 `server/discover` 获取工具列表）；④ 错误处理（超时/重试/降级）。Host 只需要关心"有哪些工具、怎么调用"，不需要关心传输层细节。这是关注点分离：Host 做 AI 调度，Client 做协议适配。                                                                                                         |
|  Q2  | Map 的查询时间复杂度是 O(1)，Array 是 O(n)。500 个工具时，每次 `getTool("web_search")` 用 Array 需要平均遍历 250 个元素，而 Map 一步到位。此外 Map 天然保证 key 唯一性，防止重复注册。Map 的 key 语义化也更清晰。                                                                                                                                                                                    |
|  Q3  | 设计意图：帮助调用方快速排错。当工具不存在时，调用方可能是写错了工具名。返回 `availableTools` 列表让调用方一眼看到"有哪些工具可用"，减少来回排查的轮次。去掉后：调用方需要额外调一次 `GET /api/mcp/tools` 才能知道可用工具列表，多一次 HTTP 往返。                                                                                                                                                   |
|  Q4  | ① 旧版有状态：客户端先握手获取 SessionId，后续所有请求带 SessionId，负载均衡器必须把请求"粘"到同一实例（sticky session），否则其他实例不认识这个 SessionId。② 新版无状态：去掉握手和 SessionId，每次请求通过 `_meta` 字段携带协议版本和客户端能力，请求自包含，任意实例都能处理。③ agent-platform 的 MCP Server 可以部署到 Cloudflare Worker、Serverless 等无状态环境，水平扩展不需要 session 同步。 |
|  Q5  | 3 个工具：选直接调用。MCP 的标准化收益不足以覆盖协议层开销（多一层转发、多一份配置）。30 个工具：选 MCP。工具数量多时，MCP 的自动发现、动态注册、统一 Schema 管理优势显现，直接调用会导致代码膨胀和维护成本线性增长。核心判断标准：工具数量 × 变更频率 × 团队数量。                                                                                                                                  |

---

## 补考环节

> **AI：** 对答错的题，换一个角度（非原题）再出题，直到学习者理解。答错者重做，出 3 道非原题验证理解。

**补考1（对应 Q2 数据结构选择）：** 假设 `McpToolRegistry` 需要新增一个功能：按 `serverName` 快速查询该 Server 提供的所有工具。当前只有一个 `Map<string, McpToolInfo>`（key 是 toolName）。① 你会新增什么数据结构来支持这个查询？② 如果要求"注册和查询都必须是 O(1)"，你会怎么设计？③ 这个新增的数据结构和原有 Map 如何保持一致性？

**补考2（对应 Q4 无状态内核）：** 某团队把 MCP Server 从有状态迁移到无状态后，发现一个 bug：Agent 调用 `tools/call` 时传了旧的 `Mcp-Session-Id` 头，Server 不识别，返回错误。请问：① 这是 Server 的 bug 还是 Client 的 bug？② 无状态设计下，Client 应该传什么信息来替代 SessionId？③ 如果 Client 是老版本、无法升级，有什么兼容方案？

**补考3（对应 Q5 选型决策）：** 你负责的 Agent 系统目前有 5 个内部工具（直接调用），但产品经理计划下季度接入 3 个外部第三方服务。请问：① 你会选择"全部迁移到 MCP"还是"老工具保持不变，新工具走 MCP"？② 如果选混合方案，Agent 怎么知道哪些工具走 MCP、哪些走直接调用？③ 混合方案长期维护的风险是什么？

---

## 动手环节：从零实现一个 MCP 工具注册与调用系统（代码级）

> **AI：** 指导学习者逐步完成，每步贴代码、每步验证。全程约 90 分钟。
> **总目标：** ① 实现 `McpToolRegistry` 的增删查；② 实现 `McpController` 的 REST API；③ 写一个 Mock MCP Server 并端到端验证工具发现→调用→注销。
> **核心约束：** `McpToolRegistry` 的接口签名必须与原文一致，否则 `McpController` 无法串联。

---

### Step 1：实现 McpToolRegistry 核心逻辑（20 分钟）

**任务：** 用 TypeScript（或你熟悉的语言）实现 `McpToolRegistry` 类，包含 `registerTool`、`listTools`、`getTool`、`unregisterTool`、`listToolsByServer`、`toOpenAIFunctions` 六个方法。

**关键测试用例：**

```typescript
// 1. 注册 3 个工具（来自 2 个不同的 Server）
registry.registerTool({ name: "web_search", serverName: "google", ... });
registry.registerTool({ name: "file_read", serverName: "filesystem", ... });
registry.registerTool({ name: "file_write", serverName: "filesystem", ... });

// 2. listTools() 返回 3 个
// 3. listToolsByServer("filesystem") 返回 2 个
// 4. getTool("web_search") 返回正确工具
// 5. unregisterTool("web_search") → listTools() 返回 2 个
// 6. toOpenAIFunctions() 返回 OpenAI 兼容格式
```

**✅ 验证标准：** 6 个测试用例全部通过。`listToolsByServer` 使用 `filter` 实现，`toOpenAIFunctions` 输出格式为 `[{name, description, parameters}]`。

---

### Step 2：实现 McpController 的 REST API（25 分钟）

**任务：** 用 Express（或你熟悉的框架）实现 `McpController` 的三个端点：`GET /tools`、`POST /tools/:toolName/execute`、`POST /tools/register`。

**关键测试用例：**

```bash
# 1. 注册工具
curl -X POST http://localhost:3000/api/mcp/tools/register \
  -H "Content-Type: application/json" \
  -d '{"name":"weather","description":"查询天气","serverName":"my-tools","endpoint":"http://localhost:4000/weather","inputSchema":{"type":"object","properties":{"city":{"type":"string"}}}}'

# 2. 获取工具列表
curl http://localhost:3000/api/mcp/tools
# 预期返回：{"total":1,"tools":[...]}，tools 格式为 OpenAI Function Calling

# 3. 调用不存在的工具
curl -X POST http://localhost:3000/api/mcp/tools/not_exist/execute
# 预期返回：404 + availableTools 列表
```

**✅ 验证标准：** 3 个端点全部返回正确响应。404 场景包含 `availableTools` 字段。

---

### Step 3：写一个 Mock MCP Server 并端到端验证（25 分钟）

**任务：** 写一个简单的 HTTP Server，模拟 MCP Server 的行为，暴露 `/discover` 和 `/weather` 端点。

**Mock Server 代码骨架：**

```python
# mock_mcp_server.py
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/discover', methods=['POST'])
def discover():
    return jsonify({
        "tools": [
            {"name": "weather", "description": "查询天气", "inputSchema": {...}, "endpoint": "http://localhost:4000/weather", "serverName": "weather-service"}
        ]
    })

@app.route('/weather', methods=['POST'])
def weather():
    city = request.json.get("city", "未知")
    return jsonify({"city": city, "weather": "晴天", "temperature": "25°C"})
```

**端到端验证流程：**

1. 启动 Mock MCP Server（端口 4000）
2. 启动 McpController（端口 3000）
3. 向 McpController 注册 Mock Server 的工具
4. 调用 `GET /api/mcp/tools` 确认工具已注册
5. 调用 `POST /api/mcp/tools/weather/execute` 传入 `{"city":"北京"}`
6. 验证返回 `{"city":"北京","weather":"晴天","temperature":"25°C"}`

**✅ 验证标准：** 端到端走通：注册 → 发现 → 调用 → 返回正确结果。能画出完整的数据流图。

---

### Step 4：实现 McpServerDiscovery 的自动发现（20 分钟）

**任务：** 实现 `McpServerDiscovery` 类，从配置文件读取 Server 列表，启动时自动调用每个 Server 的 `/discover` 端点，将发现的工具注册到 `McpToolRegistry`。

**关键逻辑：**

```typescript
async startAll(): Promise<void> {
  for (const config of this.servers) {
    // 调用 config.endpoint/discover
    const response = await axios.post(`${config.endpoint}/discover`, {
      _meta: { protocolVersion: '2026-07-28' }
    });
    // 遍历返回的 tools，逐个注册到 registry
    for (const tool of response.data.tools) {
      this.registry.registerTool(tool);
    }
  }
}
```

**✅ 验证标准：** 启动 `startAll()` 后，`registry.listTools()` 自动包含所有 Mock Server 的工具。无需手动调用 `POST /tools/register`。

---

## 判断力日志

> **AI：** 引导学习者写一条判断力日志，四段式（问题→决策→取舍→防什么失败）。

**提示要点：**

1. **问题：** 你作为 agent-platform 的架构师，面对"工具接入标准化"的需求，MCP 和直接调用 API 两条路摆在面前。你如何判断哪种场景选哪种方案？

2. **决策：** `McpToolRegistry` 选择了 `Map` 而不是 `Array` 或 `Object`。`McpController` 选择了 Express Router 而不是直接写在 agent-platform 主路由里。`McpServerDiscovery` 选择了启动时一次性发现而不是运行时懒加载。这些决策的依据分别是什么？

3. **取舍：**
   - MCP 多了一层协议转发，延迟比直接调用高。这个延迟在什么场景下是可接受的？什么场景下不可接受？
   - 2026 v5 无状态设计牺牲了"服务端记住客户端状态"的便利性，换来了水平扩展能力。如果你的场景只有 1 个 MCP Server 实例，无状态设计是否还有价值？
   - `McpController` 的 `/tools/register` 端点没有做认证。如果攻击者恶意注册大量假工具，会发生什么？这个取舍在生产环境怎么补？

4. **防什么失败：**
   - 防"每个外部服务写一套适配代码"——没有 MCP，4 个外部服务 = 4 套代码 = 8-12 天开发。MCP 让接入新服务从"写代码"变成"启动 Server"。
   - 防"工具 Schema 格式不统一，LLM 理解困难"——直接调用时每个工具 Schema 格式各异，LLM 选错工具的概率高。MCP 统一 JSON Schema 2020-12，LLM 理解更准确。
   - 防"MCP 2026 无状态内核面试被问住"——面试官问"MCP 最近有什么变化"，答不上来说明不跟进协议演进。理解无状态内核 + `_meta` + `ttlMs` 是当下基础要求。

**写日志格式：**

```
## 判断力日志：MCP协议

### 问题
[描述你面临的问题：在一个有 5 个内部工具 + 3 个外部服务的 Agent 系统中，你如何决定哪些走 MCP、哪些走直接调用？]

### 决策
[描述你做了什么决策：你选择了 MCP 用于外部服务，直接调用用于内部工具。为什么？]

### 取舍
[描述你的取舍：MCP 带来的延迟开销 vs 标准化收益，你如何权衡？哪些场景你宁愿不用 MCP？]

### 防什么失败
[描述这个决策防止了哪些失败模式：至少列出 3 个没有 MCP 时会发生的问题。]
```
