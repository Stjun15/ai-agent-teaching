# Phase 4 AI能力 · Memory系统实战（v2.0）

> **一句话总结：** Phase 4 Memory 系统实战，讲清 agent-memory 子系统（TS 实现）的三层记忆架构与落地，属双工程架构中的平台内核能力。
>
> **前置文档**
>
> - `06-AI能力-双层架构调用链.md`(`06-AI能力/`)—— 本文定位为平台内核 agent-memory 子系统，需先理解 TS 编排层与 Python 推理层的分工边界。
>
> **后置文档**
>
> - `06-AI能力-HITL人机协作实战.md`(`06-AI能力/`)—— 本文自述下一步进入 HITL 人机协作实战。

> **架构定位（双工程）：** 本能力在双工程架构（agent-platform + ai-service）中属于**平台内核 agent-memory 子系统（TypeScript 实现）**，不是 HMall 业务。agent-platform 用 HTTP(axios) 调 ai-service 的 REST API；HMall（Java 业务层）只是第一个接入方，通过"工具协议/MCP 网关"接入平台，平台不直连业务数据库。
>
> **历史参考说明：** 文中 `hm-ai`（`com.hmall.ai.*`）Java 代码**仅作"原理等价"的历史参考，不是当前实现**。当前实现用 **TypeScript（编排层 agent-platform）** 实现 agent-memory 子系统（短期/长期/语义三层记忆），落地入口见 `07-平台-工程落地-从空目录搭agent-platform.md`；AI 出题时提到 hm-ai 应一并说明这层关系。

> **AI角色：老师。** 你不是编码者，你是出题者+批改者+讲解者。目标是让学习者在45分钟内理解 Agent Memory 的三层架构（短期/长期/语义记忆），以及 agent-platform 中 memory 模块的实现。
>
> **防什么失败？** 防"Agent 每次对话都像失忆，用户说'和上次一样' Agent 完全不知道在说什么"。防"所有对话历史都塞进上下文，Token 费用爆炸"。

---

## 为什么需要 Memory 系统？

> **场景：** 用户在周一问了 Agent "iPhone 15 Pro 有什么颜色？"，Agent 认真回答了。周三用户又来了，说"上次那个白色的，帮我查一下有没有货"。Agent 一脸懵："什么上次？什么白色？"——用户怒了："你们怎么每次都像金鱼一样，7秒记忆？"

Agent 没有 Memory，就像一个人每次醒来都失忆。用户需要不断重复上下文，体验极差。Memory 系统的目标就是让 Agent **记住该记住的，忘记该忘记的**，在"记住"和"Token 成本"之间找到平衡。

### 类比：人的记忆系统 v.s. Agent Memory

```
┌──────────────────────────────────────────────────────────────────┐
│  人的记忆                        Agent Memory                     │
│  ────────                        ────────────                    │
│  工作记忆（正在想的事）     →   短期记忆：当前对话的上下文窗口      │
│  · 容量有限（7±2 个信息块）  · 最近 N 条消息                     │
│  · 用完就忘                   · 生命周期：单次会话                 │
│                                                                  │
│  长期记忆（知识和经历）      →   长期记忆：跨会话的用户画像        │
│  · 我叫什么、家住哪里         · 用户偏好、历史订单                 │
│  · 昨天吃了什么（可能忘）     · 存储：Redis / 数据库              │
│  · 儿时记忆（可能模糊）       · 生命周期：持久化（带 TTL）         │
│                                                                  │
│  语义记忆（概念和关联）      →   语义记忆：向量检索                │
│  · "苹果"=水果也是手机       · 通过语义相似度找相关记忆           │
│  · 能联想相关概念             · 存储：向量数据库（Qdrant）        │
│                                                                  │
│  核心设计：不是所有记忆都值得保留，需要分层 + 遗忘机制             │
└──────────────────────────────────────────────────────────────────┘
```

### 差做法 vs 好做法

| 差做法 ❌                               | 好做法 ✅                                          |
| --------------------------------------- | -------------------------------------------------- |
| 所有对话历史全塞进 messages，Token 爆炸 | 三层记忆：短期放窗口、长期放 Redis、语义放向量库   |
| 用户偏好每次对话都重新问一遍            | 从 Redis 加载用户画像，Agent 对话前就知道用户偏好  |
| 用户说"上次那个"时 Agent 完全不懂       | 语义记忆通过向量相似度检索，找到"上次讨论的内容"   |
| 工具调用结果也存入长期记忆，噪音巨大    | 只保存用户消息和 AI 最终回答，过滤工具调用中间结果 |
| 记忆永不过期，存储无限膨胀              | TTL 过期 + 记忆衰减，不常用的记忆自动降权          |

