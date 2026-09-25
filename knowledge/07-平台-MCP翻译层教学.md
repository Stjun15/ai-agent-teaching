# Phase 5 平台 · MCP 翻译层教学（v1.0）

> **一句话总结：** Phase 5 平台 · MCP 翻译层教学（v1.0）：从"接第三个业务又手写一个 MCP Server"的痛点讲清三层架构、配置驱动思路与三步演进（手写→配置驱动→连接器市场）。

> **前置文档**
>
> - `07-平台-MCP翻译层规范`（`07-平台治理与交付/`）—— 本文"上一篇"。
> - `07-业务-天机学堂接入`（`07-平台治理与交付/`）—— 前置：先亲手搭过手写 MCP Server。
> - `07-平台-工具Provider接入教学`（`07-平台治理与交付/`）—— 工具接入概念前置。

> **后置文档**
>
> - `07-平台-MCP翻译层代码级实操`（`07-平台治理与交付/`）—— 本文"下一篇"，动手建框架。

> 上一篇：[07-平台-MCP翻译层规范.md](07-平台-MCP翻译层规范.md)　|　下一篇：[07-平台-MCP翻译层代码级实操.md](07-平台-MCP翻译层代码级实操.md)　（MCP翻译层链路）

> **AI角色：老师。** 你不是编码者，你是出题者+批改者+讲解者。目标是让学习者在 45 分钟内理解"为什么手写 MCP Server 不可持续、通用翻译层长什么样、三层架构怎么拆"，建立从"手写薄层"到"配置驱动通用框架"的演进认知。
> **防什么失败？** 防"每接一个业务就手写一个 MCP Server"（不可持续，3个业务=3套手写代码）。防"翻译层越写越厚，变成第二个业务层"（翻译层只做翻译，不做业务逻辑）。防"知道要通用化但不知道从哪下手"（三层拆分给出明确的演进路径）。
> **配套参考：** `07-平台-MCP翻译层规范.md`（YAML 配置 schema + 框架组件契约）、`07-平台-MCP翻译层代码级实操.md`（6步动手建框架+迁移+验证）、`07-平台-工具Provider接入教学.md`（工具接入概念，前置）、`07-业务-天机学堂接入.md`（天机学堂接入实战，前置）、`00-最终架构总览.md`（架构真源）。

---

## 设计原理

| 原则             | 在本教学中的体现                                                                       |
| ---------------- | -------------------------------------------------------------------------------------- |
| **场景驱动**     | 从"接第三个业务时又手写一个 MCP Server"的痛点引出                                      |
| **生活化类比**   | 翻译层=同声传译耳机，配置=频道切换，框架=耳机本身                                      |
| **差异驱动**     | 只讲"手写→通用"的差异点，MCP 协议本身默认已掌握                                        |
| **最小可行知识** | 只学：三层架构 + 配置驱动思路 + 演进路线，不学 YAML 细节（规范篇）和代码实现（实操篇） |
| **可迁移**       | 通用翻译层本身就是"可迁移"的工程落点——换业务只换配置，框架不动                         |

---

## 这个技能解决什么问题

学完能回答：

- 为什么手写 MCP Server（tjxt-mcp-server 的 tools.ts + real.ts）不可持续？3个业务会怎样？
- 通用翻译层的三层架构是什么？哪层已经通用、哪层需要自动化、哪层最难？
- 为什么选"配置驱动（YAML）"而不是"OpenAPI 自动生成"？
- DeepSeek Harness 的 dsh-mcp-connector 做了什么？和我们的方法有什么异同？
- 翻译层和 agent-platform 内核是什么关系？翻译层变了，内核要不要改？
- 演进路线是什么？从手写薄层到通用框架分几步？

---

## 前置要求

- ✅ 已完成 `07-平台-工具Provider接入教学.md`（理解三要素+注册流程+五件事治理）
- ✅ 已完成 `07-业务-天机学堂接入.md`（亲手搭过 tjxt-mcp-server，理解手写翻译的完整流程）
- ✅ 已理解 `00-最终架构总览.md`（内核 vs 插件边界，平台做 MCP Client、业务做 MCP Server）
- ✅ 理解 MCP 协议（`tools/list` + `tools/call`，JSON-RPC 2.0）

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止，提示先补前置。**特别注意：** 如果没有亲手搭过 tjxt-mcp-server，先回去完成天机学堂接入——本文件讲的是"如何从手写演进到通用"，没搭过手写的就不知道要演进什么。

