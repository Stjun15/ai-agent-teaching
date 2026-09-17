---
type: log
last_updated: 2026-09-17
---

# LLM Wiki 变更日志

记录 LLM Wiki 的**结构性变更**：新增/删除页面、批量修正、发现矛盾、索引重建。

**只追加，不改写历史条目。** 单页内容的日常修改不记在这里（由 Git 留痕），这里只记「哪些页面被动了、为什么」。

格式：`日期 | 操作 | 范围 | 摘要`

| 日期       | 操作 | 范围                               | 摘要                                                                                                                                                                                                               |
| ---------- | ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-17 | init | 全部                               | 建立 wiki 骨架：`SCHEMA.md`（页面类型、命名、frontmatter、交叉引用、更新规则、维护任务）、`index.md`（全部规划页面的目录与建设进度）、`log.md`（本文件）。目录结构依 `references/wiki-schema.md`「一、目录结构」。 |
| 2026-09-17 | add  | concepts/llm-api.md                | 新增概念页 `llm-api`（LLM API 入门，难度 1，无前置）。内容依 `references/wiki-schema.md`「三、概念页面完整模板」。                                                                                                 |
| 2026-09-17 | fix  | index.md                           | 修正「难度」列：按 `references/wiki-schema.md` 各页面 frontmatter 的 `difficulty` 逐页核对，原值整体前移了一位。                                                                                                   |
| 2026-09-17 | add  | llm-wiki/concepts/system-prompt.md | 新增概念页 `system-prompt`（System Prompt 设计，难度 2，前置 llm-api）。内容依 `references/wiki-schema.md`「三、概念页面完整模板」。                                                                               |
| 2026-09-17 | add  | llm-wiki/concepts/agent-loop.md    | 新增概念页 `agent-loop`（Agent Loop，难度 3，前置 llm-api、system-prompt）。内容依 `references/wiki-schema.md`「三、概念页面完整模板」。                                                                           |
