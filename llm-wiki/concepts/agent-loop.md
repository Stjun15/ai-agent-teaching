---
type: concept
last_updated: 2026-09-17
id: agent-loop
name: Agent Loop
prerequisites: [llm-api, system-prompt]
difficulty: 3
estimated_time: 50min
tags: [core, agent, loop, react]
---

# Agent Loop

## 定义

Agent Loop 是 Agent 的核心运行机制：
思考 → 行动 → 观察 → 重复，直到任务完成。

## 关键步骤

1. 思考（Reasoning）：分析当前状态，决定下一步
2. 行动（Action）：调用工具或直接回答
3. 观察（Observation）：获取工具返回结果
4. 重复：带着新信息回到思考步骤

## 和普通聊天的区别

|          | 普通聊天    | Agent                                  |
| -------- | ----------- | -------------------------------------- |
| 流程     | 输入 → 输出 | 输入 → 思考 → 行动 → 观察 → ... → 输出 |
| 工具     | 无          | 有                                     |
| 多轮     | 无          | 有                                     |
| 自主决策 | 无          | 有                                     |

## 示范代码

Agent Loop 的核心 —— 思考 → 行动 → 观察 → 重复，直到任务完成。

```typescript
// ① 系统提示词：告诉模型它的身份 + 它有什么工具可用
const systemPrompt = `你是一个天气助手。
当用户问天气时，调用 getWeather 工具。
拿到结果后，用友好的语气回答。`;

// ② 工具定义：模型只能调用这里注册的工具（白名单）
const tools = [
  {
    name: "getWeather", // 工具名：动词+名词
    description: "查询指定城市的天气", // 描述：模型靠这个判断"什么时候用"
    parameters: { city: "string" }, // 参数：类型 + 含义
    execute: async ({ city }: { city: string }) => ({
      temp: 25,
      condition: "晴",
    }),
  },
];

// ③ 创建 Agent：把系统提示词和工具绑在一起
const agent = createAgent({ systemPrompt, tools });

// ④ 启动 Agent Loop：模型自动决定"要不要调工具"→ 调完再看结果 → 继续或结束
const result = await agent.run("北京今天天气怎么样？");
// Agent 内部循环：思考（需要查天气）→ 行动（调 getWeather("北京")）
// → 观察（拿到 { temp:25, condition:"晴" }）→ 输出（"北京今天晴，25度"）
```

## 常见误解

- 误解1：Agent Loop 就是 while 循环 → 它是 LLM 驱动的决策循环
- 误解2：Agent 一次就能做对 → 它可能多轮才完成
- 误解3：观察步骤不重要 → 观察决定下一步怎么走

## 相关概念

- [[system-prompt]]
- [[tool-calling]]
