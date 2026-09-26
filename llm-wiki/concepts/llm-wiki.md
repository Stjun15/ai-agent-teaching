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

## 示范代码

Wiki 三连 —— Ingest 吃进资料 → Query 回答问题 → Maintain 自动维护。

```typescript
// ① 摄入（Ingest）：把原始资料「编译」成结构化 Wiki 页面
await wiki.ingest({
  source: "课程资料.pdf",               // 原始资料文件
  target: "concepts/agent-loop.md",     // 编译后的 Wiki 页面路径
  schema: "教学概念",                   // 按什么模板结构化（定义 + 关键点 + 误解 + 相关）
});
// 编译完成：PDF 里的散乱文字 → 结构化的概念页面，后续查询不用再检索原文件

// ② 查询（Query）：基于已编译 Wiki 直接回答，不重新检索原文
const answer = await wiki.query("Agent Loop 有几步？");
// 内部流程：读 concepts/agent-loop.md → 定位到「关键步骤」小节 → 提取答案
// 成本：一次文件读取，不调 embedding 模型，不重新切片

// ③ 维护（Maintain）：自动检查交叉引用、标记矛盾、修复断链
await wiki.maintain();
// 自动化检查：
//   - [[agent-loop]] 这个链接指向的页面还在不在？
//   - 前置概念列表和实际依赖关系是否有矛盾？
//   - 自动修复能修的（如死链重定向），不能修的打标记等人审
```

## 相关概念

- [[rag]]
- [[multi-agent]]