---

## 设计原理

| 原则             | 在本技能中的体现                                                   |
| ---------------- | ------------------------------------------------------------------ |
| **场景驱动**     | 从"用户说'和上次一样'，Agent 需要记住上次对话"引出 Memory 的必要性 |
| **分层教学**     | 三层记忆架构（短期/长期/语义），逐层理解                           |
| **代码走读**     | 逐文件讲解 hm-ai/memory/ 和 Redis 缓存实现                         |
| **最小可行知识** | 只学三层记忆 + hm-ai 实现，不学所有记忆策略                        |

---

## 这个技能解决什么问题

Agent 从"金鱼记忆"到"持久记忆"的升级。学完能回答：

- Agent 为什么需要记忆？没有记忆会怎样？
- 短期记忆、长期记忆、语义记忆分别是什么？
- 对话历史怎么存储？怎么控制上下文窗口大小？
- Redis 在 Memory 系统中扮演什么角色？
- hm-ai 的 SemanticMemoryService 是怎么实现的？

---

## 前置要求

- 已完成 `06-AI能力-ReAct模式实战`（理解 Agent 循环）
- 已完成 `1A-Redis基础速通`（理解 Redis 基本操作）
- 理解 Java Spring Boot 的基本结构

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止，提示先补前置。

---

## 概念讲解

---

### 第一讲：Agent 为什么需要记忆

#### 1.1 没有记忆的 Agent

```
用户：帮我查一下 ORDER123
Agent：好的，ORDER123 状态：已发货

用户：帮我退货
Agent：请问您的订单号是？（完全忘了刚才说的 ORDER123）

用户：和上次一样
Agent：什么上次？（完全不知道用户在说什么）
```

#### 1.2 有记忆的 Agent

```
用户：帮我查一下 ORDER123
Agent：好的，ORDER123 状态：已发货 [记住：当前订单=ORDER123]

用户：帮我退货
Agent：好的，我帮您处理 ORDER123 的退货 [从记忆中找到订单号]

用户：和上次一样
Agent：您是指 ORDER123 吗？[从长期记忆中检索到上次对话]
```

#### 1.3 记忆的三层架构

```
┌─────────────────────────────────────┐
│  短期记忆（Short-term Memory）       │
│  - 当前对话的上下文窗口              │
│  - 最近的 N 条消息                  │
│  - 存储：直接放在 messages 数组中    │
│  - 生命周期：一次对话会话            │
├─────────────────────────────────────┤
│  长期记忆（Long-term Memory）        │
│  - 跨会话的用户偏好和历史            │
│  - 用户上次买了什么、偏好什么品牌     │
│  - 存储：Redis / 数据库              │
│  - 生命周期：持久化                  │
├─────────────────────────────────────┤
│  语义记忆（Semantic Memory）         │
│  - 通过向量相似度检索相关记忆        │
│  - "用户喜欢什么类型的手机？"        │
│  - 存储：向量数据库（Qdrant）        │
│  - 生命周期：持久化                  │
└─────────────────────────────────────┘
```

> **AI：** 停下来确认"短期=当前会话，长期=跨会话持久化，语义=向量检索——理解了吗？"，等回复后再继续。

---

### 第二讲：短期记忆——上下文窗口管理

#### 2.1 上下文窗口的挑战

```
问题：LLM 的上下文窗口有限

GPT-4o-mini: 128K tokens（约 10 万汉字）
但每次对话可能积累几十条消息，加上工具调用结果，很容易超出窗口

解决方案：
  1. 滑动窗口：只保留最近 N 条消息
  2. 摘要压缩：用 LLM 对历史消息做摘要
  3. 智能裁剪：保留重要的，丢弃不重要的
```

#### 2.2 滑动窗口实现

```python
def manage_context_window(messages: list, max_messages: int = 20) -> list:
    """保持上下文窗口不超过 max_messages 条"""
    if len(messages) <= max_messages:
        return messages

    # 保留 system prompt（第一条）+ 最近的消息
    system_prompt = messages[0]  # 保留系统提示词
    recent = messages[-(max_messages - 1):]  # 保留最近的消息
    return [system_prompt] + recent
```

#### 2.3 hm-ai 的 ConversationContext

