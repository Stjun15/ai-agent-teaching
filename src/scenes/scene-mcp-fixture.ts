/**
 * MCP 场景的样本数据 —— 两台 MCP Server 与它们暴露的工具
 *
 * 为什么要单独一份而不是写在场景组件里
 * ----------------------------------
 * 「工具描述」是本模块的核心：模型靠描述判断该不该调用某个工具，而描述写不写得
 * 清楚，在画面上完全看不出差别（卡片上就是一行灰字）。把它做成纯数据，测试才能
 * 断言「每个工具都有非空描述」—— 这条断言挡的是新手最常见的那个错。
 *
 * 样本为什么用 `mcp://` 而不是 `https://`
 * ------------------------------------
 * MCP 的传输层本来就是可换的（stdio / HTTP / SSE），写 `https://` 会让学生以为
 * 「MCP 就是调 REST 接口」，那是错的。用协议自有的 `mcp://` 不指向任何真实地址，
 * 也避免让人以为照着敲就能连上。
 *
 * 工具返回的内容是本项目里真实存在的东西（wiki 的三张表、检索到的片段），
 * 不是编的 —— 编出来的返回值在下一讲对不上项目，整段就不可信了。
 */

/** 一个 MCP 工具的定义。 */
export interface McpTool {
  name: string;
  /**
   * 工具描述。模型据它判断该不该调用 —— 所以「描述为空」不是少了点文字，
   * 而是这个工具等于不存在：模型只能靠名字猜。
   */
  description: string;
  /** 参数签名（展示用，不参与执行）。 */
  params: string;
  /** 它背后真正去调的外部服务，由 MCP Server 负责对接。 */
  service: string;
  /** 调用返回的内容。 */
  result: string;
}

/** 一台 MCP Server。 */
export interface McpServer {
  id: string;
  name: string;
  url: string;
  /** 这台 server 暴露的工具 —— Agent 通过 listTools 拿到的就是这一份。 */
  tools: readonly McpTool[];
}

/** 两台可以切换的 server。`04-frontend.md` 要求的「模拟不同 MCP Server」即此。 */
export const SERVERS: readonly McpServer[] = [
  {
    id: "search",
    name: "search-server",
    url: "mcp://search.local",
    tools: [
      {
        name: "webSearch",
        description:
          "按关键词搜索公开网页，返回标题、链接与摘要。需要最新信息时用。",
        params: "{ query: string, limit?: number }",
        service: "搜索引擎 API",
        result:
          "1. MCP 规范 v1.2 发布（modelcontextprotocol.io）\n2. 三家客户端宣布支持\n3. 社区 server 数量突破 500",
      },
      {
        name: "fetchPage",
        description: "抓取一个已知网址的正文。只知道链接、不知道内容时用。",
        params: "{ url: string }",
        service: "网页抓取服务",
        result: "（已抓取正文 4 千余字，略）",
      },
    ],
  },
  {
    id: "database",
    name: "db-server",
    url: "mcp://db.local",
    tools: [
      {
        name: "queryDatabase",
        description: "执行只读 SQL 查询并返回结果行。需要统计或核对数据时用。",
        params: "{ sql: string, limit?: number }",
        service: "PostgreSQL",
        result:
          "id | name        | mastery\n1  | 张小北      | 3\n2  | 李思远      | 4",
      },
      {
        name: "listTables",
        description: "列出当前库里的表名。不确定有什么数据时先看这个。",
        params: "{}",
        service: "PostgreSQL",
        result: "students, mastery, projects",
      },
    ],
  },
];

/** 取 server；id 是外部输入（来自参数），不信任，找不到退回第一台。 */
export function findServer(id: string): McpServer {
  return SERVERS.find((server) => server.id === id) ?? SERVERS[0];
}

/**
 * 取工具。工具名跨 server 不通用，所以必须带上所属 server 一起找 ——
 * 换了 server 之后旧工具名查不到，退回该 server 的第一个。
 */
export function findTool(server: McpServer, name: string): McpTool {
  return server.tools.find((tool) => tool.name === name) ?? server.tools[0];
}