---

## 概念讲解

---

### 第一讲：从"手写翻译"到"通用翻译层"

#### 1.1 问题：tjxt-mcp-server 的 tools.ts + real.ts 是手写的

回顾天机学堂接入时写的 tjxt-mcp-server，核心代码在两个文件里：

**tools.ts 的问题——手写注册 + 手写分发：**

```typescript
// 问题1：listTools() 是手写的，每加一个工具要手动加一条
export function listTools() {
  return [
    { name: "getCourseDetail", description: "...", inputSchema: {...} },
    { name: "placeOrder", description: "...", inputSchema: {...} },
    // 接第3个工具？手动加第3条
    // 接第10个工具？手动加第10条
  ];
}

// 问题2：callTool() 是 switch/case，每加一个工具要手动加一个 case
export async function callTool(name, args, userId) {
  switch (name) {
    case "getCourseDetail": return realGetCourseDetail(...);
    case "placeOrder": return realPlaceOrder(...);
    // 接第3个工具？手动加第3个 case
    default: throw new Error("Tool not found");
  }
}
```

**real.ts 的问题——鉴权/路径/响应格式全部硬编码：**

```typescript
// 问题1：鉴权逻辑硬编码（天机学堂用手机号+密码登录换token）
async function getToken() {
  await fetch("http://localhost:8081/accounts/login", {
    body: JSON.stringify({ type: 1, cellPhone: "...", password: "..." }),
  });
}

// 问题2：API路径硬编码
async function realGetCourseDetail(courseId, userId) {
  const resp = await gatewayGet(`/cs/courses/${courseId}/catalogs`);
  // 换业务？路径全变了
}

// 问题3：响应格式适配硬编码
if (resp.code !== 200) {
  return JSON.stringify({ code: -1, msg: `网关返回错误: ${resp.msg}` });
  // 换业务？响应格式可能完全不同
}
```

#### 1.2 3个业务会怎样？

| 业务     | tools.ts                           | real.ts                   | 总代码量           |
| -------- | ---------------------------------- | ------------------------- | ------------------ |
| 天机学堂 | 手写 listTools + switch/case       | 手写鉴权+路径+响应        | ~200行             |
| hmall    | 再手写一遍 listTools + switch/case | 再手写一遍鉴权+路径+响应  | ~200行             |
| MBTI     | 再手写一遍 listTools + switch/case | 再手写一遍鉴权+路径+响应  | ~200行             |
| **合计** | **3套手写注册+分发**               | **3套手写鉴权+路径+响应** | **~600行重复代码** |

> **关键洞察：** 三个 MCP Server 的 `index.ts`（46行 MCP 协议处理）完全相同，`tools.ts` 和 `real.ts` 的**结构**也相同（注册工具→分发→鉴权→调API→适配响应），只是**数据**不同（工具名、路径、鉴权方式）。**结构相同、数据不同 = 应该用配置驱动，不应该手写。**

#### 1.3 类比：同声传译耳机

```
手写翻译 = 每种语言雇一个翻译官
  - 中译英：翻译官A（手写 tools.ts + real.ts）
  - 中译日：翻译官B（再手写一遍）
  - 中译法：翻译官C（再手写一遍）
  - 问题：翻译官越来越多，管理成本爆炸

通用翻译层 = 一个同声传译耳机
  - 耳机本身 = 通用框架（index.ts + gateway.ts + auth.ts + normalizer.ts）
  - 频道切换 = 配置文件（tjxt.yaml / hmall.yaml / mbti.yaml）
  - 换语言 = 切频道，不需要换耳机
```

**[确认理解]** 用自己的话讲：tjxt-mcp-server 的 tools.ts 和 real.ts 有什么问题？3个业务为什么不能3套手写代码？

---

