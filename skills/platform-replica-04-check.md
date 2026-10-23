# 平台复刻 · 龙骨校验工具

给你的 Agent 装一个「页面连线检查员」——自动验证四大页面路由是否全部联通。

---

## 工具 Schema

复制下面的代码，新建 `src/lib/check-pages-tool.ts`：

```typescript
export const checkPagesTool = {
  type: "function" as const,
  function: {
    name: "check_pages",
    description:
      "检查龙骨阶段四大页面是否完成：首页/、学习中心/learn、工作区/learn/[moduleId]、设置/settings。用户说「检查龙骨」「检查页面」时调用。",
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

async function executeCheckPages(): Promise<string> {
  const lines: string[] = [];
  const root = process.cwd();

  const pages: { route: string; files: string[]; checks: { label: string; pattern: string }[] }[] = [
    {
      route: "/ (首页)",
      files: ["src/app/page.tsx"],
      checks: [
        { label: "开始学习按钮", pattern: "/learn" },
        { label: "页面标题", pattern: "教学平台" },
      ],
    },
    {
      route: "/learn (学习中心)",
      files: ["src/app/learn/page.tsx"],
      checks: [
        { label: "模块列表", pattern: "module" },
        { label: "模块数据源", pattern: "teaching-modules" },
      ],
    },
    {
      route: "/learn/[moduleId] (工作区)",
      files: [
        "src/app/learn/[moduleId]/page.tsx",
      ],
      checks: [
        { label: "动态路由参数", pattern: "moduleId" },
        { label: "聊天面板", pattern: "chat" },
      ],
    },
    {
      route: "/settings (设置)",
      files: ["src/app/settings/page.tsx"],
      checks: [
        { label: "API Key 配置", pattern: "key" },
      ],
    },
  ];

  for (const page of pages) {
    const found = page.files.find((f) => fs.existsSync(path.join(root, f)));
    if (found) {
      lines.push(`✓ ${page.route} 路由文件：${found}`);
      if (page.checks.length > 0) {
        const code = fs.readFileSync(path.join(root, found), "utf-8");
        for (const check of page.checks) {
          const pass = code.toLowerCase().includes(check.pattern.toLowerCase());
          lines.push(pass ? `  ✓ ${check.label}` : `  ✗ ${check.label}——页面代码中未找到「${check.pattern}」相关内容`);
        }
      }
    } else {
      lines.push(`✗ ${page.route} 路由文件不存在。期望：${page.files[0]}`);
    }
  }

  // 额外检查："use client" 放置位置
  const workspacePage = path.join(root, "src", "app", "learn", "[moduleId]", "page.tsx");
  if (fs.existsSync(workspacePage)) {
    const wc = fs.readFileSync(workspacePage, "utf-8");
    // 工作区通常需要 "use client"（因为含聊天组件）
    if (wc.includes('"use client"') || wc.includes("'use client'")) {
      lines.push("✓ 工作区页面标记了 'use client'");
    } else {
      // 检查是否含服务端代码
      if (wc.includes("readFileSync") || wc.includes("DatabaseSync")) {
        lines.push("✓ 工作区是服务端组件（含 fs/db，不需要 'use client'）");
      } else {
        lines.push("⚠ 工作区页面可能是客户端组件但未标记 'use client'。如果用了 useState/useEffect/onClick，需要加 'use client'");
      }
    }
  }

  return lines.join("\n");
}
```

## 安装步骤

**1.** 新建 `src/lib/check-pages-tool.ts`，粘贴「工具 Schema」

**2.** 在 `agent-loop.ts` 里：

- import：`import { checkPagesTool } from "./check-pages-tool";`
- tools 数组加上（⚠️ 把 checkPagesTool 追加到你现有的 tools 数组末尾——不要覆盖前几个阶段装好的工具）：`const tools = [quizTool, checkLoopTool, checkKnowledgeTool, checkPagesTool, ...];`
- executeTool 里加上：`if (name === "check_pages") return executeCheckPages();`
- 粘贴上面的「执行函数」

**3.** 重启开发服务器

## 使用方法

在对话框里说：

```
检查页面
```

Agent 自动扫描四大页面路由，逐页检查关键代码是否存在。