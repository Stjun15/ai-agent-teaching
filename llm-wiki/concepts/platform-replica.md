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

**单机版包含 / 不包含**（先说清楚，避免错误期待）：

| 包含（三板斧产出）           | 不包含（进阶方向） |
| ---------------------------- | ------------------ |
| 对话 + SSE 流式打字机        | 可视化场景播放     |
| 多步 Agent + 出题 Agent      | 多用户与登录体系   |
| 点评 Agent（作业按维度打分） | 学习报告与错题本   |
| 掌握度 SQLite 落库           | 部署上线与域名     |

「不包含」不是砍需求，是**把毕业项目的边界画清楚**：上面左列全部跑通，你就独立做出了一个 AI 应用；右列每一项都是你之后自己就能加的零件。

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

**前置：** 安装 Node.js **≥ 22.5**（进度存储用内置的 `node:sqlite`，免编译依赖）。先验证：

```bash
node --version   # 必须 ≥ v22.5
```

然后三行命令把空壳跑起来：

```
npx create-next-app teaching-platform
cd teaching-platform
npm run dev
```

浏览器打开 `localhost:3000`，看到一个 Next.js 欢迎页。—— 这就是你的起点。

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

第一斧是「一问一答」：模型说完就结束。第二斧升级成「模型说了不算完」——模型可以**点菜**（调用你提供的工具），你把菜端上来（执行工具），它接着往下说。这就是 Agent Loop 的全部秘密：**循环调用，直到模型不再要工具为止。**

| 做什么                                            | 用到的模块   | 建议落点（你自己项目里的文件） |
| ------------------------------------------------- | ------------ | ------------------------------ |
| 把「一次调用」包成「带工具的循环」                | agent-loop   | `src/lib/agent-loop.ts`        |
| 定义出题工具 + 参数 Schema（题目/选项/答案/解析） | tool-calling | `src/lib/quiz-tool.ts`         |
| 工具结果喂回模型，直到产出「讲解 + 测验」         | agent-loop   | 就在上面的循环里               |

注意：右列是**建议你自己项目里的文件名**，不是本平台的文件——本平台的文件你看不到也不该抄，每一行都该照着下面的示范代码自己写出来。

**验收脚本：**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"给我讲讲什么是 System Prompt，讲完出两道选择题"}'
# → 回答先讲透（类比 + 定义 + 例子）
# → 结尾有两道选择题，带选项和答案
# → 服务端日志能看到：模型请求工具 → 你执行 → 结果喂回 → 模型继续说
```

---

### 第三斧：知识 + 数据库 + 点评

**目标：** 搭完 AI 知道你在学什么、学了什么、学得怎么样。

| 做什么                                 | 用到的模块                 | 建议落点（你自己项目里的文件） |
| -------------------------------------- | -------------------------- | ------------------------------ |
| 概念页注入上下文（讲课时只给本讲材料） | rag                        | `src/lib/lecture-context.ts`   |
| SQLite 存掌握度                        | llm-wiki                   | `src/lib/db.ts`                |
| 点评 Agent：按验收清单给作业打维度分   | system-prompt + agent-loop | `src/lib/review.ts`            |

点评 Agent 是闭环的最后一块：学生交一段作业，系统返回「维度分 + 扣分点 + 改进建议」并落库——这正是你一直在用的「校验点评」步。

**验收脚本：**

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT * FROM mastery').all())"
# → 有记录，分数随学习变化（不需要安装 sqlite3 命令行）

curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"content":"const name = (void 0).name"}'
# → JSON 返回维度分、扣分点、改进建议，并且落库
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

> 📖 **阅读指南：** 下面三段代码对应刚才讲的三板斧。**你不用全看懂**——先扫一眼每段的标题，知道它在对应哪一斧，然后只关注每段里标注了 ①②③ 的关键行。其余的都是"抄过去就能跑"的固定写法。

| 刚才讲的概念        | 对应下面哪段代码                           | 你只需要看清                                       |
| ------------------- | ------------------------------------------ | -------------------------------------------------- |
| 第一斧：对话骨架    | 后端 route.ts + 前端打字机                 | `fetch()` 调用 + `reader.read()` 循环              |
| 第二斧：多步 Agent  | agent-loop.ts                              | `for (let step = 0; ...)` 这行 + `tool_calls` 判断 |
| 第三斧：知识+数据库 | （代码里有 SQLite 示例，篇幅关系不重复贴） | Schema 约束 + 落库逻辑                             |

---

### 第一斧实抄：后端 `src/app/api/chat/route.ts`

> 🎯 这是 "LLM API 入门" 那讲的真实落地版。你不需要重新理解——你已经见过 `messages`、`system prompt`、`stream: true`。

```typescript
// ① API Route：收到学生消息，用原始 fetch 调大模型，把 SSE 流桥接到前端
export async function POST(req: Request) {
  const { content } = await req.json();
  const apiKey = process.env.ARK_API_KEY!;
  const model = "deepseek-v4-flash-ga-260731";
  const baseUrl = "https://ark.cn-beijing.volces.com/api/v3";

  // ② 用原始 fetch 直连大模型 API —— 不靠任何 SDK 封装
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    // ③ JSON.stringify：把 JS 对象序列化成 wire format
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是教学导师，只讲学习相关内容。" },
        { role: "user", content },
      ],
      stream: true, // 让模型逐字吐，而不是憋一整段
    }),
  });

  if (!upstream.ok) {
    return Response.json(
      { error: `模型请求失败：HTTP ${upstream.status}` },
      { status: 502 },
    );
  }

  // ④ 把模型的 SSE 流原样桥接给前端 —— new Response 是内置的，不需要 import
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 第一斧实抄：前端打字机渲染

