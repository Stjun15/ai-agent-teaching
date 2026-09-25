# Phase 4 AI能力 · Function Calling 实战（v2.0）

> **一句话总结：** 讲 Function Calling 实战：让 LLM 凭工具 Schema 的 description 判断调哪个工具、传什么参数（不执行代码），含 Schema 四层校验、友好错误返回、并行调用，是 Agent 能做的起点。

> **前置文档**
>
> - `0A-Python基础速通`（`01-基础补强/`）—— 文首要求 Python 基础
> - `06-AI能力-LLM集成模式`（`06-AI能力/`）—— 文档下一步前置：先接 LLM

> **后置文档**
>
> - `06-AI能力-Tools设计实战`（`06-AI能力/`）—— 文档下一步：工具定义与设计
> - `S5-M2-tool-registry`（`00-路线图与架构/主线任务/`）—— 工具注册对接主线 S5

> **技术栈说明：** 编排层用 **TypeScript**（agent-platform），推理层用 **Python**（ai-service）。
>
> **AI角色：老师。** 目标是让学习者在45分钟内理解 Function Calling 的完整链路：工具 Schema 定义 → 模型决策 → 参数传递 → 结果返回 → 多轮调用。
>
> **防什么失败？** 防"Agent 只会聊天不会做事"。防"给了 Agent 工具，但 Agent 乱调用"。防"工具参数传错，Agent 不知道怎么办"。

---

## 为什么需要 Function Calling？

> **真实场景：** 某团队花了3个月做了一个"智能客服"，上线后用户说"帮我查订单 ORDER123"，系统回复"好的，请告诉我您的订单号..."——用户已经告诉它了！问题出在哪？这个系统只是一个聊天机器人，它没有"手"——不能查询数据库、不能调用 API。Function Calling 就是给 Agent 装上"手"。

**类比：电话客服 vs 自助终端**

```
电话客服（聊天机器人）：
  你："帮我查余额"
  客服："好的，您的余额是..."（他只能告诉你，不能操作）

自助终端（Agent with Function Calling）：
  你："帮我查余额"
  终端：① 读取你的卡 → ② 查询数据库 → ③ 显示余额
  （它能真正"做事"）
```

---

## 前置要求

- 已完成 `0A-Python基础速通`
- 已完成 `06-AI能力-LLM集成模式`
- 有一个 LLM 的 API Key

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止。

---

## 核心概念

### 第一讲：Function Calling 是什么

#### 聊天机器人 vs Agent 的区别

```
聊天机器人：只有"嘴"
  用户："帮我查订单 ORDER123"
  机器人："好的，请提供您的订单号..."（永远在问，从不执行）

Agent（有 Function Calling）：有"手"
  用户："帮我查订单 ORDER123"
  Agent：
    Step 1: 模型决定"需要调用 query_order 工具"
    Step 2: 模型生成参数 {"order_id": "ORDER123"}
    Step 3: 程序执行 query_order("ORDER123") → 查到订单数据
    Step 4: 把查询结果返回给模型
    Step 5: 模型生成回答："您的订单已发货，预计明天到达"
```

#### Function Calling 的本质

```
┌──────────────────────────────────────────────────────────────┐
│              Function Calling 数据流                          │
│                                                              │
│  ① 你定义工具 Schema（告诉 LLM"我有哪些工具"）                 │
│       │                                                      │
│       ▼                                                      │
│  ② LLM 分析用户输入，决定"要不要调工具、调哪个、传什么参数"    │
│       │                                                      │
│       ▼                                                      │
│  ③ LLM 返回"工具调用请求"（JSON 格式）                        │
│       │  {"name": "query_order", "arguments": {...}}         │
│       ▼                                                      │
│  ④ 你的程序解析这个请求，实际执行工具                          │
│       │                                                      │
│       ▼                                                      │
│  ⑤ 把执行结果返回给 LLM                                       │
│       │                                                      │
│       ▼                                                      │
│  ⑥ LLM 根据结果生成最终回答                                   │
└──────────────────────────────────────────────────────────────┘

关键理解：LLM 不执行任何代码！它只是"说"我想调什么工具。
```

