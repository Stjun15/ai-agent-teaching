---
type: anti-pattern
last_updated: 2026-09-17
id: infinite-loop
name: 无限循环
related_concepts: [agent-loop, ai-safety]
severity: high
---

# 无限循环

## 表现

- Agent 反复调用同一个工具
- 没有终止条件
- 没有最大轮次限制
- 工具一直返回失败，Agent 一直重试

## 为什么错

消耗大量 Token，可能永远不结束，成本失控。
用户等待时间过长，体验差。

## 校验规则

| 检测项               | 扣分 |
| -------------------- | ---- |
| 未设置 maxLoops      | -15  |
| 未设置终止条件       | -10  |
| 未设置 Token 上限    | -10  |
| 工具失败后无重试上限 | -10  |

## 正确示范

```typescript
const agent = createAgent({
  maxLoops: 10,

  maxTokens: 50000,

  stopCondition: (state) => state.taskComplete || state.loops >= 10,
});
```

## 相关概念

- [[agent-loop]]
- [[ai-safety]]
