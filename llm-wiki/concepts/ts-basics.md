---
type: concept
last_updated: 2026-10-11
id: ts-basics
name: TypeScript 基础速通
prerequisites: [vibe-coding]
difficulty: 1
estimated_time: 30min
tags: [language, typescript, beginner, reading]
---

# TypeScript 基础速通

---

## 定义：TypeScript 是什么

你跟一个人说话，用中文。你跟一台电脑说话，用什么？

用**编程语言**。TypeScript 就是其中一种。

想象你在遥控一台只会听口令的机器人：

```
你说中文 → 机器人听不懂
你说 TypeScript → 机器人照做
```

TypeScript 做的事就是把你的想法翻译成电脑能执行的指令。你说"把这行字显示在屏幕上"，它帮你传过去。你说"点这个按钮就跳转到那一页"，它帮你搭桥。

**那"Type"又是什么意思？**

Type = 类型。你在超市货架上看到标签——"牛奶"、"面包"、"洗发水"——你不会把洗发水当牛奶喝，因为有标签告诉你它是什么。

TypeScript 给你的每一个数据也贴上了标签：

```typescript
const name = "小明"; // 标签：字符串（文字）
let score = 95; // 标签：数字
const passed = true; // 标签：布尔（是 / 否）
```

Python 没有这些标签——你拿到一瓶东西，得打开闻一下才知道是什么。TypeScript 不一样：标签在瓶子上，还没打开就知道。

**所以 TypeScript = "带标签的 JavaScript"。** 后面所有模块的前端代码都是这个味道。这一讲不是要你学会它——认识最基本的几个词、能看懂一段代码在干嘛，就够了。

---

## 为什么用 TypeScript 做 Agent

说到「写 Agent」，很多人第一反应是 Python。Python 确实简单，但 Agent 开发有一个 Python 天然解决不了的问题：

**AI 的输出是人话，不是代码。**

你让 AI 返回 `{ "score": 95, "passed": true }`，它可能返回 `{ "score": "九十五", "pass": "yes" }`。字段名变了、值的类型变了——而 Python 只有在你跑到那行代码时才会炸。

TypeScript 不一样：**你还没跑，编辑器就标红了。**

```typescript
// 你期望 AI 返回这个格式
interface GradingResult {
  score: number; // 必须是数字
  passed: boolean; // 必须是 true/false
}

// 如果 AI 返回了错误的格式——
// TypeScript 在你运行之前就会告诉你："这不对"
```

Agent 开发的本质是**和不确定性打交道**。AI 会犯错、会漏字段、会换说法。你能做的就是在"人写的代码"这一侧尽可能设护栏。TypeScript 的类型系统就是最好的护栏——它不保证 AI 不出错，但保证 AI 出的错不会悄悄漏过去。

> **Python 让你写得快。TypeScript 让你写得稳。**
> Agent 开发不需要快——需要稳。因为一个漏过去的格式错误，会像多米诺骨牌一样炸掉后面所有步骤。

---

## 为什么需要这一站

你正在用的这个网页，每一个按钮、每一次打字效果，背后都是 TypeScript。看完开场白就可以进 LLM API，后面遇到看不懂的，随时回来看偷懒版的三招。

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

## 关键步骤：三招看懂 TypeScript（偷懒版）

> 本节的 `###` 子节是**这一讲必须掌握的步骤清单**，讲稿应当逐步覆盖。
> 结构与 `platform-replica.md` 一致，便于自动检测「讲稿漏讲了哪一步」。

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

下面这段代码做的事很简单：给你三个温度，判断哪个超过 35 度算"高温"。用招一和招二的方法逐行看：

```typescript
// 三个温度值，每个后面都有类型标签 number
const temp1: number = 36;
const temp2: number = 28;
const temp3: number = 42;

// 判断函数：超过 35 就算高温
function isHot(temp: number): boolean {
  if (temp > 35) {
    return true; // 比 35 大 → 是高温
  }
  return false; // 不超过 35 → 不是高温
}

// 逐个检查
isHot(temp1); // true  —— 36 > 35，高温
isHot(temp2); // false —— 28 ≤ 35，不是
isHot(temp3); // true  —— 42 > 35，高温
```

