---
type: concept
last_updated: 2026-09-23
id: ts-basics
name: TypeScript 基础速通
prerequisites: []
difficulty: 1
estimated_time: 30min
tags: [language, typescript, beginner, reading]
---

# TypeScript 基础速通

---

## 为什么需要这一站

你正在用的这个网页，每一个按钮、每一次打字效果，背后都是 TypeScript。后面所有模块的前端代码都是这个味道。这一讲不是要你学会它——**认识最基本的几个词、能看懂一段代码在干嘛，就够了。** 看完开场白就可以进 LLM API，后面遇到看不懂的，随时回来看偷懒版的三招。

---

## 定义：编程这件事

TypeScript 是 JavaScript 的"加护栏版"——比 Python 多打几个字，换来的是：一眼就知道每个变量是什么类型。

```typescript
const name = "小明";
let score = 95;
if (score >= 90) {
  console.log(`${name}，优秀！`);
}
```

↑ 和 Python 长得不一样，但做的事一样：存数据、做判断、输出结果。

---

## 🤔 你想怎么学？

|        | 📚 完整版                         | 🏃 偷懒版                  |
| ------ | --------------------------------- | -------------------------- |
| 时长   | 30 分钟                           | 10 分钟                    |
| 方式   | 6 讲系统学习，覆盖所有基础语法    | 3 招直击要害，只看不背     |
| 内容   | 变量、函数、接口、泛型、异步、JSX | 认关键词 + 认结构 + 读一段 |
| 你会的 | 能系统解释 TS 语法                | 能看懂 TS 代码             |

**选哪个都行。随时可以切回去。**

---

<!-- PATH:LAZY START -->

## 关键点：三招看懂 TypeScript（偷懒版）

### 招一：认关键词 —— 别背，背不完

浏览器的语言只有 JavaScript 和它的"加护栏版" TypeScript。你在这平台看到的所有界面，都是 TS 写的。

```typescript
let / const   → 声明变量（let 可变，const 不可变）
function      → 定义函数
return        → "这个函数的结果是……"
import / export → 借别人的代码 / 把自己的代码给别人用
if / else     → 条件判断
for / while   → 循环
try / catch   → 试一下，错了就兜底
async / await → 异步操作（等一下，做完再继续）
interface     → 字段说明书（规定一个对象里有什么字段）
```

> 遇到不认识的词？问 AI。别查 MDN。查了也记不住。

### 招二：认结构 —— 三种括号 + JSX

```typescript
// 花括号 { } → 对象 或 代码块
const config = { model: "gpt-4o-mini", temperature: 0.7 };  // 对象
if (score > 90) {                                            // 代码块
  return "A";
}

// 方括号 [ ] → 数组
const steps = ["explain", "observe", "imitate"];

// 尖括号 < > → 类型参数（泛型）或 JSX 标签
const list: string[] = ["a", "b"];          // 类型参数
return <div>你好</div>;                     // JSX 标签
```

```
TypeScript 和 HTML 混在一起的时候（JSX）：

return (
  <div className="p-4">          ← HTML 标签，直接写
    <h2>{module.name}</h2>       ← { } 花括号里是 TypeScript 变量
    <button onClick={handleClick}>   ← onClick 驼峰命名
      点我
    </button>
  </div>
);

三条规则：
1. HTML 标签直接写
2. 花括号 { } 里是 TypeScript
3. class → className，onclick → onClick
```

### 招三：读一段真的代码

下面是你打开这个平台时，浏览器真实在跑的代码。用招一和招二的方法逐行看：

```typescript
"use client";          // 这行组件在浏览器里跑

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

function ModuleCard({ id, name, difficulty }: {
  id: string;
  name: string;
  difficulty: number;
}) {
  const router = useRouter();

  return (
    <div
      className="rounded-lg border p-4 hover:bg-accent cursor-pointer"
      onClick={() => router.push(`/learn/${id}`)}
    >
      <h3 className="font-semibold">{name}</h3>
      <p className="text-sm text-muted-foreground">
        难度：{"⭐".repeat(difficulty)}
      </p>
    </div>
  );
}

export default ModuleCard;
```

