---
type: concept
last_updated: 2026-10-10
id: multi-agent
name: 多 Agent 协作
prerequisites: [llm-wiki]
difficulty: 5
estimated_time: 60min
tags: [core, multi-agent, orchestration]
---

# 多 Agent 协作

## 先来一个故事：造一辆车，一个人干不了

你要造一辆汽车。不是模型——是真能开的车。

你不会一个人从炼钢开始。你会组一个团队：

- **发动机师傅**只管发动机：马力多大、烧什么油
- **底盘师傅**只管车架：承重多少、过什么坑不会散
- **电气师傅**只管电路：大灯怎么亮、空调怎么转
- **质检员**挨个验收：发动机没装好？打回去重装，装好了才放行

**多 Agent 协作就是这个团队。** 前面你学的一直是"一个 Agent 单打独斗"——它一个人想、一个人做、一个人看结果。但真实项目里，一件事拆成多个角色、每人负责一块，比一个人全包靠谱得多。

**多 Agent 不是"多叫几个人来帮忙"。它是"把任务拆开，每人只做自己最擅长的那一块，然后像流水线一样拼起来"。**

---

## 定义

多个 Agent 各自负责不同角色，协作完成复杂任务。

## 为什么要多 Agent

- 单个 Agent 能力有限
- 复杂任务需要不同专长
- 分工可以提高质量

## 关键步骤：四种协作模式

> 本节的 `###` 子节是**这一讲必须掌握的步骤清单**，讲稿应当逐步覆盖。
> 结构与 `platform-replica.md` 一致，便于自动检测「讲稿漏讲了哪一步」。

### 模式一 · 流水线

**怎么转：** A 做完给 B，B 做完给 C。**串行**，前一步的输出是后一步的输入。

### 模式二 · 并行

**怎么转：** A、B、C 同时做，最后合并。**并行**，互不等待。

### 模式三 · 辩论

**怎么转：** A、B 给不同方案，C 评判。**用分歧换质量**。

### 模式四 · 监督

**怎么转：** A 做，B 检查，不合格打回。**带验收的循环**，最接近工程实践。

> 选哪个？**先问任务能不能拆成互不依赖的子任务** —— 能，就流水线或并行；不能，就辩论或监督。

## 关键问题

- 角色怎么分？
- 信息怎么传？
- 冲突怎么解决？
- 什么时候结束？

## 示范代码

流水线模式：需求 → 写代码 → 评审。三个 Agent 各司其职，协作完成。

> 👉 `createAgent()` 是一个封装函数——**把它想象成"招聘"**：你告诉它这个 Agent 的身份（systemPrompt），它就给你一个"员工"。你叫 `agent.run()`，这个员工就开始干活。内部就是你在「Agent 循环」那讲见过的 Think→Act→Observe 循环，只是现在你一次招了三个员工。

```typescript
// ① 需求分析师：把用户的模糊想法拆成可执行的功能点
const requirementAgent = createAgent({
  systemPrompt:
    "你是需求分析师，把用户想法拆成具体功能点。输出用 Markdown 列表。",
});

// ② 程序员：根据需求文档写代码
const coderAgent = createAgent({
  systemPrompt: "你是程序员，根据需求文档写代码。代码要完整、可运行、有注释。",
});

// ③ 代码评审员：检查代码是否符合需求、有没有 bug
const reviewerAgent = createAgent({
  systemPrompt:
    "你是代码评审员，检查代码是否符合需求、有没有逻辑问题。" +
    "输出格式：{ passed: boolean, comments: string }。",
});

// ④ 编排函数：流水线 —— A 的输出是 B 的输入，B 的输出是 C 的输入
async function buildProject(userInput: string) {
  // 阶段一：需求分析
  const requirements = await requirementAgent.run(userInput);

  // 阶段二：写代码（拿到需求文档再动手）
  let code = await coderAgent.run(requirements);

  // 阶段三：评审（打回重写直到通过）
  const review = await reviewerAgent.run(code);
  if (!review.passed) {
    code = await coderAgent.run(`根据评审意见修改：\n${review.comments}`);
  }

  return code; // 只有评审通过才会到这里
}

// ⑤ 运行：一句话启动三个 Agent 的协作流水线
const result = await buildProject(
  "做一个天气查询网页，输入城市名显示温度和天气图标",
);
```

## 自己动手：你来说

> 用"流水线工厂"的例子，解释多 Agent 协作的三种角色各做什么。
>
> 然后：**设计一个"写周报"的多 Agent 协作流程。** 需要哪几个 Agent？各自职责是什么？它们之间的输入输出怎么衔接？像示范代码那样画出流程。

---

## 相关概念

- [[llm-wiki]]
- [[mcp]]
