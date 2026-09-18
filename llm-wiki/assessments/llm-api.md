---
type: assessment
last_updated: 2026-09-18
id: assess-llm-api
name: LLM API 测验
module_id: llm-api
pass_line: 60
---

# LLM API 测验

## 选择题

**1.** 一次 LLM API 调用里，必填的两个字段是：

- A. `model` 与 `temperature`
- B. `model` 与 `messages`
- C. `messages` 与 `max_tokens`
- D. `prompt` 与 `model`

答案：B。其余字段都有默认值，缺 `messages` 请求直接报错。

**2.** 多轮对话要保持上下文，正确做法是：

- A. 把上一轮的回答复制进新问题
- B. 把历史消息整段放进 `messages`
- C. 换成更大的模型
- D. 提高 `temperature`

答案：B。每次调用独立，模型不会记得上一次（见 [[llm-api]]）。

## 填空题

**3.** 一个中文字大约消耗 ______ 个 Token。

答案：1–2。Token 决定成本与速度，长 Prompt 不是越长越好。

## 简答题

**4.** 为什么流式输出（stream）对交互体验重要？

评分要点：用户不必等全文生成完才看到内容；首字延迟决定「卡不卡」的体感；实现上是按段读取而不是一次性读完整响应。

## 判分要点

- 选择题错选按 0 分计，解析写进错题本（客观题的解析来自本题，不是点评 Agent）；
- 简答题必须答出「首字延迟 / 不用等全文」任一层，只写「更快」判不通过。

## 相关概念

- [[llm-api]]
