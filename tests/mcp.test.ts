/**
 * MCP 协议端到端回归。
 *
 * 这组用例守的是一个真实事故：`wiki-server.ts` 曾用 `../../wiki/query.js`
 * 指向不存在的 `.js` 文件，子进程启动即崩，`discoverTools()` 静默回退为
 * 空工具数组 —— 界面上毫无异常，MCP 集成实际上一天都没工作过。
 *
 * 所以这里不 mock：真的启动 stdio 子进程、走 JSON-RPC 握手、调一次工具。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let client: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "--experimental-strip-types",
      "--import",
      "./scripts/ts-loader.mjs",
      "src/lib/mcp/wiki-server.ts",
    ],
    stderr: "pipe",
    cwd: process.cwd(),
  });

  client = new Client({ name: "vitest-mcp", version: "1.0.0" });
  await client.connect(transport);
});

afterAll(async () => {
  await client?.close().catch(() => {});
});

describe("MCP Wiki Server", () => {
  it("能列出 search_wiki 工具", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("search_wiki");
  });

  it("能通过 tools/call 拿到真实检索结果", async () => {
    const result = await client.callTool({
      name: "search_wiki",
      arguments: { query: "Agent 循环" },
    });

    expect(result.isError ?? false).toBe(false);
    const text = (result.content as { type: string; text?: string }[])
      .filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n");
    expect(text).toContain("找到");
  });
});