```
不要求你解释每一行。只要你能说出：

✅ const temp1: number 里的 number 是什么意思
✅ function isHot 做了什么
✅ return temp > 35 在判断什么
✅ isHot(temp2) 为什么返回 false
✅ 这段代码总共做了几件事

如果能说出这五条 → 你已经有能力看懂纯 TypeScript 代码了。
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
// for await (const token of streamChat("你好")) {
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

下面这段代码只用了本讲教过的三个东西：类型标签、函数、条件判断。从上往下逐段读，每段只做一件事。

> 👉 **读法：** 不用一次看懂全部。看到 `// ①` 就只看①，看到 `// ②` 就只看②。每段都是独立的小例子。

```typescript
// ① 类型标签：冒号后面告诉电脑「这个盒子只能装什么」
const name: string = "小明"; // string  → 只能装文字
let score: number = 85; // number  → 只能装数字
const passed: boolean = true; // boolean → 只能装 true（是）或 false（否）

// ② 函数：输入 → 判断 → 输出
//    格式：function 函数名(输入: 类型): 输出类型 { return 答案; }
function isPass(score: number): boolean {
  if (score >= 60) {
    return true; // 达到 60 分 → 通过
  }
  return false; // 没达到 → 不通过
}

// ③ 调用函数：把值塞进括号，看结果
isPass(85); // true  —— 85 ≥ 60，及格
isPass(58); // false —— 58 < 60，不及格
isPass(92); // true  —— 92 ≥ 60，及格
```

## 实践任务

读下面这段代码。它在平台里真实存在——你打开任何页面时，背后都是这个逻辑在从服务器加载数据。

```typescript
// 缓存结构：存下数据 + 记录加载时间
interface CachedResult<T> {
  data: T; // 加载到的数据
  loadedAt: number; // 加载时间戳（毫秒）
}

// 缓存仓库：按 key 存储，Map 是 JS 内置的字典
const cache = new Map<string, CachedResult<unknown>>();
const ONE_MINUTE = 60_000; // 1 分钟 = 60000 毫秒

// <T> 是泛型：「不管你要什么类型的数据，我都能处理」
async function loadWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  // ① 先看缓存里有没有——有的话直接返回，省一次网络请求
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < ONE_MINUTE) {
    return cached.data as T;
  }

  // ② 没有缓存（或已过期），重新加载
  try {
    const data = await fetcher();
    cache.set(key, { data, loadedAt: Date.now() });
    return data;
  } catch (error) {
    // ③ 加载失败，给一个统一的错误提示
    console.error(`加载失败：${key}`, error);
    throw new Error(`无法加载 ${key}，请检查网络后重试`);
  }
}
```

### 标注练习

不要求你写代码。只标注以下要点：

| 检查项                                      | 回答 |
| ------------------------------------------- | ---- |
| `interface CachedResult` 定义了哪两个字段？ |      |
| `<T>` 在这个函数里是什么作用？              |      |
| `Map<string, CachedResult>` 里存了什么？    |      |
| `async function` 表示这个函数会做什么？     |      |
| `try / catch` 什么时候会走到 `catch`？      |      |
| `const cached = cache.get(key)` 在做什么？  |      |
| 这段代码大致在做什么？（一句话）            |      |

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

| 检查项                                     | 自己回答 |
| ------------------------------------------ | -------- |
| `let` 和 `const` 有什么区别？              |          |
| `function` 在做什么？                      |          |
| `interface` 在做什么？                     |          |
| `async / await` 在处理什么场景？           |          |
| `try / catch` 在做什么？                   |          |
| 花括号 `{ }` 在 JSX 里有什么含义？         |          |
| `useState` 在做什么？                      |          |
| 能看懂上面那段 `loadWithCache` 的 80% 吗？ |          |

---

> **下一步：** 带着"只看不写"的自信，进入 [LLM API 入门](./llm-api.md)。
> 这个平台的每一个页面，都是用上面这些代码写的——而你已经会读了。

<!-- PATH:SHARED END -->