```java
// D:\微服务项目\hmall\hm-ai\src\main\java\com\hmall\ai\context\ConversationContext.java

// 管理当前会话的上下文信息
public class ConversationContext {
    private String sessionId;           // 会话ID
    private String userId;              // 用户ID
    private List<Message> history;      // 对话历史
    private String currentIntent;       // 当前意图
    private Map<String, Object> state;  // 会话状态（如：当前处理的订单号）
    private int messageCount;           // 消息计数
    private LocalDateTime lastActive;   // 最后活跃时间
}
```

> **AI：** 停下来确认"ConversationContext 管理当前会话的上下文——理解了吗？"，等回复后再继续。

---

### 第三讲：长期记忆——Redis 持久化

#### 3.1 为什么用 Redis

```
长期记忆的存储需求：
  - 快速读写（每次对话都要查）
  - TTL 过期（不需要永久存储）
  - 数据结构灵活（用户画像、偏好列表）

Redis 完美匹配：
  - 内存存储，读写极快
  - 天然支持 TTL
  - 支持多种数据结构（String、Hash、List、Set、Sorted Set）
```

#### 3.2 hm-ai 的 Redis 记忆存储

```java
// D:\微服务项目\hmall\hm-ai\src\main\java\com\hmall\ai\config\RedisChatMemoryRepository.java

// 用户记忆的存储结构（Redis Hash）：
// Key:   "user:memory:{userId}"
// Field: "last_order_id"    → "ORDER123"
// Field: "preferences"      → "品牌:Apple, 预算:5000-8000"
// Field: "last_conversation"→ "用户上次咨询了退货政策"
// TTL:   7天（可根据业务调整）

// 用户对话历史的存储结构（Redis List）：
// Key: "user:history:{userId}"
// 保留最近 50 条对话
// 使用 LPUSH + LTRIM 实现滑动窗口
```

#### 3.3 SemanticMemoryService 的实现

```java
// D:\微服务项目\hmall\hm-ai\src\main\java\com\hmall\ai\memory\SemanticMemoryService.java

@Service
public class SemanticMemoryService {

    // 保存用户偏好
    public void saveUserPreference(String userId, String key, String value) {
        redisTemplate.opsForHash().put("user:memory:" + userId, key, value);
        redisTemplate.expire("user:memory:" + userId, 7, TimeUnit.DAYS);
    }

    // 获取用户偏好
    public String getUserPreference(String userId, String key) {
        return (String) redisTemplate.opsForHash().get("user:memory:" + userId, key);
    }

    // 保存对话摘要
    public void saveConversationSummary(String userId, String summary) {
        String key = "user:history:" + userId;
        redisTemplate.opsForList().leftPush(key, summary);
        // 只保留最近 50 条
        redisTemplate.opsForList().trim(key, 0, 49);
    }

    // 获取最近对话
    public List<String> getRecentConversations(String userId, int count) {
        String key = "user:history:" + userId;
        return redisTemplate.opsForList().range(key, 0, count - 1);
    }
}
```

> **AI：** 停下来确认"Redis Hash 存用户画像，Redis List 存对话历史——理解了吗？"，等回复后再继续。

---

### 第四讲：语义记忆——向量检索

#### 4.1 语义记忆解决的问题

```
传统记忆：只能通过精确匹配查询
  "用户喜欢什么颜色的手机？" → 查不到，因为存的是"偏好: 白色"

语义记忆：通过语义相似度查询
  "用户喜欢什么颜色的手机？" → 向量化 → 在向量库中找最相似的记忆
  → 找到"用户偏好白色手机" → 返回
```

#### 4.2 hm-ai 的向量存储

```java
// D:\微服务项目\hmall\hm-ai\src\main\java\com\hmall\ai\vector\QdrantVectorStore.java

// 使用 Qdrant 向量数据库存储语义记忆
// 流程：
// 1. 将用户对话转为 Embedding 向量
// 2. 存入 Qdrant
// 3. 查询时，将查询也转为向量，找最相似的记忆
```

#### 4.3 三层记忆的协作

```
用户："帮我查一下那个'上次买的手机'的订单"

1. 短期记忆：当前对话中是否提到过"上次买的手机"？
   → 没有，本对话第一次提到

2. 长期记忆（Redis）：用户的上次订单是什么？
   → 查询 user:memory:{userId} → last_order_id = "ORDER123"

3. 语义记忆（Qdrant）：用户讨论过什么手机？
   → 查询向量库 → 最相似记忆："用户3天前咨询过 iPhone 15 Pro"

4. 综合：Agent 知道用户说的是 iPhone 15 Pro，订单 ORDER123
```

---

### 第五讲：Agent 场景下的记忆管理策略

