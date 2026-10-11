---
type: concept
last_updated: 2026-10-08
id: platform-replica
name: 教学平台复刻
prerequisites: [ai-safety]
difficulty: 5
estimated_time: 180min
tags: [core, integration, project]
---

# 教学平台复刻

## 定义（开始前先看！）

「教学平台复刻」= 用本课程前 11 个模块教的每一个技术零件（LLM API、System Prompt、Agent Loop、Tool Calling、RAG、LLM Wiki、SQLite），从零搭出一个**能跑的单机版 AI 教学平台**。

它是课程的总验收：不是选择题得分，而是「你能不能独立做一个 AI 应用」的试金石。复刻的对象就是**你正在用的这个平台本身**——学什么就造什么，造什么就验证什么。

**单机版包含 / 不包含**（先说清楚，避免错误期待）：

| 包含（三板斧产出）           | 不包含（进阶方向） |
| ---------------------------- | ------------------ |
| 对话 + SSE 流式打字机        | 可视化场景播放     |
| 多步 Agent + 出题 Agent      | 多用户与登录体系   |
| 点评 Agent（作业按维度打分） | 学习报告与错题本   |
| 掌握度 SQLite 落库           | 部署上线与域名     |

「不包含」不是砍需求，是**把毕业项目的边界画清楚**：上面左列全部跑通，你就独立做出了一个 AI 应用；右列每一项都是你之后自己就能加的零件。

---

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

（下面的先不要看，先尝试自己做+问AI）

具体做法答案

### 启动台

#### 这一节的目标

在你的电脑上跑起一个空白的 Next.js 项目，浏览器打开 `localhost:3000` 能看到一个欢迎页。

#### 前置知识速查

在敲命令之前，先搞清楚这几个词是什么意思。你不需要背，扫一遍有个印象就行——后面每用到一个，都会再解释。

| 你可能会困惑的词 | 一句话解释                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **终端**         | 你电脑上那个黑底白字的窗口。Windows 上叫 PowerShell 或 CMD，Mac 上叫 Terminal。你在里面敲命令，电脑执行。                    |
| **Node.js**      | 一个让 JavaScript 在你电脑上（而不是浏览器里）运行的程序。本项目的所有代码都靠它跑。                                         |
| **npm**          | Node.js 自带的「包管理器」。你用它安装别人写好的代码库（比如 Next.js）。敲 `npm install xxx` 就是「帮我把 xxx 装到项目里」。 |
| **npx**          | npm 的兄弟工具。区别是：`npm` 装到项目里永久留着，`npx` 是「临时下载、跑一次、用完就扔」。`create-next-app` 就用 npx 跑。    |
| **Next.js**      | 一个帮你快速搭建网站的工具（框架）。它帮你处理了「用户访问哪个网址该显示哪个页面」这种麻烦事。                               |

#### 第一步：检查 Node.js 是否已安装

打开终端（Windows：按 `Win + R`，输入 `powershell`，回车。Mac：按 `Cmd + 空格`，输入 `Terminal`，回车），输入：

```bash
node --version
```

你会看到类似 `v22.5.0` 的输出。**版本号必须 ≥ v22.5**——因为后面存学习进度用到的 `node:sqlite` 是 Node.js 22.5 才内置的功能，低版本没有。

如果终端提示 `'node' 不是内部或外部命令`，说明你还没装 Node.js，跳到下一步去装。

#### 第二步：安装 Node.js（如果还没装）

1. 打开浏览器，访问 **https://nodejs.org**
2. 页面上有两个大按钮：左边是 LTS（长期支持版，推荐），右边是 Current（最新版）。**点左边的 LTS**，下载安装包。
3. 下载完后双击安装包，一路点「Next」（Windows）或「Continue」（Mac），全部用默认选项即可。
4. 安装完成后，**关掉终端重新打开**（这步很关键——不重开终端认不到新装的 Node.js）。
5. 再敲一次 `node --version`，确认版本号 ≥ v22.5。

> **注意：** 截至 2026 年 10 月，Node.js LTS 版本为 22.x。如果你看到 24.x 或更高版本的 LTS，同样可以用——只要 ≥ 22.5 就行。

#### 第三步：创建项目

在终端里，先 `cd` 到你放项目的文件夹。比如你想把项目放在桌面：

```bash
cd ~/Desktop
```

然后敲下面这行命令创建项目：

```bash
npx create-next-app teaching-platform
```

你会看到终端里哗啦啦跑过一堆文字，这是在下载 Next.js 的模板代码。过程中会问你几个问题：

| 终端问你的问题                                        | 你应该选什么 | 为什么                                                                                               |
| ----------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| Would you like to use TypeScript?                     | **Yes**      | TypeScript 是带「类型检查」的 JavaScript。你之前学 TS 基础就是为这个——代码写错时编辑器会标红提醒你。 |
| Would you like to use ESLint?                         | **Yes**      | ESLint 帮你检查代码风格，比如多了没用的变量会提示你删掉。                                            |
| Would you like to use Tailwind CSS?                   | **Yes**      | Tailwind 是写样式的工具。你不用学它——需要改颜色改间距时直接把示范代码抄过去就行。                    |
| Would you like to use `src/` directory?               | **Yes**      | 把源码统一放在 `src/` 文件夹里，结构更清晰。                                                         |
| Would you like to use App Router?                     | **Yes**      | App Router 是 Next.js 的新版路由系统，配合 React Server Components 自动区分服务端/客户端代码。       |
| Would you like to customize the default import alias? | **No**       | 默认的 `@/*` 别名已经够用，不需要改。                                                                |

等终端停下来、重新出现闪烁的光标，说明项目创建好了。

#### 第四步：进入项目并启动

```bash
cd teaching-platform
npm run dev
```

`npm run dev` 的意思是「启动开发服务器」。你会看到类似这样的输出：

```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
```

现在打开浏览器，在地址栏输入 **`http://localhost:3000`**，回车。看到 Next.js 的欢迎页（中间有个大的 "N" logo），说明空壳跑通了。

> **`localhost:3000` 是什么意思？** `localhost` 就是「这台电脑」，`3000` 是端口号（可以理解为门牌号）。你敲 `npm run dev` 时，Next.js 在你的电脑上开了一个小服务器，占用 3000 号门牌。浏览器访问这个地址，就是在跟你电脑上的这个服务器对话。

#### 验收

- [ ] 终端敲 `node --version` 输出版本号 ≥ v22.5
- [ ] `npx create-next-app teaching-platform` 成功创建了项目文件夹
- [ ] `npm run dev` 启动后，浏览器打开 `localhost:3000` 能看到 Next.js 欢迎页

#### 常见问题排查

