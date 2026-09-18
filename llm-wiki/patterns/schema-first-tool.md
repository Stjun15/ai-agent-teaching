---
type: pattern
last_updated: 2026-09-18
id: schema-first-tool
name: 先定契约再写工具
module_id: tool-calling
tags: [tool-calling, reliability]
---

# 先定契约再写工具

## 什么时候用

给 Agent 加工具的时候。顺序是：**先写 JSON Schema，再写函数体**。

## 写法

```text
1. 写 name：动宾结构，模型靠名字选工具（get_weather，不是 weather）
2. 写 description：说清「什么时候该调、什么时候不该调」
3. 写 parameters：每个字段都要有 description 与类型，能枚举的就枚举
4. 最后才写实现
```

一个字段的 description 值不值，看它能不能回答：这个字段**不填会怎样**、**边界值是什么**。写不出这两句，模型就会填错。

## 为什么有效

模型看到的不是你的代码，只有 Schema。函数体写得再漂亮，Schema 里没说清的字段，模型只能猜 —— 猜错的表现是「工具被调了但参数不对」，看起来像模型笨，实际是契约漏了。

另外，Schema 先定意味着**实现可以后补、可以换**：先让 Agent 跑通调用链，再用真实现替掉桩函数。

## 容易退化成什么

- 退化成 [[no-error-handling]]：只写成功路径，工具抛异常时 Agent 拿到一堆堆栈，把它当成工具结果继续推理；
- 退化成工具泛滥：一个意图三个工具，模型选不准 —— 先合并，再考虑拆。

## 相关概念

- [[tool-calling]]
