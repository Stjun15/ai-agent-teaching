# 平台复刻 · 最终验收工具

给你的 Agent 装一个「全链路检查员」——一键验收全部 5 个阶段的成果。

---

## 工具 Schema

复制下面的代码，新建 `src/lib/check-final-tool.ts`：

```typescript
export const checkFinalTool = {
  type: "function" as const,
  function: {
    name: "check_final",
    description:
      "平台复刻最终验收：全链路检查启动台+对话骨架+Agent Loop+知识引擎+页面连线+Git档案。用户说「最终验收」「全量检查」「验收」时调用。",
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
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function executeCheckFinal(): Promise<string> {
  const lines: string[] = [];
  const root = process.cwd();
  let pass = 0;
  let fail = 0;

  const check = (label: string, ok: boolean, fix?: string) => {
    if (ok) { pass++; lines.push(`✓ ${label}`); }
    else { fail++; lines.push(`✗ ${label}${fix ? " → " + fix : ""}`); }
  };

  // === 第一斧：对话骨架 ===
  lines.push("\n--- 第一斧：对话骨架 ---");
  const routePath = path.join(root, "src", "app", "api", "chat", "route.ts");
  check("API 路由 route.ts 存在", fs.existsSync(routePath));
  if (fs.existsSync(routePath)) {
    const rc = fs.readFileSync(routePath, "utf-8");
    check("SSE text/event-stream", rc.includes("text/event-stream"));
    check("ReadableStream", rc.includes("ReadableStream"));
    check("stream: true", rc.includes("stream: true"));
    check("System Prompt 注入", rc.includes("system") && (rc.includes("SYSTEM") || rc.includes("Prompt")));
  }

  const panelPath = path.join(root, "src", "components", "chat", "chat-panel.tsx");
  check("前端聊天面板", fs.existsSync(panelPath));

  // === 第二斧：Agent Loop ===
  lines.push("\n--- 第二斧：Agent Loop ---");
  const loopPaths = [
    path.join(root, "src", "lib", "agent-loop.ts"),
    path.join(root, "src", "lib", "agent", "agent-loop.ts"),
  ];
  const loopPath = loopPaths.find((p) => fs.existsSync(p));
  check("agent-loop.ts 存在", !!loopPath);
  if (loopPath) {
    const lc = fs.readFileSync(loopPath, "utf-8");
    check("循环结构 (while/for)", lc.includes("while") || lc.includes("for ("));
    check("tools 参数传入", lc.includes("tools"));
    check("tool_calls 判断", lc.includes("tool_calls"));
    check("tool_call_id 匹配", lc.includes("tool_call_id"));
    check("最大步数限制", lc.includes("step <") || lc.includes("maxSteps") || lc.includes("MAX_"));
  }

  const toolFiles = [
    path.join(root, "src", "lib", "quiz-tool.ts"),
    path.join(root, "src", "lib", "tools", "quiz.ts"),
  ];
  check("出题工具文件", toolFiles.some((p) => fs.existsSync(p)));

  // === 第三斧：知识引擎 ===
  lines.push("\n--- 第三斧：知识引擎 ---");
  const ragPaths = [
    path.join(root, "src", "lib", "rag-inject.ts"),
    path.join(root, "src", "lib", "agent", "rag-inject.ts"),
  ];
  check("RAG 注入", ragPaths.some((p) => fs.existsSync(p)));

  const idxPaths = [
    path.join(root, "scripts", "index.ts"),
    path.join(root, "scripts", "embed.ts"),
  ];
  check("离线索引脚本", idxPaths.some((p) => fs.existsSync(p)));

  const retPaths = [
    path.join(root, "src", "lib", "retrieve.ts"),
    path.join(root, "src", "lib", "agent", "retrieve.ts"),
  ];
  check("混合检索", retPaths.some((p) => fs.existsSync(p)));

  if (fs.existsSync(routePath)) {
    const rc = fs.readFileSync(routePath, "utf-8");
    check("SSE citation 事件", rc.includes("citation"));
  }

  check("mastery 表 (SQLite)", fs.existsSync(path.join(root, "dev.db")));

  check("点评路由 /api/validate", fs.existsSync(
    path.join(root, "src", "app", "api", "validate", "route.ts")
  ));

  // === 第四斧：页面连线 ===
  lines.push("\n--- 第四斧：页面连线 ---");
  const pages = [
    ["首页 /", "src/app/page.tsx"],
    ["学习中心 /learn", "src/app/learn/page.tsx"],
    ["工作区 /learn/[moduleId]", "src/app/learn/[moduleId]/page.tsx"],
    ["设置 /settings", "src/app/settings/page.tsx"],
  ];
  for (const [label, file] of pages) {
    check(label, fs.existsSync(path.join(root, file)));
  }

  // === Git 档案 ===
  lines.push("\n--- Git 档案 ---");
  try {
    const log = execSync("git log --oneline", { encoding: "utf-8", cwd: root }).trim();
    const count = log.split("\n").filter(Boolean).length;
    check(`Git 提交数（≥5）`, count >= 5, `当前 ${count} 条`);
    lines.push(`  最近提交：\n${log.split("\n").slice(0, 5).map((l) => "  " + l).join("\n")}`);
  } catch {
    check("Git 仓库", false, "git init && git add -A && git commit");
  }

  // === 汇总 ===
  lines.push(`\n===== 汇总：${pass}/${pass + fail} 通过 =====`);
  if (fail === 0) {
    lines.push("🎉 全部通过！平台复刻完成。");
  } else {
    lines.push(`还有 ${fail} 项未通过，对照上面的 ✗ 逐项修复。`);
  }

  return lines.join("\n");
}
```

## 安装步骤

**1.** 新建 `src/lib/check-final-tool.ts`，粘贴「工具 Schema」

**2.** 在 `agent-loop.ts` 里：

- import：`import { checkFinalTool } from "./check-final-tool";`
- tools 数组加上（⚠️ 把 checkFinalTool 追加到你现有的 tools 数组末尾——不要覆盖前几个阶段装好的工具）：`const tools = [quizTool, checkLoopTool, checkKnowledgeTool, checkPagesTool, checkFinalTool, ...];`
- executeTool 里加上：`if (name === "check_final") return executeCheckFinal();`
- 粘贴上面的「执行函数」

**3.** 重启开发服务器

## 使用方法

在对话框里说：

```
最终验收
```

Agent 自动扫描全部 5 个阶段、Git 档案，输出通过/失败统计 + 具体修复指引。

---

**你的 Agent 从一个"会讲概念的聊天机器人"，进化成了"能审查自己代码的工程师"。这就是 Agent 的真正价值。**