| 你遇到的问题                                          | 大概率是什么原因                   | 怎么解决                                                                                  |
| ----------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `'node' 不是内部或外部命令`                           | 没装 Node.js，或者装了但没重启终端 | 按上面第二步重装，装完一定要关掉终端重新打开                                              |
| `node --version` 输出版本号 < 22.5                    | 装的是旧版本                       | 去 nodejs.org 下载最新 LTS 版重新安装，新版本会覆盖旧版本                                 |
| `npm run dev` 报错 `Error: listen EADDRINUSE :::3000` | 3000 端口被别的程序占了            | Windows：`npx kill-port 3000`。Mac：`lsof -ti:3000 \| xargs kill`。然后重新 `npm run dev` |
| `npx create-next-app` 跑到一半卡住了                  | 网络问题，下载依赖包超时           | 按 `Ctrl + C` 终止，重新敲一次同样的命令。如果反复卡住，检查网络或换一个 npm 镜像源       |
| 浏览器打开 `localhost:3000` 显示「无法访问此网站」    | 开发服务器没启动，或者终端被你关了 | 确认终端还在跑着 `npm run dev`，确认没有报错信息                                          |
| `create-next-app` 问我问题但我不敢乱选                | 很正常，第一次见这些选项都会懵     | 按上面表格里的推荐选项选就行，所有选项以后都能改                                          |

---

### 第一斧：对话骨架

#### 这一斧的目标

搭完能跟 AI 聊天。你在网页上发一条消息 → 后端把消息转发给大模型 → 大模型逐字回复 → 前端一个字一个字蹦出来（打字机效果）。这一斧是整个平台的**发动机**——后面所有功能都是在这个发动机上加零件。

#### 前置知识速查

这一斧用到了前两个模块学的内容。如果你已经忘了，这里帮你快速回忆：

| 你学过的概念                  | 在本斧的用途                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **LLM API 调用**              | 你的后端代码通过 HTTP 请求把消息发给大模型，大模型返回回复。这就是「调模型」。                                              |
| **System Prompt**             | 你写给模型的「角色说明书」。比如「你是教学导师，只讲学习相关内容」——模型看到这句话，就会按老师的口吻回答。                  |
| **SSE（Server-Sent Events）** | 一种让服务器「持续推送」数据给浏览器的技术。模型生成一个字，服务器就推一个字，前端收到立刻显示——这就是打字机效果。          |
| **环境变量**                  | 存在 `.env.local` 文件里的配置信息，比如 API Key。代码里通过 `process.env.XXX` 读取。**密钥绝不写在代码里**——这是安全铁律。 |

你需要新建的概念：

| 新概念             | 一句话解释                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **API Route**      | Next.js 里的一种特殊文件。放在 `src/app/api/` 文件夹下，文件名叫 `route.ts`。浏览器访问 `/api/xxx` 时，Next.js 自动执行这个文件里的代码。 |
| **ReadableStream** | 浏览器内置的数据流对象。你把它想象成一根水管——模型那边拧开水龙头，一个字一个字流过来，你在这边拿桶接着。                                  |
| **TextDecoder**    | 浏览器内置的工具，把水管里流过来的字节（计算机认识的 0 和 1）翻译成人类认识的文字。                                                       |

#### 操作总览

| 做什么               | 用到的模块    | 你新建的文件                     |
| -------------------- | ------------- | -------------------------------- |
| 配置 API Key         | —             | `.env.local`                     |
| 封装 LLM 调用        | llm-api       | `src/lib/llm.ts`                 |
| 实现 SSE 流式接口    | —             | `src/app/api/chat/route.ts`      |
| 前端打字机聊天       | —             | `src/components/chat/`           |
| 写教学 System Prompt | system-prompt | `agent-prompts/teaching-chat.ts` |

---

#### 第一步：配置 API Key

在项目根目录（`teaching-platform/` 下）新建一个文件，命名为 **`.env.local`**。在里面写一行：

```
ARK_API_KEY=你的密钥
```

把 `你的密钥` 替换成你在火山方舟平台申请的 API Key。

> **`.env.local` 是什么？** 一个专门存敏感配置的文件。Next.js 会自动读取它，把里面的内容注入到 `process.env` 对象里。**这个文件不能被 Git 上传到网上**——你创建项目时 Next.js 已经自动把它加进了 `.gitignore`，所以不用担心误传。

> **怎么拿到 API Key？** 去火山方舟控制台（console.volcengine.com/ark）注册账号，在「API Key 管理」里创建一个新的 Key，复制下来。Key 是一长串字符串，看起来像 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`。

---

#### 第二步：创建后端 API 路由

在 `src/app/api/chat/` 文件夹下新建 `route.ts`。

> **为什么是这个路径？** Next.js 的约定：`src/app/api/chat/route.ts` → 浏览器访问 `/api/chat` 时执行。`route.ts` 这个文件名是固定的，Next.js 看到它就知道这是一个 API 端点。

把下面这段代码抄进去。**别跳读**——每一行后面都有编号 ①②③……对应下面的逐行讲解。你先抄完，再回头看讲解。

```typescript
// ①
export async function POST(req: Request) {
  // ②
  const { content } = await req.json();
  const apiKey = process.env.ARK_API_KEY!;
  const model = "deepseek-v4-flash-ga-260731";
  const baseUrl = "https://ark.cn-beijing.volces.com/api/v3";

  // ③
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    // ④
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是教学导师，只讲学习相关内容。" },
        { role: "user", content },
      ],
      stream: true,
    }),
  });

  // ⑤
  if (!upstream.ok) {
    return Response.json(
      { error: `模型请求失败：HTTP ${upstream.status}` },
      { status: 502 },
    );
  }

  // ⑥
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

#### 逐行讲解后端代码

看懂这一段，你就真正理解了「调大模型」到底是怎么回事。每一行都不用魔法——你之前学的 LLM API 入门那一讲，就是这段代码的理论版。

