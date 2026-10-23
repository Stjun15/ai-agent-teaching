---
type: rubric
last_updated: 2026-10-21
id: ts-basics-rubric
name: TypeScript 基础评分标准
module: ts-basics
---

# TypeScript 基础评分标准

## 本模块动手题

学生阅读一段包含 `interface`、泛型 `<T>`、`Map`、`async/await`、`try/catch`
的真实平台代码（缓存加载函数 `loadWithCache`），然后对以下五个知识点做标注解释：

| 检查项 | 要求 |
|---|---|
| `interface CachedResult` 定义了两个字段 | 说出字段名和各自用途 |
| `<T>` 泛型的作用 | 用自己的话解释为什么用泛型、不用会怎样 |
| `Map<string, CachedResult>` | 说出 key 是什么、value 是什么 |
| `async function` 表示什么 | 解释异步函数的含义 |
| `try / catch` 触发 `catch` 的条件 | 说出什么时候会走到 catch 分支 |

学生不写代码。只做标注解释。这是纯阅读理解题——考察能否看懂已有的代码结构。

## 正确答案要点

### interface
- 两个字段：`data`（缓存的实际数据）和 `loadedAt`（加载时间戳）
- 关键是能说出"一个存数据、一个记时间"

### 泛型 `<T>`
- 作用：让函数能处理不同类型的数据，不用为每种类型写一遍
- 核心：复用代码、类型安全（调用时才知道具体类型）

### Map
- key 是 `string`（缓存键，如文件名或 URL）
- value 是 `CachedResult<unknown>`（缓存条目）

### async function
- 表示函数内部有异步操作（网络请求、读文件等）
- `await` 等待异步结果，不阻塞主线程

### try / catch
- `catch` 在 `fetcher()` 抛出异常时触发（网络故障、数据格式错误等）

## 维度与权重

| 维度       | 权重 | 评分要点 |
|---|---|---|
| 理解准确度 | 50%  | 五个检查项的核心概念理解正确，没有张冠李戴 |
| 表达清晰度 | 25%  | 用自己的话讲清楚，不是复制原文定义 |
| 完整覆盖   | 25%  | 五个检查项全部作答 |

## 扣分规则

| 问题 | 扣分 |
|---|---|
| 把 interface 说成 function 或变量 | -20 |
| 泛型解释为"不确定类型所以不写"而非"延迟确定、复用代码" | -15 |
| 混淆 async/await 和 Promise 的关系（如说 async 就是 Promise） | -10 |
| 说 try/catch 在代码写错时触发而非运行时异常 | -10 |
| 直接复制原文定义无自己的转述 | -10 |
| 五个检查项缺一项 | -10 |
| 表述混乱、自相矛盾 | -10 |

## 通过条件

- total_score >= 75
- 理解准确度 >= 60% 权重分
- 五个检查项至少正确解释四个