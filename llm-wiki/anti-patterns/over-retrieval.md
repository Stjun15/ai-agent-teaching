---
type: anti-pattern
last_updated: 2026-09-17
id: over-retrieval
name: 过度检索
related_concepts: [rag]
severity: medium
---

# 过度检索

## 表现

- topK 设置过大（>10）
- 检索不相关的内容
- 不筛选直接全部发给 AI
- 不做相似度阈值过滤

## 为什么错

干扰 AI 判断，增加 Token 消耗，降低回答质量。
检索内容太多，AI 反而抓不住重点。

## 校验规则

| 检测项         | 扣分 |
| -------------- | ---- |
| topK > 10      | -10  |
| 未做相关性筛选 | -10  |
| 未做去重       | -5   |
| 未设相似度阈值 | -5   |

## 正确示范

```typescript
const docs = await retrieve(question, {
  topK: 3,

  threshold: 0.7,

  deduplicate: true,
});
```

## 相关概念

- [[rag]]