| 标注 | 代码                                                                           | 逐行解释                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①    | `export async function POST(req: Request)`                                     | Next.js 的约定：导出一个叫 `POST` 的函数 = 告诉 Next.js「当前端用 POST 方法请求这个地址时，执行这个函数」。`req` 是前端发来的请求对象，里面装着用户说的话。`async` 表示函数里有 `await`（等异步操作完成）。                 |
| ②    | `const { content } = await req.json()`                                         | 前端发来的数据是 JSON 格式的字符串（比如 `{"content":"你好"}`）。`req.json()` 把它解析成 JS 对象，然后 `{ content }` 把对象里的 `content` 字段取出来。所以这行执行完，`content` 变量的值就是用户输入的文字，比如 `"你好"`。 |
| ②    | `const apiKey = process.env.ARK_API_KEY!`                                      | 从环境变量里读 API Key。`process.env` 是 Node.js 提供的全局对象，里面装着 `.env.local` 里的所有配置。末尾的 `!` 是 TypeScript 语法，告诉编译器「我确定这个值不是空的，别报错」。                                            |
| ②    | `const model = "deepseek-v4-flash-ga-260731"`                                  | 告诉火山方舟「我要用哪个模型」。`deepseek-v4-flash` 是 DeepSeek 的速度优先版模型，性价比高，适合教学场景。                                                                                                                  |
| ②    | `const baseUrl = "https://ark.cn-beijing.volces.com/api/v3"`                   | 火山方舟的 API 地址。后面拼上 `/chat/completions` 就是完整的聊天接口地址。                                                                                                                                                  |
| ③    | `const upstream = await fetch(...)`                                            | 用浏览器内置的 `fetch` 函数发 HTTP 请求。`await` 表示「等这个请求返回结果再往下走」。`fetch` 第一个参数是请求地址，第二个参数是请求配置对象。                                                                               |
| ③    | `method: "POST"`                                                               | HTTP 请求方法。POST 表示「我要发送数据给服务器」。发消息给大模型是发送数据，所以用 POST。                                                                                                                                   |
| ③    | `headers: { "Content-Type": "application/json", Authorization: "Bearer xxx" }` | HTTP 请求头。`Content-Type` 告诉服务器「我发的数据是 JSON 格式」。`Authorization` 是身份验证——`Bearer` 后面跟 API Key，服务器凭这个 Key 知道你是谁、有没有权限调模型。                                                      |
| ④    | `body: JSON.stringify({...})`                                                  | HTTP 请求体——你要发给大模型的实际数据。`JSON.stringify` 把 JS 对象转成 JSON 字符串（这是网络传输的标准格式）。                                                                                                              |
| ④    | `model`                                                                        | 同上，指定模型。                                                                                                                                                                                                            |
| ④    | `messages: [{ role: "system", content: "..." }, { role: "user", content }]`    | 消息列表。`role: "system"` 是 System Prompt——给模型定角色。`role: "user"` 是用户说的话。模型会按顺序读完所有消息，然后生成回复。                                                                                            |
| ④    | `stream: true`                                                                 | **关键参数**。设为 `true` 表示「别憋着，生成一个字就发一个字过来」。不设这个参数的话，模型会生成完整回复后一次性返回——前端就只能等很久然后一下子全显示，没有打字机效果。                                                    |
| ⑤    | `if (!upstream.ok) { return Response.json({...}, { status: 502 }) }`           | 错误处理。`upstream.ok` 是 `true` 表示 HTTP 状态码是 200-299（成功）。如果模型 API 挂了（比如 API Key 错了、网络不通），`upstream.ok` 就是 `false`，我们返回一个 502 状态码给前端，告诉它「上游出错了」。                   |
| ⑥    | `return new Response(upstream.body, {...})`                                    | **桥接**——把模型返回的 SSE 流原样转发给前端。`upstream.body` 是模型那边流过来的数据流（一个字一个字地来）。`new Response` 是浏览器内置的构造函数，不需要 import。                                                           |
| ⑥    | `headers: { "Content-Type": "text/event-stream", ... }`                        | 告诉前端「我给你的是 SSE 流（text/event-stream），你要逐块读」。`Cache-Control: no-cache` 禁止浏览器缓存这个响应。`Connection: keep-alive` 保持连接不断开。                                                                 |

**核心要记住的：** 你写的这段代码没有用任何第三方 LLM SDK。没有 `import { OpenAI }`，没有 `new ChatOpenAI()`。就是最原始的 `fetch` + `JSON.stringify`。**LLM API 调用的本质就是一个 HTTP POST 请求**——你把消息打包成 JSON 发过去，模型把回复打包成 JSON 发回来。所谓「SDK」只是帮你省了几行代码，原理一模一样。

---

#### 第三步：创建前端聊天组件

后端写好了，现在写前端——让用户在页面上输入文字、看到 AI 逐字回复。

在 `src/components/` 下新建 `chat/` 文件夹，里面新建 `chat-panel.tsx`。把下面的代码抄进去：

```typescript
"use client";

import { useState } from "react";

export function ChatPanel() {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // ① 把用户消息显示在页面上
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    // ② 发 POST 请求到自己的后端
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: userMessage }),
    });

    if (!response.ok || !response.body) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "请求失败，请稍后重试。" },
      ]);
      setLoading(false);
      return;
    }

    // ③ 获取读取器
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // ④ 先在消息列表里加一个空的 AI 回复，后面逐字往里填
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    // ⑤ 循环读取流
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) {
            // ⑥ 把新 token 追加到 AI 回复的末尾
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                content: last.content + text,
              };
              return updated;
            });
          }
        } catch {
          // 偶有解析失败的行，跳过即可
        }
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === "user"
                ? "ml-auto bg-blue-500 text-white"
                : "bg-gray-100 text-gray-900"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === "assistant" && (
          <div className="text-xs text-gray-400">正在输入...</div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex gap-2 border-t p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题..."
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-blue-500 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          发送
        </button>
      </form>
    </div>
  );
}
```

#### 逐行讲解前端代码

前端代码比后端长，但核心逻辑只有一件事：**发请求 → 逐块读流 → 逐字显示**。

| 标注 | 代码                                                                             | 逐行解释                                                                                                                                                              |
| ---- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —    | `"use client"`                                                                   | Next.js 指令。告诉 Next.js「这个组件里有 `useState`、`onClick` 等浏览器才能运行的代码，不要在服务器上渲染它」。所有聊天组件都需要这一行。                             |
| —    | `useState`                                                                       | React 的「状态」钩子。你可以理解为「一个会触发页面刷新的变量」。普通变量改了值页面不会变，`useState` 改了值页面自动刷新。                                             |
| —    | `const [messages, setMessages] = useState([])`                                   | `messages` 是消息列表（当前值），`setMessages` 是修改它的函数。调用 `setMessages(新值)` 时，React 会用新值重新渲染页面。                                              |
| ①    | `setMessages(prev => [...prev, { role: "user", content: userMessage }])`         | 把用户刚发的话追加到消息列表末尾。`prev` 是当前的消息列表，`[...prev, 新消息]` 是「旧列表 + 新消息」的新数组。然后用 `setMessages` 更新状态，页面立刻显示用户说的话。 |
| ②    | `fetch("/api/chat", { method: "POST", ... })`                                    | 发请求到你刚才写的后端接口。`"/api/chat"` 是相对路径，浏览器会自动拼上 `http://localhost:3000`。和你在后端调大模型 API 的 `fetch` 语法完全一样。                      |
| ③    | `const reader = response.body.getReader()`                                       | 拿到响应体的「读取器」。响应体是一根水管（ReadableStream），`getReader()` 给你一个能逐块从水管里舀水的勺子。                                                          |
| ③    | `const decoder = new TextDecoder()`                                              | 创建文字解码器。水管里流的是字节（0 和 1），`TextDecoder` 把它们翻译成人类认识的文字。                                                                                |
| ④    | `setMessages(prev => [...prev, { role: "assistant", content: "" }])`             | 在消息列表里先占个位——加一条空的 AI 回复，`content` 初始为空字符串。后面每收到一个字就往里拼。                                                                        |
| ⑤    | `while (true) { const { done, value } = await reader.read(); if (done) break; }` | **核心循环**。`reader.read()` 从水管里舀一勺数据。返回的 `done` 是 `true` 表示水流完了。`value` 是舀到的字节块（Uint8Array）。循环一直跑到水流完为止。                |
| ⑤    | `buffer += decoder.decode(value, { stream: true })`                              | 把舀到的字节块解码成文字，追加到 `buffer` 里。`{ stream: true }` 参数告诉解码器「后面还有数据，遇到不完整的字符别急着翻译，留着等下次拼起来」。                       |
| ⑤    | `const lines = buffer.split("\n"); buffer = lines.pop() \|\| ""`                 | SSE 格式是按行分隔的。`split("\n")` 按换行符切成多行。`lines.pop()` 移除最后一行（它可能不完整，留着下次拼），剩下的都是完整的行。                                    |
| ⑤    | `if (!trimmed \|\| !trimmed.startsWith("data: ")) continue`                      | SSE 协议规定：有效数据行以 `data: ` 开头。空行和以 `:` 开头的注释行全部跳过。                                                                                         |
| ⑤    | `const data = trimmed.slice(6)`                                                  | 去掉 `"data: "` 这 6 个字符的前缀，剩下的就是真正的 JSON 数据。                                                                                                       |
| ⑤    | `if (data === "[DONE]") break`                                                   | `[DONE]` 是 SSE 协议规定的流结束信号。看到它就知道模型说完了，退出循环。                                                                                              |
| ⑤    | `const parsed = JSON.parse(data)`                                                | 把 JSON 字符串解析成 JS 对象。                                                                                                                                        |
| ⑤    | `const text = parsed.choices?.[0]?.delta?.content`                               | 从解析出的对象里取模型生成的文字。`?.` 是可选链——路径上任何一步是 `null`/`undefined` 都不会报错，直接返回 `undefined`。                                               |
| ⑥    | `setMessages(prev => { ... last.content + text })`                               | 把新收到的 token 追加到最后一条消息（就是刚才占位的 AI 回复）的 `content` 后面。React 检测到状态变化→重新渲染→页面上多了一个字→**打字机效果**。                       |