### 第二讲：三层架构拆分

通用翻译层的核心设计是**三层拆分**——把当前 tjxt-mcp-server 的代码按"通用程度"分成三层，通用程度高的做成框架，通用程度低的做成配置。

#### 2.1 三层总览

```
┌─────────────────────────────────────────────────────────┐
│          通用 MCP 翻译层（mcp-gateway）                    │
├─────────────────────────────────────────────────────────┤
│ 第3层：业务语义翻译（声明式配置 + 钩子）                    │
│   - 鉴权策略适配（login / OAuth2 / API Key）              │
│   - 敏感操作标记（sensitive: true → HITL）                │
│   - 多步操作组合（preSteps: 预下单→正式下单）              │
│   - 响应格式统一（responseFormat 配置）                    │
│   通用程度：★☆☆（每个业务不同，用配置表达差异）              │
├─────────────────────────────────────────────────────────┤
│ 第2层：工具发现（配置驱动自动生成）                         │
│   - listTools() 从 YAML 自动生成（不再手写）               │
│   - callTool() 从 YAML 的 method/path/params 自动映射     │
│   通用程度：★★☆（结构相同，数据不同，配置驱动）              │
├─────────────────────────────────────────────────────────┤
│ 第1层：协议翻译（已完成，通用）                             │
│   - MCP JSON-RPC 2.0 ↔ HTTP REST                        │
│   - tools/list + tools/call 标准实现                      │
│   通用程度：★★★（和业务完全无关，46行代码）                 │
└─────────────────────────────────────────────────────────┘
```

#### 2.2 第1层：协议翻译（✅ 已完成，通用）

对应 tjxt-mcp-server 的 `index.ts`，46行代码：

```typescript
app.post("/mcp", async (req, res) => {
  const { id, method, params } = req.body ?? {};
  if (method === "tools/list") {
    res.json({ jsonrpc: "2.0", id, result: { tools: listTools() } });
  } else if (method === "tools/call") {
    const result = await callTool(params.name, params.arguments, userId);
    res.json({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: result }] },
    });
  }
});
```

**这46行和业务完全无关**——不管是天机学堂、hmall、MBTI，MCP 协议的处理逻辑一模一样。**不需要改，直接搬进通用框架。**

#### 2.3 第2层：工具发现（❌ 目前手写，需要自动化）

对应 tjxt-mcp-server 的 `tools.ts` 的 `listTools()` 和 `callTool()`。

**当前（手写）：**

```typescript
export function listTools() {
  return [
    { name: "getCourseDetail", ... },  // 手写第1条
    { name: "placeOrder", ... },       // 手写第2条
  ];
}
export async function callTool(name, args, userId) {
  switch (name) {
    case "getCourseDetail": return realGetCourseDetail(...);  // 手写第1个case
    case "placeOrder": return realPlaceOrder(...);            // 手写第2个case
  }
}
```

**目标（配置驱动）：**

```yaml
# connectors/tjxt.yaml
tools:
  - name: getCourseDetail
    method: GET
    path: /cs/courses/{courseId}/catalogs
    params:
      - name: courseId
        in: path
        type: number
        required: true
  - name: placeOrder
    method: POST
    path: /ts/orders/placeOrder
    params:
      - name: courseIds
        in: body
        type: array
        items: number
        required: true
```

```typescript
// gateway.ts — 从 YAML 自动生成
export function listTools() {
  return config.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: buildSchema(t.params),
  }));
}
export async function callTool(name, args, userId) {
  const tool = config.tools.find((t) => t.name === name);
  // 通用逻辑：读 method/path/params → 构建 HTTP 请求 → 发送 → 返回
  return executeTool(tool, args, userId);
}
```

**关键变化**：`listTools()` 和 `callTool()` 不再有 switch/case，而是从配置文件动态生成。**加一个工具 = 加一段 YAML，不改代码。**

#### 2.4 第3层：业务语义翻译（⚠️ 最难，也是真正的价值所在）

对应 tjxt-mcp-server 的 `real.ts` 中的鉴权、响应格式适配、多步操作等逻辑。

