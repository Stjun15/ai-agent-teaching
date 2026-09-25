# Phase 4 AI能力 · ReAct 模式实战（v2.0）

> **一句话总结：** 讲透 ReAct（Reason→Act→Observe）循环原理并带写出一个最小可用的 Agent Loop，含工具 Schema 设计、max_iter 防死循环、文本模式与原生 tool_choice 选型对比，配套分层 Quiz 与 P3_ReAct_Demo 动手任务，用于让学习者从「Agent 只会调一次 LLM」进阶到「能让 Agent 自主多轮思考并安全停止」。

> **前置文档**
>
> - `06-AI能力-FunctionCalling实战`（`06-AI能力/`）—— ReAct 的 Act 步骤建立在结构化工具调用之上，需先掌握 function calling 的 schema 定义与调用写法，否则无法理解循环里"工具结果如何回喂 LLM"。
> - `0A-Python基础速通`（`01-基础补强/`）—— 本文手写最小循环与跑通 Demo 均使用 Python，需具备基础语法、函数与字典能力。

> **后置文档**
>
> - `06-AI能力-Agent安全防护实战`（`06-AI能力/`）—— 本文文末指定的下一步：Agent 具备自主多轮调用能力后，紧接着必须解决越权拦截与提示注入防御，否则循环能力本身就是风险放大器。
> - `06-AI能力-Harness工程设计`（`06-AI能力/`）—— 把本文手写的教学级循环，升级为带并发调度、全局超时与状态持久化的生产级 Agent 运行时。

> **AI角色：老师。** 目标是让学习者在45分钟内理解 ReAct（Reason→Act→Observe）循环，并能手写一个最小 Agent Loop。
>
> **防什么失败？** 防"Agent 只会一次调用，不会多轮思考"。防"Agent 陷入死循环，API 费用爆炸"。防"不知道 ReAct 是什么，面试被问住"。

---

## 为什么需要 ReAct？

> **真实场景：** 某天用户说"帮我退货 ORDER123"。Agent 一次调用 LLM，LLM 说"好的，我需要先查一下订单状态..."——然后就没下文了。因为代码只调了一次 API，没有继续执行查订单→判断退货条件→创建退货单。用户等了 30 秒，只看到一句"我需要查一下"，体验极差，投诉率飙升。

**Agent 的核心能力不是"回答一次"，而是"多轮思考、多步执行"。** ReAct 就是这个多轮循环的模式。

**类比：GPS 导航的"重新规划路线"**

```
普通 API 调用 = 问路人"怎么去北京？"→ 路人说"往北走"→ 结束
            （没有后续，走错了也没人纠正）

ReAct 循环   = GPS 导航
            ① 分析当前位置（Reason）→ "你在上海，目标北京"
            ② 规划路线（Act）→ "走G2京沪高速"
            ③ 观察结果（Observe）→ "前方拥堵，重新规划"
            ④ 回到①，继续调整 → "绕行G15"
            → 直到到达目的地（任务完成）
```

---

## 前置要求

- 已完成 `06-AI能力-FunctionCalling实战`
- 已完成 `0A-Python基础速通`
- 有一个 LLM 的 API Key

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止。

---

## 核心概念

### 第一讲：ReAct 是什么

#### ReAct = Reason + Act + Observe（三个步骤循环）

```
┌──────────────────────────────────────────────────────────────┐
│                      ReAct 循环全景图                          │
│                                                              │
│    ┌──────────────────────────────────────────────────┐     │
│    │                   ③ Observe                      │     │
│    │              观察工具执行结果                      │     │
│    │         "订单状态：已发货，7天内可退货"             │     │
│    └──────────────────────┬───────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│    ┌──────────────────────────────────────────────────┐     │
│    │                   ① Reason                       │     │
│    │              模型分析+决定下一步                    │     │
│    │     "已发货且7天内，符合退货条件，需要创建退货单"    │     │
│    └──────────────────────┬───────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│    ┌──────────────────────────────────────────────────┐     │
│    │                   ② Act                          │     │
│    │              执行工具调用                          │     │
│    │       → 调用 create_return("ORDER123")            │     │
│    └──────────────────────┬───────────────────────────┘     │
│                           │                                  │
│              ┌────────────┴────────────┐                     │
│              │  模型决定停止？          │                     │
│              └──────┬─────────┬────────┘                     │
│                     │YES      │NO                            │
│                     ▼         └────── 回到 ③ ──────────┐    │
│              ┌──────────┐                               │    │
│              │ 返回最终  │                               │    │
│              │ 回答给用户│                               │    │
│              └──────────┘                               │    │
└──────────────────────────────────────────────────────────────┘
```

