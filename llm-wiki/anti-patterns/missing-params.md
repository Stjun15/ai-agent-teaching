---
type: anti-pattern
last_updated: 2026-09-17
id: missing-params
name: 参数定义缺失
related_concepts: [tool-calling]
severity: high
---

# 参数定义缺失

## 表现

- 参数只有名称，没有类型
- 没有 required 字段
- 没有参数描述
- 没有默认值
- 参数用自然语言描述而非结构化

## 为什么错

Agent 不知道参数类型和是否必填，会传错参数或漏传。
参数描述不清，Agent 不知道格式要求。

## 校验规则

| 检测项                             | 扣分   |
| ---------------------------------- | ------ |
| 参数缺少 type                      | -10/个 |
| 参数缺少 description               | -5/个  |
| 缺少 required                      | -10    |
| 缺少默认值（可选参数）             | -3/个  |
| 参数定义用自然语言而非 JSON Schema | -15    |

## 正确示范

```typescript

parameters: {

  type: "object",

  properties: {

    from: { type: "string", description: "源货币代码，如 USD" },

    to: { type: "string", description: "目标货币代码，如 CNY" }

  },

  required: ["from", "to"]

}

```

## 相关概念

- [[tool-calling]]