**这一层不可能完全通用化**——每个业务的鉴权方式、响应格式、操作语义都不同。但可以做成**"半自动"**：通用框架处理80%的标准化工作，剩余20%的业务语义用声明式配置或小段钩子代码表达。

**第3层的四个子问题：**

| 子问题       | 当前（手写）                       | 目标（配置驱动）                                      | 通用程度              |
| ------------ | ---------------------------------- | ----------------------------------------------------- | --------------------- |
| **鉴权**     | 手写 getToken()（手机号+密码→JWT） | YAML 声明 auth.type=login + body + tokenField         | ★★☆ 框架内置3种适配器 |
| **响应格式** | 手写 if(resp.code!==200)           | YAML 声明 responseFormat.codeField/msgField/dataField | ★★★ 完全可配置        |
| **敏感操作** | 插件层手写 HITLRequiredError       | YAML 声明 sensitive:true，框架自动标记                | ★★★ 完全可配置        |
| **多步组合** | real.ts 手写预下单+正式下单        | YAML 声明 preSteps，框架自动执行                      | ★☆☆ 需要钩子扩展      |

**最难的是"多步组合"**——天机学堂的 placeOrder 实际上是"预下单→正式下单"两步合一，这种业务语义无法用简单的配置表达，需要框架支持 `preSteps` 钩子。

**[确认理解]** 三层架构各解决什么问题？哪层已经通用？哪层需要自动化？哪层最难、为什么？

---

### 第三讲：为什么选"配置驱动"而不是"OpenAPI 自动生成"

#### 3.1 业界有 OpenAPI → MCP 自动生成的方案

搜索结果显示，已有成熟方案可以把 OpenAPI/Swagger 文档直接转成 MCP Server：

| 方案                 | 原理                                                |
| -------------------- | --------------------------------------------------- |
| `mcp-openapi-server` | 读取 OpenAPI JSON，自动生成 tools/list + tools/call |
| `fastmcp`（Python）  | 用装饰器声明工具，自动暴露 MCP 接口                 |
| Spring AI MCP        | 用 `@Tool` 注解自动生成 MCP 工具（hm-ai 已用）      |

**流程**：`HTTP API → OpenAPI 描述 → MCP Server 网关 → 模型调用`

#### 3.2 OpenAPI 自动生成的局限

OpenAPI 描述的是**每个 REST 端点的输入输出**，但 MCP 工具需要的是**业务语义**。两者之间有三道鸿沟：

**鸿沟1：多步操作组合**

天机学堂的下单 = 预下单（生成 orderId）+ 正式下单（带 orderId 提交）。OpenAPI 只描述了两个独立的 REST 端点，不知道它们应该被组合成一个原子操作。

```
OpenAPI 看到的：
  POST /ts/orders/preOrder → 返回 orderId
  POST /ts/orders/placeOrder → 需要 orderId

MCP 需要的：
  placeOrder 工具 → 一步完成（内部自动调 preOrder + placeOrder）
```

**鸿沟2：鉴权策略差异**

OpenAPI 只描述了"这个端点需要 Bearer Token"，不描述"怎么获取 Token"。天机学堂用手机号+密码登录，hmall 用 OAuth2，MBTI 用 API Key——这些差异 OpenAPI 无法表达。

**鸿沟3：敏感操作标记**

OpenAPI 没有概念区分"只读操作"和"敏感写操作"。但 MCP 翻译层需要知道哪些工具要配 HITL（人工审批），这是业务语义，不是 API 规范能表达的。

#### 3.3 我们的选择：配置驱动（YAML）

**配置驱动 = OpenAPI 自动生成 + 业务语义声明**：

```
OpenAPI 能做的（工具发现 + 参数映射）→ YAML 的 tools 段自动完成
OpenAPI 做不到的（鉴权/多步/HITL）→ YAML 的 auth/preSteps/sensitive 段手动声明
```

**而且，YAML 可以从 OpenAPI 自动生成**——未来可以加一个 `openapi2yaml` 工具，从 Swagger JSON 自动生成 YAML 的 tools 段，再手动补上 auth/preSteps/sensitive。这样既享受了 OpenAPI 自动化的红利，又不丢失业务语义。

