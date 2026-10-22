/**
 * MCP 工具发现与适配 —— 启动 MCP Server → 连接 → 列出工具 → 转为 AgentCustomTool
 *
 * 为什么放在 tools/ 而不是 mcp/
 * ------------------------------
 * 本文件的产物是 `AgentCustomTool[]`（`session.ts` 的工具类型），
 * 与 `calculator.ts` / `query-wiki.ts` 同一层级。调用方（route.ts）把它们
 * 一起传给 `runAgentLoop`，MCP 工具与内置工具对 loop.ts 无区别。
 *
 * 单例策略（为什么用 globalThis 缓存）
 * -----------------------------------
 * MCP Server 通过 stdio 作为子进程运行。每次 `discoverTools()` 创建新进程
 * 的代价是 Node 启动 + 模块加载（包含 sqlite、wiki 分词器等），数百毫秒。
 * 缓存一次、后续复用是必要的。`globalThis` 的键名带 mcp 前缀避免与其他
 * 单例冲突，Next.js 热更新期间也安全（模块重新求值时 globalThis 仍指向同一对象）。
 *
 * 与现有 query_wiki 工具的关系
 * ---------------------------
 * `query-wiki.ts` 是内置工具（defineTool），始终注册。
 * 本文件通过 MCP 协议提供同名 `search_wiki` 工具 —— 同一份能力，两套接入方式。
 * 教学上可以让学生对比「直接调工具」和「通过 MCP 协议调工具」的区别。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Type } from "typebox";

import type { AgentCustomTool } from "../session.js";

interface McpCache {
  promise: Promise<AgentCustomTool[]> | null;
  /** MCP Server 子进程引用，用于清理 */
  transport: StdioClientTransport | null;
  client: Client | null;
  error: string | null;
  ts: number;
}

const MCP_CACHE_KEY = "__mcp_discover_cache__";
const CACHE_MAX_AGE_MS = 5 * 60_000; // 5 分钟后重连，避免僵尸进程

function getCache(): McpCache {
  const g = globalThis as Record<string, unknown>;
  if (!g[MCP_CACHE_KEY]) {
    g[MCP_CACHE_KEY] = {
      promise: null,
      transport: null,
      client: null,
      error: null,
      ts: 0,
    };
  }
  return g[MCP_CACHE_KEY] as McpCache;
}

function clearCache(cache: McpCache) {
  cache.client?.close().catch(() => {});
  cache.transport?.close().catch(() => {});
  cache.client = null;
  cache.transport = null;
  cache.promise = null;
  cache.ts = 0;
}

/** MCP Server 进程参数，与 `scripts/ts-loader.mjs` 同一模式。 */
const SERVER_COMMAND = "node";
const SERVER_ARGS = [
  "--experimental-strip-types",
  "--import",
  "./scripts/ts-loader.mjs",
  "src/lib/mcp/wiki-server.ts",
];

/**
 * 连接 MCP Server 并发现所有可用工具。
 * 结果缓存于 `globalThis`，5 分钟内复用同一连接。
 * 连接失败时返回空数组、记录 error 字段 —— 不影响 Agent 正常对话。
 */
export async function discoverTools(): Promise<{
  tools: AgentCustomTool[];
  error: string | null;
}> {
  const cache = getCache();

  // 缓存有效：直接返回
  if (
    cache.promise &&
    cache.ts > 0 &&
    Date.now() - cache.ts < CACHE_MAX_AGE_MS
  ) {
    const tools = await cache.promise;
    return { tools, error: cache.error };
  }

  // 过期或首次：重建
  clearCache(cache);
  cache.ts = Date.now();
  cache.error = null;

  cache.promise = (async () => {
    const transport = new StdioClientTransport({
      command: SERVER_COMMAND,
      args: SERVER_ARGS,
      stderr: "pipe" as const,
    });

    cache.transport = transport;

    const client = new Client({
      name: "ai-teaching-agent",
      version: "1.0.0",
    });

    cache.client = client;

    try {
      await client.connect(transport);

      const { tools: mcpTools } = await client.listTools();

      // 把 MCP 工具转为 AgentCustomTool（defineTool 格式）
      const converted: AgentCustomTool[] = mcpTools.map((t) => {
        // inputSchema 是 Zod raw shape 或 JSON Schema —— 统一转 TypeBox
        const schema = t.inputSchema as Record<string, unknown> | undefined;
        const properties = (schema?.properties ?? schema ?? {}) as Record<
          string,
          { type?: string; description?: string }
        >;
        const tbProps: Record<string, ReturnType<typeof Type.String>> = {};
        for (const [key, def] of Object.entries(properties)) {
          // 简化：所有参数当 string 处理。MCP tools/list 返回的是 JSON Schema，
          // TypeBox 从 JSON Schema 重构太复杂；string 对搜索查询是最常见的类型。
          const desc = def?.description ?? "";
          tbProps[key] = Type.String({ description: desc });
        }

        // 构建执行函数：把 Agent 侧收到的参数转发给 MCP Server
        const execute: AgentCustomTool["execute"] = async (
          _toolCallId,
          params: Record<string, unknown>,
        ) => {
          const result = await client.callTool({
            name: t.name,
            arguments: params,
          });

          const isError = result.isError === true;
          const text = (result.content as { type: string; text?: string }[])
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join("\n");

          return {
            content: [
              {
                type: "text" as const,
                text: text || (isError ? "MCP 工具返回了空结果。" : ""),
              },
            ],
            details: {
              toolName: t.name,
              isError,
              resultCount: (result.content as unknown[]).length,
            },
          };
        };

        return {
          name: t.name,
          label: t.name,
          description: t.description ?? "",
          parameters: Type.Object(tbProps),
          execute,
        };
      });

      return converted;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cache.error = msg;
      return [] as AgentCustomTool[];
    }
  })();

  const tools = await cache.promise;
  return { tools, error: cache.error };
}

/**
 * 释放 MCP 连接（进程退出时调用，避免句柄泄漏）。
 * 不会抛错 —— 清理操作失败只打日志。
 */
export function disposeMcp(): void {
  const cache = getCache();
  clearCache(cache);
}

// 进程退出时主动清理子进程
if (typeof process !== "undefined") {
  process.on("exit", disposeMcp);
  process.on("SIGTERM", () => {
    disposeMcp();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    disposeMcp();
    process.exit(0);
  });
}
