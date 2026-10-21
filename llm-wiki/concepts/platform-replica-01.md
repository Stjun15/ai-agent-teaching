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

> 🔖 **存档检查点**：第一斧做完了。你的 AI 现在能实时聊天了。这是第一个重大里程碑——**立刻存档**：
> ```bash
> git add -A && git commit -m "第一斧完成：对话骨架，SSE 流式打字机"
> ```
> 万一第二斧改崩了 Agent Loop，`git checkout .` 一秒回到这里。后面每一斧做完都存档——你不用记，这里每次都提醒。

---