> 来自 AI 应用开发的核心洞察：Agent 的记忆管理比普通对话更复杂——工具调用会产生大量中间结果，这些结果不应该全部记入长期记忆。

#### 5.1 Agent 记忆 vs 普通对话记忆

| 维度           | 普通对话记忆       | Agent 记忆                           |
| -------------- | ------------------ | ------------------------------------ |
| 消息增速       | 慢（纯对话）       | 快（每轮工具调用多2条消息）          |
| 噪音           | 少                 | 多（工具返回的大量数据）             |
| 需要记忆的内容 | 用户偏好、对话历史 | 用户偏好 + 任务上下文 + 工具调用记录 |
| 上下文压力     | 中                 | **高**                               |

#### 5.2 TypeScript 实现：Agent Memory 管理器

```typescript
// agent-platform/src/memory/agent-memory.ts
// Agent Memory 三层架构的 TypeScript 实现

import { Redis } from "ioredis";
import { QdrantClient } from "@qdrant/js-client-rest";

export interface ShortTermMemory {
  messages: Message[]; // 当前会话的消息
  sessionState: Record<string, unknown>; // 会话状态（当前订单号等）
}

export interface LongTermMemory {
  userId: string;
  preferences: Record<string, string>; // 用户偏好
  lastOrderId?: string;
  lastConversation?: string; // 上次对话摘要
}

export class AgentMemoryManager {
  private shortTerm: Map<string, ShortTermMemory> = new Map();
  private redis: Redis;
  private qdrant: QdrantClient;

  constructor(redisUrl: string, qdrantUrl: string) {
    this.redis = new Redis(redisUrl);
    this.qdrant = new QdrantClient({ url: qdrantUrl });
  }

  // ===== 短期记忆：当前会话 =====
  getShortTerm(sessionId: string): ShortTermMemory {
    if (!this.shortTerm.has(sessionId)) {
      this.shortTerm.set(sessionId, { messages: [], sessionState: {} });
    }
    return this.shortTerm.get(sessionId)!;
  }

  addMessage(sessionId: string, message: Message): void {
    const memory = this.getShortTerm(sessionId);
    memory.messages.push(message);
    // 控制上下文窗口大小（保留最近 20 条 + system prompt）
    if (memory.messages.length > 21) {
      const systemPrompt = memory.messages[0];
      memory.messages = [systemPrompt, ...memory.messages.slice(-20)];
    }
  }

  // ===== 长期记忆：Redis 持久化 =====
  async saveUserPreference(
    userId: string,
    key: string,
    value: string,
  ): Promise<void> {
    await this.redis.hset(`user:memory:${userId}`, key, value);
    await this.redis.expire(`user:memory:${userId}`, 7 * 24 * 3600); // 7天TTL
  }

  async getUserPreferences(userId: string): Promise<Record<string, string>> {
    return this.redis.hgetall(`user:memory:${userId}`);
  }

  async saveConversationSummary(
    userId: string,
    summary: string,
  ): Promise<void> {
    const key = `user:history:${userId}`;
    await this.redis.lpush(key, summary);
    await this.redis.ltrim(key, 0, 49); // 只保留最近50条
  }

  async getRecentConversations(
    userId: string,
    count: number = 10,
  ): Promise<string[]> {
    return this.redis.lrange(`user:history:${userId}`, 0, count - 1);
  }

  // ===== 语义记忆：向量检索 =====
  async searchSemanticMemory(
    userId: string,
    query: string,
    topK: number = 5,
  ): Promise<string[]> {
    // 1. 将查询转为向量（使用 embedding 模型）
    const queryVector = await this.embed(query);

    // 2. 在 Qdrant 中搜索最相似的记忆
    const results = await this.qdrant.search("user_memories", {
      vector: queryVector,
      filter: { must: [{ key: "user_id", match: { value: userId } }] },
      limit: topK,
    });

    return results.map((r) => r.payload?.content as string);
  }

  // ===== 记忆过滤：只保存有价值的消息 =====
  shouldRemember(message: Message): boolean {
    // 工具调用结果通常不需要记入长期记忆
    if (message.role === "tool") return false;
    // 用户消息和 AI 最终回答才值得记
    if (message.role === "user" || message.role === "assistant") {
      // 过滤掉纯工具调用的 assistant 消息
      if (message.role === "assistant" && message.toolCalls) return false;
      return true;
    }
    return false;
  }

  // 嵌入函数（简化示例）
  private async embed(text: string): Promise<number[]> {
    // 实际使用 OpenAI Embeddings API 或本地模型
    // const response = await openai.embeddings.create({
    //   model: 'text-embedding-3-small',
    //   input: text,
    // });
    // return response.data[0].embedding;
    return []; // 占位
  }
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: { name: string; arguments: string }[];
}
```

