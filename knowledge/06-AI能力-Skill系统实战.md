# Phase 4 AI能力 · Skill 系统实战（v2.0）

> **一句话总结：** 用"产品经理临时加催单功能"讲清 Skill 机制与 Tool 的边界，如何优雅地给 Agent 注册和管理能力，并配套代码走读。

> **前置文档**
>
> - `06-AI能力-上下文工程实战`（`06-AI能力/`）—— 本文"下一步"链条：上下文之后进入 Skill。
> - `06-AI能力-Tools设计实战`（`06-AI能力/`）—— Tool 是 Skill 的底层。

> **后置文档**
>
> - `06-AI能力-双层架构调用链`（`06-AI能力/`）—— 本文"下一步"指定。

> **架构定位（双工程）：** 本能力在双工程架构（agent-platform + ai-service）中属于**平台内核 agent-tools 子系统（TypeScript 实现）**，不是 HMall 业务。agent-platform 用 HTTP(axios) 调 ai-service 的 REST API；HMall（Java 业务层）只是第一个接入方，通过"工具协议/MCP 网关"接入平台，平台不直连业务数据库。
>
> **历史参考说明：** 文中 `hm-ai`（`com.hmall.ai.*`）Java 代码**仅作"原理等价"的历史参考，不是当前实现**。当前实现用 **TypeScript（编排层 agent-platform）** 实现 agent-tools 子系统的 Skill 注册/发现/调用/生命周期，落地入口见 `07-平台-工程落地-从空目录搭agent-platform.md`。

> **AI角色：老师。** 你不是编码者，你是出题者+批改者+讲解者。目标是让学习者在45分钟内理解 Agent Skill 系统的设计：Skill 注册、发现、调用、生命周期管理。
>
> **防什么失败？** 防"Agent 的能力硬编码在代码里，加一个新功能要改核心代码"。防"团队每个人都在写 Agent 工具，但方式各不相同，无法统一管理"。防"不知道 Skill 和 Tool 的区别"。

---

## 为什么需要 Skill 系统？

### 一个真实的翻车场景

```
周五下午 5:30，产品经理突然提需求："给 Agent 加一个'催单'功能，用户说'帮我催一下'就自动触发。"

你打开代码仓库，发现 Agent 的核心逻辑是这样写的：

// ❌ 差做法：所有能力硬编码在一个巨大的 switch 里
switch (intent) {
  case "查订单":   return queryOrder(userId);
  case "查物流":   return trackLogistics(orderId);
  case "退货":     return createReturn(orderId);
  case "商品咨询": return searchProduct(query);
  // 要加催单？只能在 switch 里加一个 case...
  // 但这里已经有 200 行代码了！
  // 而且每次加新功能都要改核心文件，改一点就影响全局
  // 测试回归跑一遍要 2 小时...
}

你看着这个 200 行的 switch，再看看 5:30 的时间，陷入了沉思。
```

**这就是没有 Skill 系统的后果：**

- 新能力必须改核心代码 → 每次改动都是风险
- 不同人写的工具风格各异 → 维护成本爆炸
- 停用某个能力要重新部署 → 一个 bug 就让整个系统下线
- 无法做到"灰度发布"——要么全上，要么全不上

**Skill 系统做的事情：**

- 把每个业务能力封装成独立的"技能包"（Skill）
- 注册、发现、调用、卸载全部标准化
- 加新功能 = 注册一个新 Skill，不影响现有代码
- 停用某个 Skill = 关掉开关，不用重启服务

> **类比：手机 App Store。** 没有 Skill 系统 = 你的手机出厂时所有功能写死在系统里，想加个计算器要刷机。有 Skill 系统 = 你想加什么功能，去 App Store 下载安装就行，不想要了直接卸载，手机系统完全不受影响。

---

## 设计原理

| 原则             | 在本技能中的体现                                                  |
| ---------------- | ----------------------------------------------------------------- |
| **场景驱动**     | 从"要给 Agent 加一个'查询优惠券'能力，怎么优雅地添加？"引出 Skill |
| **对比教学**     | Skill vs Tool 的对比，明确概念边界                                |
| **代码走读**     | 讲解 Skill 注册、发现、调用、卸载的完整生命周期                   |
| **最小可行知识** | 只学 Skill 的核心概念和生命周期                                   |

---

## 这个技能解决什么问题

Agent 能力的模块化、可扩展管理。学完能回答：

- Skill 和 Tool 有什么区别？
- 为什么需要 Skill 系统？直接把 Tool 给 Agent 不行吗？
- Skill 的生命周期是什么？
- 怎么注册一个新 Skill？怎么让 Agent 发现？
- Skill 怎么组合使用？多个 Skill 怎么协作？
- 怎么停用一个 Skill 而不影响其他功能？

---

## 前置要求

- 已完成 `06-AI能力-Tools设计实战`（理解工具设计）
- 已完成 `06-AI能力-FunctionCalling实战`（理解工具调用）
- 理解 TypeScript 基本语法

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止，提示先补前置。

---

## 概念讲解

---

### 第一讲：Skill vs Tool

#### 1.1 概念区分

```
Tool（工具）：
  - 单一功能：查询、计算、搜索
  - 粒度：一个 API 调用
  - 示例：query_order、calculate、search_web

Skill（技能）：
  - 组合能力：包含多个 Tool + 特定的 Prompt + 业务逻辑
  - 粒度：一个完整的业务能力
  - 示例：售后处理 Skill（包含查订单+判断退货条件+创建退货单+通知用户）
```

> **类比：修车行。**
>
> ```
> Tool = 螺丝刀（单一工具，只能拧螺丝）
> Skill = 修车技能（包含螺丝刀、扳手、千斤顶，以及知道什么时候用什么、怎么用）
> ```

