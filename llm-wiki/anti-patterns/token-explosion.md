---
type: anti-pattern
last_updated: 2026-09-17
id: token-explosion
name: Token 爆炸
related_concepts: [llm-api, ai-safety]
severity: medium
---

# Token 爆炸

## 表现

- Prompt 冗长
- 历史消息全量发送
- RAG 检索 topK 过大
- 多 Agent 通信无压缩
- 每次对话都带上完整知识库

## 为什么错

成本飙升，响应变慢，可能超出上下文窗口。
开发期可能感觉不到，上线后成本失控。

## 校验规则

| 检测项              | 扣分 |
| ------------------- | ---- |
| Prompt 超过 2000 字 | -10  |
| 未做历史压缩        | -5   |
| topK > 10           | -5   |
| 未做 Token 预算控制 | -10  |

## 正确示范

- Prompt 精简，只保留必要规则
- 历史消息只保留最近 5 轮
- topK = 3-5
- 多 Agent 通信用结构化摘要
- 设置 Token 上限和告警

## 相关概念

- [[llm-api]]
- [[rag]]
- [[ai-safety]]
