---
type: anti-pattern
last_updated: 2026-09-17
id: role-overlap
name: 角色重叠
related_concepts: [multi-agent]
severity: medium
---

# 角色重叠

## 表现

- 两个 Agent 职责相同
- 两个 Agent 都能写同一个文件
- 两个 Agent 都回答同一类问题
- 无明确分工

## 为什么错

资源浪费，输出冲突，难以调试。
两个 Agent 可能给出矛盾答案，用户困惑。

## 校验规则

| 检测项         | 扣分 |
| -------------- | ---- |
| 角色职责重叠   | -15  |
| 写入权限重叠   | -10  |
| 无明确分工     | -10  |
| 无角色通信规则 | -5   |

## 正确示范

| Agent | 职责   | 写入            |
| ----- | ------ | --------------- |
| 讲解  | 讲概念 | learning-path   |
| 点评  | 校验   | prompts, errors |
| 出题  | 出题   | examiner        |
| 答疑  | 答疑   | log             |

## 相关概念

- [[multi-agent]]