```
不要求你解释每一行。只要你能说出：

✅ "use client" 是什么
✅ import 了哪几个东西
✅ function 定义了什么组件
✅ return 里写了什么 HTML
✅ onClick 点击后会发生什么

如果能说出这五条 → 你已经有能力看懂这个平台的大多数页面代码了。
```

---

<!-- PATH:LAZY END -->

<!-- PATH:FULL START -->

## 📚 完整版

> **AI：** 这一版是给想"系统掌握"的人准备的。6 讲，每讲 5 分钟。`interface`、`generics`、`Promise<T>`、`useState`、`Zustand`……全部覆盖。准备好了吗？

---

### 第一讲：变量、类型、你不需要记住的类型系统

```typescript
// TypeScript 里声明变量必须用 let 或 const
let count: number = 0; // 可变
const name: string = "AI助教"; // 不可变

// 基础类型
let score: number = 95;
let label: string = "llm-api";
let active: boolean = true;
let data: null = null;
let pending: undefined = undefined;
```

```typescript
// 但你有可能会看到这种写法：
// 联合类型（| = 或）
type Status = "idle" | "loading" | "success" | "error";

// 泛型（<T> = 类型参数，一种"占位符"）
function first<T>(items: T[]): T | undefined {
  return items[0];
}

// 条件类型 + keyof
type PickKeys<T, K extends keyof T> = {
  [P in K]: T[P];
};

// 模板字面量类型
type EventName = `on${Capitalize<string>}`;
// "onClick" | "onChange" | "onSubmit" | ...
```

```
TypeScript 的类型系统图灵完备——
意思是类型本身可以写程序。但你不必成为类型专家。
你只需要知道：冒号 = 类型标注，问号 = 可选，竖线 = 或。
```

---

### 第二讲：函数 — 重载、泛型、回调地狱的终结者

```typescript
// 函数声明
function add(a: number, b: number): number {
  return a + b;
}

// 箭头函数
const greet = (name: string): string => `你好，${name}！`;

// 函数重载（同一个名字，不同参数 → 不同行为）
function process(input: string): string;
function process(input: number): number;
function process(input: string | number): string | number {
  if (typeof input === "string") return input.toUpperCase();
  return input * 2;
}

// 泛型函数（<T> = "我不管是什么类型，反正是某种类型"）
function retry<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
  return fn().catch((error) => {
    if (maxAttempts <= 1) throw error;
    return retry(fn, maxAttempts - 1);
  });
}

// 高阶函数（函数返回函数）
function createMultiplier(factor: number): (n: number) => number {
  return (n: number) => n * factor;
}
const triple = createMultiplier(3);
console.log(triple(5)); // → 15
```

---

### 第三讲：接口、类型别名、泛型约束

```typescript
// interface：规定一个对象该有什么字段
interface Student {
  id: string;
  name: string;
  level: "beginner" | "intermediate" | "advanced";
  completedModules: string[];
  preferences?: {
    // ? = 可选
    language?: "python" | "typescript";
    theme?: "light" | "dark";
  };
}

// 用接口约束函数参数
function enroll(student: Student, moduleId: string): void {
  if (!student.completedModules.includes(moduleId)) {
    console.log(`${student.name} 开始学习 ${moduleId}`);
  }
}

// 泛型约束（<T extends ...> = "T 必须是某种类型"）
function findByName<T extends { name: string }>(
  items: T[],
  name: string,
): T | undefined {
  return items.find((item) => item.name === name);
}

// type 和 interface 可以混合使用
type ModuleId = string;
type StepType =
  | "explain"
  | "observe"
  | "imitate"
  | "validate"
  | "visualize"
  | "practice"
  | "mastery";

interface ModuleStep {
  type: StepType;
  label: string;
  completed: boolean;
}
```

---

### 第四讲：异步 — Promise、async/await、并发