---

### 第二讲：工具 Schema 定义

#### Schema 是工具的"使用说明书"

```python
# src/ai-service/tools/schemas.py — 工具 Schema 定义
# Schema 设计原则：
# 1. name：清晰、动词开头，如 query_order、create_return
# 2. description：最重要！模型靠这个判断"什么时候该用这个工具"
# 3. parameters：类型要准确，描述要具体
# 4. required：明确标记哪些参数必填

query_order_schema = {
    "type": "function",
    "function": {
        "name": "query_order",
        "description": "根据订单号查询订单详情，包括订单状态、金额、商品列表、物流信息",
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "订单号，格式如 ORDER123"
                }
            },
            "required": ["order_id"]
        }
    }
}

# 工具2：查询物流
query_logistics_schema = {
    "type": "function",
    "function": {
        "name": "query_logistics",
        "description": "查询订单的物流详情。当用户询问物流进度、快递位置、预计送达时间时使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "订单号"}
            },
            "required": ["order_id"]
        }
    }
}

# 工具3：知识库检索
knowledge_search_schema = {
    "type": "function",
    "function": {
        "name": "search_knowledge",
        "description": "在知识库中搜索信息。当用户询问商品信息、售后政策、优惠活动时使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词或问题"}
            },
            "required": ["query"]
        }
    }
}
```

---

### 第三讲：完整的 Function Calling 流程

```python
# src/ai-service/agent/function_calling_agent.py — 完整流程
import json
from openai import OpenAI

client = OpenAI()

def function_calling_demo(user_message: str):
    # 1. 定义工具
    tools = [query_order_schema, query_logistics_schema, knowledge_search_schema]

    # 2. 第一次调用模型：让模型决定要不要调工具
    response = client.chat.completions.create(
        model="gpt-5.6-luna",  # 简单决策用 Luna，省钱
        messages=[
            {"role": "system", "content": "你是客服助手，帮助用户查询订单和商品信息。"},
            {"role": "user", "content": user_message}
        ],
        tools=tools,
        tool_choice="auto"  # 让模型自动决定
    )

    message = response.choices[0].message

    if message.tool_calls:
        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)
            print(f"模型决定调用: {tool_name}, 参数: {tool_args}")

            # 3. 执行工具
            tool_result = execute_tool(tool_name, tool_args)

            # 4. 把结果返回给模型
            messages = [
                {"role": "system", "content": "你是客服助手。"},
                {"role": "user", "content": user_message},
                message.model_dump(),
                {"role": "tool", "tool_call_id": tool_call.id, "content": tool_result}
            ]

            # 5. 模型生成最终回答
            final_response = client.chat.completions.create(
                model="gpt-5.6-luna",
                messages=messages
            )
            return final_response.choices[0].message.content
    else:
        return message.content  # 不需要工具，直接回答


def execute_tool(tool_name: str, args: dict) -> str:
    """模拟工具执行"""
    tools_map = {
        "query_order": lambda a: f"订单{a['order_id']}: 状态=已发货，金额=299元",
        "query_logistics": lambda a: f"订单{a['order_id']}: 快递已到达北京",
        "search_knowledge": lambda a: f"关于'{a['query']}'的搜索结果: ...",
    }
    return tools_map.get(tool_name, lambda _: "工具不存在")(args)
```

#### 并行调用 vs 串行调用

```
并行调用：多个不相关的工具同时调用
  用户："查一下 ORDER123 的订单，顺便告诉我物流到哪了"
  → 模型同时返回 query_order 和 query_logistics 两个 tool_call
  → 程序并行执行两个工具

串行调用：后一个工具依赖前一个工具的结果
  用户："查一下 ORDER123，如果金额大于200就帮我申请退货"
  → 第1轮：调用 query_order → 得到金额=299
  → 第2轮：模型判断金额>200，调用 create_return
```

