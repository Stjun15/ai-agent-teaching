---
type: concept
last_updated: 2026-09-17
id: llm-wiki
name: LLM Wiki 知识编译
prerequisites: [rag]
difficulty: 4
estimated_time: 60min
tags: [core, wiki, knowledge]
---

# LLM Wiki 知识编译

## 定义

LLM Wiki 是 RAG 的升级形态。
不是每次查询都重新检索，而是把知识一次性"编译"成结构化 Wiki。

## RAG vs LLM Wiki

|          | RAG            | LLM Wiki           |
| -------- | -------------- | ------------------ |
| 模式     | 解释器         | 编译器             |
| 每次查询 | 重新检索       | 读已编译知识       |
| 积累     | 无             | 有复利效应         |
| 成本     | 随查询线性增长 | 一次编译，持续复用 |

## 核心操作

- Ingest：摄入新资料，编译进 Wiki
- Query：基于已编译 Wiki 回答
- Maintain：自动维护交叉引用、标记矛盾

## 复利效应

第 100 份资料编译时，建立在前面 99 份蒸馏出的知识结构上。

## 相关概念

- [[rag]]
- [[multi-agent]]