```
┌──────────────────────────────────────────────────────────┐
│                    Skill（技能）                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  System Prompt："你是售后客服，先确认订单再判断..."   │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │  Tool 1: query_order     → 查订单状态               │ │
│  │  Tool 2: check_policy    → 判断退货条件             │ │
│  │  Tool 3: create_return   → 创建退货单               │ │
│  │  Tool 4: notify_user     → 通知用户结果             │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │  Safety Rules: 超500元需人工审核, 超7天不能退       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  vs                                                        │
│                                                            │
│  Tool（工具）: query_order                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  输入: { orderId: string }                          │ │
│  │  输出: { status, product, tracking }                 │ │
│  │  不知道什么时候用、怎么和其他工具配合                  │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### 1.2 Skill 的结构

```typescript
// agent-platform/src/agent-tools/skill/types.ts
// Skill 的完整数据结构定义

interface SkillDefinition {
  name: string; // 唯一标识："after_sales_service"
  version: string; // 版本号："1.0.0"
  description: string; // 描述："处理售后问题：退货、退款、换货"
  triggerKeywords: string[]; // 触发关键词：["退货", "退款", "换货", "售后"]
  requiredTools: string[]; // 需要的工具：["query_order", "check_return_policy", "create_return"]
  systemPrompt: string; // 覆盖的 System Prompt
  safetyRules: string[]; // 安全规则
  status: "active" | "inactive" | "testing"; // 状态
  priority: number; // 优先级（数字越大越优先）
  createdAt: Date; // 注册时间
  updatedAt: Date; // 更新时间
}
```

> **AI：** 停下来确认"Tool=单一功能，Skill=组合能力，包含多个Tool+Prompt+业务逻辑——理解了吗？"，等回复后再继续。

---

### 第二讲：Skill 的生命周期

#### 2.1 类比：餐厅后厨

```
┌─────────────────────────────────────────────────────────┐
│  类比：餐厅后厨的 Skill 生命周期                          │
│                                                         │
│  1. 注册（Register）                                     │
│     = 大厨今天学会了一道新菜                              │
│     → 把菜名、配料、做法写进菜单系统                      │
│                                                         │
│  2. 发现（Discover）                                     │
│     = 顾客说"我想吃辣的"                                 │
│     → 服务员翻菜单，找到"水煮鱼"、"麻辣香锅"             │
│                                                         │
│  3. 调用（Invoke）                                       │
│     = 下单"水煮鱼"，大厨开始做菜                         │
│     → 备料（Tool: 切鱼）→ 烹饪（Tool: 炒料）→ 装盘      │
│                                                         │
│  4. 卸载（Unload）                                       │
│     = 菜上齐了，厨房恢复待命状态                         │
│     → 锅洗干净，灶台整理好，等下一单                     │
└─────────────────────────────────────────────────────────┘
```

#### 2.2 四个阶段（技术视角）

```
┌──────────────────────────────────────────────────────────┐
│  Skill 生命周期                                           │
│                                                          │
│  1. 注册（Register）                                      │
│     将 Skill 注册到 SkillRegistry                        │
│     → 声明名称、工具、触发条件                            │
│     → 存入 Map<skillName, Skill>                        │
│                                                          │
│  2. 发现（Discover）                                      │
│     Agent 根据用户意图发现可用 Skill                      │
│     → 匹配 triggerKeywords（关键词快速匹配）              │
│     → 或通过语义向量匹配（Embedding 相似度）              │
│                                                          │
│  3. 调用（Invoke）                                        │
│     Agent 激活 Skill，执行其逻辑                          │
│     → 加载 Skill 的 System Prompt                       │
│     → 调用 Skill 的 Tools                                │
│     → 遵循 Skill 的安全规则                              │
│                                                          │
│  4. 卸载（Unload）                                        │
│     Skill 任务完成，恢复默认状态                          │
│     → 恢复默认 System Prompt                             │
│     → 释放 Skill 占用的资源                              │
│     → 清理临时上下文数据                                  │
└──────────────────────────────────────────────────────────┘
```

#### 2.3 TypeScript 实现：Skill 注册与发现

```typescript
// agent-platform/src/agent-tools/skill/SkillRegistry.ts
// 核心职责：Skill 的注册、发现、卸载

import { EventEmitter } from "events";

interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  triggerKeywords: string[];
  requiredTools: string[];
  systemPrompt: string;
  safetyRules: string[];
  status: "active" | "inactive" | "testing";
  priority: number;
}

export class SkillRegistry extends EventEmitter {
  // 用 Map 存储所有已注册的 Skill，key 是 Skill 名称
  private skills: Map<string, SkillDefinition> = new Map();