#### 为什么需要循环？—— 对比讲解

```
❌ 单次调用（没有循环）：
   用户："帮我退货 ORDER123"
   LLM："好的，我需要查一下订单..."  ← 程序结束，用户傻等

✅ ReAct 循环（多轮）：
   第1轮：Reason"需要查订单" → Act 调用 query_order → Observe"已发货"
   第2轮：Reason"符合退货条件，创建退货单" → Act 调用 create_return
   第3轮：Observe"退货单创建成功" → Reason"任务完成，告诉用户结果"
```

---

### 第二讲：手写最小 ReAct 循环

> **⚠️ 教学示例说明：** 下面用 Python 脚本讲清 ReAct 循环的**概念**（Reason→Act→Observe 最直观）。**生产环境的 ReAct 循环在 TS 的 `src/agent.ts`**（agent-platform 驱动循环），ai-service 只做单步推理（意图识别 + 判断"回答 or 调工具"），工具执行在 TS 本地。本脚本的 `query_order` 是模拟函数，真实查询走 TS → MCP → hmall。

```python
# 教学示例：最小 ReAct 循环（生产环境在 TS 的 src/agent.ts）
import os
import json
from datetime import datetime
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ===== 工具定义 =====
def get_current_time():
    """获取当前时间。无参数，直接返回时间字符串。"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def calculate(expression: str):
    """
    计算数学表达式。
    为什么用 eval？演示用，生产环境请用 ast.literal_eval 或专用计算库。
    """
    try:
        result = eval(expression)
        return f"计算结果: {result}"
    except Exception as e:
        return f"计算失败: {str(e)}"

def query_order(order_id: str):
    """查询订单详情。模拟数据库查询。"""
    orders = {
        "ORDER123": "订单ORDER123: 状态=已发货，金额=299元，7天内可退货",
        "ORDER456": "订单ORDER456: 状态=已完成，金额=599元，已超过退货期限",
    }
    return orders.get(order_id, f"未找到订单 {order_id}")

# 工具映射表：名称 → 函数
TOOLS_MAP = {
    "get_current_time": get_current_time,
    "calculate": calculate,
    "query_order": query_order,
}

# 工具 Schema（告诉 LLM 有哪些工具可用）
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前时间，当用户问时间相关问题时使用",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "计算数学表达式，当用户需要数学计算时使用",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "数学表达式，如 '2+3*4'"}
                },
                "required": ["expression"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_order",
            "description": "查询订单详情，当用户询问订单状态/信息时使用",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "订单号，如 ORDER123"}
                },
                "required": ["order_id"]
            }
        }
    }
]

SYSTEM_PROMPT = """你是一个智能助手，可以使用工具来完成任务。

规则：
1. 当需要工具时，调用合适的工具
2. 当有足够信息时，直接回答用户
3. 如果不需要工具，直接回答
4. 完成任务后，用自然语言总结结果
5. 如果工具返回错误，尝试其他方案或告知用户"""


def react_loop(user_message: str, max_iter: int = 10) -> str:
    """
    ReAct 循环：Reason → Act → Observe → Reason → ...

    参数：
    - user_message: 用户输入
    - max_iter: 最大迭代次数（防止死循环，控制 API 费用）

    返回：最终回答字符串
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message}
    ]

    for i in range(max_iter):
        print(f"\n===== 第 {i+1} 轮 =====")

        # ① Reason：调用模型，让它分析+决定
        response = client.chat.completions.create(
            model="gpt-5.6-luna",  # 简单推理用 Luna，省钱
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"  # 让模型自动决定是否调工具
        )

        message = response.choices[0].message

        if message.content:
            print(f"[Reason] 模型思考: {message.content}")

        # 如果模型不调用工具 → 任务完成，返回最终回答
        if not message.tool_calls:
            print("[结束] 模型决定停止，返回最终回答")
            return message.content or "抱歉，我无法处理这个请求。"

        # ② Act：执行工具调用
        messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)

            print(f"[Act] 调用工具: {tool_name}({tool_args})")

            tool_func = TOOLS_MAP.get(tool_name)
            if tool_func:
                try:
                    result = tool_func(**tool_args) if tool_args else tool_func()
                except Exception as e:
                    result = f"工具执行错误: {str(e)}"
            else:
                result = f"工具不存在: {tool_name}"

            print(f"[Observe] 工具结果: {result}")

            # ③ Observe：把结果返回给模型
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result)
            })

    # 达到最大迭代次数 → 强制终止
    return "抱歉，处理超时，请稍后重试。"


if __name__ == "__main__":
    result = react_loop("帮我查一下 ORDER123 的订单状态")
    print(f"\n最终回答: {result}")
```