#### 5.3 三层记忆协作流程

```
用户："帮我查一下上次买的那个手机的订单"

Step 1: 短期记忆（当前会话）
  → 当前对话中是否提到过"上次买的手机"？
  → 没有 → 继续查长期记忆

Step 2: 长期记忆（Redis）
  → 查询 user:memory:{userId} → last_order_id = "ORDER123"
  → 查询 user:memory:{userId} → preferences = "品牌:Apple, 预算:5000-8000"

Step 3: 语义记忆（Qdrant）
  → 将"上次买的手机"转为向量
  → 搜索最相似记忆 → "用户3天前咨询过 iPhone 15 Pro"

Step 4: 综合
  → Agent 知道：用户说的是 iPhone 15 Pro，订单 ORDER123
  → 回复："您上次购买的 iPhone 15 Pro（订单 ORDER123），目前状态：已发货"
```

> **核心原则**：三层记忆是**并行检索、综合决策**，不是串行查找。

---

### 提示词教学：记忆提取与压缩 Prompt

> **AI：** 不重讲六要素模板（真源：`03-AI协作构建\03-AI协作构建技能.md`；进阶：`06-AI能力-Prompt工程实战.md`），只讲 Memory 场景怎么填。

**① 场景**：Memory 系统里有两份关键 prompt——**记忆提取 prompt**（从对话中提取值得保存的用户偏好/关键信息）和**记忆压缩/摘要 prompt**（把长对话压缩成摘要，节省上下文窗口）。前者决定"什么信息值得记"，后者决定"怎么把 50 轮对话压成 3 句话"。两份 prompt 都依赖 LLM 做信息抽取和摘要，写不好要么记了噪音（工具调用中间结果）、要么丢了关键信息（用户 10 轮前说的订单号）。

**② 六要素对照表**：

| 要素     | 记忆提取 prompt 填什么                                                                                                    | 记忆压缩/摘要 prompt 填什么                                                                   |
| :------- | :------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------- |
| 角色     | 用户信息提取器（只提取，不编造）                                                                                          | 对话摘要生成器（只压缩，不推理）                                                              |
| 任务     | 从对话中提取用户偏好、关键实体、历史行为                                                                                  | 将长对话压缩为 ≤200 字的摘要，保留关键信息                                                    |
| 上下文   | 完整对话历史 + 已有用户画像（避免重复提取）                                                                               | 完整对话历史（含工具调用结果）                                                                |
| 约束     | ① 只提取用户明确表达的信息，不推测；② 数值型偏好要标注来源（如"预算 5000-8000，来自第 3 轮"）；③ 工具调用结果不提取为偏好 | ① 保留订单号/金额/商品名等关键实体；② 丢弃闲聊/问候；③ 压缩后信息不丢失不编造；④ 输出 ≤200 字 |
| 参考     | 已有用户画像（如 preferences 已有"品牌:Apple"），避免重复提取                                                             | 本次对话主题（用于判断哪些信息是"关键"的）                                                    |
| 输出格式 | JSON 格式：`{"preferences": {"key": "value"}, "entities": [...], "summary": "一句话"}`                                    | 纯文本摘要，≤200 字                                                                           |

**③ 示例 Prompt**（记忆提取，可直接用）：

```
你是用户信息提取器。从以下对话中提取值得长期保存的用户信息。

提取规则：
1. 偏好类：用户明确表达的品牌偏好、预算范围、颜色偏好等（如"我喜欢白色的""预算 5000 左右"）
2. 关键实体：订单号、商品名、地址（只提取用户明确提到的，不推测）
3. 历史行为：用户的购买记录（只提取对话中实际出现的，不编造）

不提取以下内容：
- 工具调用中间结果（如"查询返回：订单状态=已发货"）
- 闲聊/问候（如"你好""谢谢"）
- 系统提示（如"请提供订单号"）

已有用户画像：{existing_profile}

对话历史：{history}

只输出 JSON，不要解释：
{
  "preferences": {"key": "value"},
  "entities": {"order_ids": [...], "products": [...]},
  "summary": "一句话总结用户本次对话的核心诉求"
}
```

**④ 反例 + 为什么**：

```
记忆提取 prompt：'把对话中所有重要信息都记下来。'   // ❌
```

