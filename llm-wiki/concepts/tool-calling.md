---
type: concept
last_updated: 2026-09-17
id: tool-calling
name: 工具调用
prerequisites: [agent-loop]
difficulty: 3
estimated_time: 50min
tags: [core, tool, function-calling]
---

# 工具调用

## 定义

工具调用是 Agent 使用外部能力的机制。
你定义工具，Agent 决定什么时候调用、传什么参数。

## 工具定义三要素

1. 名称：动词+名词，如 getWeather
2. 描述：用途、适用场景、返回什么
3. 参数：类型、必填、描述、默认值

## 示范代码

给 Agent 注册两个工具 —— 一个查天气、一个算数。模型自己决定用哪个。

```typescript
// ① 工具是用 JSON Schema 定义的「说明书」，名称、描述、参数三要素缺一不可
const tools = [
  {
    name: "getWeather",                     // ①-1 名称：动词+名词，模型靠名字选工具
    description: "查询指定城市的当前天气。" +  // ①-2 描述：模型靠这段文字判断"该不该调这个工具"
      "当用户问温度、会不会下雨时使用。",
    parameters: {                           // ①-3 参数：Schema 定义，required 标记必填
      type: "object",
      properties: {
        city: { type: "string", description: "城市名称，如 北京" },
      },
      required: ["city"],                   // 城市是必填，模型必须传，不能编
    },
    execute: async ({ city }: { city: string }) => ({ temp: 25, condition: "晴" }),
  },
  {
    name: "calculate",                      // 第二个工具：算数
    description: "计算数学表达式，支持加减乘除。" +
      "需要精确计算结果时使用，不要让模型心算。",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "数学表达式，如 2+3*4" },
      },
      required: ["expression"],
    },
    execute: async ({ expression }: { expression: string }) => eval(expression),
  },
];

// ② 创建 Agent 时传入工具列表 —— 模型拿到这份说明书，自己判断用哪个
const agent = createAgent({
  systemPrompt: "你是一个生活助手，会查天气和算数。",
  tools,
});

// ③ 模型自动选型：这句话触发 getWeather；算数题会触发 calculate
await agent.run("北京今天热吗？");            // → 调 getWeather("北京")
await agent.run("3 斤苹果每斤 5 块，一共多少钱？"); // → 调 calculate("3*5")
```

## 常见问题

- 名称模糊：weather → 应该叫 getWeather
- 描述不清：AI 不知道什么时候用
- 参数缺失：AI 不知道该传什么
- 没有错误处理：工具失败时 Agent 不知道怎么办

## 相关概念

- [[agent-loop]]
- [[rag]]