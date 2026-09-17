---
type: anti-pattern
last_updated: 2026-09-17
id: no-error-handling
name: 无错误处理
related_concepts: [tool-calling, ai-safety]
severity: medium
---

# 无错误处理

## 表现

- 工具函数没有 try-catch
- 没有考虑空输入
- 没有考虑超时
- 没有考虑 API 失败
- 出错时直接抛出异常而非返回错误信息

## 为什么错

工具失败时 Agent 不知道怎么办，可能崩溃或输出错误信息。
没有错误处理，Agent Loop 可能卡在失败步骤。

## 校验规则

| 检测项                       | 扣分 |
| ---------------------------- | ---- |
| 无 try-catch                 | -10  |
| 未考虑空输入                 | -5   |
| 未考虑超时                   | -5   |
| 未返回错误信息               | -5   |
| 出错时抛异常而非返回错误对象 | -5   |

## 正确示范

```typescript
execute: async ({ city }) => {
  if (!city) return { error: "城市不能为空" };

  try {
    const res = await fetch(`...`);

    if (!res.ok) return { error: "查询失败" };

    return await res.json();
  } catch (e) {
    return { error: "网络错误，请重试" };
  }
};
```

## 相关概念

- [[tool-calling]]
- [[ai-safety]]