**核心要记住的：** 打字机效果不是魔法。就是后端把大模型的 SSE 流桥接过来，前端用 `reader.read()` 循环读、读到一个字就拼到页面上。全过程没有任何第三方库——`getReader`、`TextDecoder`、`ReadableStream` 全部是浏览器内置的。

---

#### 第四步：写教学 System Prompt

在项目根目录新建 `agent-prompts/` 文件夹，里面新建 `teaching-chat.ts`：

```typescript
export const TEACHING_SYSTEM_PROMPT = `你是「AI 教学平台」的教学导师。

你的职责：
1. 用通俗易懂的语言讲解概念，多用类比和生活例子
2. 每个概念讲完后，给一段能跑的示范代码
3. 学生问什么你答什么，不要讲无关内容
4. 如果学生表示不理解，换一种方式重新解释，而不是重复原话

你不做：
- 不讲政治、暴力、色情等敏感内容
- 不帮学生写完整的项目作业（可以给思路，不能给全量代码）
- 不扮演除教学导师以外的角色`;
```

> **System Prompt 写多长合适？** 上面这段是起步版。随着你后面学 Agent Loop 和 Tool Calling，这个 Prompt 还会加内容。起步阶段先确保模型「知道自己是老师」就行。

---

#### 第五步：让 AI 导师用上 System Prompt

回到 `route.ts`，把原来写死的 System Prompt 替换成 import：

```typescript
import { TEACHING_SYSTEM_PROMPT } from "@/../agent-prompts/teaching-chat";

// 把原来 messages 数组里的
{ role: "system", content: "你是教学导师，只讲学习相关内容。" }
// 改成
{ role: "system", content: TEACHING_SYSTEM_PROMPT }
```

---

#### 第六步：把聊天组件挂到首页

修改 `src/app/page.tsx`，把原来的 Next.js 欢迎页内容替换成你的聊天组件：

```typescript
import { ChatPanel } from "@/components/chat/chat-panel";

export default function Home() {
  return (
    <main className="flex h-screen flex-col">
      <header className="border-b px-6 py-3">
        <h1 className="text-lg font-semibold">AI 教学平台</h1>
      </header>
      <ChatPanel />
    </main>
  );
}
```

现在打开浏览器访问 `localhost:3000`，你应该能看到一个聊天界面。输入「你好，请介绍一下你自己」，AI 应该以教学导师的身份回复你，并且文字是逐字蹦出来的。

---

#### 验收

