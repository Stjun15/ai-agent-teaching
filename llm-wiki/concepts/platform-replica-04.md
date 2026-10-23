### 龙骨：页面连线

#### 这一节的目标

把前三斧的功能连成一条完整的用户路径：学生打开网站 → 看到模块列表 → 进入某个模块学习 → 查看学习报告 → 设置 API Key。

#### 前置知识速查

| 概念                   | 解释                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Next.js App Router** | 基于文件夹的路由系统。`src/app/page.tsx` → `/`，`src/app/learn/page.tsx` → `/learn`，`src/app/learn/[id]/page.tsx` → `/learn/llm-api` 等。 |
| **`[id]` 动态路由**    | 方括号表示「这段路径是变量」。`src/app/learn/[id]/page.tsx` 匹配 `/learn/llm-api`、`/learn/system-prompt` 等所有 `/learn/xxx` 路径。       |
| **`layout.tsx`**       | Next.js 的布局文件。包裹在页面外层的固定结构（导航栏、侧边栏），页面切换时布局不重新渲染。                                                 |
| **`<Link>`**           | Next.js 提供的导航组件。用它代替 `<a>` 标签，页面切换更快（不需要整页刷新）。                                                              |

#### 页面地图

每连一段跑通一段。不攒到最后。

```
首页     → /               模块列表 + 进入学习
学习中心  → /learn          按拓扑顺序排列的模块卡片
工作区    → /learn/[id]     概念讲解 + 观察示范（分屏）
报告     → /report         学习报告 + 错题本
设置     → /settings       API Key + 模型选择
```

#### 第一步：首页 `/`

修改 `src/app/page.tsx`（第一斧已经放了一个聊天组件在这里——现在把它扩展为导航入口）：

```typescript
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">AI 教学平台</h1>
      <p className="max-w-md text-center text-gray-500">
        从零学 AI，每学一个概念就做一个零件，最后拼出一台自己的 AI 教学平台。
      </p>
      <div className="flex gap-4">
        <Link
          href="/learn"
          className="rounded-lg bg-blue-500 px-6 py-3 text-white hover:bg-blue-600"
        >
          开始学习
        </Link>
        <Link
          href="/report"
          className="rounded-lg border px-6 py-3 hover:bg-gray-50"
        >
          查看报告
        </Link>
      </div>
    </main>
  );
}
```

---

#### 第二步：学习中心 `/learn`

新建 `src/app/learn/page.tsx`：

```typescript
import Link from "next/link";

// 模块列表——后续可以从文件系统动态读取
const MODULES = [
  { id: "ts-basics", name: "TypeScript 基础", desc: "给 JS 装上类型安全带" },
  { id: "vibe-coding", name: "有纪律的 Vibe Coding", desc: "跟 AI 结对编程的正确姿势" },
  { id: "llm-api", name: "LLM API 入门", desc: "第一次调通大模型" },
  { id: "system-prompt", name: "System Prompt", desc: "让模型按角色说话" },
  { id: "agent-loop", name: "Agent Loop", desc: "模型不止说一句" },
  { id: "tool-calling", name: "Tool Calling", desc: "给模型装上手" },
  { id: "rag", name: "RAG 检索增强", desc: "让模型读教材" },
  { id: "llm-wiki", name: "LLM Wiki", desc: "结构化你的教材库" },
  { id: "multi-agent", name: "多 Agent 协作", desc: "让多个 Agent 分工干活" },
  { id: "mcp", name: "MCP 工具集成", desc: "给 Agent 接上外部工具" },
  { id: "ai-safety", name: "AI 安全", desc: "可控的 AI" },
];

export default function LearnPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-bold">学习中心</h1>
      <p className="mb-8 text-gray-500">按顺序学——每一讲都是下一讲的前置</p>

      <div className="space-y-3">
        {MODULES.map((mod, i) => (
          <Link
            key={mod.id}
            href={`/learn/${mod.id}`}
            className="flex items-center gap-4 rounded-lg border p-4 hover:bg-gray-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
              {i + 1}
            </span>
            <div>
              <h2 className="font-medium">{mod.name}</h2>
              <p className="text-sm text-gray-500">{mod.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

---

#### 第三步：工作区 `/learn/[id]`

新建 `src/app/learn/[id]/page.tsx`：

```typescript
import Link from "next/link";
import { ChatPanel } from "@/components/chat/chat-panel";

export default async function LearnModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <Link href="/learn" className="text-sm text-blue-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-lg font-semibold">学习：{id}</h1>
      </header>

      <div className="flex flex-1 gap-0">
        {/* 左侧：概念讲解 */}
        <div className="w-1/2 overflow-y-auto border-r p-6">
          <h2 className="mb-4 text-xl font-bold">概念讲解</h2>
          <p className="text-gray-500">
            这里将显示模块 <code>{id}</code> 的讲稿内容。
            后面的进阶任务：把第三斧的 RAG 注入接到这里。
          </p>
        </div>

        {/* 右侧：AI 对话 */}
        <div className="w-1/2">
          <ChatPanel />
        </div>
      </div>
    </main>
  );
}
```

#### 第四步：设置 `/settings`

```typescript
// src/app/settings/page.tsx
export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold">设置</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            className="w-full rounded-md border px-3 py-2 text-sm"
            defaultValue="●●●●●●●●"
            readOnly
          />
          <p className="mt-1 text-xs text-gray-400">
            API Key 在 <code>.env.local</code> 中配置，这里仅显示状态。
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">模型</label>
          <select className="w-full rounded-md border px-3 py-2 text-sm">
            <option>deepseek-v4-flash-ga-260731</option>
          </select>
        </div>
      </div>
    </main>
  );
}
```

#### 验收

> 🤖 **Agent 自查**：不用贴 prompt——给你的 Agent 装一个校验工具。打开右侧「工具箱 → Agent 自查」，按步骤把 `check_pages` 工具的 Schema 和执行函数装到你的 Agent 里。装好后在对话框说「检查页面」，Agent 自动扫描四大页面路由。

**🔍 自助验证：浏览器手动走通四大页面：**

```bash
# ① 首页
curl -s http://localhost:3000 | grep -o "开始学习\|查看报告\|教学平台"
# → 预期：输出包含 "开始学习" 和 "查看报告"

# ② 学习中心（模块列表）
curl -s http://localhost:3000/learn | grep -o "LLM\|Agent"
# → 预期：输出包含模块名称（如 "LLM"、"Agent"）

# ③ 工作区（概念区 + 聊天区）
curl -s http://localhost:3000/learn/llm-api | head -c 200
# → 预期：返回 HTML（非 404），包含页面结构

# ④ 设置页
curl -s http://localhost:3000/settings | head -c 200
# → 预期：返回 HTML（非 404）
```

**预期结果：**

- [ ] 浏览器访问 `/` → 看到首页，有「开始学习」和「查看报告」两个入口
- [ ] 点击「开始学习」→ 跳转到 `/learn`，看到 11 个模块卡片
- [ ] 点击任意模块 → 跳转到 `/learn/llm-api`（或对应模块），看到左侧概念区 + 右侧聊天区
- [ ] 访问 `/settings` → 看到设置页面

---