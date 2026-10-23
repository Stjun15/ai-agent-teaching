import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";

import { query } from "../../wiki/query";

const server = new McpServer({
  name: "ai-teaching-wiki",
  version: "1.0.0",
});

server.registerTool(
  "search_wiki",
  {
    description:
      "搜索教学平台Wiki知识库。传入概念名或关键词（如「System Prompt」「Agent循环」「RAG」），" +
      "返回相关的教学文档标题、类型、关键片段和来源路径。在Agent不确定答案时先调用本工具再回答。",
    inputSchema: {
      query: z
        .string()
        .describe(
          "搜索关键词或自然语言问题。越具体越好，例如「TypeScript中interface和type的区别」比「类型」更可能命中。",
        ),
    },
  },
  async ({ query: q }) => {
    try {
      const result = await query(q, { topK: 5 });
      if (result.hits.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `在Wiki中未找到与「${q}」相关的页面。请尝试用更具体的术语重新查询。`,
            },
          ],
        };
      }
      const lines = result.hits.map(
        (hit, i) =>
          `${i + 1}. **${hit.name ?? hit.path}** (${hit.type ?? "concept"}, 相关度 ${Math.round(hit.score)}%)\n` +
          `   来源: ${hit.path}\n` +
          `   > ${hit.excerpt.slice(0, 200)}`,
      );
      return {
        content: [
          {
            type: "text" as const,
            text:
              `找到 ${result.hits.length} 条相关结果（共扫描 ${result.scanned} 页）：\n\n` +
              lines.join("\n\n") +
              `\n\n根据以上片段回答学生的问题。如果信息不足，请诚实说明哪些部分在Wiki中未覆盖。`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: "Wiki搜索暂时不可用。请基于你的自有知识谨慎回答，并标注「资料库未确认」。",
          },
        ],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
