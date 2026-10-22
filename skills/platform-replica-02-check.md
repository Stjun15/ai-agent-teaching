# 平台复刻 · 第二斧校验工具

给你的 Agent 装一个「Agent Loop 检查员」——自动验证你的 Agent 循环和工具调用是否正确实现。

---

## 工具 Schema

复制下面的代码，新建 `src/lib/check-loop-tool.ts`：

```typescript
export const checkLoopTool = {
  type: "function" as const,
  function: {
    name: "check_agent_loop",
    description:
      "检查第二斧「多步 Agent」是否完成：Agent Loop 循环结构、工具定义、tool_calls 处理、API 集成。用户说「检查第二斧」「检查 Agent Loop」时调用。",
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

async function executeCheckAgentLoop(): Promise<string> {
  const lines: string[] = [];
  const root = process.cwd();

  // 1. agent-loop.ts 存在
  const loopPaths = [
    path.join(root, "src", "lib", "agent-loop.ts"),
    path.join(root, "src", "lib", "agent", "agent-loop.ts"),
  ];
  const loopPath = loopPaths.find((p) => fs.existsSync(p));
  if (!loopPath) {
    lines.push("✗ agent-loop.ts 不存在。在 src/lib/ 下新建 agent-loop.ts");
    return lines.join("\n");
  }
  lines.push(`✓ agent-loop.ts 存在：${path.relative(root, loopPath)}`);
  const code = fs.readFileSync(loopPath, "utf-8");

  // 2. 循环结构
  if (code.includes("while") || code.includes("for (")) {
    lines.push("✓ 循环结构存在（while/for）");
  } else {
    lines.push("✗ 没有循环。Agent Loop 需要 while 或 for 循环包裹 API 调用");
  }

  // 3. tools 参数
  if (code.includes("tools")) {
    lines.push("✓ 模型 API 调用传了 tools 参数");
  } else {
    lines.push("✗ 模型 API 调用未传 tools 参数。在 fetch body 里加 tools: [quizTool]");
  }

  // 4. tool_calls 判断
  if (code.includes("tool_calls")) {
    lines.push("✓ tool_calls 判断逻辑存在");
  } else {
    lines.push("✗ 未检查 tool_calls。需要 if (!choice.message.tool_calls) return/break");
  }

  // 5. tool_call 结果回喂
  if (code.includes('role":"tool"') || code.includes("role: \"tool\"")) {
    lines.push("✓ tool 角色消息回喂");
  } else {
    lines.push("✗ 工具结果未回喂。执行完工具后需要 messages.push({ role: 'tool', tool_call_id: call.id, content: ... })");
  }

  // 6. tool_call_id 匹配
  if (code.includes("tool_call_id")) {
    lines.push("✓ tool_call_id 匹配逻辑存在");
  } else {
    lines.push("✗ tool 消息未设 tool_call_id。必须和对应 tool_call 的 id 一致");
  }

  // 7. 出题工具
  const toolFiles = [
    path.join(root, "src", "lib", "quiz-tool.ts"),
    path.join(root, "src", "lib", "tools", "quiz.ts"),
  ];
  const toolFile = toolFiles.find((p) => fs.existsSync(p));
  if (toolFile) {
    const tc = fs.readFileSync(toolFile, "utf-8");
    const hasName = tc.includes('"make_quiz"') || tc.includes("'make_quiz'");
    const hasDesc = tc.includes("description");
    const hasParams = tc.includes("parameters");
    lines.push(`✓ 出题工具文件：${path.relative(root, toolFile)}`);
    lines.push(hasName ? "  ✓ 工具名 make_quiz" : "  ✗ 缺 name 字段");
    lines.push(hasDesc ? "  ✓ description 已定义" : "  ✗ 缺 description——模型不知道什么时候用");
    lines.push(hasParams ? "  ✓ parameters 已定义" : "  ✗ 缺 parameters——模型不知道传什么参数");
  } else {
    lines.push("✗ 出题工具文件不存在。在 src/lib/ 下新建 quiz-tool.ts");
  }

  // 8. API 路由集成
  const routePath = path.join(root, "src", "app", "api", "chat", "route.ts");
  if (fs.existsSync(routePath)) {
    const rc = fs.readFileSync(routePath, "utf-8");
    if (rc.includes("runAgentLoop") || rc.includes("agentLoop")) {
      lines.push("✓ API 路由已集成 Agent Loop");
    } else {
      lines.push("✗ API 路由未集成 Agent Loop。route.ts 里应该调用 runAgentLoop 而不是直接调模型");
    }
  }

  // 9. 安全限制
  if (code.includes("step <") || code.includes("maxSteps") || code.includes("MAX_STEPS")) {
    lines.push("✓ 有最大步数限制（防死循环）");
  } else {
    lines.push("✗ 没有最大步数限制。循环里加 step < 5 或 maxSteps 防止死循环");
  }

  return lines.join("\n");
}
```

## 安装步骤

**1.** 新建 `src/lib/check-loop-tool.ts`，粘贴「工具 Schema」

**2.** 在 `agent-loop.ts` 里：

- import：`import { checkLoopTool } from "./check-loop-tool";`
- tools 数组加上（⚠️ 把 checkLoopTool 追加到你现有的 tools 数组末尾——不要覆盖已有的工具）：`const tools = [quizTool, checkLoopTool, ...];`
- executeTool 里加上：`if (name === "check_agent_loop") return executeCheckAgentLoop();`
- 粘贴上面的「执行函数」

**3.** 重启开发服务器

## 使用方法

在对话框里说：

```
检查 Agent Loop
```

Agent 自动调用 `check_agent_loop`，逐项检查循环结构、工具定义、tool_calls 处理逻辑。

---

**你的 Agent 自己审查自己的代码——它现在真的有了"自知之明"。**