  /**
   * 注册一个 Skill
   * 相当于"大厨学会了新菜"
   */
  registerSkill(skill: SkillDefinition): void {
    if (this.skills.has(skill.name)) {
      // 同名 Skill 已存在 → 警告并覆盖（热更新）
      console.warn(
        `Skill "${skill.name}" 已存在，将覆盖旧版本 v${this.skills.get(skill.name)!.version}`,
      );
    }
    this.skills.set(skill.name, {
      ...skill,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // 发出事件，通知其他模块有新的 Skill 注册
    this.emit("skill:registered", skill.name);
    console.log(`✅ Skill 注册成功: ${skill.name} v${skill.version}`);
  }

  /**
   * 根据用户消息发现匹配的 Skill
   * 策略：关键词匹配（快速） + 优先级排序
   */
  discoverSkill(userMessage: string): SkillDefinition | null {
    const matched: SkillDefinition[] = [];

    for (const skill of this.skills.values()) {
      // 跳过非活跃状态的 Skill
      if (skill.status !== "active") continue;

      // 关键词匹配：用户消息中包含任意一个触发关键词
      const hit = skill.triggerKeywords.some((keyword) =>
        userMessage.includes(keyword),
      );
      if (hit) {
        matched.push(skill);
      }
    }

    if (matched.length === 0) return null;

    // 多个匹配时，按优先级排序，返回最高优先级的
    matched.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return matched[0];
  }

  /**
   * 卸载一个 Skill
   * 相当于"大厨从菜单上划掉一道菜"
   */
  unregisterSkill(skillName: string): boolean {
    const removed = this.skills.delete(skillName);
    if (removed) {
      this.emit("skill:unregistered", skillName);
      console.log(`🗑️ Skill 已卸载: ${skillName}`);
    }
    return removed;
  }

  /**
   * 停用 Skill（不卸载，但不参与匹配）
   */
  disableSkill(skillName: string): void {
    const skill = this.skills.get(skillName);
    if (skill) {
      skill.status = "inactive";
      console.log(`⏸️ Skill 已停用: ${skillName}`);
    }
  }

  /**
   * 启用 Skill
   */
  enableSkill(skillName: string): void {
    const skill = this.skills.get(skillName);
    if (skill) {
      skill.status = "active";
      console.log(`▶️ Skill 已启用: ${skillName}`);
    }
  }

  /**
   * 列出所有 Skill（供管理后台查询）
   */
  listAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取指定 Skill
   */
  getSkill(skillName: string): SkillDefinition | undefined {
    return this.skills.get(skillName);
  }
}
```

#### 2.4 初始化注册示例

```typescript
// agent-platform/src/agent-tools/skill/skills.config.ts
// 应用启动时注册所有内置 Skill

import { SkillRegistry } from "./SkillRegistry";

export function registerBuiltinSkills(registry: SkillRegistry): void {
  // 注册"售后处理" Skill
  registry.registerSkill({
    name: "after_sales_service",
    version: "1.0.0",
    description: "处理售后问题：退货、退款、换货",
    triggerKeywords: ["退货", "退款", "换货", "售后", "不想要了"],
    requiredTools: ["query_order", "check_return_policy", "create_return"],
    systemPrompt: `你正在处理售后问题。请遵循以下流程：
1. 先确认订单状态（是否已发货、是否在退货期内）
2. 判断是否满足退货/退款条件
3. 创建退货单或退款单
4. 通知用户处理结果
注意：退款金额超过500元需要人工审核，超过7天的订单不能退货。`,
    safetyRules: [
      "退款金额超过500元需要人工审核",
      "已超过7天的订单不能退货",
      "奢侈品/定制商品不支持退货",
    ],
    status: "active",
    priority: 100, // 高优先级，售后问题优先处理
  });

  // 注册"商品咨询" Skill
  registry.registerSkill({
    name: "product_consultation",
    version: "1.0.0",
    description: "回答商品相关问题",
    triggerKeywords: [
      "多少钱",
      "什么颜色",
      "有没有货",
      "推荐",
      "怎么样",
      "好用吗",
    ],
    requiredTools: ["query_item", "search_knowledge"],
    systemPrompt: `你正在回答商品咨询。请基于商品信息回答，不要编造不存在的信息。
如果商品信息中没有答案，请诚实告知用户"目前没有这方面的信息"。`,
    safetyRules: ["不要编造商品信息", "不要对其他商品做比较评价"],
    status: "active",
    priority: 50, // 普通优先级
  });

  // 注册"订单催单" Skill
  registry.registerSkill({
    name: "order_urge",
    version: "1.0.0",
    description: "帮助用户催促订单处理",
    triggerKeywords: ["催单", "催一下", "快点发货", "怎么还不发"],
    requiredTools: ["query_order", "send_urge_notification"],
    systemPrompt: `你正在处理订单催单请求。请先查询订单状态，再发送催单通知。
如果订单已经发货，告知用户物流信息；如果超过承诺发货时间，帮助用户催促并记录。`,
    safetyRules: ["已发货的订单不能催单", "同一订单24小时内只能催一次"],
    status: "active",
    priority: 80,
  });
}
```

> **AI：** 停下来确认"注册→发现→调用→卸载，四个生命周期阶段——理解了吗？"，等回复后再继续。

---

### 第三讲：Skill 的协作

#### 3.1 类比：医院分诊台

```
┌─────────────────────────────────────────────────────────┐
│  类比：医院分诊台                                         │
│                                                         │
│  病人："我头疼，顺便帮我看看上次的化验单"                 │
│                                                         │
│  分诊台（Skill 编排）：                                  │
│    1. 识别两个诉求：头疼 + 查化验单                      │
│    2. 先挂内科（Skill A：头痛诊断）                      │
│       → 医生问诊、开检查、开药                           │
│    3. 再去检验科（Skill B：化验单查询）                  │
│       → 调出上次化验记录，对比结果                       │
│    4. 整合两个科室的结果，给病人综合建议                  │
│                                                         │
│  关键：分诊台记得"上次的化验单"指的是病人张三的化验单     │
│  → 这就是上下文继承（Context Inheritance）               │
└─────────────────────────────────────────────────────────┘
```

#### 3.2 Skill 切换与上下文继承

```
用户："帮我查一下 ORDER123"
  → 匹配"查订单" Skill → 激活
  → 上下文: { orderId: "ORDER123", orderStatus: "已发货" }

用户："这个能退货吗？"（指代"这个" → ORDER123）
  → 匹配"售后处理" Skill → 切换 Skill
  → 从上一个 Skill 继承上下文 { orderId: "ORDER123" }
  → 加载售后 Skill 的 System Prompt
  → 调用 query_order → check_return_policy → 返回结果
```

```
┌──────────────────────────────────────────────────────────┐
│               Skill 切换与上下文继承流程                    │
│                                                          │
│  Session Context: { orderId: "ORDER123" }                │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ Skill A      │    │ Skill B      │                   │
│  │ 查订单       │───→│ 售后处理     │                   │
│  │              │  继承│              │                   │
│  │ 输入:        │  orderId │ 输入:        │                   │
│  │ ORDER123     │    │ ORDER123     │                   │
│  │              │    │ + "能退吗"   │                   │
│  │ 输出:        │    │              │                   │
│  │ 已发货/手机  │    │ 输出:        │                   │
│  └──────────────┘    │ 可以退/退货  │                   │
│                      └──────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

#### 3.3 Skill 编排

```typescript
// agent-platform/src/agent-tools/skill/SkillOrchestrator.ts
// 负责多个 Skill 的编排执行

export class SkillOrchestrator {
  constructor(
    private registry: SkillRegistry,
    private context: SessionContext,
  ) {}

  /**
   * 处理复合请求：用户一句话包含多个意图
   * 例如："帮我推荐一款手机，顺便查一下上次买的那个能退吗"
   */
  async handleCompositeRequest(userMessage: string): Promise<string> {
    // 1. 意图拆分：识别出多个子意图
    const subIntents = this.splitIntents(userMessage);
    // 结果: ["推荐手机", "查上次订单是否可退"]

    const results: string[] = [];
    let sharedContext = this.context;

    // 2. 按顺序执行每个子意图对应的 Skill
    for (const intent of subIntents) {
      const skill = this.registry.discoverSkill(intent);
      if (!skill) {
        results.push(`抱歉，我不太理解"${intent}"的意思。`);
        continue;
      }

      // 3. 执行 Skill，并将上一次的上下文传递下去
      const result = await this.executeSkill(skill, intent, sharedContext);
      results.push(result);

      // 4. 更新共享上下文（如提取到的订单号等）
      sharedContext = this.mergeContext(sharedContext, result);
    }

    // 5. 合并所有结果返回
    return results.join("\n\n");
  }

  private splitIntents(message: string): string[] {
    // 简化实现：按分隔词拆分
    const separators = ["顺便", "还有", "另外", "同时", "以及"];
    for (const sep of separators) {
      if (message.includes(sep)) {
        return message
          .split(sep)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return [message];
  }

  private async executeSkill(
    skill: SkillDefinition,
    userMessage: string,
    context: SessionContext,
  ): Promise<string> {
    // 加载 Skill 的 System Prompt
    // 调用 Skill 的 Tools
    // 遵循 Skill 的安全规则
    // 返回结果
    return `[${skill.name}] 处理结果: ...`;
  }

  private mergeContext(
    current: SessionContext,
    result: string,
  ): SessionContext {
    // 从结果中提取关键信息（订单号、商品ID等）更新上下文
    return current;
  }
}
```

#### 3.4 Skill 优先级规则

```
当多个 Skill 同时匹配用户消息时，按以下优先级选择：

┌──────────────────────────────────────────────────────────┐
│  优先级规则（从高到低）                                    │
│                                                          │
│  1. 关键词精确匹配 > 模糊匹配                             │
│     例："退货" → after_sales_service（精确匹配）         │
│         "退那个" → 可能是退货或退订，得分低               │
│                                                          │
│  2. 业务 Skill > 通用 Skill                              │
│     例："售后处理" > "闲聊回复"                           │
│                                                          │
│  3. 最近使用的 Skill > 很久没用的 Skill                   │
│     例：上一轮用了"查订单"，这轮优先匹配"查订单"          │
│                                                          │
│  4. 用户明确要求 > 自动匹配                               │
│     例："用售后处理帮我..." → 强制使用该 Skill            │
│                                                          │
│  5. 配置的 priority 值高 > 低                             │
│     例：after_sales_service(100) > product_consultation(50)│
└──────────────────────────────────────────────────────────┘
```

---

### 第四讲：Skill 的动态管理

#### 4.1 类比：App Store 的热更新

```
┌─────────────────────────────────────────────────────────┐
│  类比：手机 App 的安装/卸载/停用                          │
│                                                         │
│  安装 App = 注册 Skill                                   │
│     → 下载 → 安装 → 手机上出现图标                       │
│     → 不用重启手机                                       │
│                                                         │
│  卸载 App = 卸载 Skill                                   │
│     → 删除应用和数据                                     │
│     → 手机其他功能不受影响                               │
│                                                         │
│  停用 App = 停用 Skill                                   │
│     → App 还在手机里，但图标变灰，不能打开               │
│     → 随时可以重新启用                                   │
│                                                         │
│  App 灰度发布 = Skill 灰度发布                           │
│     → 新版本先给 10% 用户试用                            │
│     → 没问题 → 扩大到 50% → 100%                        │
│     → 有问题 → 回滚到旧版本，不影响所有用户               │
└─────────────────────────────────────────────────────────┘
```

#### 4.2 TypeScript 实现：热加载/热卸载

```typescript
// agent-platform/src/agent-tools/skill/SkillController.ts
// 管理 Skill 的 HTTP API 接口

import express, { Request, Response } from "express";
import { SkillRegistry } from "./SkillRegistry";

export function createSkillRouter(registry: SkillRegistry) {
  const router = express.Router();

  // 注册新 Skill（热加载）
  // POST /api/skills/register
  router.post("/register", (req: Request, res: Response) => {
    try {
      const skill = req.body;
      // 验证必填字段
      if (!skill.name || !skill.triggerKeywords) {
        return res
          .status(400)
          .json({ error: "name 和 triggerKeywords 是必填字段" });
      }
      registry.registerSkill(skill);
      res.json({ success: true, message: `Skill "${skill.name}" 注册成功` });
    } catch (err) {
      res
        .status(500)
        .json({ error: "注册失败", detail: (err as Error).message });
    }
  });

  // 卸载 Skill
  // DELETE /api/skills/:name
  router.delete("/:name", (req: Request, res: Response) => {
    const removed = registry.unregisterSkill(req.params.name);
    if (removed) {
      res.json({ success: true, message: `Skill "${req.params.name}" 已卸载` });
    } else {
      res.status(404).json({ error: `Skill "${req.params.name}" 不存在` });
    }
  });

  // 停用 Skill（不卸载，但不参与匹配）
  // POST /api/skills/:name/disable
  router.post("/:name/disable", (req: Request, res: Response) => {
    registry.disableSkill(req.params.name);
    res.json({ success: true, message: `Skill "${req.params.name}" 已停用` });
  });

  // 启用 Skill
  // POST /api/skills/:name/enable
  router.post("/:name/enable", (req: Request, res: Response) => {
    registry.enableSkill(req.params.name);
    res.json({ success: true, message: `Skill "${req.params.name}" 已启用` });
  });

  // 查看所有 Skill
  // GET /api/skills/list
  router.get("/list", (_req: Request, res: Response) => {
    const skills = registry.listAll();
    res.json({ total: skills.length, skills });
  });

  return router;
}
```

#### 4.3 Skill 灰度发布

```typescript
// agent-platform/src/agent-tools/skill/SkillGradualRollout.ts
// 实现 Skill 的灰度发布：新 Skill 逐步放量

export class SkillGradualRollout {
  private rolloutConfig: Map<
    string,
    {
      newSkill: SkillDefinition;
      oldSkill?: SkillDefinition;
      percentage: number; // 当前流量百分比 0-100
      startTime: Date;
    }
  > = new Map();

  /**
   * 开始灰度发布
   * @param skillName Skill 名称
   * @param newSkill 新版本 Skill
   * @param initialPercentage 初始流量百分比（默认 10%）
   */
  startRollout(
    skillName: string,
    newSkill: SkillDefinition,
    initialPercentage = 10,
  ): void {
    const oldSkill = this.registry.getSkill(skillName);
    this.rolloutConfig.set(skillName, {
      newSkill: { ...newSkill, status: "testing" },
      oldSkill,
      percentage: initialPercentage,
      startTime: new Date(),
    });
    console.log(
      `🚀 灰度发布开始: ${skillName}, 初始流量 ${initialPercentage}%`,
    );
  }

  /**
   * 根据用户 ID 决定路由到新版还是旧版
   * 使用 hash 确保同一用户始终路由到同一版本
   */
  getSkillForUser(skillName: string, userId: string): SkillDefinition | null {
    const config = this.rolloutConfig.get(skillName);
    if (!config) {
      return this.registry.getSkill(skillName) ?? null;
    }

    // 用 userId 的 hash 决定路由，确保同一用户始终拿到同一版本
    const hash = this.hashUserId(userId) % 100;
    if (hash < config.percentage) {
      return config.newSkill; // 新版
    }
    return config.oldSkill ?? this.registry.getSkill(skillName) ?? null; // 旧版
  }

  /**
   * 扩大灰度比例
   */
  expandRollout(skillName: string, newPercentage: number): void {
    const config = this.rolloutConfig.get(skillName);
    if (config) {
      config.percentage = Math.min(newPercentage, 100);
      console.log(`📈 灰度比例扩大: ${skillName} → ${config.percentage}%`);
    }
  }

  /**
   * 完成灰度 → 全量上线
   */
  completeRollout(skillName: string): void {
    const config = this.rolloutConfig.get(skillName);
    if (config) {
      config.newSkill.status = "active";
      this.registry.registerSkill(config.newSkill);
      this.rolloutConfig.delete(skillName);
      console.log(`✅ 灰度完成: ${skillName} 已全量上线`);
    }
  }

  /**
   * 回滚 → 恢复到旧版本
   */
  rollback(skillName: string): void {
    this.rolloutConfig.delete(skillName);
    console.log(`⏪ 灰度回滚: ${skillName} 已恢复到旧版本`);
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0; // 转为 32 位整数
    }
    return Math.abs(hash);
  }
}
```

---

### 第五讲：Skill 的四个组成部分

> 来自 AI 应用开发的核心洞察：Skill 不是 Prompt，Skill = Prompt + 工具规则 + 执行函数 + 参数配置。

#### 5.1 四部分一览

| 部分             | 作用                                              | 示例                                             |
| ---------------- | ------------------------------------------------- | ------------------------------------------------ |
| **Prompt**       | 角色定义 + 规则约束，决定 Skill 怎么说话          | "你是电商订单查询助手，只基于数据回答，不要编造" |
| **工具接入规则** | 声明需要哪些工具、何时调用、传什么参数            | "工具：query_order，触发条件：用户提供了订单号"  |
| **执行函数**     | 串联流程：解析输入→查数据→组装messages→调LLM→返回 | TypeScript 函数，串联整个调用链                  |
| **参数配置**     | 控制输出行为：温度、最大 token 数等               | `temperature=0.3, maxTokens=200`                 |

#### 5.2 完整 TypeScript Skill 示例

```typescript
// agent-platform/src/agent-tools/skill/skills/orderQuery.skill.ts
// 一个完整的"订单查询" Skill 实现

import { ChatCompletionService } from "../../services/chatCompletion";
import { OrderService } from "../../services/order";

interface SkillResult {
  content: string;
  extractedContext: Record<string, unknown>;
}

export async function skillOrderQuery(
  userMessage: string,
  userId: string,
): Promise<SkillResult> {
  // 第1步：解析用户输入，提取订单号
  const orderIdMatch = userMessage.match(/ORDER\d{3,}|\d{6,}/);
  if (!orderIdMatch) {
    return {
      content: '请提供订单号，我帮您查询。例如："帮我查一下 ORDER123"',
      extractedContext: {},
    };
  }
  const orderId = orderIdMatch[0];

  // 第2步：查数据（调工具），拿到上下文
  const orderService = new OrderService();
  const order = await orderService.queryOrder(orderId, userId);
  if (!order) {
    return {
      content: `未找到订单 ${orderId}，请确认订单号是否正确。`,
      extractedContext: {},
    };
  }

  const context = `订单号：${order.id}
状态：${order.status}
商品：${order.productName}
金额：¥${order.amount}
快递单号：${order.tracking || "暂无"}
下单时间：${order.createdAt}`;

  // 第3步：组装 messages = system prompt + 数据上下文 + 用户问题
  const messages = [
    {
      role: "system" as const,
      content:
        "你是电商订单查询助手，只基于提供的订单数据回答，不要编造任何信息。",
    },
    {
      role: "system" as const,
      content: `以下是该订单的数据：\n${context}`,
    },
    {
      role: "user" as const,
      content: userMessage,
    },
  ];

  // 第4步：调 LLM，返回结果
  // 使用 GPT-5.6-mini（$0.075/M input，$0.30/M output）
  // 订单查询不需要复杂推理，mini 足够
  const chatService = new ChatCompletionService();
  const response = await chatService.complete({
    model: "gpt-5.6-mini", // 性价比之选，订单查询不需要 sol 的推理能力
    messages,
    temperature: 0.3, // 低温度，确保回答稳定一致
    maxTokens: 200,
  });

  return {
    content: response.choices[0].message.content ?? "查询失败，请稍后重试。",
    extractedContext: { orderId, orderStatus: order.status },
  };
}
```

#### 5.3 模型选择策略（2026 年）

```typescript
// agent-platform/src/agent-tools/skill/modelStrategy.ts
// 不同 Skill 场景应该用不同模型，平衡效果与成本

export const MODEL_STRATEGY: Record<string, { model: string; reason: string }> =
  {
    // 简单查询 → 最便宜的模型
    order_query: {
      model: "gpt-5.6-mini", // $0.075/M input, $0.30/M output
      reason: "订单查询只需数据拼装，不需要复杂推理",
    },
    // 简单 FAQ → 最便宜的模型
    faq_match: {
      model: "gpt-5.6-flash", // $0.025/M input, $0.10/M output
      reason: "FAQ 匹配主要是 Embedding 相似度，LLM 只做格式化输出",
    },
    // 售后处理 → 需要推理能力
    after_sales: {
      model: "gpt-5.6-sol", // $1.25/M input, $10.00/M output
      reason: "售后涉及多条件判断（退货期、金额、品类），需要推理能力",
    },
    // 商品推荐 → 需要推理 + 创意
    product_recommend: {
      model: "gpt-5.6-sol", // $1.25/M input, $10.00/M output
      reason: "推荐需要理解用户偏好并给出有说服力的理由",
    },
  };
```

| 模型          | 每百万 token 输入 | 每百万 token 输出 | 上下文窗口 | 适用场景             |
| ------------- | :---------------: | :---------------: | :--------: | -------------------- |
| GPT-5.6-sol   |       $1.25       |      $10.00       |   1.05M    | 复杂推理、售后、推荐 |
| GPT-5.6-mini  |      $0.075       |       $0.30       |   1.05M    | 数据查询、格式化输出 |
| GPT-5.6-flash |      $0.025       |       $0.10       |   1.05M    | 极简任务、FAQ 格式化 |

---

### 第六讲：如何写好一个 Skill

#### 6.1 类比：写一份好的菜谱

```
┌─────────────────────────────────────────────────────────┐
│  类比：写菜谱 vs 写 Skill                                │
│                                                         │
│  烂菜谱：                                               │
│    "做个红烧肉，差不多就行"                               │
│    → 什么肉？多少克？什么火候？不知道                     │
│                                                         │
│  好菜谱：                                               │
│    材料：五花肉 500g、冰糖 30g、生抽 2勺...              │
│    步骤：                                               │
│      1. 五花肉切 3cm 方块，冷水下锅焯水                  │
│      2. 小火炒糖色至琥珀色，下肉翻炒上色                  │
│      3. 加开水没过肉，大火烧开转小火炖 40 分钟            │
│      4. 大火收汁至浓稠                                   │
│    注意：糖色不能炒过头，否则发苦                         │
│                                                         │
│  烂 Skill：                                             │
│    "帮用户处理售后"                                      │
│    → 什么能退？什么不能退？怎么判断？不知道               │
│                                                         │
│  好 Skill：                                             │
│    输入：用户消息（含订单号）                             │
│    输出：售后处理结果                                     │
│    步骤：查订单→判断条件→创建退货单→通知用户              │
│    边界：超500元需人工审核，超7天不能退                   │
│    安全规则：不泄露其他用户订单信息                       │
└─────────────────────────────────────────────────────────┘
```

#### 6.2 五步流程

```
第1步：想清楚需求（自己做，AI不懂你的业务）
   ↓  问自己：输入是什么？输出是什么？边界在哪？
第2步：（可选）和AI探讨，理清思路
   ↓  把需求描述给 AI，让它帮你梳理逻辑
第3步：让AI生成初版Skill
   ↓  把需求给 AI，生成代码
第4步：测试，用真实case验证
   ↓  至少覆盖：正常输入、边界输入、异常输入
第5步：发现问题 → 告诉AI → 让它优化 → 回到第4步
```

#### 6.3 三类测试用例

| 类型         | 说明                       | 示例                     | 期望结果                  |
| ------------ | -------------------------- | ------------------------ | ------------------------- |
| **正常输入** | 标准问题，能否给出预期回答 | "这个手机支持5G吗？"     | 基于商品信息回答          |
| **边界输入** | 模糊问题，Skill怎么处理    | "你们的售后政策是什么？" | 给出售后政策说明          |
| **异常输入** | 完全不相关的问题           | "帮我写一首诗"           | 拒绝并说明只处理商品/订单 |

#### 6.4 迭代优化示例

```
测试发现：用户问"帮我写一首诗"，Skill 居然真的写了一首

❌ 差做法：放任不管，认为"用户偶尔玩一下没事"
   后果：Prompt 被污染，后续对话可能偏离主题

✅ 好做法：修改 System Prompt 加入边界约束
   修改后：
   "如果用户请求与商品/订单无关（如写诗、闲聊、天气），
   回复：'我是订单查询助手，只能帮您查询订单和商品信息。'"

再次测试：用户问"帮我写一首诗"
   → 正确回复："我是订单查询助手，只能帮您查询订单和商品信息。"
```

---

### 🔒 G2 讲解门禁

> **AI：** 确认以上讲解的学习者都表示理解。**必须等用户明确回复"没问题"/"理解了"等肯定词，未收到回复前不得出题。** 全部确认 → 放行。有任何疑问 → 回到对应讲，澄清后再确认。

---

## 阶段一：理解验证（Quiz 闭卷）

### 概念难度与题目配额

| 概念                                  |  难度  | 最少题数 | 出题说明      |
| ------------------------------------- | :----: | :------: | ------------- |
| Skill vs Tool 概念区分                |  ⭐⭐  |    2     | 选择+判断     |
| Skill 生命周期（注册/发现/调用/卸载） | ⭐⭐⭐ |    3     | 核心难点      |
| Skill 的触发条件与匹配策略            |  ⭐⭐  |    2     | 选择+场景     |
| Skill 的协作（切换、编排、优先级）    | ⭐⭐⭐ |    2     | 场景分析      |
| Skill 动态管理（热加载/灰度发布）     |  ⭐⭐  |    2     | 代码实践+选择 |
| Skill 四部分组成                      | ⭐⭐⭐ |    2     | 核心概念      |
| 如何写好一个 Skill                    |  ⭐⭐  |    2     | 流程+场景     |

### 题目池

#### 选择题

**Q-C1.** 关于 Skill 和 Tool 的区别，以下描述正确的是？
A. Tool 是组合能力，Skill 是单一功能
B. Skill 是组合能力，包含多个 Tool + 特定 Prompt + 业务逻辑 + 安全规则
C. Skill 和 Tool 没有区别，是同一个概念
D. Tool 只能在 Skill 内部使用，不能单独调用

**Q-C2.** Skill 生命周期四个阶段的正确顺序是？
A. 发现 → 调用 → 注册 → 卸载
B. 注册 → 发现 → 调用 → 卸载
C. 调用 → 注册 → 发现 → 卸载
D. 注册 → 调用 → 发现 → 卸载

**Q-C3.** 在 `SkillRegistry` 中，发现（Discover）Skill 时主要依据什么？
A. 用户输入的完整语义分析
B. 匹配 Skill 的 `triggerKeywords` 关键词列表
C. 随机选择一个已注册的 Skill
D. 按 Skill 名称的字母顺序

**Q-C4.** 当多个 Skill 同时匹配用户消息时，优先级的正确规则是？
A. 模糊匹配 > 精确匹配，通用 Skill > 业务 Skill
B. 关键词精确匹配 > 模糊匹配，业务 Skill > 通用 Skill
C. 最新注册的 Skill 优先
D. 名称最短的 Skill 优先

**Q-C5.** Skill 热卸载（Hot Unload）的作用是？
A. 重启应用后 Skill 自动恢复
B. 不停机的情况下删除或停用一个 Skill，不影响其他功能
C. 删除 Skill 的同时删除所有用户的对话数据
D. 卸载后无法重新注册

#### 判断题

**Q-J1.** Tool = 螺丝刀（单一工具），Skill = 修车技能（包含螺丝刀、扳手、千斤顶，以及知道什么时候用哪个工具）。这个类比是正确的。

**Q-J2.** Skill 灰度发布时，新 Skill 一旦注册就可以直接全量上线，不需要分阶段放量。

#### 场景分析题

**Q-S1.** HMall 场景：用户说"帮我推荐一款手机，顺便查一下上次买的那个能退吗"。请分析此处包含几个意图，Agent 应该如何编排 Skill 来处理这个复合请求？需要说明 Skill 切换时上下文（如订单号）如何继承。

#### 代码/实践题

**Q-P1.** 请根据 SkillRegistry 的 TypeScript 实现，写出注册一个"物流查询" Skill 的代码片段，要求：Skill 名称 `logistics_tracking`，触发关键词包含"物流""快递""到哪了"，需要的 Tool 为 `query_order` 和 `track_logistics`，安全规则必须包含"物流信息超过 30 天不展示"。

---

## 批改与补考机制

> **AI：** 题目池中的题目是最低基线。如果池中题目不够配额，必须自行生成新题补足，不得少于配额数。

### 补考规则

| 错误概念                       | 补考出题方向                                                              |
| ------------------------------ | ------------------------------------------------------------------------- |
| Skill vs Tool 概念区分         | 改考"给一个具体业务场景（如订单催单）让考生拆解成 Tool 和 Skill 清单"     |
| Skill 生命周期四阶段           | 改考"其中某一阶段缺失时（如没有卸载步骤）会有什么影响"                    |
| 触发条件与匹配策略             | 改考"如果 triggerKeywords 为空，Agent 如何发现 Skill？"或"怎样避免误触发" |
| Skill 协作（切换/编排/优先级） | 改考"用户明确指定 Skill 名称 vs 自动匹配的优先级矛盾如何解决"             |
| 动态管理（热加载/灰度发布）    | 改考"灰度发布时发现错误率上升，回滚方案怎么设计"                          |

---

### 🔒 G3 理解门禁

> **AI：** 确认所有概念点全部通过。全部通过 → 放行。有未通过 → 补考。

---

## 实践任务：设计一个 Skill

> **说明：** 文中 `SkillRegistry`/`SkillController` 等为**旧 Java 参考**（`com.hmall.ai.*`），仅理解"原理等价"的 Skill 生命周期。新实现应在 **agent-platform 的 agent-tools 子系统**（TS）中设计/实现 Skill 注册、发现、调用与热加载。

### 目标

为 HMall 设计一个"订单催单" Skill。

### 步骤

1. 定义 Skill 结构：
   - 名称、触发关键词
   - 需要的 Tool
   - System Prompt 覆盖
   - 安全规则

2. 写 Skill 注册代码

3. 测试 Skill 的发现和调用

### ✅ 验证

- Skill 能正确匹配触发关键词
- Skill 能正确加载 System Prompt
- Skill 能调用所需的 Tool
- 不匹配时不激活该 Skill

---

### 🔒 G4 决策门禁

> **AI：** 确认学习者已完成动手环节。已完成 → 继续。未完成 → 回去做。

---

## 🎯 学完检查

| 检查项                         | 自己回答 |
| ------------------------------ | -------- |
| Skill 和 Tool 的区别是什么？   |          |
| Skill 的生命周期有哪四个阶段？ |          |
| 多个 Skill 匹配时怎么选择？    |          |
| Skill 怎么热加载？             |          |
| Skill 灰度发布怎么实现？       |          |
| 为什么需要 Skill 系统？        |          |

---

> **下一步：** 完成后进入 `06-AI能力-双层架构调用链.md`，学习 TS 编排层和 Python 推理层如何协作。

---

## 2026年最新动态（截至2026年8月）

### Nacos 3.2/3.3 AI Registry 完成"AI 三件套"

Nacos 3.2.0-BETA（2026.3）推出 AI Registry，3.3.0-BETA（2026.8）持续增强：

- **AI Registry**：模型注册、Skill 注册、Prompt 注册，构成"AI 三件套"
- **插件架构增强**：支持自定义 Skill 发现、安全审查、灰度发布插件
- **API 现代化**：RESTful API 重构，兼容 OpenAPI 3.0
- **Java 17 基线**：Nacos 3.x 要求 Java 17+

### 文件系统 + MCP 双通道 Skill 发现

2026 年主流 Agent 采用双通道 Skill 发现：

```
通道1：文件系统（Claude Code 模式）
skills/
├── web-search/SKILL.md
├── code-review/SKILL.md + scripts/

通道2：MCP 协议（v5 无状态）
MCP Server → tools/list → tools/call
```

- 文件系统适合内部 Skill，MCP 适合外部/第三方 Skill
- 两者互补，Agent 可同时使用两种通道

### Skill vs Tool 的区别（2026 年共识）

| 维度     | Tool                   | Skill                             |
| -------- | ---------------------- | --------------------------------- |
| 粒度     | 原子操作（查订单）     | 复合能力（订单处理 = 查+改+通知） |
| 注册方式 | 函数签名 + JSON Schema | SKILL.md + MCP 工具描述           |
| 生命周期 | 静态注册               | 热加载/热卸载                     |
| 发现方式 | 模型 Function Calling  | 意图匹配 + MCP 工具发现           |

---

<!-- 教学补全：P2-X 会话追加 -->

## 判断力日志

> **AI：** 引导学习者写一条判断力日志，四段式（问题→决策→取舍→防什么失败）。Quiz、补考、动手环节（实践任务）原文已有，跳过。

**提示要点：**

1. **问题：** Skill 系统设计中，Skill 和 Tool 的边界到底画在哪？什么情况下一个功能应该是独立的 Skill，什么情况下它应该只是一个 Tool？

2. **决策：** 你决定把"售后处理"设计为一个 Skill（包含 query_order + check_return_policy + create_return + notify_user 四个 Tool），而不是四个独立的 Tool 直接暴露给 Agent。这个决策的依据是什么？如果拆成四个 Tool，Agent 会面临什么问题？

3. **取舍：**
   - Skill 的 triggerKeywords 要写多宽？写太窄（如只写"退货"）→ 用户说"想退"就匹配不到；写太宽（如加上"退""还""换"）→ 用户说"退一步讲"也会误触发。你怎么取舍？
   - Skill 灰度发布时，初始流量设 10% 还是 50%？10% 更安全但验证慢，50% 验证快但出问题影响面大。你怎么决定？
   - Skill 热卸载 vs 停用：什么时候用卸载（彻底删除），什么时候用停用（保留但禁用）？两者的取舍是什么？

4. **防什么失败：**
   - 防"Skill 变成巨型 switch"——如果所有业务逻辑都写在一个 Skill 里，就和最初的 200 行 switch 没区别了。Skill 系统的核心价值（模块化、可扩展、灰度发布）全部丧失。
   - 防"Skill 切换丢上下文"——用户说"这个能退吗"时，上一个 Skill 提取的 orderId 没有继承到售后 Skill，导致 Agent 反问"请问您的订单号是什么？"——用户已经告诉过它了。
   - 防"灰度发布无回滚方案"——新 Skill 上线后错误率飙升，但回滚方案没设计好，只能硬着头皮修 bug，影响所有灰度用户。

**写日志格式：**

```
## 判断力日志：Skill 系统边界与灰度策略

### 问题
[描述你面临的问题]

### 决策
[描述你做了什么决策]

### 取舍
[描述你的取舍：哪些做了、哪些没做、为什么？]

### 防什么失败
[描述这个决策防止了哪些失败模式？]
```