---

### 第四讲：参数校验——不要信任模型传的参数

```python
# src/ai-service/tools/validators.py — 参数校验
def query_order(order_id: str) -> str:
    # 1. 类型校验：模型可能传整数
    if not isinstance(order_id, str):
        return "错误：order_id 必须是字符串"

    # 2. 非空校验：模型可能传空字符串
    if not order_id or not order_id.strip():
        return "错误：order_id 不能为空"

    # 3. 长度校验：防止溢出攻击
    if len(order_id) > 50:
        return "错误：order_id 长度不能超过50"

    # 4. 格式校验：防止注入攻击
    import re
    if not re.match(r'^[A-Za-z0-9_-]+$', order_id):
        return "错误：order_id 格式不正确"

    # 5. 实际查询
    order = db.query(order_id)
    if not order:
        return f"未找到订单 {order_id}"
    return f"订单{order_id}: 状态={order.status}, 金额={order.amount}"
```

---

## 对比讲解：差做法 vs 好做法

| 维度               | ❌ 差做法            | ✅ 好做法                                      |
| ------------------ | -------------------- | ---------------------------------------------- |
| Schema description | "查询订单"（太模糊） | "根据订单号查询订单详情，包括状态、金额、物流" |
| 参数校验           | 不校验，信任模型     | 类型+非空+长度+格式 四层校验                   |
| 错误处理           | 工具失败直接崩       | 返回友好错误信息给模型                         |
| 并行/串行          | 全部串行执行         | 不依赖的工具并行执行                           |
| 模型选择           | 所有工具用同一个模型 | 简单决策用 Luna，复杂推理用 Sol                |

---

### 提示词教学：工具选择与参数提取 Prompt

> **AI：** 不重讲六要素模板（真源：`03-AI协作构建\03-AI协作构建技能.md`；进阶：`06-AI能力-Prompt工程实战.md`），只讲 Function Calling 场景怎么填。

**① 场景**：Function Calling 的核心挑战是 LLM 必须在**不执行代码**的前提下，仅凭工具 Schema 的 description 判断"要不要调工具、调哪个、传什么参数"。错误决策的代价极高——调了错误的工具，用户看到完全无关的回复；参数提取错了，工具执行失败或返回脏数据。本场景的 prompt 本质上是**工具 Schema 的 description 设计**——这是六要素落到"给 LLM 看的接口文档"的典型场景。

**② 六要素对照表**：

| 要素     | 工具 Schema 填什么                                                                                                                          |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| 角色     | 工具本身（如 `query_order` / `create_return`）                                                                                              |
| 任务     | 描述工具能完成什么操作，以及**触发条件**（"当用户询问订单状态/物流信息时使用"）                                                             |
| 上下文   | 参数 Schema（类型、必填/可选、格式说明）+ 工具之间的依赖关系（哪个工具的输出是另一个工具的输入）                                            |
| 约束     | ① 参数格式必须写清楚（如"订单号，格式如 ORDER123"）；② 必填参数标记 required；③ 描述中暗示串行/并行关系（如"查询订单后才能判断是否可退货"） |
| 参考     | 1-2 个示例：用户说什么话时应该调这个工具（如"用户说'我的订单到哪了'→调用 query_order"）                                                     |
| 输出格式 | 工具返回的格式化字符串（人类可读 + 摘要 + 含关键字段）                                                                                      |

**③ 示例 Prompt**（工具 Schema 的 description 设计，可直接用）：

