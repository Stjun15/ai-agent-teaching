---
type: concept
last_updated: 2026-09-17
id: ai-safety
name: AI 安全与可控性
prerequisites: [mcp]
difficulty: 4
estimated_time: 50min
tags: [core, safety, security]
---

# AI 安全与可控性

## 定义

让 Agent 在安全边界内运行，不产生有害输出，不执行危险操作。

## 核心风险

- 幻觉：编造不存在的信息
- 提示注入：用户诱导 Agent 越权
- 危险操作：删除文件、执行恶意代码
- 成本失控：无限循环、Token 爆炸
- 隐私泄露：把用户数据发给第三方

## 防护机制

- 内容过滤：输入输出都过滤
- 沙箱：危险操作隔离
- 限流：限制调用次数和 Token
- 兜底：出错时给友好提示
- 引用溯源：回答能追溯来源

## 相关概念

- [[mcp]]
- [[rag]]