> 🎯 这一段就是让文字"一个个蹦出来"的代码。核心就两行：`reader.read()` 拿数据 + `JSON.parse` 取文字。

```typescript
// ⑤ 前端用 fetch POST 到你的 /api/chat，然后用 reader 逐块读 SSE 响应
async function sendMessage(content: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok || !response.body) return;

  // ⑥ getReader：拿到 ReadableStream 的读取器
  const reader = response.body.getReader();
  // ⑦ TextDecoder：把 Uint8Array 字节块解码成 JS 字符串
  const decoder = new TextDecoder();
  let buffer = "";

  // ⑧ reader.read() 循环：逐块读取，done 为 true 时流结束
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // ⑨ stream: true 让 decoder 跨 chunk 保留不完整的多字节字符
    buffer += decoder.decode(value, { stream: true });

    // ⑩ SSE 行解析：每个 data: 行就是一个模型吐出的 token
    const lines = buffer.split("\n");
    // 最后一行可能是不完整的 chunk，留着下次拼
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6); // 去掉 "data: " 前缀
      if (data === "[DONE]") break; // ⑪ [DONE] 是 SSE 协议里的流结束信号

      const parsed = JSON.parse(data);
      const text = parsed.choices?.[0]?.delta?.content;
      if (text) {
        // ⑫ 把 token 拼到页面上 → 打字机效果
        appendToChat(text);
      }
    }
  }
}
```

### 第二斧实抄：Agent 循环 `src/lib/agent-loop.ts`

> 🎯 第一斧的管线是"调用一次就结束"。第二斧在它外面**套一层循环**：模型如果要工具，你执行工具、把结果喂回去，再问一次——直到模型不再要工具。**只看 `for (let step = 0; ...)` 和 `if (!choice.message.tool_calls)` 这两处就行。**