```
# 工具1：查订单
{
  "name": "query_order",
  "description": "根据订单号查询订单详情，包括订单状态、金额、商品列表、物流信息。当用户询问订单状态、订单金额、购买记录、退货条件时使用。",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "订单号，格式如 ORDER123（ORDER + 3位数字）"
      }
    },
    "required": ["order_id"]
  }
}

# 工具2：查物流
{
  "name": "query_logistics",
  "description": "查询订单的物流详情。当用户询问物流进度、快递位置、预计送达时间、包裹到哪了时使用。注意：需要先调用 query_order 确认订单存在且已发货。",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "订单号，格式如 ORDER123"
      }
    },
    "required": ["order_id"]
  }
}

# 工具3：创建退货单
{
  "name": "create_return",
  "description": "创建退货单。当用户明确要求退货/退款/取消订单时使用。注意：必须先用 query_order 确认订单状态为"已发货"且"7天内"，不符合条件时告知用户不调用此工具。",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "要退货的订单号"
      },
      "reason": {
        "type": "string",
        "description": "退货原因，如'不想要了''质量问题''发错货'"
      }
    },
    "required": ["order_id", "reason"]
  }
}
```

**④ 反例 + 为什么**：

```
工具 Schema：{
  "name": "do_stuff",
  "description": "处理订单相关的事情",
  "parameters": {"order_id": {"type": "string"}, "action": {"type": "string"}}
}   // ❌
```

错在哪：① name 模糊——`do_stuff` 不能告诉 LLM 这个工具具体做什么，LLM 不知道什么时候该调；② description 没有触发条件——LLM 无法判断"用户说'我的订单到哪了'时该不该调这个工具"；③ 参数没有格式说明——LLM 可能传 `order_id: "123"` 而不是 `"ORDER123"`，工具执行失败；④ 没有 required 标记——LLM 可能漏传 `action` 参数，工具收到 null 崩溃。

**⑤ 完成标准**：能独立为每个工具写出包含**触发条件（"当用户...时使用"）/ 参数格式说明 / 工具间依赖关系 / required 标记**四条款的 Schema description。

---

### 🔒 G2 讲解门禁

> **AI：** 确认以上讲解的学习者都表示理解。**必须等用户明确回复"没问题"/"理解了"等肯定词，未收到回复前不得出题。** 全部确认 → 放行。

---

## 阶段一：理解验证（Quiz 闭卷）

**Q-C1.** 关于 Function Calling 中"模型执行工具"的说法，正确的是？

- A. 模型直接调用 Python 函数并返回结果
- B. 模型只返回"工具调用请求"（JSON格式），由程序执行工具
- C. 模型只能调用一个工具

**Q-C2.** 用户说"查一下 ORDER123 的状态，顺便看看物流到哪了"，最优做法是？

- A. 先查订单，再查物流，串行
- B. 同时返回两个 tool_call，并行执行
- C. 只查订单

**Q-C3.** 工具 Schema 中最重要的字段是？

- A. name
- B. description（模型靠它判断什么时候用这个工具）
- C. parameters

**Q-J1.** 模型传的参数不需要校验，因为 LLM 不会传错。

**Q-S1.** 用户说"ORDER456 多少钱？能退货吗？物流到哪了？"请设计 Agent 的工具调用方案（并行/串行）。

---

## 🎯 学完检查

| 检查项                               | 自己回答 |
| ------------------------------------ | -------- |
| Function Calling 的本质是什么？      |          |
| Schema 的 description 为什么最重要？ |          |
| 什么时候并行调用？什么时候串行？     |          |
| 参数校验应该检查什么？               |          |

---

> **下一步：** 完成后进入 `06-AI能力-Tools设计实战.md`。

---

<!-- 教学补全：P2-X 会话追加 -->

## Quiz（闭卷）

> **AI：** 出 5 道题考下面内容，每题先批改，不通过进入补考。

1. **Function Calling 的本质**：用自己的话描述 Function Calling 的完整数据流（6 步），并说明"LLM 不执行任何代码"这句话为什么是理解 Function Calling 的关键。