错在哪：① 没定义"重要"——LLM 会把工具调用的中间结果（如"查询返回：订单状态=已发货，金额=29900分"）也存入长期记忆，导致 Redis 里全是噪音；② 没要求标注来源——后续调试时无法追溯某条偏好是用户第几轮说的；③ 没给已有画像——LLM 重复提取"品牌:Apple"，用户画像里同一个 key 被覆盖多次，浪费存储。

```
记忆压缩 prompt：'把对话总结一下。'   // ❌
```

错在哪：没锁"保留关键实体"——LLM 可能把"订单 ORDER123 已发货"压缩成"用户查了订单"，丢失了 ORDER123 这个关键信息，后续 Agent 无法从摘要中找回订单号。

**⑤ 完成标准**：能独立写出包含**不提取工具调用结果 / 标注来源 / 关键实体不丢失 / 输出字数限制**四条款的记忆提取和压缩 prompt。

---

### 🔒 G2 讲解门禁

> **AI：** 确认以上讲解的学习者都表示理解。**必须等用户明确回复"没问题"/"理解了"等肯定词，未收到回复前不得出题。** 全部确认 → 放行。有任何疑问 → 回到对应讲，澄清后再确认。

---

## 阶段一：理解验证（Quiz 闭卷）

### 概念难度与题目配额

| 概念                                      |  难度  | 最少题数 | 出题说明  |
| ----------------------------------------- | :----: | :------: | --------- |
| 短期记忆 vs 长期记忆 vs 语义记忆          | ⭐⭐⭐ |    3     | 核心难点  |
| 三层记忆架构与生命周期/存储位置           | ⭐⭐⭐ |    3     | 选择+场景 |
| 上下文窗口管理与滑动窗口                  |  ⭐⭐  |    2     | 选择+判断 |
| Redis 在长期记忆中的角色（Hash/List/TTL） |  ⭐⭐  |    2     | 代码实践  |
| 语义记忆=向量检索（Qdrant）               |  ⭐⭐  |    2     | 选择+场景 |
| Agent场景记忆分层策略                     |  ⭐⭐  |    2     | 选择+判断 |

### 题目池

#### 选择题

**Q-C1.** Agent 记忆的三层架构中，各层对应的存储位置与用途，正确的是？
A. 短期记忆存 Qdrant，长期记忆存 Redis，语义记忆存 messages 数组
B. 短期记忆放 messages 数组（当前会话），长期记忆存 Redis/数据库（跨会话持久化），语义记忆存 Qdrant（向量检索）
C. 三层都存 Redis
D. 三层都存 Qdrant

**Q-C2.** 长期记忆选择 Redis 的原因，不包括以下哪一项？
A. 内存存储，读写极快，每次对话都要查询
B. 天然支持 TTL 过期
C. 支持多种数据结构（Hash/List/Set）
D. 支持 SQL 复杂关联查询

**Q-C3.** 语义记忆（Semantic Memory）与传统记忆相比，核心区别是？
A. 语义记忆存的数据更多
B. 语义记忆通过向量相似度检索相关记忆，传统记忆只能精确匹配
C. 语义记忆只存数字，传统记忆只存文字
D. 语义记忆不需要存储介质

**Q-C4.** 在 hm-ai 中，`SemanticMemoryService.saveUserPreference` 使用 Redis 的哪种数据结构存储用户偏好，并设置了多长的 TTL？
A. List，TTL 50 天
B. Hash（opsForHash），TTL 7 天
C. String，无 TTL
D. Sorted Set，TTL 1 天

**Q-C5.** 当用户说"和上次一样"时，Agent 需要从哪一层记忆中检索"上次对话内容"？
A. 短期记忆
B. 长期记忆（跨会话持久化的历史/偏好）
C. 都不需要，直接问用户
D. 只从当前 messages 数组查

#### 判断题

**Q-J1.** 滑动窗口管理上下文时，可以直接丢弃 system prompt，只保留最近 N 条消息。

**Q-J2.** Redis List 通过 `LPUSH` + `LTRIM` 可以很方便地实现"只保留最近 50 条对话"的滑动窗口。

#### 场景分析题

**Q-S1.** HMall 客服场景：用户先查了 ORDER123，隔了几小时后又说"帮我稍后跟进一下那个订单的退货"。请结合三层记忆，分析 Agent 如何正确理解"那个订单"指 ORDER123，并说明三层记忆分别在这个流程中起了什么作用。

#### 代码/实践题

**Q-P1.** 请写出用 Python 实现"上下文窗口管理"的 `manage_context_window` 函数：当消息超过 `max_messages` 时，保留 system prompt（第一条）+ 最近的消息。（可参考 short-term 记忆的滑动窗口实现）

