---
type: student-errors
last_updated: YYYY-MM-DD
student_id: s001
---

# 错题记录

## YYYY-MM-DD | tool-calling | 参数定义

**题目：** 定义一个查询汇率的工具
**学生答案：**

```typescript
const tool = {
  name: "getRate",

  description: "查汇率",

  parameters: { from: "string", to: "string" },
};
```

**问题：**

- 缺少参数类型说明
- 缺少 required 字段
- description 不够具体

**正确示范：**

```typescript
const tool = {
  name: "getExchangeRate",

  description: "查询两种货币之间的实时汇率",

  parameters: {
    type: "object",

    properties: {
      from: { type: "string", description: "源货币代码，如 USD" },

      to: { type: "string", description: "目标货币代码，如 CNY" },
    },

    required: ["from", "to"],
  },
};
```

**关联概念：** [[tool-calling]]
**关联反模式：** [[missing-params]]
**是否已订正：** 是
**变式练习：** 已生成 3 道
**下次复习：** YYYY-MM-DD
