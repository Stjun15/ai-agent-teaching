# Phase 4 AI能力 · LLM 集成模式实战（v2.0）

> **一句话总结：** 用"客服首字延迟6秒"的痛点讲清同步/异步/流式/批量四种 LLM 调用模式及其适用场景，并走读 ai-service 的 llm_client.py 实现。

> **前置文档**
>
> - `06-AI能力-Harness工程设计`（`06-AI能力/`）—— 理解 Agent 运行机制后，再学"怎么高效地调 LLM"才有的放矢。

> **后置文档**
>
> - `06-AI能力-意图识别实战`（`06-AI能力/`）—— 本文"下一步"指定：掌握调用模式后，进入意图识别让 Agent 决定何时调什么。

> **AI角色：老师。** 你不是编码者，你是出题者+批改者+讲解者。目标是让学习者在45分钟内掌握 LLM 调用的核心模式：同步/异步/流式/批量，以及流式响应的完整实现。
>
> **防什么失败？** 防"不知道什么时候用流式、什么时候用同步"。防"LLM 调用超时，不知道怎么处理"。防"不知道 Streaming 和普通调用的区别"。防"流式响应写到一半断了，用户看到半句话"。

---

## 为什么需要：真实场景的痛点

2026 年 3 月，HMall 客服系统上线第一周，用户投诉率飙升 40%。原因很简单：用户问"我的订单到哪了？"，Agent 需要先调意图识别（1s）、再查订单（2s）、再调 LLM 生成回复（3s），总共 6 秒用户才看到第一个字。用户以为系统卡死了，疯狂刷新，导致重复请求雪崩。

**两个核心问题：**

1. 用户等待 6 秒 → 体验差，转人工率飙升
2. 所有请求都走同步 → 一个慢请求堵住后面所有请求

**解决方案：流式响应 + 异步架构。** 用户 200ms 内看到第一个字"您"，然后逐字打印，虽然总耗时还是 6 秒，但用户感知延迟从 6 秒降到 200ms。

---

## 设计原理

| 原则             | 在本技能中的体现                        |
| ---------------- | --------------------------------------- |
| **对比教学**     | 四种调用模式的对比：同步/异步/流式/批量 |
| **代码走读**     | 讲解 ai-service/llm_client.py 的实现    |
| **动手优先**     | 每种模式都提供可运行的代码              |
| **最小可行知识** | 只学四种调用模式，不学所有 LLM 细节     |

---

## 前置要求

- 已完成 `0A-Python基础速通`
- 有 OpenAI API Key

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止。

---

## 第一讲：四种调用模式全景图

### 类比：四种模式 = 四种点餐方式

```
同步调用  = 在柜台前站着等，菜做好了才走
            → 简单，但后面的人都要等你

异步调用  = 拿个震动器，去旁边坐着，好了叫你
            → 不堵柜台，可以同时点多个菜

流式调用  = 厨师一边炒一边往你盘子里夹
            → 你看到菜在变多，不用等整盘上桌

批量调用  = 食堂打饭，一次打 100 份，不着急
            → 效率高，但每份都要等很久
```

### 四种模式架构图

```
┌──────────────────────────────────────────────────────────────┐
│                      LLM 调用模式决策树                        │
│                                                              │
│  用户请求 ──→ 需要实时反馈？                                   │
│       │          ├── 是 → 聊天界面？ ──→ 流式调用 (Stream)     │
│       │          │       └── 后台任务？ ──→ 同步调用 (Sync)    │
│       │          │                                           │
│       │          └── 不需要实时？                              │
│       │                 ├── 需要并发？ ──→ 异步调用 (Async)    │
│       │                 └── 大批量离线？ ──→ 批量调用 (Batch)  │
│       │                                                      │
│       └── Agent 决策（需要完整结果）──→ 同步/异步（非流式）     │
│                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │
│  │ 同步模式 │   │ 异步模式 │   │ 流式模式 │   │ 批量模式 │     │
│  │ 阻塞等待 │   │ 协程并发 │   │ 逐token  │   │ 离线生成 │     │
│  │ 简单直接 │   │ 高吞吐  │   │ 低延迟感 │   │ 低成本  │     │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 第二讲：四种调用模式详解

### 1. 同步调用（最基础）

**场景：** 凌晨 3 点，后台定时任务生成日报摘要，没人等着看，同步就行。

```python
# src/ai-service/llm_client.py
from openai import OpenAI

