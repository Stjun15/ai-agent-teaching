---
type: concept
last_updated: 2026-09-23
id: platform-replica
name: 教学平台复刻
prerequisites: [ai-safety]
difficulty: 5
estimated_time: 180min
tags: [core, integration, project]
---

# 教学平台复刻

## 定义

「教学平台复刻」= 用本课程前 9 个模块教的每一个技术零件（LLM API、System Prompt、Agent Loop、Tool Calling、RAG、LLM Wiki、SQLite），从零搭出一个**能跑的单机版 AI 教学平台**。

它是课程的总验收：不是选择题得分，而是「你能不能独立做一个 AI 应用」的试金石。复刻的对象就是**你正在用的这个平台本身**——学什么就造什么，造什么就验证什么。

## 为什么需要：最终目标

用前面 9 个模块教的每一个零件，从零搭出一个**能教别人学 AI 的单机版教学平台**。

不是 Demo。不是玩具。是真的能跑、能用、能拿去给别人用的东西。

就是你正在用的这个平台的孪生兄弟。

```
你的任务：用 AI 造一个教 AI 的平台。

你学 LLM API      → 平台能调大模型
你学 System Prompt → 平台知道怎么当老师
你学 Agent Loop    → 平台能多步推理
你学 Tool Calling  → 平台能出题、能点评
你学 RAG           → 平台能注入讲稿
你学 LLM Wiki      → 平台有教材库
```

---

## 关键步骤：三板斧 + 一条龙骨

不是先讲完理论再写代码。是**造一段、跑一段、通了再往下**。

## 关键步骤：三板斧 + 一条龙骨（详细步骤）

### 启动台

```
npx create-next-app teaching-platform
cd teaching-platform
npm run dev
```

先把空壳跑通。浏览器打开 `localhost:3000`，看到一个 Next.js 欢迎页。—— 这就是你的起点。

**验收：** 空壳能跑。

---

### 第一斧：对话骨架

**目标：** 搭完能跟 AI 聊天。

| 做什么               | 用到的模块    | 关键文件                         |
| -------------------- | ------------- | -------------------------------- |
| 封装 LLM 调用        | llm-api       | `src/lib/llm.ts`                 |
| 写教学 System Prompt | system-prompt | `agent-prompts/teaching-chat.ts` |
| 实现 SSE 流式接口    | —             | `src/app/api/chat/route.ts`      |
| 前端打字机聊天       | —             | `src/components/chat/`           |
| API Key 配置         | —             | `.env.local` + 设置页            |

**验收脚本：**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"你好，请介绍一下你自己"}'
# → 200 + SSE 流式响应
# → 角色是"教学导师"
# → 前端打字机正常渲染
```

---

### 第二斧：多步 Agent

**目标：** 搭完 AI 能讲课、能出题。

| 做什么                         | 用到的模块   | 关键文件                          |
| ------------------------------ | ------------ | --------------------------------- |
| runAgent 核心循环              | agent-loop   | `src/lib/agent/runtime.ts`        |
| 教学 Agent（多步讲解）         | agent-loop   | `src/lib/agent/teaching-agent.ts` |
| 出题 Agent（function calling） | tool-calling | `src/lib/agent/examiner-agent.ts` |

**验收脚本：**

```bash
curl -X POST http://localhost:3000/api/agent/teach \
  -d '{"concept":"llm-api","step":"explain"}'
# → Agent 多步输出：概念定义 → 核心原理 → 防踩坑 → 两道测验题
```

---

### 第三斧：知识 + 数据库

**目标：** 搭完 AI 知道你在学什么、学了什么。

| 做什么           | 用到的模块 | 关键文件                     |
| ---------------- | ---------- | ---------------------------- |
| 概念页注入上下文 | rag        | `src/lib/lecture-context.ts` |
| SQLite 存掌握度  | llm-wiki   | `src/lib/db/sqlite.ts`       |
| 进度追踪         | —          | 掌握度表 + 会话表            |

**验收脚本：**

```bash
sqlite3 dev.db "SELECT * FROM mastery WHERE student_id = 'default';"
# → 有记录，分数随学习变化
```

---

### 龙骨：页面连线

每连一段跑通一段。不攒到最后。

```
首页    → /             模块列表 + 进入学习
学习中心 → /learn        按拓扑顺序排列的模块卡片
工作区   → /learn/[id]   概念讲解 + 观察示范（分屏）
沙箱    → /playground   自由对话
设置    → /settings      API Key + 模型选择
```

---

## 常见误解

- 误解 1：复刻 = 照着界面截图搭壳 → 其实复刻的是**管线**：SSE 流式、Agent 多步循环、Schema 约束输出、SQLite 落库。界面只是管线的壳，管线通了界面才有魂。
- 误解 2：一次把所有功能写完再一起调试 → 三板斧的顺序就是防这个：**造一段、跑一段、通了再往下**。攒到最后调试，错误会叠错误。
- 误解 3：AI 输出不稳定是模型不行 → 出题 Agent 的输出结构靠 Schema 钉死、讲解口径靠 System Prompt 约束、流式体验靠 SSE 关缓冲——不稳通常是这三道约束缺了一道。

## 示范代码

第一斧「对话骨架」的最小可抄版：一个 SSE 流式对话端点（Next.js API Route），逐行看。

```typescript
// ① API Route：收到学生消息，向模型要一份「流式」的回复
export async function POST(req: Request) {
  const { content } = await req.json(); // 学生的消息
  // ② 调大模型：stream=true 让模型逐字吐，而不是憋一整段
  const upstream = await callLLM({
    messages: [
      { role: "system", content: "你是教学导师，只讲学习相关内容。" },
      { role: "user", content },
    ],
    stream: true,
  });
  // ③ 把模型的流原样转成 SSE 推给前端（打字机的数据来源）
  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

前端那半边只需要一个循环：`reader.read()` 逐块读、拼到页面上 —— 打字机效果就是这么来的。

## 动手任务：最终验收

三斧全绿 + 龙骨连线完整 = **达标**。

不是选择题得分。是这套东西真的在 `localhost:3000` 上跑着：

- [ ] 能跟 AI 实时对话（SSE 流式，打字机渲染）
- [ ] AI 被 System Prompt 约束为教学导师，不讲无关内容
- [ ] Agent 能多步输出：讲概念 → 给示范 → 出测验题
- [ ] 出题 Agent 输出的题目符合 Schema（有选项、有答案、有解析）
- [ ] SQLite 记录学习进度，刷新不丢
- [ ] 页面导航完整：首页 → 学习中心 → 工作区 → 沙箱 → 设置

---

## 🎯 结算

你从 `npx create-next-app` 开始，一行一行搭出来的。

LLM API 那一讲你第一次调通了 `chat.completions.create`。System Prompt 那一讲你第一次写了一段让 AI 变老师的提示词。Agent Loop 那一讲你第一次看着 Agent 自己推了三步。

现在它们全都连在一起了。

**这不是学完 10 个模块的毕业设计。这是你前面每学一个零件时，就已经在为这台车拧螺丝。**

你已经会造了。剩下的只是拧多少颗螺丝的问题。