#### ReAct 循环的关键设计点

```
┌─────────────────────────────────────────────────────────────────┐
│ 设计点              │ 说明                    │ 为什么重要       │
├─────────────────────────────────────────────────────────────────┤
│ max_iter = 10       │ 最大迭代次数             │ 死循环防护 + 费用控制│
│ tool_choice="auto"  │ 模型自主决定是否调工具    │ 不需要工具时直接回答│
│ tool_call_id        │ 每次工具调用唯一ID        │ 模型需要对应结果  │
│ 错误处理            │ 工具失败返回错误信息       │ 模型可以重试/换策略│
│ 消息历史保留        │ 所有对话轮次都在 messages  │ 模型需要上下文决策│
└─────────────────────────────────────────────────────────────────┘
```

---

### 第三讲：ReAct 常见问题与解决方案

#### 问题1：死循环（Agent 永远不停止）

```
症状：Agent 不断调用工具，但永远不给最终答案
根因：工具返回信息不够，或模型没被告知"该停了"
```

| 策略     | 做法                                     | 层级 |
| -------- | ---------------------------------------- | :--: |
| 硬限制   | max_iter = 10~15                         | 必须 |
| 提示词   | System Prompt 中明确"完成任务后直接回答" | 推荐 |
| 工具返回 | 返回完整信息，让模型能判断               | 推荐 |
| 兜底     | 超出 max_iter 返回"处理超时"             | 必须 |

#### 问题2：Agent 不调用工具

```
症状：用户需要查订单，但 Agent 直接说"我帮不了你"
根因：工具 description 不清晰，或 System Prompt 没引导
```

#### 问题3：上下文溢出

```
症状：多轮对话 + 工具返回大量数据 → 超出模型上下文窗口
解法：工具返回摘要而非全量数据，或压缩历史消息
```

---

### 第四讲：文本模式 vs 原生 tool_choice

```
┌──────────────────────────────────────────────────────────────────┐
│ 维度        │ 文本模式 ReAct          │ 原生 tool_choice          │
├──────────────────────────────────────────────────────────────────┤
│ 做法        │ Prompt 要求 AI 输出      │ 用 tools 参数 +           │
│             │ Thought/Action 格式      │ tool_choice="auto"       │
│ 解析        │ 正则匹配文本，容易出错    │ 直接读 response.tool_calls│
│ 可控性      │ 低，AI 可能不按格式输出   │ 高，API 保证结构化返回    │
│ 适用场景    │ 学习理解、自定义格式      │ 生产环境首选              │
└──────────────────────────────────────────────────────────────────┘

结论：学习阶段手写文本模式理解循环本质，生产环境用原生 tool_choice。
```

---

## 对比讲解：差做法 vs 好做法

| 维度     | ❌ 差做法                | ✅ 好做法                        |
| -------- | ------------------------ | -------------------------------- |
| 循环控制 | 无限循环，没有 max_iter  | max_iter = 10，超时返回兜底      |
| 停止条件 | 靠用户手动停止           | 模型不返回 tool_calls 时自动停止 |
| 错误处理 | 工具失败直接崩           | 捕获异常，返回错误信息给模型     |
| 上下文   | 不保留历史消息           | 保留所有轮次，模型有完整上下文   |
| 工具返回 | 返回全量数据（可能溢出） | 返回摘要，关键信息优先           |

---

### 提示词教学：ReAct System Prompt 与工具决策 Prompt

