# 平台复刻 · 第三斧校验工具

给你的 Agent 装一个「知识引擎检查员」——自动验证 RAG 注入、向量索引、混合检索和点评 Agent。

---

## 工具 Schema

复制下面的代码，新建 `src/lib/check-knowledge-tool.ts`：

```typescript
export const checkKnowledgeTool = {
  type: "function" as const,
  function: {
    name: "check_knowledge",
    description:
      "检查第三斧「知识注入+向量+数据库+点评」是否完成。用户说「检查第三斧」「检查知识引擎」时调用。",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
```

## 执行函数

复制下面的代码，粘贴到 `src/lib/agent-loop.ts`：

```typescript
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

async function executeCheckKnowledge(): Promise<string> {
  const lines: string[] = [];
  const root = process.cwd();

  // 1. RAG 注入
  const ragPaths = [
    path.join(root, "src", "lib", "rag-inject.ts"),
    path.join(root, "src", "lib", "agent", "rag-inject.ts"),
  ];
  const ragPath = ragPaths.find((p) => fs.existsSync(p));
  if (ragPath) {
    lines.push(`✓ RAG 注入文件：${path.relative(root, ragPath)}`);
    const rc = fs.readFileSync(ragPath, "utf-8");
    if (rc.includes("injectKnowledge") || rc.includes("ragInject")) {
      lines.push("  ✓ 导出了注入函数");
    }
    if (rc.includes("readFileSync") || rc.includes("readFile")) {
      lines.push("  ✓ 读文件逻辑存在");
    }
  } else {
    lines.push("✗ RAG 注入文件不存在。新建 src/lib/rag-inject.ts");
  }

  // 2. 向量索引脚本
  const idxPaths = [
    path.join(root, "scripts", "index.ts"),
    path.join(root, "scripts", "embed.ts"),
  ];
  const idxPath = idxPaths.find((p) => fs.existsSync(p));
  if (idxPath) {
    lines.push(`✓ 离线索引脚本：${path.relative(root, idxPath)}`);
    const ic = fs.readFileSync(idxPath, "utf-8");
    if (ic.includes("embed") || ic.includes("Embedding")) {
      lines.push("  ✓ 调用了 Embedding API");
    }
    if (ic.includes("knowledge_embeddings") || ic.includes("embeddings")) {
      lines.push("  ✓ 引用 knowledge_embeddings 表");
    }
  } else {
    lines.push("✗ 离线索引脚本不存在。在 scripts/ 下新建 index.ts");
  }

  // 3. 混合检索
  const retPaths = [
    path.join(root, "src", "lib", "retrieve.ts"),
    path.join(root, "src", "lib", "agent", "retrieve.ts"),
  ];
  const retPath = retPaths.find((p) => fs.existsSync(p));
  if (retPath) {
    lines.push(`✓ 检索模块：${path.relative(root, retPath)}`);
    const rc = fs.readFileSync(retPath, "utf-8");
    if (rc.includes("cosine") || rc.includes("dot")) {
      lines.push("  ✓ 相似度计算存在");
    }
    if (rc.includes("retrieveRelevant") || rc.includes("search")) {
      lines.push("  ✓ 检索函数已导出");
    }
    // 客户端安全
    if (rc.includes('"use client"') || rc.includes("'use client'")) {
      lines.push("  ✗ 检索文件含 'use client'！数据库/fs 不能在客户端跑。去掉这行或移到服务端 import");
    } else {
      lines.push("  ✓ 未标记客户端（安全）");
    }
  } else {
    lines.push("✗ 检索模块不存在。新建 src/lib/retrieve.ts");
  }

  // 4. citation 事件
  const routePath = path.join(root, "src", "app", "api", "chat", "route.ts");
  if (fs.existsSync(routePath)) {
    const rc = fs.readFileSync(routePath, "utf-8");
    if (rc.includes("citation")) {
      lines.push("✓ SSE 含 citation 事件");
    } else {
      lines.push("✗ SSE 未发送 citation 事件。在模型回答前先 enqueue({type:'citation',chunks:[...]})");
    }
  }

  // 5. 数据库
  let dbExists = false;
  try {
    const db = JSON.parse(JSON.stringify(
      Object.keys(require("node:sqlite") || {})
    ));
    dbExists = true;
  } catch { /* ignore */ }

  if (dbExists) {
    lines.push("✓ SQLite 已使用");
  } else {
    // Check if dev.db exists
    const dbPath = path.join(root, "dev.db");
    if (fs.existsSync(dbPath)) {
      lines.push("✓ dev.db 数据库文件存在");
    } else {
      lines.push("⚠ 未检测到 SQLite 使用（dev.db 或 import DatabaseSync）");
    }
  }

  // 6. mastery 表
  const srcDir = path.join(root, "src");
  let hasTable = false;
  if (fs.existsSync(srcDir)) {
    const searchDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
          searchDir(path.join(dir, e.name));
        } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
          const content = fs.readFileSync(path.join(dir, e.name), "utf-8");
          if (content.includes("mastery") && (content.includes("CREATE TABLE") || content.includes("createTable"))) {
            hasTable = true;
          }
        }
      }
    };
    try { searchDir(srcDir); } catch { /* ignore */ }
  }
  lines.push(hasTable ? "✓ mastery 表定义存在" : "✗ 未找到 mastery 表定义。需要 CREATE TABLE mastery(...)");

  // 7. 点评 Agent
  const validatePath = path.join(root, "src", "app", "api", "validate", "route.ts");
  if (fs.existsSync(validatePath)) {
    lines.push("✓ /api/validate 路由存在");
  } else {
    lines.push("✗ /api/validate/route.ts 不存在。新建点评路由");
  }

  return lines.join("\n");
}
```

## 安装步骤

**1.** 新建 `src/lib/check-knowledge-tool.ts`，粘贴「工具 Schema」

**2.** 在 `agent-loop.ts` 里：

- import：`import { checkKnowledgeTool } from "./check-knowledge-tool";`
- tools 数组加上（⚠️ 把 checkKnowledgeTool 追加到你现有的 tools 数组末尾——不要覆盖前几个阶段装好的工具）：`const tools = [quizTool, checkLoopTool, checkKnowledgeTool, ...];`
- executeTool 里加上：`if (name === "check_knowledge") return executeCheckKnowledge();`
- 粘贴上面的「执行函数」

**3.** 重启开发服务器

## 使用方法

在对话框里说：

```
检查知识引擎
```

Agent 自动扫描 RAG、向量、检索、citation、数据库、点评路由 6 大模块。