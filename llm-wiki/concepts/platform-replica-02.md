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

> 🤖 **Agent 自查**：不用贴 prompt——给你的 Agent 装一个校验工具。打开右侧「工具箱 → Agent 自查」，按步骤把 `check_agent_loop` 工具的 Schema 和执行函数装到你的 Agent 里。装好后在对话框说「检查 Agent Loop」，Agent 自己审查自己的循环结构和 tool_calls 逻辑。

**🔍 自助验证：**

```bash
# ① Agent Loop + 出题工具
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"给我讲讲什么是 System Prompt，讲完出两道选择题"}'
# → 预期：AI 先讲概念，然后两道选择题（选项 + 答案 + 解析）

# ② 看服务端日志
# → 终端里应该能看到：模型请求工具 → 工具被执行 → 结果喂回 → 模型继续讲
```

**预期结果：**

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
| `tool_call_id` 对不上导致报错 | 你没有把 `choice.message` push 进消息历史          | 在遍历 tool_calls 之前，必须先 `messages.push(choice.message)`——API 要求 tool_call 消息出现在对应的 tool 结果消息之前                                                  |

> 🔖 **存档检查点**：第二斧做完了——你的 Agent 现在是活的，能自己决定什么时候出题、什么时候讲。这才是真正的"AI 应用"：
> ```bash
> git add -A && git commit -m "第二斧完成：Agent Loop，工具调用 + 多步推理"
> ```

---