> **AI：** 不重讲六要素模板（真源：`03-AI协作构建\03-AI协作构建技能.md`；进阶：`06-AI能力-Prompt工程实战.md`），只讲 ReAct 场景怎么填。

**① 场景**：ReAct 循环里有两份 prompt——**System Prompt**（决定 Agent 的行为规则，如"什么时候调工具、什么时候停止"）和**工具 Schema 的 description**（决定 LLM 在某一轮"选哪个工具、传什么参数"）。System Prompt 写不好，Agent 要么永远不调工具，要么陷入死循环；工具 description 写不好，LLM 选了错误的工具或传了错误的参数。

**② 六要素对照表**：

| 要素     | System Prompt 填什么                                                                                         | 工具 description 填什么                                                                                            |
| :------- | :----------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| 角色     | 智能助手，具备工具调用能力                                                                                   | 工具本身（如 `query_order`）                                                                                       |
| 任务     | 分析用户需求，必要时调工具，完成回答                                                                         | 描述工具能完成什么操作（给 LLM 判断"什么时候该调此工具"）                                                          |
| 上下文   | 可用工具列表（名称 + 简要描述）、对话历史                                                                    | 工具的参数 Schema（类型、必填/可选）                                                                               |
| 约束     | ① max_iter 内完成；② 不需要工具时直接回答不调；③ 工具失败告知用户不重试超过 3 次；④ 完成后用自然语言总结结果 | ① 参数格式必须写清楚（如"订单号，格式如 ORDER123"）；② 描述要写"触发条件"（如"当用户询问订单状态/物流信息时使用"） |
| 参考     | 工具返回的真实数据（不是凭记忆）                                                                             | 工具实际执行逻辑（如 Feign 调哪个服务）                                                                            |
| 输出格式 | 自然语言回复，或 tool_calls JSON                                                                             | 工具返回的格式化字符串                                                                                             |

**③ 示例 Prompt**（System Prompt，可直接用）：

```
你是智能助手，具备调用工具完成任务的能力。

可用工具：
- get_current_time：获取当前时间（无参数）
- calculate：计算数学表达式，参数 expression（如 '2+3*4'）
- query_order：查询订单详情，参数 order_id（格式如 ORDER123）

行为规则：
1. 当用户的问题需要工具才能回答时，调用合适的工具；不需要工具时直接回答，不调工具
2. 每次只调用与当前需求相关的工具，不调用无关工具
3. 工具调用失败时，尝试其他方案或告知用户，同一工具不重试超过 3 次
4. 获得足够信息后，用自然语言总结结果，停止调用工具
5. 禁止编造数据——所有事实性回答必须来自工具返回结果
```

**④ 反例 + 为什么**：

```
System Prompt：'你是万能助手，尽力帮助用户，可以使用任何工具。'   // ❌
```

错在哪：① 没写"不需要工具时直接回答"——Agent 每一轮都强行调工具，浪费 API 费用；② 没写"工具失败不重试超过 3 次"——工具挂了 Agent 陷入死循环，API 费用爆炸（真实案例：一个 bug 导致 $200 的 API 费用）；③ 没写"禁止编造数据"——工具返回空时 LLM 会自己编一个订单号应付用户。

```
工具 description：'查订单'   // ❌
```

错在哪：description 只写了工具名，没写"什么时候用"——LLM 看到用户说"我上次买的那个"，不知道"查订单"工具能处理这个场景，不敢调，导致工具白注册了。

**⑤ 完成标准**：能独立写出包含**调工具规则 / 停止条件 / 不编造数据 / 失败不重试超过 3 次**四条款的 System Prompt，以及每个工具描述包含"触发条件 + 参数格式"的 description。

---

### 🔒 G2 讲解门禁

> **AI：** 确认以上讲解的学习者都表示理解。**必须等用户明确回复"没问题"/"理解了"等肯定词，未收到回复前不得出题。** 全部确认 → 放行。

---

## 阶段一：理解验证（Quiz 闭卷）

### 概念难度与题目配额