client = OpenAI(api_key="sk-xxx")  # 从环境变量读取，不要硬编码

def sync_call(prompt: str) -> str:
    """同步调用：发送请求，阻塞等待返回"""
    response = client.chat.completions.create(
        model="gpt-5.6-luna",  # 用最便宜的模型，日报不需要顶级推理
        messages=[{"role": "user", "content": prompt}],
        timeout=30  # 30秒超时，防止无限等待
    )
    return response.choices[0].message.content

# ✅ 适用场景：后台任务、离线处理、定时任务
# ❌ 不适用场景：Web 请求（会阻塞整个请求线程）
```

### 2. 异步调用（高并发）

**场景：** 运营活动页需要同时生成 5 个不同品类的推荐文案，用户等不了串行。

```python
# src/ai-service/llm_client.py
import asyncio
from openai import AsyncOpenAI

async_client = AsyncOpenAI(api_key="sk-xxx")  # 异步客户端，不阻塞事件循环

async def async_call(prompt: str) -> str:
    """异步调用：不阻塞主线程，事件循环可以处理其他请求"""
    response = await async_client.chat.completions.create(
        model="gpt-5.6-terra",  # 推荐文案需要中端推理能力
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# 并发调用多个请求（5个同时发，不是5个依次发）
async def batch_async(prompts: list[str]) -> list[str]:
    """asyncio.gather 让所有请求并发执行，总耗时 = 最慢的那个"""
    tasks = [async_call(p) for p in prompts]  # 创建协程列表，不执行
    return await asyncio.gather(*tasks)  # 全部并发执行，等所有结果返回

# 示例：5个品类文案，串行 ≈ 15s，并发 ≈ 3s
# prompts = ["手机推荐", "电脑推荐", "耳机推荐", "手表推荐", "平板推荐"]
# results = await batch_async(prompts)

# ✅ 适用场景：高并发 Web 服务、同时调用多个 LLM
# ❌ 不适用场景：简单脚本（不需要并发，增加复杂度）
```

### 3. 流式调用（实时反馈）—— 核心中的核心

**场景：** 客服聊天界面，用户消息发出去，200ms 内看到第一个字"您"，然后逐字打印"您的订单 ORDER123 状态：已发货..."。用户感觉"秒回"。

```
流式响应的数据流：

用户发送 "查订单ORDER123"
  │
  ▼
┌──────────────┐    POST /api/chat    ┌──────────────┐
│  agent-platform │ ──────────────────→ │  ai-service   │
│  (TS 编排层)   │                      │  (Python 推理) │
│              │   stream=True         │              │
│  ① 建立SSE连接 │ ←────────────────── │  llm_client   │
│              │   SSE: data: "您"     │  .chat_stream │
│  ② 接收chunk │ ←────────────────── │              │
│              │   SSE: data: "的"     │              │
│  ③ 接收chunk │ ←────────────────── │              │
│              │   SSE: data: "订单"   │              │
│  ...逐token  │                      │              │
│              │                      │              │
│  ④ 转发给前端│ ──→ WebSocket/SSE ──→ │  浏览器渲染   │
│  (实时推送)  │                      │  (打字效果)   │
└──────────────┘                      └──────────────┘
```

```python
# src/ai-service/llm_client.py — 流式调用核心实现

def stream_call(prompt: str):
    """
    流式调用：逐 token 返回，用户能看到"打字"效果。

    为什么用 yield 而不是 return？
    yield 让函数变成生成器，每产生一个 token 就立即返回给调用方，
    不需要等全部生成完。这就是"流式"的本质。
    """
    stream = client.chat.completions.create(
        model="gpt-5.6-terra",
        messages=[{"role": "user", "content": prompt}],
        stream=True  # 关键参数：告诉 API 不要一次性返回，逐 token 推送
    )
    for chunk in stream:
        # delta.content 是本次新增的文本片段（通常1-2个字符）
        # 注意：第一个 chunk 可能没有 content（只有 role）
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content  # 立即返回，不等后续

# ✅ 适用场景：聊天界面、需要实时反馈的场景
# ❌ 不适用场景：Agent 决策（需要完整结果再判断下一步）

# ===== 流式响应的异步版本（推荐生产使用）=====
async def async_stream_call(prompt: str):
    """异步流式：生产环境推荐，不阻塞事件循环"""
    stream = await async_client.chat.completions.create(
        model="gpt-5.6-terra",
        messages=[{"role": "user", "content": prompt}],
        stream=True
    )
    async for chunk in stream:  # async for 解异步迭代器
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

### 流式响应的陷阱与解决方案

````
❌ 陷阱1：流式响应写到一半断了
  用户看到："您的订单 ORD" → 卡住了 → 5秒后 → "抱歉，请重试"
  体验比不流式还差！

✅ 解决：设置超时 + 心跳检测
  ```python
  async def stream_with_timeout(prompt: str, timeout: int = 30):
      """带超时的流式调用"""
      stream = await async_client.chat.completions.create(
          model="gpt-5.6-terra",
          messages=[{"role": "user", "content": prompt}],
          stream=True,
          timeout=timeout  # 整个流式过程的总超时
      )
      async for chunk in stream:
          yield chunk.choices[0].delta.content
````

❌ 陷阱2：流式响应不能修改已生成的内容
模型生成："您的订单 ORDER123 状态：已删除"（实际是"已发货"）
无法撤回，用户已经看到了错误信息！

✅ 解决：流式只用于展示，最终答案用普通调用验证关键信息

```python
# 先流式展示（用户体验优先）
async for token in stream_call(prompt):
    await send_to_user(token)
# 再非流式验证（准确性兜底）
verified = await async_call(f"验证以下回答是否正确：{full_answer}")
```

### 4. 批量调用（离线处理）

**场景：** 运营团队需要为 1000 个商品生成 SEO 描述，凌晨 2 点跑，不要求实时。

```python
# src/ai-service/llm_client.py
def batch_call(prompts: list[str], batch_size: int = 10) -> list[str]:
    """
    批量调用：分批处理大量请求，控制并发数。
    为什么不用 asyncio.gather 全部并发？
    因为 API 有速率限制（Rate Limit），1000 个并发会被直接拒绝。
    """
    responses = []
    for i in range(0, len(prompts), batch_size):
        batch = prompts[i:i + batch_size]  # 每次取 10 个
        for prompt in batch:
            response = sync_call(prompt)  # 串行处理每批内的请求
            responses.append(response)
        print(f"进度: {min(i + batch_size, len(prompts))}/{len(prompts)}")
    return responses

# ✅ 适用场景：离线评测、数据标注、批量生成
# ❌ 不适用场景：聊天界面（实时性要求高）
```

---

## 第三讲：四种模式对比

| 模式 |  用户感知延迟   | 并发能力 | 代码复杂度 | 适用场景 | 2026推荐模型  |
| ---- | :-------------: | :------: | :--------: | -------- | ------------- |
| 同步 |  高（等全部）   |    低    |     ⭐     | 后台任务 | GPT-5.6 Luna  |
| 异步 |  中（等全部）   |    高    |   ⭐⭐⭐   | 高并发   | GPT-5.6 Terra |
| 流式 | 低（200ms首字） |    中    |    ⭐⭐    | 聊天界面 | GPT-5.6 Terra |
| 批量 |   高（离线）    |    低    |     ⭐     | 离线生成 | GPT-5.6 Luna  |

---

## 第四讲：HMall 中的实际使用

```python
# src/ai-service/llm_client.py — 生产级 LLM 客户端

from openai import OpenAI, AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

class LLMClient:
    """
    HMall AI 服务的统一 LLM 调用入口。
    为什么封装成类？因为需要统一管理 API Key、超时、重试策略。
    """

    def __init__(self):
        # 同步客户端：用于非流式调用
        self.sync_client = OpenAI(timeout=30)
        # 异步客户端：用于流式和高并发
        self.async_client = AsyncOpenAI(timeout=60)

    # 聊天界面用流式 — 用户体验优先
    async def chat_stream(self, messages: list, session_id: str):
        """流式响应：逐 token 推送给前端"""
        stream = await self.async_client.chat.completions.create(
            model="gpt-5.6-terra",  # 聊天需要中端模型，平衡成本和质量
            messages=messages,
            stream=True,
            temperature=0.7  # 聊天场景需要一定创造性
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # Agent 决策用非流式 — 需要完整结果再判断
    async def agent_decision(self, messages: list, tools: list):
        """Agent 决策：需要完整结果才能判断下一步"""
        return await self.async_client.chat.completions.create(
            model="gpt-5.6-sol",  # Agent 决策需要最强推理能力
            messages=messages,
            tools=tools,
            temperature=0.1  # 决策场景需要确定性
        )
```

---

## 第五讲：错误处理与指数退避

```
为什么需要指数退避？

假设 ai-service 因为流量突增触发了 Rate Limit（速率限制）。
如果所有请求都立即重试 → 同时重试 → 再次触发 Rate Limit → 死循环。

指数退避：第1次等1秒，第2次等2秒，第3次等4秒...
这样重试请求分散在不同时间点，不会同时冲击 API。

┌─────────────────────────────────────────────────┐
│               重试策略时间线                       │
│                                                 │
│  请求失败 ──→ 等 1s ──→ 重试 ──→ 又失败         │
│                         └──→ 等 2s ──→ 重试     │
│                                  └──→ 又失败     │
│                                      └──→ 等 4s │
│                                           └──→ 最终失败，抛异常 │
└─────────────────────────────────────────────────┘
```

```python
# src/ai-service/llm_client.py — 错误处理与重试

from tenacity import retry, stop_after_attempt, wait_exponential
import openai

@retry(
    stop=stop_after_attempt(3),           # 最多重试3次
    wait=wait_exponential(multiplier=1, min=1, max=10)  # 1s, 2s, 4s, 最多10s
)
async def call_with_retry(messages: list, model: str = "gpt-5.6-terra"):
    """
    带重试的 LLM 调用。
    tenacity 的 retry 装饰器自动处理重试逻辑：
    - 函数抛异常 → 等 wait 时间 → 重新执行函数
    - 连续3次都失败 → 抛出最终异常
    """
    try:
        return await async_client.chat.completions.create(
            model=model, messages=messages, timeout=30
        )
    except openai.RateLimitError:
        # 速率限制：API 说"你太快了"，等一等再试
        print("速率限制，等待重试...")
        raise  # 抛出异常让 tenacity 捕获并重试
    except openai.APITimeoutError:
        # 超时：API 响应太慢，可能是网络问题或模型过载
        print("超时，等待重试...")
        raise
    except openai.APIError as e:
        # 其他 API 错误：认证失败、参数错误等
        print(f"API 错误: {e}")
        if "invalid_api_key" in str(e).lower():
            raise  # API Key 错误，重试也没用，直接抛出
        raise  # 其他错误尝试重试
```

---

### 🔒 G2 讲解门禁

> **AI：** 确认以上讲解的学习者都表示理解。**必须等用户明确回复"没问题"/"理解了"等肯定词，未收到回复前不得出题。** 全部确认 → 放行。有任何疑问 → 回到对应讲，澄清后再确认。

---

## 阶段一：理解验证（Quiz 闭卷）

### 概念难度与题目配额

| 概念                                |  难度  | 最少题数 | 出题说明       |
| ----------------------------------- | :----: | :------: | -------------- |
| 四种调用模式（同步/异步/流式/批量） |  ⭐⭐  |    4     | 选择+判断+场景 |
| Token 计费与多模型路由              | ⭐⭐⭐ |    3     | 核心难点       |
| 错误处理与重试                      |  ⭐⭐  |    2     | 选择+判断      |
| 流式响应陷阱与解决                  | ⭐⭐⭐ |    2     | 场景分析       |

### 题目池

#### 选择题

**Q-C1.** HMall 客服聊天界面需要用户输入后实时看到"打字"效果，应使用哪种调用模式？
A. 同步调用
B. 异步调用
C. 流式调用（stream=True）
D. 批量调用

**Q-C2.** 关于异步调用（AsyncOpenAI）的说法，正确的是？
A. 会阻塞主线程，无法并发
B. 使用 `await` 和 `asyncio.gather` 可并发调用多个 LLM
C. 只能用于流式场景
D. 不需要依赖 asyncio

**Q-C3.** 2026 年 8 月 OpenAI 多模型路由中，"成本优先"应优先选择哪个模型？
A. GPT-5.6 Sol（$4.00/$20.00 — 旗舰推理，2026.7 降价 20%）
B. GPT-5.6 Terra（$2.00/$12.00 — 中端性价比）
C. GPT-5.6 Luna（$0.20/$1.20 — 降价 80% 后的轻量级）
D. 三者价格相同

**Q-C4.** 关于 Token 计费，下列说法正确的是？
A. 只对输出 Token 计费
B. 输入和输出 Token 都计费，模型越强单价越高
C. 流式调用不产生 Token 费用
D. 调用失败的系统错误不计费且不会重试

#### 判断题

**Q-J1.** 流式调用（stream=True）返回的是完整结果，可以对已生成的内容进行修改。

**Q-J2.** Agent 决策（需要拿到完整结果再判断是否调用工具）应优先使用同步/普通调用，而非流式调用。

**Q-J3.** 流式响应断掉后，用户看到半句话，体验比不流式更差。

#### 场景分析题

**Q-S1.** 客服系统需要同时查询 5 个相互独立的订单状态，追求最快全部返回。应选择哪种调用模式？为什么？

**Q-S2.** 运营团队需要离线批量生成 1000 条商品评价，不要求实时。应选择哪种模式？请说明理由。

**Q-S3.** Agent 在流式响应中说"您的订单 ORDER123 状态：已删除"，但实际是"已发货"。如何防止这种流式输出的错误？

---

## 批改与补考机制

> **AI：** 题目池中的题目是最低基线。如果池中题目不够配额，必须自行生成新题补足，不得少于配额数。

### 补考规则

| 错误概念               | 补考出题方向                             |
| ---------------------- | ---------------------------------------- |
| 四种调用模式           | 用"流式 vs 同步"的取舍判断题重新考察     |
| Token 计费与多模型路由 | 用"故障转移 Sol→Terra→Luna"的判断题      |
| 错误处理与重试         | 用 tenacity 指数退避参数（multiplier）题 |
| 各模式适用场景         | 用"同一场景反向选择错误模式并说明后果"题 |

---

### 🔒 G3 理解门禁

> **AI：** 确认所有概念点全部通过。全部通过 → 放行。有未通过 → 补考。

---

## 🎯 学完检查

| 检查项                   | 自己回答 |
| ------------------------ | -------- |
| 四种调用模式分别是什么？ |          |
| 聊天界面用哪种模式？     |          |
| Agent 决策用哪种模式？   |          |
| 怎么处理 LLM 调用超时？  |          |
| 怎么并发调用多个 LLM？   |          |
| 流式响应断掉怎么处理？   |          |

---

> **下一步：** 完成后进入 `06-AI能力-意图识别实战.md`。

---

## 2026年最新动态（截至2026年8月）

### GPT-5.6 系列最新定价（2026.07 降价后）

| 模型          | 输入 ($/1M tokens) | 缓存命中 | 输出 ($/1M tokens) | 定位                      |
| ------------- | :----------------: | :------: | :----------------: | ------------------------- |
| GPT-5.6 Sol   |       $4.00        |  $0.40   |       $20.00       | 旗舰推理，2026.7 降价 20% |
| GPT-5.6 Terra |       $2.00        |  $0.20   |       $12.00       | 中端性价比，降价 20%      |
| GPT-5.6 Luna  |       $0.20        |  $0.02   |       $1.20        | 轻量级，降价 80%          |

### DeepSeek V4 系列最新定价（2026.08.17 峰谷计价）

| 模型     | 输入 (缓存未命中) | 输入 (缓存命中) | 输出  | 特性                |
| -------- | :---------------: | :-------------: | :---: | ------------------- |
| V4-Flash |       ¥1/M        |     ¥0.02/M     | ¥2/M  | 极致性价比          |
| V4-Pro   |       ¥12/M       |     ¥0.1/M      | ¥24/M | 正式商用，2.5折优惠 |

### Claude 系列最新定价（2026.07）

| 模型             | 输入 ($/1M) | 输出 ($/1M) | 定位          |
| ---------------- | :---------: | :---------: | ------------- |
| Claude Opus 5    |     $5      |     $25     | 2026.7 新旗舰 |
| Claude Sonnet 5  |     $2      |     $10     | 入门价永久化  |
| Claude Haiku 4.5 |     $1      |     $5      | 轻量级        |

### 模型选择决策树（2026）

```
任务复杂度？
├── 简单（分类、FAQ、问候）→ GPT-5.6 Luna ($0.20) / DeepSeek V4-Flash
├── 中等（推理、摘要、推荐）→ GPT-5.6 Terra ($2.00) / Claude Sonnet 5 ($2)
└── 复杂（Agent决策、代码、数学）→ GPT-5.6 Sol ($4.00) / Claude Opus 5 ($5)
```