```typescript
// ① 工具定义：出题 Agent 的「手」。参数用 JSON Schema 钉死——
//    模型只能按这个形状出题（题目/选项/答案/解析），这就是 Schema 约束输出
const quizTool = {
  type: "function",
  function: {
    name: "make_quiz",
    description: "出一道考察当前概念的选择题",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "题干" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "四个选项",
        },
        answer: { type: "string", description: "正确选项，如 B" },
        explanation: { type: "string", description: "解析：为什么选它" },
      },
      required: ["question", "options", "answer", "explanation"],
    },
  },
};

// ② Agent 循环本体
export async function runAgentLoop(
  messages: { role: string; content: string }[],
): Promise<string> {
  for (let step = 0; step < 5; step++) {
    // 和第一斧同一个 fetch，多传一个 tools 数组
    const res = await fetch(
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ARK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash-ga-260731",
          messages,
          tools: [quizTool], // ③ 告诉模型：你有一件工具可点
        }),
      },
    );
    // ⑦ 先查状态码再解析：上游 4xx/5xx 时 res.json() 会抛出难懂的错，
    //    早点抛出可读的错误（点评 Agent 会按「边界处理」维度查这一行）
    if (!res.ok) {
      return `模型请求失败：HTTP ${res.status}`;
    }
    const choice = (await res.json()).choices[0];

    // ④ 模型没要工具 = 它说完了，返回最终讲解
    if (!choice.message.tool_calls) return choice.message.content;

    // ⑤ 模型要了工具：执行它（出题），把结果喂回去，循环再问
    messages.push(choice.message); // 别丢掉模型这句「我要工具」
    for (const call of choice.message.tool_calls) {
      // ⑧ 工具参数解析也要兜底：模型偶尔产出不合 Schema 的参数，
      //    一处 JSON.parse 抛异常会打断整个循环
      let quiz: Record<string, unknown>;
      try {
        quiz = JSON.parse(call.function.arguments);
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: "参数不是合法 JSON" }),
        });
        continue;
      }
      // 真实项目里在这里存库、返回题 id
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ ok: true, quiz }),
      });
    }
    // ⑥ 带着工具结果回到循环开头，再问模型一次
  }
  return "（本轮讲解已结束）";
}
```

读这段代码只需要记住一件事：**Agent 不是更聪明的模型，是「会点菜的普通模型 + 一个愿意端菜的循环」。** 第二斧验收脚本里「服务端日志能看到模型请求工具」，看到的就是这五步在转。

### 管线全景

```
浏览器 sendMessage()
  → fetch POST /api/chat（前端 ⑤）
    → API Route POST（后端 ①）
      → fetch POST https://ark.../chat/completions（后端 ②③）
        → 模型逐字返回 SSE data: 行
      ← new Response(upstream.body)（后端 ④）
    ← 响应体 = SSE 流
  → reader.read() 循环（前端 ⑥⑦⑧⑨）
    → 按 \n 拆行，认 data: 前缀（⑩）
    → JSON.parse 取 delta.content（⑪⑫）
      → 逐字拼到 DOM → 打字机
```

**这 12 个标注就是第一斧的全部原料。** 没有 `import { callLLM }`，没有 `new OpenAI()`，每一个 `fetch`、每一个 `reader.read()`、每一个 `new TextDecoder()` 都是你亲手写的 —— 这就是「原始管线」。

## 动手任务：最终验收

三斧全绿 + 龙骨连线完整 = **达标**。

不是选择题得分。是这套东西真的在 `localhost:3000` 上跑着：

- [ ] 能跟 AI 实时对话（SSE 流式，打字机渲染）
- [ ] AI 被 System Prompt 约束为教学导师，不讲无关内容
- [ ] Agent 能多步输出：讲概念 → 给示范 → 出测验题
- [ ] 出题 Agent 输出的题目符合 Schema（有选项、有答案、有解析）
- [ ] **点评 Agent：交一段作业能拿到维度分、扣分点、改进建议，且落库**
- [ ] SQLite 记录学习进度，刷新不丢
- [ ] 页面导航完整：首页 → 学习中心 → 工作区 → 沙箱 → 设置

**提交什么给点评导师：** 回到课程页的「结算」阶段，把 `agent-loop.ts` 全文贴进「交付与检验单」编辑器，点 **「提交点评」**——点评导师按评分维度出正式检验单（维度分、扣分点、改进建议，并计入掌握度），不需要交整个工程：

1. `agent-loop.ts` 全文——第二斧的循环是整个平台的发动机，导师重点看它；
2. `route.ts` 不用整份贴——用一句话说明「照第一斧示范抄的，改动点是某某」即可；验收清单的逐条自查（每条 ✓/✗ 加一句话证据）贴在对话里，与导师逐条核对。

你交的不是「作业」，是一台车的出厂检验单。

---

## 🎯 结算

你从 `npx create-next-app` 开始，一行一行搭出来的。

LLM API 那一讲你第一次调通了 `chat.completions.create`。System Prompt 那一讲你第一次写了一段让 AI 变老师的提示词。Agent Loop 那一讲你第一次看着 Agent 自己推了三步。

现在它们全都连在一起了。

**这不是学完 10 个模块的毕业设计。这是你前面每学一个零件时，就已经在为这台车拧螺丝。**

你已经会造了。剩下的只是拧多少颗螺丝的问题。