2. **工具 Schema 的 description**：为什么说 description 是 Schema 中最重要的字段？如果 description 只写"查询订单"三个字，会导致什么具体问题？请给出至少两个。

3. **并行 vs 串行调用**：用户说"ORDER123 的物流到哪了？顺便看看这个订单能不能退"，Agent 应该怎么安排工具调用（并行/串行）？画出调用顺序并解释每一步的决策依据。

4. **参数校验**：模型传的参数需要哪四层校验？为什么不能信任模型传的参数？如果跳过校验，最坏情况下会发生什么？

5. **跨讲串联**：从工具 Schema 定义 → 模型决策 → 参数传递 → 结果返回 → 多轮调用，这五个环节中哪个环节最容易出错？为什么？如果这个环节出错，下游环节会怎么被影响？

**答案：**

1. 六步：定义 Schema → LLM 分析输入 → 返回 tool_call JSON → 程序执行工具 → 结果返回 LLM → LLM 生成最终回答。关键：LLM 只输出"我想调什么工具"，不执行代码，执行权在程序手里。
2. 因为 LLM 靠 description 判断"什么时候该用这个工具"。只写"查询订单"的问题：① 不知道触发条件（用户说"我的订单到哪了"时不知道该不该调）；② 不知道返回什么字段（LLM 拿到结果后不知道怎么解读）。
3. 串行：先 query_order（确认订单存在且状态），再根据结果决定是否调用 create_return（需要先判断金额、是否在退货期内）。不能并行，因为 create_return 依赖 query_order 的结果。
4. 四层校验：类型校验、非空校验、长度校验、格式校验。不能信任的原因：LLM 会幻觉，可能传错误类型、空值、超长字符串、注入攻击。最坏情况：SQL 注入导致数据泄露。
5. 模型决策环节最容易出错。因为 LLM 不执行代码，仅凭 Schema 文字做判断，可能选错工具或传错参数。下游影响：参数错误 → 工具执行失败 → 错误结果返回 LLM → LLM 基于错误结果生成错误回答。

---

## 补考环节

> **AI：** 对答错的题，换一个角度（非原题）再出题，直到学习者理解。答错者重做，出 3 道非原题验证理解。

1. **如果反过来**：假设你的工具 Schema 的 description 写得非常详细（200 字），但 name 写成了 `qo`（缩写）。LLM 在用户说"帮我查一下 ORDER456 的详情"时，会正确调用这个工具吗？为什么？这说明了 Schema 中 name 和 description 的分工是什么？

2. **换一个场景**：你要给一个"酒店预订"Agent 设计三个工具：`search_hotel`（搜索酒店）、`check_availability`（查房态）、`book_room`（预订房间）。请写出这三个工具的调用依赖关系（哪些可以并行、哪些必须串行），并说明为什么。

3. **为什么不能**：为什么工具执行失败时，不能直接把 Python 异常堆栈返回给 LLM？如果返回了 `TypeError: 'NoneType' object is not subscriptable` 给 LLM，LLM 会怎么处理？正确的做法应该返回什么？

**答案参考：**

1. 不会。因为 name 是 LLM 做工具匹配的第一入口，`qo` 与用户说的"查订单"无语义关联。分工：name 用于匹配识别，description 用于触发条件判断和参数理解。
2. search_hotel 和 check_availability 的参数如果独立（按城市和日期搜索 vs 按酒店 ID 查房态），则不能直接并行——因为用户可能先搜再选酒店。book_room 必须串行在 check_availability 之后（确认有房才能订）。
3. 因为 LLM 看不懂异常堆栈，会把它当作"工具执行结果"来回答用户，可能说"您的订单出现了一个 TypeError"。正确做法：返回友好错误信息，如"查询超时，请稍后重试"。

---

## 动手环节：给一个空 Agent 装上"手"（代码级）