在终端运行（**另开一个终端窗口**，不要关掉 `npm run dev` 那个）：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"你好，请介绍一下你自己"}'
```

预期结果：

- [ ] HTTP 状态码 200
- [ ] 返回的是 SSE 流式数据（一行一行的 `data: {...}`）
- [ ] AI 回复的角色是「教学导师」（提到了教学相关的内容）
- [ ] 前端页面输入消息后，AI 逐字回复（打字机效果）

> **`curl` 是什么？** 一个在终端里发 HTTP 请求的工具。`-X POST` 指定请求方法，`-H` 添加请求头，`-d` 指定请求体。它相当于「终端版的浏览器」。Windows 的 PowerShell 里自带了 curl。

#### 常见问题排查

| 你遇到的问题                                      | 大概率是什么原因                                       | 怎么解决                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前端返回「请求失败，请稍后重试」                  | API Key 没配或配错了                                   | 检查 `.env.local` 里 `ARK_API_KEY=你的密钥` 是否正确。注意：等号两边**不能有空格**。改完后重启 `npm run dev`（`.env.local` 的改动需要重启才生效） |
| 后端终端报 `process.env.ARK_API_KEY is undefined` | `.env.local` 不在项目根目录                            | `.env.local` 必须在 `teaching-platform/` 的根目录下，和 `package.json` 同级                                                                       |
| 前端发消息后 AI 没回复，但也没报错                | 模型 API 调用失败但被静默了                            | 在 `route.ts` 的 `if (!upstream.ok)` 块里加一行 `console.error(await upstream.text())` 看具体报错                                                 |
| AI 回复了但不是教学导师的口吻                     | System Prompt 没生效                                   | 确认 `route.ts` 里 import 了 `TEACHING_SYSTEM_PROMPT`，且 messages 数组里 `role: "system"` 那条用的是它                                           |
| `curl` 命令报 `curl: (7) Failed to connect`       | 开发服务器没启动                                       | 确认 `npm run dev` 在另一个终端里正在跑                                                                                                           |
| AI 回复一次性全部显示，没有打字机效果             | `stream: true` 没设，或前端 `reader.read()` 逻辑没写对 | 检查后端 `body` 里 `stream: true`。检查前端 `while(true)` 循环和 `setMessages` 逐字追加逻辑                                                       |

---

### 第二斧：多步 Agent

#### 这一斧的目标

第一斧的 AI 是「一问一答」——你说一句，它回一句，对话结束。第二斧升级成**多步循环**：AI 收到你的消息后，不直接回复，而是先想「我是不是该出几道题？」→ 它调用你提供的「出题工具」→ 你把题目生成好、喂回给它 → 它拿着题目继续讲解。

这就是 Agent Loop：**模型调用工具 → 你执行工具 → 结果喂回模型 → 模型再决定继续调用还是结束**。循环往复，直到模型认为任务完成。

#### 前置知识速查

| 你学过的概念     | 在本斧的用途                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **Agent Loop**   | 整个第二斧就是 Agent Loop 的实操。第一斧调一次就结束，第二斧在外面套一层 `for` 循环——这就是 Agent。    |
| **Tool Calling** | 你给模型定义「工具」（一个带参数的函数），模型决定要不要调用、用什么参数调。你执行工具，把结果还给它。 |

你可能困惑的新概念：

| 新概念            | 一句话解释                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tool Schema**   | 用 JSON Schema 格式描述一个工具的「说明书」：工具名叫什么、干什么用的、接受什么参数、每个参数是什么类型。模型读到这份说明书就知道该怎么用它。 |
| **tool_call**     | 模型返回的消息里如果包含 `tool_calls` 字段，说明模型「想用工具」。每条 `tool_call` 包含工具名和参数。                                         |
| **tool 角色消息** | 你执行完工具后，需要把结果包装成 `{ role: "tool", tool_call_id: "...", content: "..." }` 格式喂回给模型。模型根据这个结果决定下一步做什么。   |

---

#### 第一步：定义出题工具

新建 `src/lib/quiz-tool.ts`：

```typescript
export const quizTool = {
  type: "function" as const,
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
```

**逐行讲解：**

| 关键字段            | 含义                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `type: "function"`  | 告诉模型「这是一个可调用的函数工具」（另一种是 `"code_interpreter"`，本课程不用）。                               |
| `name: "make_quiz"` | 工具的「名字」。模型在回复中会写「我要调用 `make_quiz`」。                                                        |
| `description`       | 工具的「用途说明」。模型根据这段描述判断「现在该不该用这个工具」。                                                |
| `parameters`        | 工具的「参数说明书」——用 **JSON Schema** 格式写明每个参数的名字、类型、是否必填。模型会严格按这个 Schema 填参数。 |
| `required`          | 必填参数列表。模型调用工具时这些字段一个都不能少——少了模型会自己补，或者报错。                                    |

> **JSON Schema 是什么？** 一种描述 JSON 数据格式的语言。上面的 `parameters` 就是在说：「调用这个工具时必须传一个 JSON 对象，里面必须有 `question`（字符串）、`options`（字符串数组）、`answer`（字符串）、`explanation`（字符串）这四个字段。」模型看懂这份说明书后，生成的工具调用参数一定符合这个格式。

---

#### 第二步：写 Agent 循环

新建 `src/lib/agent-loop.ts`：

```typescript
import { quizTool } from "./quiz-tool";
import { TEACHING_SYSTEM_PROMPT } from "@/../agent-prompts/teaching-chat";

export async function runAgentLoop(userMessage: string): Promise<string> {
  const apiKey = process.env.ARK_API_KEY!;
  const model = "deepseek-v4-flash-ga-260731";
  const baseUrl = "https://ark.cn-beijing.volces.com/api/v3";

  // ① 初始化消息列表：System Prompt + 用户消息
  const messages: {
    role: string;
    content: string;
    tool_calls?: unknown;
    tool_call_id?: string;
    name?: string;
  }[] = [
    { role: "system", content: TEACHING_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // ② Agent Loop：最多循环 5 步，防止死循环
  for (let step = 0; step < 5; step++) {
    // ③ 调大模型（和第一斧的 fetch 一样，多了 tools 参数）
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: [quizTool], // ④ 告诉模型「你可以用这个工具」
      }),
    });

    if (!res.ok) {
      return `模型请求失败：HTTP ${res.status}`;
    }

    const choice = (await res.json()).choices[0];

    // ⑤ 模型没要工具 → 它说完了，返回最终讲解
    if (!choice.message.tool_calls) {
      return choice.message.content;
    }

    // ⑥ 模型要了工具 → 记录模型的 tool_call 消息
    messages.push(choice.message);

    // ⑦ 逐个执行工具调用
    for (const call of choice.message.tool_calls) {
      let quiz: Record<string, unknown>;
      try {
        quiz = JSON.parse(call.function.arguments);
      } catch {
        // ⑧ 工具参数解析失败时，告诉模型「参数不对」
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: "参数不是合法 JSON" }),
        });
        continue;
      }

      // ⑨ 工具执行成功，把结果喂回模型
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ ok: true, quiz }),
      });
    }
    // ⑩ 带着工具结果回到循环开头，再问模型一次
  }

  return "（本轮讲解已结束）";
}
```

#### 逐行讲解 Agent 循环代码

这段代码是整个平台的心脏。看懂它，你就真正理解了 Agent。

| 标注 | 代码                                                                   | 逐行解释                                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①    | `const messages = [{ role: "system", ... }, { role: "user", ... }]`    | 初始消息列表。Agent 的每一轮循环都会往里追加新消息（模型的 tool_call、工具执行结果、模型的最终回复），消息列表越来越长，模型每次都「看完全部历史」再决定下一步。                    |
| ②    | `for (let step = 0; step < 5; step++)`                                 | **Agent Loop 的骨架**。`step < 5` 是安全限制——最多循环 5 次，防止模型一直要工具、永远不结束（死循环）。实际使用中 2-3 步就够了：第 1 步模型决定出题 → 第 2 步拿到题后讲解。         |
| ③    | `fetch(\`${baseUrl}/chat/completions\`, {...})`                        | 和第一斧完全一样的 `fetch` 调用。区别只有一个：多了 `tools` 参数。                                                                                                                  |
| ④    | `tools: [quizTool]`                                                    | 把刚才定义的工具说明书传给模型。模型看到 `tools` 数组后，会在回复中决定「要不要调用工具、调哪个、传什么参数」。不传 `tools` → 模型只能纯文本回复。传了 `tools` → 模型有「手」了。   |
| ⑤    | `if (!choice.message.tool_calls) return choice.message.content`        | **循环的出口**。如果模型这次回复里没有 `tool_calls` 字段，说明它不想用工具了，认为任务已完成。此时直接返回模型的文本回复 `content`，Agent 循环结束。                                |
| ⑥    | `messages.push(choice.message)`                                        | 把模型刚才的话（包含 tool_calls）加入消息历史。注意——这一步**不能省**：API 要求消息历史中 tool_call 消息和 tool 结果消息必须成对出现，否则模型会困惑「我什么时候调过工具？」        |
| ⑦    | `for (const call of choice.message.tool_calls)`                        | 一条模型回复可能同时调用**多个**工具（虽然本例只有一个 `make_quiz`）。遍历每个 tool_call，分别执行。                                                                                |
| ⑧    | `try { quiz = JSON.parse(call.function.arguments) } catch { ... }`     | 防御性编程。模型偶尔会产出不合法的 JSON（极少见但发生过）。用 try-catch 兜底：解析成功就继续，失败就返回错误信息给模型，模型看到错误后会自己修正。                                  |
| ⑨    | `messages.push({ role: "tool", tool_call_id: call.id, content: ... })` | 把工具执行结果喂回消息历史。`role: "tool"` 告诉模型「这是工具返回的结果」。`tool_call_id` 必须和上一步 tool_call 的 `id` 一致——模型靠这个 ID 匹配「哪个结果对应哪次调用」。         |
| ⑩    | `// 循环回到 for 开头`                                                 | `for` 循环不是执行完就结束——执行到末尾后，自动跳回开头，`step` 加 1，再来一次。模型看到第 ⑦ 步 push 进去的工具结果后，第 ③ 步再次调 API——这次模型可能会说「题目出好了，我来讲解」。 |

**用故事理解 Agent Loop：**

```
你（用户）：给我讲讲什么是闭包，然后出两道选择题考我。

模型（第 1 步）：「我要先讲概念，讲完再出题。
  但我需要题目——调用 make_quiz 工具。
  参数：question="...", options=[...], answer="...", explanation="..."」

你（Agent Loop）：收到。执行 make_quiz，返回题目数据。

模型（第 2 步）：「题目有了。现在把概念讲解和题目一起输出。」
  → 最终回复（纯文本，没有 tool_calls）

Agent Loop 检测到没有 tool_calls → 循环结束 → 返回讲解给前端。
```

**核心要记住的：** Agent 不是更聪明的模型。Agent = 普通模型 + 一个愿意端菜的循环。模型说「我要工具」，你执行工具把菜端上来。模型吃完菜接着说。就这么简单。

---

#### 第三步：把 Agent Loop 接入 API 路由

修改 `src/app/api/chat/route.ts`，把原来第一斧的直接调用替换为 Agent Loop：

```typescript
import { runAgentLoop } from "@/lib/agent-loop";

export async function POST(req: Request) {
  const { content } = await req.json();

  // 不再直接调大模型，而是走 Agent Loop
  const answer = await runAgentLoop(content);

  // Agent Loop 返回的是一整段完整文本，不是流
  // 简单起见先返回纯文本，后面可以改回流式
  return Response.json({ content: answer });
}
```

> **注意：** 这个简化版不再支持 SSE 流式。因为 Agent Loop 多步循环期间模型需要来回调用工具，中间步骤的 token 无法确定最终会保留——第一版先把功能跑通，SSE 流式 Agent 是进阶优化。**先跑通，再优化。**

---

#### 验收

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"给我讲讲什么是 System Prompt，讲完出两道选择题"}'
```

预期结果：

- [ ] AI 先讲清楚概念（类比 + 定义 + 例子）
- [ ] 结尾有两道选择题，带选项和答案
- [ ] 服务端终端日志能看到：模型请求工具 → 工具被执行 → 结果喂回 → 模型继续讲

---

#### 常见问题排查

| 你遇到的问题                  | 大概率是什么原因                                  | 怎么解决                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI 只讲概念，没有出题         | 模型没有调用工具                                  | 检查 `tools: [quizTool]` 是否正确传入。检查 `quizTool` 的 `description` 是否清晰描述了「什么时候该用」。可以在 System Prompt 里加一句「讲解结束时调用 make_quiz 出题」 |
| Agent Loop 返回空内容         | `choice.message.tool_calls` 存在但 `content` 为空 | 这是正常的——当模型调用工具时，`content` 可能为 `null` 或空。确认你的代码里 `if (!choice.message.tool_calls)` 判断能正确处理这种情况                                    |
| 循环只跑了一步就结束了        | 模型在一次调用中把讲解和 tool_call 一起返回了     | 检查 `if (!choice.message.tool_calls)` 的时机——确保先 push tool_call 消息和结果，再进入下一轮循环                                                                      |
| `tool_call_id` 对不上导致报错 | 你没有把 `choice.message` push 进消息历史         | 在遍历 tool_calls 之前，必须先 `messages.push(choice.message)`——API 要求 tool_call 消息出现在对应的 tool 结果消息之前                                                  |

---

### 第三斧：知识 + 数据库 + 点评

#### 这一斧的目标

搭完 AI 知道三件事：**你在学什么**（RAG 注入讲稿）、**你学了什么**（SQLite 存掌握度）、**你学得怎么样**（点评 Agent 打分）。

#### 前置知识速查

| 你学过的概念   | 在本斧的用途                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **RAG**        | 检索增强生成。在调大模型之前，先从教材库里捞出当前模块的讲稿，塞进 System Prompt——模型就能「照着教材讲」。                           |
| **LLM Wiki**   | 教材库的结构。每个模块的概念页（`llm-wiki/concepts/xxx.md`）就是 RAG 的知识来源。                                                    |
| **SQLite**     | 一个轻量级数据库。你的进度数据（学了哪些模块、每个模块的得分）存在这里。Node.js 22.5+ 内置了 `node:sqlite`，不需要额外安装任何东西。 |
| **点评 Agent** | 一个带上评分维度的 System Prompt + Agent Loop。学生交作业，Agent 按维度打分，返回扣分点和改进建议。                                  |

---

#### 第一步：注入讲稿上下文（RAG）

新建 `src/lib/lecture-context.ts`：

```typescript
import fs from "node:fs";
import path from "node:path";