```typescript
// Promise 有三种状态：pending → fulfilled / rejected
function fetchModule(id: string): Promise<{ name: string; steps: number }> {
  return fetch(`/api/modules/${id}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => ({
      name: data.name,
      steps: data.steps.length,
    }));
}

// async/await 是 Promise 的语法糖（看起来更"同步"）
async function loadModule(id: string): Promise<void> {
  try {
    const module = await fetchModule(id);
    console.log(`加载完成：${module.name}（${module.steps} 步）`);
  } catch (error) {
    console.error("加载失败：", error);
  }
}

// 并发（Promise.all = 同时等好几个）
async function loadAll(ids: string[]): Promise<void> {
  const results = await Promise.allSettled(ids.map((id) => fetchModule(id)));

  for (const result of results) {
    if (result.status === "fulfilled") {
      console.log("✅", result.value.name);
    } else {
      console.error("❌", result.reason);
    }
  }
}
```

```
读异步代码的规则：

async function → 此函数内有 await
await         → "停在这里，等 Promise 完成"
Promise.all   → "同时等好几个"
try / catch   → "试一下，错了别崩"
```

---

### 第五讲：React — 组件、状态、副作用、自定义 Hook

```typescript
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// useState：让组件"记住"一个值
function Counter() {
  const [count, setCount] = useState<number>(0);
  //    ↑ 当前值    ↑ 更新函数        ↑ 初始值

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      点击了 {count} 次
    </button>
  );
}

// useEffect：在组件渲染后执行副作用
function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
    return () => { document.title = "AI 编程教学平台"; };  // 清理函数
  }, [title]);  // ← 依赖数组：title 变化时重新执行

  return <h1>{title}</h1>;
}

// useCallback + useMemo：性能优化（缓存函数和计算结果）
function ExpensiveList({ items }: { items: string[] }) {
  const sorted = useMemo(
    () => [...items].sort(),
    [items]   // ← 只在 items 变化时重新排序
  );

  const handleClick = useCallback(
    (item: string) => {
      console.log("点击了", item);
    },
    []  // ← 空依赖 = 永远不会变
  );

  return (
    <ul>
      {sorted.map((item) => (
        <li key={item} onClick={() => handleClick(item)}>
          {item}
        </li>
      ))}
    </ul>
  );
}
```

---

### 第六讲：全局状态 — Zustand、Store、SSE 流式处理

```typescript
import { create } from "zustand";

// Zustand：把状态提升到全局，任何组件都能读写
interface CodeState {
  code: string;
  language: "typescript" | "python";
  setCode: (code: string) => void;
  setLanguage: (language: "typescript" | "python") => void;
}

const useCodeStore = create<CodeState>((set) => ({
  code: "",
  language: "typescript",
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
}));

// 在任何组件里直接用：
function Editor() {
  const code = useCodeStore((state) => state.code);
  const setCode = useCodeStore((state) => state.setCode);

  return (
    <textarea
      value={code}
      onChange={(e) => setCode(e.target.value)}
    />
  );
}
```

```typescript
// SSE 流式处理（Server-Sent Events —— 这个平台怎么实现"逐字输出"）
async function* streamChat(prompt: string): AsyncGenerator<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: prompt }),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("不支持流式响应");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const json = JSON.parse(line.slice(6));
        yield json.content; // ← 一个字一个字地产出
      }
    }
  }
}

// 使用：
// for await (const token of streamChat("什么是 Agent？")) {
//   appendToChat(token);  // 每收到一个字就追加到界面
// }
```

```
读完第六讲的你不会全部记住。这很正常。
这六讲的存在价值不是让你背——是让你在读到这类代码时，
能说出一句："我见过这个，它的大概作用是写界面 / 处理异步 / 管理状态……"
```

---

## 示范代码

下面是你打开这个平台时浏览器真实在跑的代码 —— 一个模块卡片组件。用招一和招二的方法逐行看。

```typescript
// ① "use client" 声明：这个组件只在浏览器里跑，不在服务器上渲染
"use client";