| 概念                         |  难度  | 最少题数 | 出题说明  |
| ---------------------------- | :----: | :------: | --------- |
| Reason→Act→Observe 循环      | ⭐⭐⭐ |    3     | 核心难点  |
| max_iter 与停止标准          | ⭐⭐⭐ |    3     | 核心难点  |
| tool_call_id 与消息历史      |  ⭐⭐  |    2     | 选择+判断 |
| 死循环与常见问题             |  ⭐⭐  |    2     | 选择+场景 |
| 文本模式 vs 原生 tool_choice |  ⭐⭐  |    2     | 选择+判断 |

### 题目池

#### 选择题

**Q-C1.** ReAct 循环三个步骤的正确顺序是？

- A. Act → Reason → Observe
- B. Reason → Act → Observe
- C. Observe → Act → Reason
- D. Reason → Observe → Act

**Q-C2.** `max_iter` 的最主要作用是？

- A. 提高回答质量
- B. 防止死循环、控制 API 费用爆炸
- C. 加快单次模型调用速度
- D. 强制模型必须调用工具

**Q-C3.** Agent 如何知道"该停止"了？

- A. 到达固定运行时间
- B. 模型不再返回 `tool_calls`（或达到 `max_iter`）
- C. 用户说"停止"
- D. 只要调用过一次工具就停止

**Q-C4.** 工具返回结果过长、超出上下文窗口时，推荐的做法是？

- A. 增大 `max_iter`
- B. 让工具返回摘要而非全量数据
- C. 强制 `tool_choice="required"`
- D. 提高模型采样温度

#### 判断题

**Q-J1.** 每次工具调用都必须带上 `tool_call_id`，模型才能知道结果对应哪次调用。

**Q-J2.** 工具执行失败时应该直接把错误丢弃，不让模型知道，这样输出更干净。

**Q-J3.** 生产环境推荐使用文本模式 ReAct 而非原生 tool_choice。

#### 场景分析题

**Q-S1.** 用户想退货 ORDER123。请用 ReAct 的 Reason→Act→Observe 循环描述至少两轮的完整执行过程。

**Q-S2.** Agent 反复调用工具但永远不给出最终答案。请列出至少 2 种排查思路和对应解决方案。

#### 代码/实践题

**Q-P1.** 补全 ReAct 循环的终止条件：

```python
def react_loop(user_message, max_iter=10):
    messages = [...]
    for i in range(___):          # 用 max_iter 限制迭代次数
        ...
        if not message._______:   # 模型决定停止的条件
            return message.content
        ...
    return "抱歉，处理超时，请稍后重试。"
```

---

## 批改与补考机制

### 补考规则

| 错误概念                | 补考出题方向                      |
| ----------------------- | --------------------------------- |
| Reason→Act→Observe 循环 | 画出循环图并标注每步输入输出      |
| max_iter 与停止标准     | 分析 max_iter 设太小/设太大的后果 |
| tool_call_id 与消息历史 | 缺失消息历史会导致什么            |
| 死循环与常见问题        | Agent 不调用工具的另一类故障场景  |

---

### 🔒 G3 理解门禁

> **AI：** 确认所有概念点全部通过。全部通过 → 放行。有未通过 → 补考。

---

## 实践任务：跑通 P3_ReAct_Demo

1. 打开 `D:\微服务项目\AgentProject\P3_ReAct_Demo\p3_react_agent.py`
2. 配置 API Key（在 .env 文件中）
3. 运行 `python p3_react_agent.py`
4. 测试以下输入：
   - "现在几点了？" → 应调用 get_current_time
   - "帮我算一下 123 * 456" → 应调用 calculate
   - "你好" → 不应调用工具，直接回复
   - "帮我查订单 ORDER123，然后告诉我能不能退货" → 应多轮调用

---

## 🎯 学完检查

| 检查项                              | 自己回答 |
| ----------------------------------- | -------- |
| ReAct 三个步骤是什么？              |          |
| max_iter 为什么重要？               |          |
| Agent 怎么知道该停了？              |          |
| 死循环怎么预防？                    |          |
| 文本模式和原生 tool_choice 怎么选？ |          |

---

> **下一步：** 完成后进入 `06-AI能力-Agent安全防护实战.md`。

---

## 2026年最新动态

### ReAct 演进：从 ReAct 到 Plan-and-Execute

```
2023 ReAct:     Reason → Act → Observe（一步一思考）
2024 Tool-use:  原生 function calling（结构化工具调用）
2025 Plan-Execute: 先规划再执行（Plan → Execute → Verify）
2026 Agentic:   多 Agent 协作 + 自主规划 + 自我纠错
```

