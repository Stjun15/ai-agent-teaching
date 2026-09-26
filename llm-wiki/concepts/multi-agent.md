---
type: concept
last_updated: 2026-09-17
id: multi-agent
name: 多 Agent 协作
prerequisites: [llm-wiki]
difficulty: 5
estimated_time: 60min
tags: [core, multi-agent, orchestration]
---

# 多 Agent 协作

## 定义

多个 Agent 各自负责不同角色，协作完成复杂任务。

## 为什么要多 Agent

- 单个 Agent 能力有限
- 复杂任务需要不同专长
- 分工可以提高质量

## 常见模式

- 流水线：A 做完给 B，B 做完给 C
- 并行：A、B、C 同时做，最后合并
- 辩论：A、B 给不同方案，C 评判
- 监督：A 做，B 检查，不合格打回

## 关键问题

- 角色怎么分？
- 信息怎么传？
- 冲突怎么解决？
- 什么时候结束？

## 示范代码

流水线模式：需求 → 写代码 → 评审。三个 Agent 各司其职，协作完成。

```typescript
// ① 需求分析师：把用户的模糊想法拆成可执行的功能点
const requirementAgent = createAgent({
  systemPrompt: "你是需求分析师，把用户想法拆成具体功能点。输出用 Markdown 列表。",
});

// ② 程序员：根据需求文档写代码
const coderAgent = createAgent({
  systemPrompt: "你是程序员，根据需求文档写代码。代码要完整、可运行、有注释。",
});

// ③ 代码评审员：检查代码是否符合需求、有没有 bug
const reviewerAgent = createAgent({
  systemPrompt: "你是代码评审员，检查代码是否符合需求、有没有逻辑问题。" +
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
const result = await buildProject("做一个天气查询网页，输入城市名显示温度和天气图标");
```

## 相关概念

- [[llm-wiki]]
- [[mcp]]