// ② 导入 UI 原子组件和路由工具 —— 从已经写好的零件库里拿
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// ③ 定义组件，Props 用内联类型声明：id、name、difficulty 三个字段
function ModuleCard({ id, name, difficulty }: {
  id: string;                  // 模块的唯一标识，路由跳转时用
  name: string;                // 模块标题
  difficulty: number;          // 难度等级 1–5
}) {
  // ④ useRouter 是 Next.js 的导航 hook，拿来做页面跳转
  const router = useRouter();

  // ⑤ 返回 JSX：一个可以点击的卡片
  return (
    <div
      className="rounded-lg border p-4 hover:bg-accent cursor-pointer"
      onClick={() => router.push(`/learn/${id}`)}   // 点击跳转到学习页面
    >
      <h3 className="font-semibold">{name}</h3>
      <p className="text-sm text-muted-foreground">
        难度：{"⭐".repeat(difficulty)}               {/* 用星星数量表示难度 */}
      </p>
    </div>
  );
}

// ⑥ 导出组件，让其他文件可以 import 使用
export default ModuleCard;
```

## 实践任务

读下面这段代码。这是这个平台真实的 Agent 运行时核心——包含重试、错误恢复、JSON 解析、Zod 校验。

```typescript
import { AGENT_OUTPUT_SCHEMAS } from "@/lib/agent/schemas";
import type { AgentOutputMap, RunAgentOptions } from "@/lib/agent/types";
import { collectCompletion } from "@/lib/agent/llm";
import { composeAgentPrompt } from "@/lib/agent/prompts";
import { extractJson } from "@/lib/agent/json";

type AgentLoopResult<T> = {
  ok: boolean;
  data?: T;
  rawText: string;
  attempts: number;
  usedFallback: boolean;
  tokens: { input: number; output: number };
  durationMs: number;
  error?: string;
};

async function executeAgent<Id extends keyof AgentOutputMap>(
  options: RunAgentOptions<Id> & { maxRetries?: number },
): Promise<AgentLoopResult<AgentOutputMap[Id]>> {
  const {
    agent,
    skill,
    input,
    maxRetries = 1,
    signal,
    env,
    fallback,
  } = options;
  const schema = AGENT_OUTPUT_SCHEMAS[agent];

  const startedAt = Date.now();
  let attempts = 0;
  let rawText = "";
  let tokens = { input: 0, output: 0 };
  let lastError = "";

  for (let i = 0; i <= maxRetries; i++) {
    attempts += 1;

    const { systemPrompt, userMessage } = composeAgentPrompt({
      systemPrompt: agent.systemPrompt,
      skillContent: skill.content,
      input,
      ...(lastError
        ? { previousError: lastError, previousRawText: rawText }
        : {}),
    });

    const turn = await collectCompletion({
      systemPrompt,
      userMessage,
      env,
      signal,
    });

    rawText = turn.text;
    tokens = {
      input: tokens.input + turn.tokens.input,
      output: tokens.output + turn.tokens.output,
    };

    const json = extractJson(turn.text);
    if (json === null) {
      lastError = "输出里找不到 JSON 对象。";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      lastError = `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`;
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return {
        ok: true,
        data: result.data,
        rawText,
        attempts,
        usedFallback: false,
        tokens,
        durationMs: Date.now() - startedAt,
      };
    }

    lastError = `Zod 校验失败：${result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(根)"} ${issue.message}`)
      .join("；")}`;
  }

  const durationMs = Date.now() - startedAt;

  if (fallback) {
    return {
      ok: true,
      data: fallback(),
      rawText,
      attempts,
      usedFallback: true,
      tokens,
      durationMs,
      error: lastError,
    };
  }

  return {
    ok: false,
    rawText,
    attempts,
    usedFallback: false,
    tokens,
    durationMs,
    error: lastError,
  };
}
```

### 标注练习

不要求你写代码。只标注以下要点：