/**
 * 读取指定模块的讲稿内容
 * @param moduleId - 模块的 id，如 "llm-api"、"system-prompt"
 * @returns 讲稿的 Markdown 原文，找不到则返回 undefined
 */
export function loadLectureContent(moduleId: string): string | undefined {
  // 讲稿放在项目根目录的 llm-wiki/concepts/ 下
  const filePath = path.join(
    process.cwd(),
    "llm-wiki",
    "concepts",
    `${moduleId}.md`,
  );

  if (!fs.existsSync(filePath)) return undefined;

  // 读取整个文件内容
  const raw = fs.readFileSync(filePath, "utf-8");

  // 去掉 YAML front matter（文件头部的 --- 块）
  // 它是给平台程序读的元数据，不需要喂给模型
  const contentStart = raw.indexOf("---", 3);
  if (contentStart !== -1) {
    return raw.slice(contentStart + 3).trim();
  }

  return raw;
}
```

**逐行讲解：**

| 关键点                               | 解释                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `node:fs` / `node:path`              | Node.js 内置的文件系统模块。`fs` 用来读写文件，`path` 用来拼接文件路径。`node:` 前缀是 Node.js 的约定，表示「这是内置模块，不是 npm 包」。 |
| `process.cwd()`                      | 当前工作目录——就是你启动 `npm run dev` 的那个文件夹（项目根目录）。                                                                        |
| `fs.existsSync(filePath)`            | 检查文件是否存在。`Sync` 后缀表示同步操作——代码会停下来等文件系统返回结果再继续。                                                          |
| `fs.readFileSync(filePath, "utf-8")` | 读取文件的全部内容，以 UTF-8 编码（支持中文）返回字符串。                                                                                  |
| YAML front matter                    | Markdown 文件顶部的 `---` 包裹区域，包含 `type`、`id`、`tags` 等元数据。这些是给程序读的配置，喂给模型只会浪费 token，所以要去掉。         |

然后在 `route.ts` 或 `agent-loop.ts` 的 System Prompt 里注入讲稿：

```typescript
import { loadLectureContent } from "@/lib/lecture-context";

// 假设当前正在学 "llm-api" 这个模块
const lecture = loadLectureContent("llm-api");

const systemPrompt = lecture
  ? `${TEACHING_SYSTEM_PROMPT}\n\n【本讲参考资料】\n${lecture}`
  : TEACHING_SYSTEM_PROMPT;
```

**原理：** RAG 的核心就是这句话——**「调模型之前，把参考资料塞进 System Prompt」**。模型看到参考资料后，回复会严格基于资料内容，而不是靠「记忆」瞎编。

---

#### 第二步：SQLite 存掌握度

新建 `src/lib/db.ts`：

```typescript
import { DatabaseSync } from "node:sqlite";

// ① 创建 / 打开数据库
const db = new DatabaseSync("dev.db");

// ② 建表（如果表不存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS mastery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0,
    dimension_scores TEXT DEFAULT '{}',
    feedback TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ③ 插入或更新掌握度记录
