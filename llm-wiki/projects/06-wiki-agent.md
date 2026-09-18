---
type: project
last_updated: 2026-09-18
id: 06-wiki-agent
name: Wiki Agent
difficulty: 4
estimated_time: 120min
module_id: llm-wiki
tags: [llm-wiki, knowledge, compile]
---

## 概述

做一个会「编译知识」的 Agent：把零散笔记整理成带 frontmatter 的知识页，并按 [[llm-wiki]] 的 SCHEMA 校验必填字段、自动加交叉引用。训练的是「让模型产出结构化、可机器校验的产物」这一能力。

## 目标

- 能让模型为每条知识生成规范的 frontmatter（类型、依赖、标签）。
- 能校验产物缺了哪些必填字段，并让模型补上。
- 能自动在相关页面之间建立 `[[wiki-link]]`。

## 起步 Prompt

```text
把用户给的笔记整理成一篇知识页：先写 frontmatter（type/id/name/
last_updated），再写正文。正文里凡是提到别的概念，用 [[概念ID]] 链接。
最后自查必填字段是否齐全。
```

## 检查清单

- [ ] 产物带合法 frontmatter 且必填字段齐全
- [ ] 正文中相关概念都用 wiki-link 互联
- [ ] 缺字段时模型能被要求补全，而非产出半成品

## 验收要点

- 输入一段无结构的笔记，产出页能通过 SCHEMA 校验且至少有两处交叉引用。