| 检查项                                 | 回答 |
| -------------------------------------- | ---- |
| `import` 从哪里借了东西？              |      |
| `async function` 定义了什么？          |      |
| `for` 循环在做什么？（重试几次？）     |      |
| `try / catch` 在做什么？               |      |
| `if (result.success)` 之后发生了什么？ |      |
| `fallback` 是什么？（兜底函数）        |      |
| 这段代码大致在做什么？（一句话）       |      |

---

<!-- PATH:FULL END -->

<!-- PATH:SHARED START -->

---

# 🧠 顺手扔掉一件事

完整版 30 分钟还是偷懒版 10 分钟——你是不是在纠结这个？

你有没有发现，纠结本身就暴露了一种很旧的习惯：

> **「老师教 → 我听课 → 考试打分 → 过关」**

十六年。从小学一年级起你就被按在这个模型里。坐好，听讲，做题，等分数。语法要全会、概念要背熟、选择题不能错——然后你才有资格往下走。

但现在你要做的这件事，**和考试没有半点关系**。

没有人给你打「TypeScript 语法等级」。没有标准答案。`interface` 还是 `type`？`useCallback` 什么时候用？`T extends { name: string }` 叫什么？

**——你交付的那个网页跑不跑得起来，才是唯一算数的东西。**

所以完整版和偷懒版**没有区别**。不是安慰你。这是实话：你学了 30 分钟还是 10 分钟，不重要。语法背了几个，不重要。重要的是你看到代码不害怕了——知道自己看不懂什么，知道怎么去查。

你不需要学到 100 分才能开始。「看得懂」就够了。

从这一讲开始，记住一句话：

> **你不是来考试的。你是来造东西的。**

<br>

# 🎯 结算

你选了完整版，花了 30 分钟，记住了变量、函数、接口、异步、React 组件、Zustand。
你选了偷懒版，花了 10 分钟，学会了认关键词、认结构、读一段。

**猜猜看，后面 9 个模块里谁更有优势？**

答案是：**没有区别。**

因为后面的学习里，你根本不需要「写 TypeScript 代码」——
你需要的是：

```
读得懂 → 知道 AI 在说什么
说得清 → 能告诉 AI 你要什么
做得到 → 把 AI 给的代码跑起来
```

`interface` 和 `type` 有什么区别？`useCallback` 什么时候用？
`Promise.allSettled` 和 `Promise.all` 差在哪里？`T extends { name: string }` 叫泛型约束？

语法真的不重要吗？

重要。`async/await` 搞不懂，你看不懂网络请求代码。
`泛型` 搞不懂，你看不懂工具函数的类型标注。

但它们不该成为你的**前置条件**。

如果非要等 TypeScript 语法学精通了再碰 AI——
那你要先学变量→函数→接口→泛型→条件类型→映射类型→infer→……
等你学完，课已经结束了。

**正确的顺序是反过来：**

```
遇到一段看不懂的 → 问 AI"这行在干什么" → 懂了 → 继续
                                              │
                                              └─ 如果反复遇到同一个语法
                                                 → 花 5 分钟专门学一下
```

语法是**工具**，不是**门槛**。
用到什么学什么。在做的过程中学。
不可能什么都等精通了才去做。

偷该偷的懒——不是不学，是不提前学。
做该做的事——开始了，才知道自己缺什么。

<br>

| 检查项                                 | 自己回答 |
| -------------------------------------- | -------- |
| `let` 和 `const` 有什么区别？          |          |
| `function` 在做什么？                  |          |
| `interface` 在做什么？                 |          |
| `async / await` 在处理什么场景？       |          |
| `try / catch` 在做什么？               |          |
| 花括号 `{ }` 在 JSX 里有什么含义？     |          |
| `useState` 在做什么？                  |          |
| 能看懂上面那段 Agent 执行器的 50% 吗？ |          |

---

> **下一步：** 带着"只看不写"的自信，进入 [LLM API 入门](./llm-api.md)。
> 这个平台的每一个页面，都是用上面这些代码写的——而你已经会读了。

<!-- PATH:SHARED END -->