**[确认理解]** OpenAPI 自动生成有什么局限？为什么配置驱动（YAML）比纯 OpenAPI 驱动更适合我们的场景？

---

### 第四讲：DeepSeek Harness 的做法与我们的异同

#### 4.1 DeepSeek Harness 的架构

根据公开资料，DeepSeek Harness（DSH）的架构核心：

| 组件                  | 职责                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| **Cordis 内核**       | Agent 运行时框架，"一切皆插件"                                           |
| **dsh-mcp-connector** | MCP 连接器市场，已上架 82 张服务卡                                       |
| **连接器**            | 每个业务方提供一个 MCP Server（连接器），DSH 通过 MCP 协议动态发现和调用 |

#### 4.2 和我们的方法对比

| 维度           | DeepSeek Harness               | 我们的方法                                     |
| -------------- | ------------------------------ | ---------------------------------------------- |
| **Agent 内核** | Cordis（"一切皆插件"）         | agent-platform（ReAct 循环 + 工具注册 + HITL） |
| **MCP 连接器** | dsh-mcp-connector 市场（82个） | mcp-gateway + connectors/*.yaml（目标3个起步） |
| **连接器形态** | 每个业务一个独立 MCP Server    | 每个业务一份 YAML 配置，共享一个通用框架       |
| **新增业务**   | 写一个新 MCP Server            | 写一份新 YAML                                  |
| **协议**       | MCP（tools/list + tools/call） | MCP（tools/list + tools/call）——完全相同       |
| **鉴权**       | 每个连接器自行处理             | 框架内置适配器（login/OAuth2/API Key）         |

**核心相同点**：都是"Agent 内核 + MCP 连接器"的架构，都通过 MCP 协议动态发现和调用工具。

**核心差异**：DSH 的每个连接器是独立的 MCP Server（各自部署），我们的目标是**一个通用框架 + N 份配置**（一个进程，通过环境变量切换业务）。我们的方案更轻量——不需要为每个业务部署一个独立的 MCP Server。

#### 4.3 我们的独特价值

```
DSH 的做法：82个连接器 = 82个独立 MCP Server = 82个进程
我们的做法：3个连接器 = 1个通用框架 + 3份 YAML = 1个进程

优势：
1. 部署简单：一个 mcp-gateway 进程，通过 SERVICE=tjxt 切换业务
2. 维护简单：框架升级一次，所有业务受益
3. 开发简单：新业务只需写 YAML，不需要写代码

劣势：
1. 单点：一个进程挂了，所有业务都不可用（生产环境需要多实例+负载均衡）
2. 隔离性差：一个业务的配置错误可能影响其他业务（需要配置校验+沙箱）
```

**[确认理解]** DSH 的做法和我们的方法有什么异同？我们的"一个框架+N份配置"比"N个独立MCP Server"有什么优势和劣势？

---

### 第五讲：架构演进路线

#### 5.1 三步演进

```
Step 1: 手写薄层（已完成）
  tjxt-mcp-server/
  ├── index.ts   (46行, MCP协议)
  ├── tools.ts   (手写注册+分发)
  ├── real.ts    (手写鉴权+路径+响应)
  └── mock.ts    (mock数据)

Step 2: 配置驱动薄层（接下来做）
  mcp-gateway/
  ├── src/
  │   ├── index.ts       (46行, 不动)
  │   ├── gateway.ts     (新增: 读YAML→生成tools)
  │   ├── auth.ts        (新增: 鉴权适配器)
  │   ├── normalizer.ts  (新增: 响应格式统一)
  │   └── mock.ts        (保留)
  ├── connectors/
  │   ├── tjxt.yaml      (天机学堂配置)
  │   └── hmall.yaml     (电商配置)
  └── package.json

Step 3: 连接器市场（未来方向）
  mcp-gateway/
  ├── src/               (同Step2)
  ├── connectors/
  │   ├── tjxt.yaml
  │   ├── hmall.yaml
  │   ├── mbti.yaml
  │   └── ...N个.yaml
  ├── openapi2yaml.ts    (新增: 从Swagger自动生成YAML)
  └── package.json
```

#### 5.2 每步的验证标准

| 步骤             | 验证标准                                                              |
| ---------------- | --------------------------------------------------------------------- |
| Step 1（已完成） | 天机学堂端到端跑通：POST /api/chat → MCP → 微服务 → 返回数据          |
| Step 2（接下来） | 同一个 mcp-gateway，SERVICE=tjxt 跑通天机学堂，SERVICE=hmall 跑通电商 |
| Step 3（未来）   | 新业务只需写 YAML + 运行 openapi2yaml，30分钟接入                     |

#### 5.3 和现有架构的关系

```
翻译层变了，什么没变？
  ✅ agent-platform 内核（agent.ts / tool.ts / bootstrap.ts / client.ts）——不动
  ✅ 业务微服务（天机学堂 / hmall）——不动
  ✅ MCP 协议（tools/list + tools/call）——不动
  ✅ 插件层（src/plugins/tjxt/ / src/plugins/queryOrder.ts）——不动

翻译层变了，什么变了？
  🔄 tjxt-mcp-server → mcp-gateway（框架升级，功能等价）
  🔄 手写代码 → YAML 配置（表达方式变化，语义不变）
```

> **一句话：翻译层是"平台和业务之间的适配器"，它怎么实现不影响平台内核和业务微服务。** 就像你换了一个同声传译耳机，说话的人和听话的人都不需要变。

**[确认理解]** 三步演进各做什么？翻译层从手写变成配置驱动后，agent-platform 内核需要改吗？为什么？

---

## Quiz（闭卷）

> **AI：** 出 5 道题考下面内容，每题先批改，不通过进入补考。

1. tjxt-mcp-server 的 tools.ts 和 real.ts 各有什么问题？为什么"3个业务=3套手写代码"不可持续？
2. 通用翻译层的三层架构是什么？哪层已经通用、哪层需要自动化、哪层最难？最难的那层为什么难？
3. 为什么选"配置驱动（YAML）"而不是"OpenAPI 自动生成"？OpenAPI 有哪三道鸿沟？
4. DeepSeek Harness 的 dsh-mcp-connector 和我们的方法有什么异同？我们的"一个框架+N份配置"有什么优势和劣势？
5. 翻译层从手写变成配置驱动后，agent-platform 内核需要改吗？为什么？哪些文件绝对不能动？

---

## 补考环节

> **AI：** 对答错的题，换一个角度（非原题）再出题，直到学习者理解。例如：
>
> - 如果第4个业务（医疗）接入时，手写方法和配置驱动方法分别要做什么？工作量差多少？
> - 如果 placeOrder 不是"两步合一"而是"一步直调"，OpenAPI 自动生成能覆盖吗？这说明什么？
> - 如果翻译层和业务微服务部署在同一进程里，会破坏什么边界？正确的做法应该是什么？
> - 三层架构中，如果把第2层（工具发现）也做成手写的，只自动化第3层，会怎样？反过来呢？

---

## 动手环节：为 hmall 业务编写 YAML 配置并验证

> **AI：** 指导学习者逐步完成，每步贴代码、每步验证。全程约 60 分钟。
> **总目标：** ① 读懂 YAML 配置 schema；② 为 hmall 编写一份完整的 connector YAML；③ 用配置验证工具跑通校验；④ 能讲清 YAML 每个字段和三层架构的对应关系。
> **核心约束：** 只写 YAML，**不改框架代码**。如果发现需要改 gateway.ts/auth.ts/normalizer.ts，说明配置设计有问题——回头检查。

---

### Step 1：读懂 YAML 配置 schema（10 分钟）

**任务：** 打开 `07-平台-MCP翻译层规范.md`，阅读 YAML 配置 schema 定义，回答以下问题。

**回答 5 个问题：**

1. `tools` 段里 `method`、`path`、`params` 分别对应三层架构的哪一层？
2. `auth` 段支持哪几种鉴权类型？天机学堂用哪种？hmall 用哪种？
3. `responseFormat` 的 `codeField`/`msgField`/`dataField` 分别干什么？
4. `sensitive: true` 标记后，框架会自动做什么？
5. `preSteps` 字段解决什么问题？为什么它最难通用化？

**✅ 验证标准：** 能不看规范文档，口头讲清 YAML 五大段（tools / auth / responseFormat / sensitive / preSteps）各自解决了三层架构的哪个子问题。

---

### Step 2：为 hmall 编写 connectors/hmall.yaml（25 分钟）⭐ 重点

**任务：** 模仿 `tjxt.yaml` 的 schema，为 hmall 电商业务编写一份 YAML 配置。

**业务背景：** hmall 是一个电商微服务，提供以下 REST API：

| 工具名           | HTTP 方法 | API 路径          | 参数                                                        | 说明             |
| ---------------- | --------- | ----------------- | ----------------------------------------------------------- | ---------------- |
| searchProduct    | GET       | /search/products  | keyword(string, query, required)                            | 搜索商品         |
| getProductDetail | GET       | /items/{id}       | id(number, path, required)                                  | 商品详情         |
| createOrder      | POST      | /orders           | itemId(number, body, required), num(number, body, required) | 下单（敏感操作） |
| queryOrder       | GET       | /orders/{orderId} | orderId(number, path, required)                             | 查询订单         |

**hmall 鉴权方式：** OAuth2（Bearer Token），通过 `POST /auth/oauth2/token` 换 token，请求体 `{ client_id, client_secret, grant_type: "client_credentials" }`，响应中 token 字段为 `access_token`。

**hmall 响应格式：** `{ status: 200, message: "success", data: {...} }`

**3.1 先写 Prompt（不写代码！）**

> **AI：** 先让学习者自己写 Prompt，指挥 AI 生成 YAML。以下为残缺 Prompt，请补全 2 个挖空要素后喂给 AI。

```
【角色】你是 MCP 翻译层配置工程师，熟悉 YAML schema 规范。
【任务】为 hmall 电商业务编写一份 connectors/hmall.yaml 配置文件。
【上下文】hmall 提供 4 个 REST API（searchProduct/getProductDetail/createOrder/queryOrder），
  鉴权用 OAuth2 client_credentials 模式，响应格式为 {status, message, data}。
  YAML schema 参考 connectors/tjxt.yaml 和 07-平台-MCP翻译层规范.md。
【约束】_____（补全：至少 2 条约束）_____
【参考】connectors/tjxt.yaml
【输出格式】_____（补全：要求的输出格式）_____
```

**3.2 对照检查 YAML 完整性**

写完 YAML 后，逐项检查：

| 检查项                     | 对应字段                                              | 你的 YAML 是否覆盖？ |
| -------------------------- | ----------------------------------------------------- | -------------------- |
| 4 个工具的方法/路径/参数   | `tools[].method` / `path` / `params`                  |                      |
| OAuth2 鉴权配置            | `auth.type` / `tokenUrl` / `body` / `tokenField`      |                      |
| 响应格式适配               | `responseFormat.codeField` / `msgField` / `dataField` |                      |
| createOrder 标记为敏感操作 | `tools[].sensitive: true`                             |                      |

**✅ 验证标准：**

- YAML 包含完整的 4 个工具定义（每个工具含 method/path/params）
- OAuth2 鉴权段完整（type=oauth2, tokenUrl, body, tokenField）
- 响应格式三个字段映射正确（status→code, message→msg, data→data）
- createOrder 标记 `sensitive: true`
- YAML 语法正确（缩进一致、无 tab 字符）

---

### Step 3：验证 YAML 配置（15 分钟）

**任务：** 用配置校验工具验证 YAML 的正确性。

**3.1 YAML 语法校验**

```bash
# PowerShell：安装 yaml 校验工具（如果没有）
npm install -g yaml-lint

# 校验 YAML 语法
yamllint connectors/hmall.yaml
```

**预期输出：** 无错误输出（或仅 warning，无 error）。

**3.2 Schema 校验（如果有 schema 校验脚本）**

```bash
# 用项目自带的 schema 校验（如果存在）
node src/validate-config.js connectors/hmall.yaml
```

**预期输出：** `✅ connectors/hmall.yaml is valid` 或类似成功提示。

**3.3 手动对照检查清单**

逐项检查 schema 中每个必填字段是否填写：

| Schema 必填字段            | 你的 YAML 值        | 状态 |
| :------------------------- | :------------------ | :--: |
| `tools[].name`             | 4 个工具名          |      |
| `tools[].method`           | GET/POST            |      |
| `tools[].path`             | 4 条 API 路径       |      |
| `tools[].params[].name`    | 每个参数有 name     |      |
| `tools[].params[].in`      | query/path/body     |      |
| `tools[].params[].type`    | string/number/array |      |
| `auth.type`                | oauth2              |      |
| `auth.tokenUrl`            | /auth/oauth2/token  |      |
| `responseFormat.codeField` | status              |      |
| `responseFormat.dataField` | data                |      |

**✅ 验证标准：** 全部 9 项必填字段检查通过，无遗漏。YAML 语法校验通过。

---

### Step 4：讲清 YAML 和三层架构的对应关系（10 分钟）

**任务：** 用自己的话讲清 YAML 配置的每一段对应三层架构的哪一层。

**回答以下问题：**

1. `tools` 段的 `method`/`path`/`params` 对应三层架构的哪一层？解决了手写代码的什么问题？
2. `auth` 段对应哪一层？为什么 OAuth2 可以配置化而"多步组合"（preSteps）不能？
3. `responseFormat` 段为什么通用程度最高（★★★）？
4. 如果 hmall 的 placeOrder 也是"预下单→正式下单"两步合一，你要在 YAML 里加什么段？
5. 换一个业务（如 MBTI 测评），hmall.yaml 里哪些字段要改？哪些完全不用动？

**✅ 验证标准：** 能口头讲清以上 5 个问题，且每个问题都能对应到三层架构的具体层级。

---

## 判断力日志

> **AI：** 引导学习者写一条判断力日志，四段式（问题→决策→取舍→防什么失败）。

**提示要点：**

1. **问题：** 为什么 MCP 翻译层要从"手写 Server"演进到"通用框架 + YAML 配置"？如果只接一个业务（天机学堂），这个演进有必要吗？什么时候开始有必要？

2. **决策：** 选择"配置驱动（YAML）"而不是"OpenAPI 自动生成"作为第 2 层的实现方式。你的决策依据是什么？OpenAPI 自动生成在什么场景下是更好的选择？

3. **取舍：**
   - "一个框架 + N 份 YAML" vs "N 个独立 MCP Server"：你选了前者。部署简单了，但隔离性差了。这个取舍在你的场景下值得吗？什么情况下你会反过来选后者？
   - 第 3 层（业务语义翻译）的"多步组合"（preSteps）选择了钩子扩展而非纯配置。这说明什么？"配置驱动"的边界在哪里？
   - 敏感操作标记（sensitive: true）放在 YAML 里而不是代码里，有什么好处和风险？

4. **防什么失败：**
   - 防"每接一个业务就手写一个 MCP Server"——3 个业务 = 3 套手写代码 = 600 行重复，维护成本爆炸。
   - 防"翻译层越写越厚，变成第二个业务层"——翻译层只做协议翻译 + 配置驱动，业务逻辑留在微服务里。
   - 防"YAML 配置写错了但没人发现"——Schema 校验 + 配置验证脚本是必须的，不能只靠肉眼检查。
   - 防"面试官问 MCP 架构时只能讲协议，讲不清为什么选配置驱动"——必须能讲清 OpenAPI 自动生成的三道鸿沟和我们的取舍。

**写日志格式：**

```
## 判断力日志：MCP 翻译层架构决策

### 问题
[描述你面临的问题：手写 MCP Server 有什么痛点？什么时候需要演进？]

### 决策
[描述你做了什么决策：为什么选配置驱动而不是 OpenAPI 自动生成？三层架构怎么拆分？]

### 取舍
[描述你的取舍：一个框架 vs N 个 Server 的取舍？配置驱动 vs 代码驱动的边界？]

### 防什么失败
[描述这个决策防止了哪些失败模式？如果做反了会怎样？]
```