**当前最佳实践：** 生产环境用原生 tool_choice + ReAct 循环结构，复杂场景叠加 Plan-and-Execute 模式。

---

## 判断力日志：ReAct 循环的设计取舍

### 问题

你在设计 Agent 的执行循环时面临的核心矛盾：Agent 不能只调用一次 LLM 就结束（用户问"帮我退货 ORDER123"，需要先查订单→判断退货条件→创建退货单→告知结果，至少 3 轮），但如果不限制循环次数，Agent 可能陷入死循环——工具调用失败→重试→再失败→再重试，API 费用无声爆炸（真实案例：一个 bug 导致 $200 的 API 费用）。你需要在"多轮思考能力"和"死循环防护"之间找到平衡。

### 决策

我选择了**Reason→Act→Observe 循环 + max_iter 硬限制 + 工具失败不重试超过 3 次**：

- **循环结构**：Reason（模型分析+决定）→ Act（执行工具调用）→ Observe（观察结果）→ 回到 Reason，直到模型决定停止（不返回 tool_calls）或达到 max_iter
- **max_iter = 10**：硬限制循环次数，防止死循环。10 轮足够覆盖大多数多步任务（查订单→判断条件→创建退货单→告知结果 = 约 3-5 轮），超出返回"处理超时"
- **停止条件**：模型不再返回 `tool_calls` 时自动停止，不需要用户手动干预
- **工具失败处理**：捕获异常 → 返回错误信息给模型 → 模型尝试其他方案 → 同一工具失败不重试超过 3 次
- **生产环境用原生 tool_choice**：`tool_choice="auto"` + 结构化 `tool_calls` 返回，避免文本模式的正则解析错误

### 取舍

- **文本模式 ReAct vs 原生 tool_choice**：文本模式（Prompt 要求 AI 输出 Thought/Action 格式）灵活但解析脆弱——AI 不按格式输出时正则匹配失败，Agent 卡住。原生 tool_choice 由 API 保证结构化返回，解析零错误，但依赖 API 支持。**取舍结论**：学习阶段用文本模式理解循环本质，生产环境坚决用原生 tool_choice
- **max_iter 设多少？**：设太小（如 3）→ 复杂任务未完成就强制终止，用户体验差。设太大（如 50）→ 死循环时 API 费用爆炸。**取舍结论**：10 是经验值——覆盖 90% 的多步任务，超出时兜底返回"处理超时"，用户可重试
- **工具失败要不要告诉模型？**：不告诉 → 模型不知道失败，继续用错误假设推理，答案全错。告诉 → 模型可能反复重试同一工具，陷入死循环。**取舍结论**：告诉模型失败信息 + 限制同一工具不重试超过 3 次，让模型有机会换策略但不无限重试
- **消息历史保留多少？**：全保留 → Token 爆炸。不保留 → 模型没有上下文，决策质量下降。**取舍结论**：保留所有轮次的消息历史（含 tool_call_id），让模型有完整上下文，配合上下文工程的滑动窗口/摘要压缩控制 Token

### 防什么失败

- **防"Agent 只调用一次就没下文"**：ReAct 循环保证模型持续思考→执行→观察，直到任务完成。不是"一次调用就结束"的聊天机器人模式
- **防"死循环 API 费用爆炸"**：max_iter=10 硬限制 + 工具失败不重试超过 3 次，双重防护。即使出现 bug，最多 10 轮 × 3 次重试 = 30 次 API 调用，费用可控
- **防"工具失败直接崩"**：try-catch 捕获异常，返回错误信息给模型，模型可以换策略或告知用户，不会因一个工具挂了整个 Agent 崩溃
- **防"解析错误导致 Agent 卡住"**：生产环境用原生 tool_choice（结构化 JSON），不用正则匹配文本。从根源消除"AI 输出格式不对→解析失败→Agent 卡住"的故障模式
- **防"面试被问住"**：ReAct 是 Agent 开发的基础模式，面试必考。理解 Reason→Act→Observe 循环 + max_iter + 停止条件 + 文本模式 vs 原生 tool_choice 的区别，是 Agent 工程师的基本功