> **AI：** 指导学习者逐步完成，每步贴代码、每步验证。全程约 60 分钟。
> **总目标：** ① 为一个空 Agent 定义 3 个工具 Schema；② 实现完整的 Function Calling 循环；③ 验证并行调用和串行调用两种场景。
> **核心约束：** 工具执行函数可以 mock（返回假数据），但 Schema 和 Function Calling 循环必须是真实可运行的代码。

---

### Step 1：定义 3 个工具 Schema（10 分钟）

**任务：** 为"天气助手"Agent 定义 3 个工具：`get_weather`（查天气）、`get_air_quality`（查空气质量）、`get_clothing_advice`（穿衣建议，依赖天气结果）。

**具体操作：** 用 Python 写出 3 个 Schema，每个必须包含 name、description（含触发条件）、parameters（含 required 标记）。

```python
get_weather_schema = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询指定城市的当前天气，包括温度、湿度、天气状况。当用户询问天气、温度、会不会下雨时使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名称，如'北京'、'上海'"}
            },
            "required": ["city"]
        }
    }
}
```

**✅ 验证标准：** 3 个 Schema 的 description 都包含"当用户...时使用"的触发条件，parameters 都有 required 标记。

---

### Step 2：实现 Function Calling 循环（20 分钟）

**任务：** 写一个 `function_calling_loop(user_message)` 函数，实现完整的 6 步流程。

**具体操作：**

1. 将 3 个 Schema 传入 LLM
2. 解析 LLM 返回的 tool_calls
3. 执行工具（mock 实现即可）
4. 将结果返回 LLM
5. 获取最终回答

**✅ 验证标准：** 输入"北京今天天气怎么样？"→ 输出包含天气信息；输入"你好"→ 不调用工具，直接回复。

---

### Step 3：验证并行调用（15 分钟）

**任务：** 测试"北京今天天气怎么样？空气质量如何？"这个输入，验证 LLM 能否并行调用 `get_weather` 和 `get_air_quality`。

**✅ 验证标准：** 一次 LLM 调用返回两个 tool_calls，程序并行执行两个工具，最终回答同时包含天气和空气质量信息。

---

### Step 4：验证串行调用（15 分钟）

**任务：** 测试"北京今天天气怎么样？适合穿什么？"这个输入，验证 LLM 能否先调用 `get_weather` 获取天气，再根据天气结果调用 `get_clothing_advice`。

**✅ 验证标准：** 分两轮 LLM 调用——第一轮返回 get_weather 的 tool_call，第二轮基于天气结果返回 get_clothing_advice 的 tool_call，最终回答是穿衣建议而非天气数据。

---

## 判断力日志

> **AI：** 引导学习者写一条判断力日志，四段式（问题→决策→取舍→防什么失败）。

**提示要点：**

1. **问题：** Function Calling 中，工具 Schema 的 description 到底要写多详细？写太少 LLM 不会用，写太多会不会有反效果？

2. **决策：** 你决定按"触发条件 + 参数格式 + 返回值说明 + 工具间依赖"四条款来写 description。这个决策的依据是什么？

3. **取舍：**
   - description 写详细了，token 消耗会增加。你在"准确性"和"成本"之间怎么取舍？
   - 参数校验写到什么程度？四层校验（类型/非空/长度/格式）全做，还是只做前两层？

4. **防什么失败：**
   - 防"工具给了但 Agent 不会用"——description 没写触发条件，LLM 判断不了什么时候该调。
   - 防"参数传错导致工具静默失败"——没校验参数，LLM 传了空字符串，工具返回空结果，LLM 说"没有找到相关信息"。
   - 防"并行调用写成串行"——不相关的工具串行调用，用户等 3 秒才拿到结果，体验差。

**写日志格式：**

```
## 判断力日志：Function Calling 工具 Schema 设计

### 问题
[描述你面临的问题]

### 决策
[描述你做了什么决策]

### 取舍
[描述你的取舍：哪些做了、哪些没做、为什么？]

### 防什么失败
[描述这个决策防止了哪些失败模式？]
```