---

## 批改与补考机制

> **AI：** 题目池中的题目是最低基线。如果池中题目不够配额，必须自行生成新题补足，不得少于配额数。

### 补考规则

| 错误概念                    | 补考出题方向                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------- |
| 短期/长期/语义记忆区分      | 改考"给三条具体记忆（当前订单号/用户地址/用户偏好白色手机）让考生归类"             |
| 三层架构生命周期/存储位置   | 改考"各层记忆的 TTL 与多会话复用"或"哪个 Agent 之间可共享"                         |
| 上下文窗口管理              | 改考"摘要压缩 vs 滑动窗口 vs 智能裁剪的取舍"，或计算给定消息数下保留几条           |
| Redis 角色（Hash/List/TTL） | 改考"如何用 Redis 存储用户对话历史并用 List 做滑动窗口"，或 Hash 每个 field 的含义 |
| 语义记忆=向量检索           | 改考"嵌入流程（对话→Embedding→Qdrant→相似检索）中某一步缺失的后果"                 |

---

### 🔒 G3 理解门禁

> **AI：** 确认所有概念点全部通过。全部通过 → 放行。有未通过 → 补考。

---

## 实践任务：走读 agent-platform 的 Memory 代码

> **说明：** 走读 **agent-platform 的 agent-memory 子系统**（TS）实现（`src/memory.ts`），理解记忆的协作。教学级用 Map 存储，生产级会换成 Redis/DB（接口不变，是 seam）。

### 目标

阅读 `MemoryStore`，理解记忆的协作。

### 步骤

1. 阅读 `D:\AgentHub\AgentHub\agent-platform\src\memory.ts`
2. 短期记忆和长期记忆分别存在哪个 Map？
3. `append()` 和 `writeLongTerm()` 分别写哪层记忆？
4. 画出两层记忆的数据流图（教学级无语义记忆层，生产级补 Qdrant 向量层）

### ✅ 验证

- 能说出两层记忆分别存储在哪里
- 能说出为什么用 Map 存储（教学级），生产级怎么换（Redis/DB，接口不变）
- 能说出语义记忆（向量）和传统记忆的区别

---

### 🔒 G4 决策门禁

> **AI：** 确认学习者已完成动手环节。已完成 → 继续。未完成 → 回去做。

---

## 🎯 学完检查

| 检查项                               | 自己回答 |
| ------------------------------------ | -------- |
| Agent 的三层记忆分别是什么？         |          |
| 短期记忆存储在哪里？生命周期多长？   |          |
| 长期记忆存储在哪里？为什么用 Redis？ |          |
| 语义记忆的核心原理是什么？           |          |
| ConversationContext 管理哪些信息？   |          |
| 三层记忆如何协作完成一个请求？       |          |

---

> **下一步：** 完成后进入 `06-AI能力-HITL人机协作实战.md`，学习 Agent 如何与人工客服协作。

---

## 2026年最新动态（截至2026年8月）

### Agent Memory 五大支柱（2026 年）

2026 年 Agent 工程指南将 Memory 列为 Agent 工程五大支柱之首：

| 支柱     | 实现方式                   | 2026 最佳实践              |
| -------- | -------------------------- | -------------------------- |
| 短期记忆 | 上下文窗口（1.05M+ token） | 对话历史摘要 + 滑动窗口    |
| 长期记忆 | Mem0 + 向量数据库          | 自动提取 + 记忆去重 + 衰减 |
| 共享记忆 | 知识图谱                   | 多 Agent 间共享上下文      |
| 工作记忆 | 结构化存储                 | 任务草稿、中间结果         |
| 情景记忆 | 对话摘要存储               | 历史对话的语义压缩         |

### Mem0 自动记忆管理（2026 年）

- **自动记忆提取**：从对话中自动提取关键信息并存储
- **记忆去重**：自动合并相似记忆，避免冗余
- **记忆衰减**：模拟人类记忆衰减，不常用的记忆优先级降低
- 配合 GPT-5.6 1.05M 上下文窗口，短期记忆几乎无限

### 记忆类型矩阵（2026 年）

| 记忆类型 | 存储位置   | 生命周期 | 示例           |
| -------- | ---------- | -------- | -------------- |
| 工作记忆 | 上下文窗口 | 单次对话 | 当前订单号     |
| 短期记忆 | 向量数据库 | 当前会话 | 对话历史摘要   |
| 长期记忆 | 关系数据库 | 永久     | 用户偏好、地址 |
| 语义记忆 | 知识图谱   | 系统级   | 商品知识、政策 |

