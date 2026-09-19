---
type: concept
last_updated: 2026-09-19
id: rag
name: RAG 检索增强生成
prerequisites: [tool-calling]
difficulty: 4
estimated_time: 60min
tags: [core, rag, retrieval]
---

# RAG 检索增强生成

## 定义

RAG = Retrieval + Augmented + Generation。
先检索相关资料，再让 AI 基于资料生成回答。

## 为什么需要 RAG

- AI 不知道你的私有资料
- AI 的知识有截止日期
- AI 会幻觉，编造不存在的内容

## 核心流程

1. 用户提问
2. 检索相关资料（向量检索）
3. 把资料和问题一起发给 AI
4. AI 基于资料生成回答
5. 标注引用来源

## 关键概念

- 向量检索：把文本转成向量，找最相似的
- 知识边界：AI 只能基于检索到的内容回答
- 引用溯源：每条回答都要能追溯到来源

## 常见误解

- 误解1：RAG 就是搜索 → 它比搜索多了生成
- 误解2：检索越多越好 → 太多会干扰 AI
- 误解3：RAG 能解决幻觉 → 它减少幻觉，但不能消除

## 相关概念

- [[tool-calling]]
- [[llm-wiki]]