export function upsertMastery(
  moduleId: string,
  score: number,
  dimensionScores: Record<string, number>,
  feedback: string,
) {
  const existing = db
    .prepare("SELECT id FROM mastery WHERE module_id = ?")
    .get(moduleId) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE mastery 
       SET score = ?, dimension_scores = ?, feedback = ?, updated_at = datetime('now')
       WHERE module_id = ?`,
    ).run(score, JSON.stringify(dimensionScores), feedback, moduleId);
  } else {
    db.prepare(
      `INSERT INTO mastery (module_id, score, dimension_scores, feedback)
       VALUES (?, ?, ?, ?)`,
    ).run(moduleId, score, JSON.stringify(dimensionScores), feedback);
  }
}

// ④ 查询所有掌握度记录
export function getAllMastery() {
  return db.prepare("SELECT * FROM mastery ORDER BY updated_at DESC").all();
}

// ⑤ 查询单个模块的掌握度
export function getModuleMastery(moduleId: string) {
  return db
    .prepare("SELECT * FROM mastery WHERE module_id = ?")
    .get(moduleId) as Record<string, unknown> | undefined;
}
```

**逐行讲解：**

| 标注 | 代码                                       | 解释                                                                                                                                  |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| ①    | `new DatabaseSync("dev.db")`               | `DatabaseSync` 是 Node.js 22.5+ 内置的 SQLite 驱动。`"dev.db"` 是数据库文件名——如果项目根目录没有这个文件，它会自动创建一个。         |
| ②    | `CREATE TABLE IF NOT EXISTS mastery (...)` | SQL 建表语句。`IF NOT EXISTS` 表示「如果表已经存在就不动它」。表名叫 `mastery`（掌握度），有 7 个字段。                               |
| ②    | `score REAL NOT NULL DEFAULT 0`            | `score` 是综合分数（浮点数），默认 0。                                                                                                |
| ②    | `dimension_scores TEXT DEFAULT '{}'`       | 各维度的分数，用 JSON 字符串存（SQLite 没有 JSON 列类型）。比如 `{"正确性": 4, "可读性": 3, "完整性": 5}`。                           |
| ②    | `datetime('now')`                          | SQLite 内置函数，返回当前时间。                                                                                                       |
| ③    | `db.prepare(...).get(moduleId)`            | 「预编译」一条 SQL 语句，然后执行它。`?` 是占位符——`get(moduleId)` 把 `moduleId` 填进去。预编译的好处：防 SQL 注入 + 比字符串拼接快。 |
| ③    | `upsertMastery`                            | `upsert` = update + insert。先查有没有记录：有就更新，没有就插入。这样同一个模块的分数始终只有一条记录，新分数覆盖旧分数。            |
| ④    | `getAllMastery()`                          | 查全部记录，按更新时间倒序排列。用于显示学习进度总览。                                                                                |
| ⑤    | `getModuleMastery(moduleId)`               | 查单个模块的掌握度。用于每次答题后回显当前得分。                                                                                      |

> **为什么用 `node:sqlite` 而不是装 `better-sqlite3`？** `node:sqlite` 是 Node.js 22.5 起内置的模块。不用 `npm install`，不用编译 C++ 代码，不用担心不同操作系统的兼容问题——直接 `import` 就能用。对于单机版教学平台这种场景完全够用。

**验证数据库：**

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT * FROM mastery').all())"
```

如果输出 `[]`（空数组），说明数据库已创建、表已建好，只是还没有记录——正常。

---

#### 第三步：写点评 Agent

新建 `src/lib/review.ts`：

```typescript
import { getModuleMastery, upsertMastery } from "./db";

const REVIEW_SYSTEM_PROMPT = `你是作业点评导师。你的任务是对学生提交的代码作业进行维度化评分。

## 评分维度

对每份作业，你从以下 4 个维度打分（每个维度 1-5 分）：

1. **正确性**：代码能不能跑通？逻辑对不对？
2. **可读性**：变量命名清不清晰？结构乱不乱？
3. **完整性**：有没有缺关键步骤？错误处理做了吗？
4. **规范性**：有没有遵循课程教的代码规范？

## 输出格式

你必须**严格**按以下 JSON 格式输出，不要有任何额外文字：

{
  "dimensions": {
    "正确性": 4,
    "可读性": 3,
    "完整性": 5,
    "规范性": 4
  },
  "deductions": ["可读性扣分：变量名 x1, x2 含义不明确，建议改成 leftOperand, rightOperand"],
  "suggestions": "整体正确，但建议给每个函数加上 JSDoc 注释说明参数和返回值。",
  "overall": 4
}`;

export async function reviewHomework(
  moduleId: string,
  homework: string,
): Promise<string> {
  const apiKey = process.env.ARK_API_KEY!;
  const baseUrl = "https://ark.cn-beijing.volces.com/api/v3";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash-ga-260731",
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        {
          role: "user",
          content: `模块：${moduleId}\n\n学生作业：\n${homework}`,
        },
      ],
      temperature: 0.3, // 低温度让评分更稳定
    }),
  });

  if (!res.ok) {
    return `点评请求失败：HTTP ${res.status}`;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  // 解析模型返回的 JSON，落库
  try {
    const review = JSON.parse(content);
    const overall = review.overall ?? 3;
    const dimensions = review.dimensions ?? {};

    upsertMastery(moduleId, overall, dimensions, JSON.stringify(review));
  } catch {
    // 解析失败不影响返回——学生还能看到原始回复
  }

  return content;
}
```

**逐行讲解：**

| 关键点                        | 解释                                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REVIEW_SYSTEM_PROMPT` 的格式 | System Prompt 里写死了输出格式（JSON Schema + 示例）。模型看到这个 Prompt 后，**大概率**会严格按 JSON 格式输出。后续可以加 Tool Calling 用 Schema 硬约束。 |
| `temperature: 0.3`            | 温度参数。范围 0-2，越低模型越「确定」（每次输出几乎一样），越高越「随机」（每次输出可能不同）。评分场景需要稳定，所以设 0.3。                             |
| `upsertMastery(...)`          | 把评分结果存入数据库。这样学生的每次作业评分都被持久化——刷新页面、重启电脑都不会丢。                                                                       |
| try-catch 包裹 `JSON.parse`   | 模型偶尔会在 JSON 外面包一层 markdown 代码块（\`\`\`json ... \`\`\`），导致 `JSON.parse` 失败。用 try-catch 兜底：解析失败照样返回原始内容给学生看。       |

---

#### 第四步：创建点评 API 路由

新建 `src/app/api/validate/route.ts`：

```typescript
import { reviewHomework } from "@/lib/review";

export async function POST(req: Request) {
  const { content, moduleId } = await req.json();

  if (!content || !moduleId) {
    return Response.json(
      { error: "缺少 content 或 moduleId 参数" },
      { status: 400 },
    );
  }

  const result = await reviewHomework(moduleId, content);
  return Response.json({ result });
}
```

---

#### 验收

**验证知识点注入 + 数据库：**

```bash
# ① 验证数据库能读写
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT * FROM mastery').all())"
# → 先看到空数组 []（表已建好，无记录）

# ② 验证点评 Agent
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"moduleId":"llm-api","content":"const apiKey = process.env.API_KEY; async function chat(msg) { const res = await fetch(\"https://api.example.com/chat\", { method: \"POST\", headers: {\"Authorization\": \"Bearer \" + apiKey}, body: JSON.stringify({message: msg}) }); return res.json(); }"}'
# → 返回 JSON 含维度分、扣分点、改进建议

