# 平台复刻 · 第一斧验收脚本

你现在有了 `route.ts` 和 `chat-panel.tsx`，但还没有 Agent Loop（那是第二斧的事）。这段脚本帮你自动检查 SSE 流式接口和前端打字机是否写对了。

---

## 验收脚本

```typescript
// check-chat.ts —— 保存到 teaching-platform/ 目录下，终端运行 npx tsx check-chat.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks: { label: string; ok: boolean; detail: string }[] = [];

function checkFile(path: string, label: string, patterns: { label: string; regex: RegExp }[]) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) {
    checks.push({ label, ok: false, detail: `文件不存在：${path}——确认文件名和路径是否正确` });
    return;
  }
  checks.push({ label, ok: true, detail: `文件存在` });
  const content = readFileSync(fullPath, "utf8");
  for (const p of patterns) {
    const match = p.regex.test(content);
    checks.push({ label: `  └ ${p.label}`, ok: match, detail: match ? "已检测到" : `未找到——在 ${path} 中搜索「${p.label}」` });
  }
}

// ① API 路由
checkFile("src/app/api/chat/route.ts", "API 路由 route.ts", [
  { label: "ReadableStream", regex: /ReadableStream/ },
  { label: "text/event-stream", regex: /text\/event-stream/ },
  { label: "stream: true（关闭缓冲）", regex: /stream:\s*true/ },
  { label: "System Prompt（角色定义）", regex: /system|role.*system/i },
  { label: "DeepSeek API 调用", regex: /deepseek|api\.deepseek|dashscope/i },
]);

// ② 前端聊天面板
checkFile("src/components/chat-panel.tsx", "前端组件 chat-panel.tsx", [
  { label: "'use client'", regex: /"use client"|'use client'/ },
  { label: "useState（messages）", regex: /useState/ },
  { label: "fetch（POST /api/chat）", regex: /fetch\(/ },
  { label: "reader（SSE 解码）", regex: /\.getReader|response\.body/ },
  { label: "TextDecoder", regex: /TextDecoder/ },
  { label: "打字机效果", regex: /setMessages|setStreaming/ },
]);

// ③ 环境变量
const envPath = resolve(".env.local");
if (!existsSync(envPath)) {
  checks.push({ label: ".env.local", ok: false, detail: "不存在——需要创建并填入 DEEPSEEK_API_KEY" });
} else {
  const env = readFileSync(envPath, "utf8");
  const hasKey = /DEEPSEEK_API_KEY\s*=\s*\S+/.test(env) || /DASHSCOPE_API_KEY\s*=\s*\S+/.test(env);
  checks.push({
    label: ".env.local 含 API Key",
    ok: hasKey,
    detail: hasKey ? "已配置" : "文件存在但没填 Key——在 .env.local 里加上 DEEPSEEK_API_KEY=sk-xxx",
  });
}

// ④ @/lib/llm 工具函数
checkFile("src/lib/llm.ts", "工具函数 llm.ts", [
  { label: "export 函数", regex: /export\s+(async\s+)?function/ },
  { label: "fetch 调用大模型", regex: /fetch\(/ },
]);

// 输出
const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
console.log(`\n第一斧验收：${pass}/${total} 通过\n`);
for (const c of checks) {
  const icon = c.ok ? "✓" : "✗";
  console.log(`${icon} ${c.label.padEnd(32)} ${c.ok ? c.detail : "→ " + c.detail}`);
}
if (pass === total) {
  console.log("\n✅ 第一斧全部通过！SSE 管线搭好了，可以进入第二斧了。");
} else {
  console.log(`\n⚠️  ${total - pass} 项未通过。对照 wiki 检查对应文件，修复后再跑一次。`);
}
```

## 怎么运行

```bash
# 在 teaching-platform/ 目录下
npx tsx check-chat.ts
```

## 你会看到什么

```
第一斧验收：13/15 通过

✓ API 路由 route.ts             文件存在
  └ ✓ ReadableStream             已检测到
  └ ✓ text/event-stream          已检测到
  └ ✓ stream: true（关闭缓冲）    已检测到
  └ ✓ System Prompt（角色定义）    已检测到
  └ ✓ DeepSeek API 调用          已检测到
✓ 前端组件 chat-panel.tsx        文件存在
  └ ✓ 'use client'              已检测到
  └ ✓ useState（messages）        已检测到
  └ ✓ fetch（POST /api/chat）    已检测到
  └ ✓ reader（SSE 解码）          已检测到
  └ ✓ TextDecoder                已检测到
  └ ✗ 打字机效果                 → 未找到——在 chat-panel.tsx 中搜索「setStreaming」
✓ .env.local 含 API Key         已配置
✗ 工具函数 llm.ts               → 文件不存在：src/lib/llm.ts
```

14 个模式检查，用正则扫代码。✗ 的那行告诉你哪个文件、缺了什么、去搜什么关键词。