### 2026 年 embedding 模型推荐

| 模型                   | 维度 | 每百万token价格 | 适用场景               |
| ---------------------- | :--: | :-------------: | ---------------------- |
| text-embedding-3-small | 512  |      $0.02      | 语义记忆（性价比最高） |
| text-embedding-3-large | 3072 |      $0.13      | 高精度语义检索         |
| text-embedding-4-mini  | 256  |      $0.01      | 轻量级场景（2026 新）  |

### 2026 关键认知：Memory ≠ 把对话历史全存下来

> Memory 系统的核心不是"存多少"，而是"检索什么"。存了一百万条记忆，检索不到想要的，等于没存。好的 Memory 系统 = 精准的检索策略 + 合理的遗忘机制 + 分层存储架构。

---

## 判断力日志：Memory 三层架构的设计取舍

### 问题

你在设计 Agent 的记忆系统时面临的核心矛盾：用户期望 Agent 记住偏好和历史（"和上次一样""上次那个白色的"），但无差别存储会导致三个问题——① 所有对话历史塞进上下文，Token 费用爆炸；② 工具调用中间结果（2000 字 JSON）也存入记忆，噪音淹没信号；③ 跨会话记忆检索困难，"用户喜欢什么颜色的手机？"无法通过精确匹配查到（因为存的是"偏好: 白色"）。你需要在"记住该记的"和"忘记该忘的"之间找到平衡。

### 决策

我选择了**三层记忆架构 + 记忆过滤 + TTL 衰减**：

- **短期记忆（上下文窗口）**：当前会话的 messages 数组，滑动窗口保留最近 20 条 + System Prompt，生命周期 = 单次会话
- **长期记忆（Redis）**：跨会话持久化用户画像和偏好，Hash 存用户偏好（TTL 7 天），List 存对话历史摘要（LPUSH + LTRIM 保留最近 50 条），每次对话前加载到上下文
- **语义记忆（Qdrant 向量库）**：用户对话 → Embedding → 向量检索，通过语义相似度找"上次讨论的内容"，解决"用户喜欢什么颜色的手机"这类模糊查询
- **记忆过滤**：`shouldRemember()` 过滤掉工具调用结果（role='tool'）和含 tool_calls 的 assistant 消息，只保存用户消息和 AI 最终回答
- **TTL 衰减**：7 天过期，不常用的记忆自动降权，模拟人类记忆衰减

### 取舍

- **全存 Redis**：读写极快，TTL 天然支持，但只能精确匹配 → 用户问"喜欢什么颜色"查不到"偏好: 白色"，语义检索能力为零
- **全存 Qdrant**：语义检索能力强，但每次查询都要 Embedding，比 Redis 慢一个数量级，不适合高频读写场景（每次对话都要查用户画像）
- **全存上下文窗口**：最直接，GPT-5.6 1.05M token 够大，但 Agent 对话每轮 ReAct 增加 2 条消息，50 轮轻松 40K tokens，加上工具调用结果，Token 费用和延迟不可接受
- **取舍结论**：Redis 做高频读写（用户画像/偏好），Qdrant 做语义检索（"上次讨论的内容"），上下文窗口做当前会话。三层不是冗余，而是**不同查询模式匹配不同存储引擎**——精确匹配走 Redis，语义模糊查询走 Qdrant，当前会话走短期记忆。

### 防什么失败

- **防"Agent 每次对话都像失忆"**：长期记忆（Redis）在每次对话开始时加载用户画像和偏好，Agent 对话前就知道"用户偏好 Apple、预算 5000-8000"，不需要用户重复说明
- **防"Token 费用爆炸"**：三层分层——短期记忆只保留最近 20 条，长期记忆只存摘要不存原文，工具调用中间结果一律过滤，不存入长期记忆
- **防"用户偏好丢失"**：用户说"我喜欢白色的"，`saveUserPreference` 立即写入 Redis Hash，TTL 7 天，下次对话还在
- **防"噪音污染长期记忆"**：`shouldRemember()` 过滤 role='tool' 和含 tool_calls 的 assistant 消息，确保存入 Redis 的都是有价值的用户偏好和对话摘要，不是工具返回的 2000 字 JSON
- **防"语义检索找不到"**：语义记忆通过向量相似度检索，用户问"喜欢什么颜色的手机"→ Embedding → Qdrant 搜索 → 找到"用户偏好白色手机"，不依赖精确关键词匹配
