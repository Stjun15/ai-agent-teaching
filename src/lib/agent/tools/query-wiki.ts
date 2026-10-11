/**
 * Wiki 查询工具（query_wiki）
 *
 * 设计依据
 * --------
 * 教学导师在回答学生概念问题时，不应只凭模型自有记忆——那可能过时、不准。
 * 本工具让导师先查向量库（Wiki），只把**相关的那几段**注入上下文再回答。
 * 实现「用到哪灌倒哪」，而不是把整篇概念页灌进系统提示词。
 *
 * 工具名为什么是 `query_wiki` 而不是 `search_wiki`
 * ---------------------------------------------
 * 与 `wiki/query.ts` 的入口函数同名，模型看到参数名与工具名一致时更容易
 * 建立关联。`query` 也比 `search` 更精确：查的是内部知识库，不是万维网。
 *
 * 为什么用纯关键词检索而不是混合检索（rag-hybrid.ts）
 * ----------------------------------------------
 * 向量路依赖 embedding 离线索引，可能没有提前构建。关键词检索（2-gram）
 * 毫秒级、零依赖、永远可用。导师如果觉得结果不够，可以改关键词再查一次。
 * 向量路留给引用检索（citations.ts）那条单独路径用。
 */

import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { query } from "@/wiki";

const MAX_RESULTS = 5;
const MAX_SNIPPET_LENGTH = 200;

export const queryWikiTool = defineTool({
  name: "query_wiki",
  label: "查询知识库",
  description:
    "在你的内部知识不够确定时，先调用本工具查项目的 LLM Wiki 知识库。" +
    "传一个自然语言问题或关键字（如 TypeScript 联合类型和交叉类型的区别），" +
    "工具会返回最相关的页面名称、类型与关键片段。拿到结果后再根据片段作答，" +
    "不要凭空编造。",
  parameters: Type.Object({
    query: Type.String({
      description:
        "要在 Wiki 中搜索的问题或关键词。用自然语言写，不要用 AND/OR 语法。" +
        '越具体越好，例如 TypeScript 中 interface 和 type 的区别比"类型"更可能命中。',
    }),
  }),
  execute: async (_toolCallId, params) => {
    try {
      const result = await query(params.query, { topK: MAX_RESULTS });
      if (result.hits.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `在 Wiki 中未找到与「${params.query}」相关的页面。` +
                `请尝试用更具体的术语重新查询，或基于你自己的知识谨慎回答并标注"未在资料库中确认"。`,
            },
          ],
          details: { query: params.query, hitCount: 0 },
        };
      }

      const lines = result.hits.map(
        (hit, index) =>
          `${index + 1}. **${hit.name ?? hit.path}** (${hit.type}, 相关度 ${Math.round(hit.score)}%)\n` +
          `   > ${hit.excerpt.slice(0, MAX_SNIPPET_LENGTH)}`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text:
              `找到 ${result.hits.length} 条相关结果（共扫描 ${result.scanned} 页）：\n\n` +
              lines.join("\n\n") +
              `\n\n根据以上片段回答学生的问题。如果片段信息不足以完全回答，` +
              `先基于片段给出已有信息，再诚实说明哪些部分在知识库中未找到。`,
          },
        ],
        details: { query: params.query, hitCount: result.hits.length },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Wiki 查询失败：${message}。` +
              `请基于你自己的知识回答，并在开头标注"资料库暂时不可用，以下回答基于模型自有知识"。`,
          },
        ],
        details: { query: params.query, hitCount: 0 },
      };
    }
  },
});