# ③ 再次查数据库
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT module_id, score FROM mastery').all())"
# → 有记录，包含 module_id 和 score
```

预期结果：

- [ ] AI 回复基于注入的教材内容（不会凭空编造）
- [ ] 点评返回 JSON 格式：维度分 + 扣分点 + 改进建议
- [ ] 数据库有掌握度记录，刷新不丢

---

#### 常见问题排查

| 你遇到的问题                   | 大概率是什么原因           | 怎么解决                                                                                                                 |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `DatabaseSync is not defined`  | Node.js 版本 < 22.5        | `node --version` 确认版本。如果 < 22.5，去 nodejs.org 升级                                                               |
| 点评 Agent 返回的不是 JSON     | 模型没有严格按输出格式返回 | 在 System Prompt 里加强约束。或者后续引入 Tool Calling，用 `response_format: { type: "json_object" }` 参数强制 JSON 输出 |
| `fs.existsSync` 找不到讲稿文件 | 路径拼接不对               | 确认 `llm-wiki/concepts/` 文件夹存在。确认 `moduleId` 和文件名（去掉 `.md`）一致                                         |
| 数据库文件 `dev.db` 找不到     | 文件创建在当前工作目录     | `new DatabaseSync("dev.db")` 会在 `process.cwd()` 下创建文件。确认你在项目根目录启动的 `npm run dev`                     |

---

### 龙骨：页面连线

#### 这一节的目标

把前三斧的功能连成一条完整的用户路径：学生打开网站 → 看到模块列表 → 进入某个模块学习 → 自由对话 → 设置 API Key。

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
沙箱     → /playground     自由对话
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
          href="/playground"
          className="rounded-lg border px-6 py-3 hover:bg-gray-50"
        >
          自由对话
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
  { id: "llm-api", name: "LLM API 入门", desc: "第一次调通大模型" },
  { id: "system-prompt", name: "System Prompt", desc: "让模型按角色说话" },
  { id: "agent-loop", name: "Agent Loop", desc: "模型不止说一句" },
  { id: "tool-calling", name: "Tool Calling", desc: "给模型装上手" },
  { id: "rag", name: "RAG 检索增强", desc: "让模型读教材" },
  { id: "llm-wiki", name: "LLM Wiki", desc: "结构化你的教材库" },
  { id: "sqlite", name: "SQLite 存储", desc: "学习进度不丢失" },
  { id: "ai-safety", name: "AI 安全", desc: "可控的 AI" },
  { id: "platform-replica", name: "教学平台复刻", desc: "从零搭一个平台" },
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

#### 第四步：沙箱 `/playground` 和设置 `/settings`

```typescript
// src/app/playground/page.tsx
import { ChatPanel } from "@/components/chat/chat-panel";

export default function PlaygroundPage() {
  return (
    <main className="flex h-screen flex-col">
      <header className="border-b px-6 py-3">
        <h1 className="text-lg font-semibold">自由对话</h1>
      </header>
      <ChatPanel />
    </main>
  );
}
```

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

- [ ] 浏览器访问 `/` → 看到首页，有「开始学习」和「自由对话」两个入口
- [ ] 点击「开始学习」→ 跳转到 `/learn`，看到 9 个模块卡片
- [ ] 点击任意模块 → 跳转到 `/learn/llm-api`（或对应模块），看到左侧概念区 + 右侧聊天区
- [ ] 访问 `/playground` → 看到自由对话页面
- [ ] 访问 `/settings` → 看到设置页面

---

## 常见误解

| 误解                                                   | 真相                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **复刻 = 照着界面截图搭壳**                            | 复刻的是**管线**：SSE 流式、Agent 多步循环、Schema 约束输出、SQLite 落库。界面只是管线的壳，管线通了界面才有魂。                                                                      |
| **一次把所有功能写完再一起调试**                       | 三板斧的顺序就是防这个。**造一段、跑一段、通了再往下**。攒到最后调试，错误会叠错误——你根本分不清是哪个环节出的问题。                                                                  |
| **AI 输出不稳定是模型不行**                            | 出题 Agent 的输出靠 Tool Schema 钉死、讲解口径靠 System Prompt 约束、流式体验靠 SSE 关缓冲——不稳通常是这三道约束缺了一道。模型本身没问题，是你没给它戴上缰绳。                        |
| **System Prompt 写一次就够了**                         | System Prompt 是活的。Agent Loop 环节你要往里加「什么时候调用工具」的指令；RAG 环节你要往里塞参考资料；点评环节你换一套完全不同的 Prompt。它不是写死的——每个场景有每个场景的 Prompt。 |
| **Agent Loop 一定是 5 步**                             | `step < 5` 是安全上限，不是必须跑满。大多数对话 2-3 步就结束了：模型决定调用工具（第 1 步），你执行并返回结果，模型拿到结果后直接输出最终回复（第 2 步），循环结束。                  |
| **SSE 打字机效果必须用第三方库**                       | 不需要。本文档前端代码里 `response.body.getReader()` + `TextDecoder` + `while(true)` 循环就是打字机的全部实现。三个 API 全部是浏览器内置的，零依赖。                                  |
| **点评 Agent 的 JSON 输出需要 `response_format` 参数** | 不必须。DeepSeek V4 Flash 对 System Prompt 里写的 JSON 格式遵循度很高。`response_format: { type: "json_object" }` 是后续进阶优化——先跑通再优化。                                      |
| **学完前 11 个模块才能开始复刻**                       | 可以边学边造。学完 LLM API 那一讲，你就已经可以写出本文档第一斧的后端 route.ts。每学一个模块，你就往项目里加一个文件。最后全部连起来就是完整平台。                                    |

---

## 示范代码

> **阅读指南：** 下面三段代码对应刚才讲的三板斧。你不用全看懂——先扫一眼每段的标题，知道它在对应哪一斧，然后只关注每段里标注了 ①②③ 的关键行。其余的都是「抄过去就能跑」的固定写法。

| 刚才讲的概念        | 对应下面哪段代码                            | 你只需要看清                                       |
| ------------------- | ------------------------------------------- | -------------------------------------------------- |
| 第一斧：对话骨架    | 后端 route.ts + 前端打字机                  | `fetch()` 调用 + `reader.read()` 循环              |
| 第二斧：多步 Agent  | agent-loop.ts                               | `for (let step = 0; ...)` 这行 + `tool_calls` 判断 |
| 第三斧：知识+数据库 | 数据库 + 点评 Agent（已在第三斧正文中给出） | Schema 约束 + 落库逻辑                             |

> 三段完整代码均已在上文各小节中给出并逐行讲解。如果你跳过了详细讲解直接来看示范代码，**建议回到对应小节先读一遍逐行讲解**——只抄代码不理解原理，遇到 bug 你完全不知道怎么排查。

---

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
2. `route.ts` 不用整份贴——用一句话说明「照第一斧示范抄的，改动点是某某」即可；
3. 验收清单的逐条自查（每条 ✓/✗ 加一句话证据）贴在对话里，与导师逐条核对。

你交的不是「作业」，是一台车的出厂检验单。

---

## 🎯 结算

你从 `npx create-next-app` 开始，一行一行搭出来的。

LLM API 那一讲你第一次调通了 `chat.completions.create`。System Prompt 那一讲你第一次写了一段让 AI 变老师的提示词。Agent Loop 那一讲你第一次看着 Agent 自己推了三步。

现在它们全都连在一起了。

**这不是学完 10 个模块的毕业设计。这是你前面每学一个零件时，就已经在为这台车拧螺丝。**

你已经会造了。剩下的只是拧多少颗螺丝的问题。
