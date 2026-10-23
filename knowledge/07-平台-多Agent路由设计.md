# 07-平台 · 多Agent路由设计（v2.0）

> **一句话总结：** 07 平台 · 多Agent 路由设计（v2.0）：定义单入口 `/api/chat` → Captain 意图分析 → Worker 分发，以及 Profile/Preset 双层配置与降级策略，是多Agent 的设计真源。

> **前置文档**
>
> - `07-交付-双Agent产品设计任务书`（`07-平台治理与交付/`）—— 本文关联文档，产品需求来源。
> - `07-平台-安全防护落地-agent-platform`（`07-平台治理与交付/`）—— 单 Agent 工程落地后演进。

> **后置文档**
>
> - `07-平台-多Agent路由教学`（`07-平台治理与交付/`）—— 设计之后进入教学承接。

> **这是什么？** agent-platform 多 Agent 路由设计文档，基于 Captain/Worker 模式 + Profile/Preset 双层配置 + 事件总线架构。
> **架构真源：** `00-最终架构总览.md`
> **关联文档：** `07-交付-双Agent产品设计任务书.md`（v2.0）

---

## 0. 场景代入：为什么需要多Agent路由？

### 0.1 单Agent的局限

```
当前 agent-platform（v1.0）：
  用户请求 → POST /api/chat → 单一 AgentRuntime → 返回结果

问题：
  ❌ 只能处理一种业务（电商客服），无法同时服务 MBTI 测评和编程面试
  ❌ Agent 配置混杂在 bootstrap 中，换业务需要改代码
  ❌ 没有跨切面拦截能力（成本追踪、Trace 记录散落各处）
  ❌ 工具调用失败、HITL 审批等事件无法统一处理
```

### 0.2 v2.0 多Agent路由的目标

```
用户请求 → POST /api/chat → Captain Agent（意图分析）→ 分发到对应 Worker
                                                 ├─ MBTI Worker（测评）
                                                 └─ Interview Worker（面试）

核心能力：
  ✅ 一个入口 /api/chat，Captain 自动路由到正确 Worker
  ✅ Profile/Preset 双层配置，换业务 = 换配置，不改代码
  ✅ 事件总线统一拦截跨切面关注点（tool、hitl、agent切换）
  ✅ 降级策略：Captain 不可用时自动降级为 URL 路由
```

---

## 1. 总体架构：Captain/Worker 模式

```
用户请求 → POST /api/chat
              │
              ▼
    ┌─────────────────────┐
    │   Captain Agent     │  ← 意图分析 + 任务分发
    │   (agent-teams)     │
    │                     │
    │ "用户想做什么？"      │
    │  → MBTI测评？        │
    │  → 编程面试？        │
    │  → 闲聊/其他？       │
    └──────┬──────────────┘
           │ 事件: agent:dispatch
           │ payload: { target: "mbti" | "interview", context }
           ▼
    ┌──────────────────────────────────────────┐
    │           事件总线 (EventBus)             │
    │  ┌────────────────────────────────────┐  │
    │  │ 拦截点:                             │  │
    │  │ tool:before  → 参数校验 + 成本预估   │  │
    │  │ tool:after   → 结果校验 + Trace记录  │  │
    │  │ tool:error   → 错误记录 + 告警       │  │
    │  │ hitl:required → 审批挂起             │  │
    │  │ agent:switch  → 上下文切换 + 日志     │  │
    │  │ agent:complete → 执行统计 + 成本核算  │  │
    │  └────────────────────────────────────┘  │
    └──────┬───────────────────┬───────────────┘
           │                   │
           ▼                   ▼
    ┌──────────────┐    ┌──────────────┐
    │ MBTI Worker  │    │Interview     │
    │  Agent       │    │Worker Agent  │
    │              │    │              │
    │ Profile:     │    │ Profile:     │
    │  model:      │    │  model:      │
    │   gpt-4o-mini│    │   gpt-4o     │
    │  tools:      │    │  tools:      │
    │   mbti_judge │    │   interview_ │
    │   mbti_quest │    │   plan,      │
    │   mbti_lookup│    │   generate_q │
    │  sandbox:    │    │   run_code   │
    │   none       │    │   evaluate   │
    │              │    │   submit_rpt │
    │ Preset:      │    │  sandbox:    │
    │  agentLoop:  │    │   judge0     │
    │   ReAct      │    │              │
    │  maxSteps:15 │    │ Preset:      │
    │  hitl:false  │    │  agentLoop:  │
    │              │    │   Plan-and-  │
    │              │    │   Execute    │
    │              │    │  maxSteps:20 │
    │              │    │  hitl:true   │
    └──────┬───────┘    └──────┬───────┘
           │ MCP               │ MCP
           ▼                   ▼
    mbti-mcp-server    interview-mcp-server
```

---

## 2. Captain Agent 设计

### 2.1 职责

Captain Agent 是平台的调度员，**只做意图分析 + 任务分发，不做具体业务逻辑**。

### 2.2 System Prompt

```
你是 Agent 平台的调度员（Captain）。
你的职责是分析用户意图，决定将任务分发给哪个专业 Agent。

分类规则：
1. 用户提到"MBTI"、"性格测试"、"职业规划"、"人格类型"、"心理测评" → 分发给 MBTI Agent
2. 用户提到"面试"、"算法"、"刷题"、"系统设计"、"代码"、"编程"、"mock interview" → 分发给 Interview Agent
3. 用户打招呼、闲聊、询问功能 → 直接回复，介绍平台能力：
   "你好！我是 AgentHub 平台，目前支持两个功能：
    - 🧠 MBTI 职业规划师：帮你探索性格类型，找到适合的职业方向
    - 💻 AI 编程面试教练：模拟真实面试官，帮你准备技术面试
    你想用哪个？"
4. 无法确定意图 → 询问用户想使用哪个功能

分发时调用 dispatch_to_worker 工具，传入 target 和 context。
分发后，将 Worker 的回复直接返回给用户，不要添加自己的解读。
```

### 2.3 dispatch_to_worker 工具

```typescript
const dispatchTool = {
  name: "dispatch_to_worker",
  description: "将用户请求分发到指定的 Worker Agent",
  inputSchema: {
    type: "object",
    properties: {
      target: {
        type: "string",
        enum: ["mbti", "interview"],
        description: "目标 Worker Agent 名称",
      },
      context: {
        type: "string",
        description: "用户原始消息 + Captain 意图分析摘要",
      },
    },
    required: ["target", "context"],
  },
};
```

### 2.4 Captain 配置

```typescript
const captainProfile: AgentProfile = {
  name: "captain",
  model: "gpt-4o-mini", // 意图分析简单，用小模型
  tools: ["dispatch_to_worker"], // 唯一工具：分发
  sandbox: "none",
  memoryNamespace: "captain",
  temperature: 0.1, // 低温度保证路由一致性
};

const captainPreset: AgentPreset = {
  agentLoop: "ReAct",
  maxSteps: 3, // 最多3步：分析→分发→返回
  timeout: 30000, // 30秒超时
  hitl: false,
  systemPromptTemplate: "...", // 见上方 System Prompt
  retryOnError: false,
  maxRetries: 0,
  contextWindowLimit: 4000,
};
```

---

## 3. Profile/Preset 双层配置

### 3.1 核心理念

- **Profile** 定义"**用什么**"（模型、工具、沙箱、记忆）
- **Preset** 定义"**怎么用**"（循环模式、步数、超时、HITL）

两者分离后，可以给同一个 Agent 组合不同的 Profile 和 Preset。

### 3.2 Profile 接口

```typescript
interface AgentProfile {
  name: string; // "mbti-worker" | "interview-worker"
  model: string; // 模型名，示例值，实际以环境变量覆盖为准
  tools: string[]; // 允许的工具名列表（白名单）
  sandbox: "none" | "judge0"; // 代码沙箱类型
  memoryNamespace: string; // Memory 命名空间："mbti:{userId}" | "interview:{userId}"
  temperature?: number; // 模型温度（默认 0.7）
  maxTokens?: number; // 单次回复最大 token 数
}
```

### 3.3 Preset 接口

```typescript
interface AgentPreset {
  agentLoop: "ReAct" | "Plan-and-Execute"; // Agent 循环模式
  maxSteps: number; // 最大 ReAct 步数
  timeout: number; // 超时时间（ms）
  hitl: boolean; // 是否启用人工审批
  systemPromptTemplate: string; // 系统提示词模板（支持 {{variable}} 占位符）
  retryOnError: boolean; // 工具调用失败是否重试
  maxRetries: number; // 最大重试次数
  contextWindowLimit: number; // 上下文窗口 token 上限
}
```

### 3.4 MBTI Worker 配置示例

```typescript
const mbtiProfile: AgentProfile = {
  name: "mbti-worker",
  model: process.env.PROFILE_MBTI_MODEL ?? "gpt-4o-mini",
  tools: ["mbti_judge", "mbti_question", "mbti_lookup"],
  sandbox: "none",
  memoryNamespace: "mbti",
  temperature: 0.3,
};

const mbtiPreset: AgentPreset = {
  agentLoop: "ReAct",
  maxSteps: parseInt(process.env.PRESET_MBTI_MAXSTEPS ?? "15", 10),
  timeout: 300000,
  hitl: false,
  systemPromptTemplate: `
你是 MBTI 职业规划师。你通过提问帮助用户探索性格类型。

规则：
1. 每次只问一道题，等待用户回答后再出下一题
2. 根据用户回答调用 mbti_judge 记录维度得分
3. 4 个维度（EI/SN/TF/JP）各收集 3-5 题后调用 mbti_lookup 输出结果
4. 结果解读必须包含免责声明："MBTI 是自我认知探索工具，非医疗诊断"
5. 超过 {{maxSteps}} 轮仍未锁定，取置信度最高的维度结束测评
  `.trim(),
  retryOnError: true,
  maxRetries: 2,
  contextWindowLimit: 8000,
};
```

### 3.5 Interview Worker 配置示例

```typescript
const interviewProfile: AgentProfile = {
  name: "interview-worker",
  model: process.env.PROFILE_INTERVIEW_MODEL ?? "gpt-4o",
  tools: [
    "interview_plan",
    "generate_question",
    "run_code",
    "evaluate_answer",
    "submit_report",
  ],
  sandbox: "judge0",
  memoryNamespace: "interview",
  temperature: 0.5,
};

const interviewPreset: AgentPreset = {
  agentLoop: "Plan-and-Execute",
  maxSteps: parseInt(process.env.PRESET_INTERVIEW_MAXSTEPS ?? "20", 10),
  timeout: 600000,
  hitl: true,
  systemPromptTemplate: `
你是 AI 编程面试教练。你模拟真实面试官，帮助用户准备技术面试。

规则：
1. 先了解用户背景（技术栈、经验、目标公司），调用 interview_plan 生成方案
2. 按方案轮次出题：算法 → 系统设计 → 行为面
3. 算法题：调用 generate_question 出题 → 等用户代码 → 调用 run_code 运行 → 调用 evaluate_answer 评分
4. 系统设计题：出题 → 等用户方案 → RAG 检索最佳实践 → 追问高并发/一致性
5. 行为面：出 STAR 题 → 等回答 → 追问细节
6. 不直接给答案，引导思考。追问边界 case 和优化方向
7. 全部完成后调用 submit_report 生成报告（需人工审批）
8. 超过 {{maxSteps}} 轮仍未完成，总结当前进度并结束
  `.trim(),
  retryOnError: true,
  maxRetries: 3,
  contextWindowLimit: 16000,
};
```

> **注意：** 以上 `model` 字段中的 `gpt-4o-mini`、`gpt-4o` 等为示例模型名，实际以环境变量（`PROFILE_MBTI_MODEL`、`PROFILE_INTERVIEW_MODEL`）为准。agent-platform 当前使用的模型为智谱 GLM-4.7-Flash。

---

## 4. 事件总线设计

### 4.1 事件类型

```typescript
type AgentEvent =
  | {
      type: "agent:dispatch";
      payload: { target: string; context: string; sessionId: string };
    }
  | {
      type: "agent:switch";
      payload: { from: string; to: string; sessionId: string };
    }
  | {
      type: "tool:before";
      payload: { toolName: string; params: unknown; agentName: string };
    }
  | {
      type: "tool:after";
      payload: {
        toolName: string;
        result: unknown;
        duration: number;
        agentName: string;
      };
    }
  | {
      type: "tool:error";
      payload: { toolName: string; error: string; agentName: string };
    }
  | {
      type: "hitl:required";
      payload: { opId: string; toolName: string; agentName: string };
    }
  | {
      type: "agent:complete";
      payload: { agentName: string; steps: number; duration: number };
    };
```

### 4.2 事件拦截器注册

```typescript
// 在 bootstrap.ts 中注册全局拦截器
eventBus.on("tool:before", (event) => {
  trace.record(event); // 记录到 Trace
  cost.estimate(event); // 预估成本
});

eventBus.on("tool:after", (event) => {
  trace.record(event); // 记录结果
  cost.record(event); // 实际成本
});

eventBus.on("tool:error", (event) => {
  trace.record(event); // 记录错误
  logger.error(event); // 错误日志
});

eventBus.on("hitl:required", (event) => {
  approval.register(event.payload.opId); // 注册审批
});

eventBus.on("agent:switch", (event) => {
  logger.info(`Agent switch: ${event.payload.from} → ${event.payload.to}`);
});

eventBus.on("agent:complete", (event) => {
  trace.record(event); // 记录 Agent 执行统计
  cost.finalize(event); // 最终成本核算
});
```

### 4.3 EventBus 接口

```typescript
interface EventBus {
  on(type: string, handler: (event: AgentEvent) => void | Promise<void>): void;
  emit(event: AgentEvent): Promise<void>;
  off(type: string, handler: (event: AgentEvent) => void | Promise<void>): void;
}
```

**设计要点：**

- 异步处理不阻塞主流程
- 事件处理器异常隔离（一个 handler 抛错不影响其他）
- 支持动态注册/注销

---

## 5. DAG 调度流程

### 5.1 核心流程

```
1. 用户发送消息 → POST /api/chat
2. Captain Agent 接收消息，运行 ReAct（最多 3 步）
   - Step 1: 分析意图
   - Step 2: 调用 dispatch_to_worker(target, context)
   - Step 3: 返回 Worker 结果给用户
3. dispatch_to_worker 触发 agent:dispatch 事件
4. 事件总线根据 target 加载对应 Profile + Preset
5. 创建 Worker Agent 实例（独立的 AgentRuntime + Memory + Sandbox）
6. Worker Agent 运行自己的 Agent Loop（ReAct 或 Plan-and-Execute）
7. Worker 完成后，触发 agent:complete 事件
8. Captain 将 Worker 的最终回复返回给用户
```

### 5.2 DAG 依赖

```
Captain(意图分析) → Worker(业务执行) → Captain(结果汇总)
```

### 5.3 扩展性：并行分发

未来可支持 Captain → [Worker1, Worker2]（并行分发）：

```
例如："帮我分析我的 MBTI 性格，然后推荐适合的面试题"
  → Captain 并行分发到 MBTI Worker + Interview Worker
  → 两个 Worker 完成后，Captain 汇总结果
```

---

## 6. bootstrap.ts 改造

### 6.1 当前（v1.0 单 Agent）

```typescript
const agent = createAgent(config);
app.post("/api/chat", async (req, res) => {
  const answer = await agent.run(req.body.message);
  res.json({ answer });
});
```

### 6.2 v2.0（Captain/Worker 多 Agent）

```typescript
import { EventBus } from "./event-bus.js";
import { AgentTeams } from "./agent-teams.js";
import { loadProfile, loadPreset } from "./profile.js";

const eventBus = new EventBus();

// 注册全局事件拦截器
eventBus.on("tool:before", (event) => {
  /* Trace + 成本预估 */
});
eventBus.on("tool:after", (event) => {
  /* 结果校验 + 成本记录 */
});
eventBus.on("tool:error", (event) => {
  /* 错误记录 */
});
eventBus.on("hitl:required", (event) => {
  /* 审批注册 */
});
eventBus.on("agent:switch", (event) => {
  /* 日志 */
});
eventBus.on("agent:complete", (event) => {
  /* 统计 */
});

// 加载 Profile/Preset
const mbtiProfile = loadProfile("mbti");
const mbtiPreset = loadPreset("mbti");
const interviewProfile = loadProfile("interview");
const interviewPreset = loadPreset("interview");

// 创建 Captain + Workers
const captainProfile = loadProfile("captain");
const captainPreset = loadPreset("captain");

const teams = new AgentTeams({
  captain: { profile: captainProfile, preset: captainPreset },
  workers: {
    mbti: { profile: mbtiProfile, preset: mbtiPreset },
    interview: { profile: interviewProfile, preset: interviewPreset },
  },
  eventBus,
  dispatchStrategy: "intent", // 意图分发
  fallback: "url", // 降级：URL 路由
});

// 统一入口
app.post("/api/chat", teams.handleRequest);
// 降级入口
app.post("/api/chat/mbti", teams.handleDirect("mbti"));
app.post("/api/chat/interview", teams.handleDirect("interview"));
```

---

## 7. 降级策略

### 7.1 触发条件

当 Captain 意图分析失败或不可用时（如 LLM 超时、返回格式异常），自动降级为 URL 路由。

### 7.2 降级路径

- `/api/chat/mbti` → 直接创建 MBTI Worker，跳过 Captain
- `/api/chat/interview` → 直接创建 Interview Worker，跳过 Captain

### 7.3 降级标记

降级时在响应中标记 `"routing": "fallback"`，方便监控和排查：

```typescript
interface TeamResponse {
  answer: string;
  routing: "intent" | "fallback"; // 路由方式
  agent: string; // 执行的 Agent 名称
  traceId?: string;
}
```

### 7.4 降级逻辑

```typescript
async handleRequest(req, res): Promise<void> {
  try {
    // 尝试 Captain 意图分发
    const result = await this.captain.dispatch(req.body.message);
    if (result.target) {
      // 成功分发
      return this.routeToWorker(result.target, req.body.message);
    }
  } catch (e) {
    // Captain 失败 → 降级
    logger.warn("Captain 不可用，降级为 URL 路由", e);
  }

  // 降级：返回提示用户使用具体入口
  return {
    answer: "系统繁忙，请直接使用 /api/chat/mbti 或 /api/chat/interview",
    routing: "fallback",
  };
}
```

---

## 8. 关键注意事项

1. **模型名不要硬编码。** Profile 中的 `model` 字段均通过环境变量可覆盖（如 `PROFILE_MBTI_MODEL`、`PROFILE_INTERVIEW_MODEL`）。agent-platform 当前实际使用智谱 GLM-4.7-Flash（`LLM_MODEL=glm-4.7-flash`）。

2. **平台内核零改动。** agent.ts、tool.ts、mcp/client.ts、memory.ts、approval.ts、trace.ts、cost.ts 一律不改，新增能力全部通过新增文件 + bootstrap 装配实现。

3. **Worker 上下文隔离。** 每个 Worker 拥有独立的 AgentRuntime 实例，通过 `memoryNamespace` 隔离 Memory，避免上下文泄露。

4. **Profile 白名单生效。** MBTI Worker 的 `tools` 白名单只包含 mbti_* 工具，无法调用 interview 工具；反之亦然。

5. **事件总线异步。** 事件处理器不阻塞 Agent 主流程，异常隔离不影响业务。

6. **降级不打折。** 降级为 URL 路由时，Worker 的完整 Agent Loop 仍然正常运行，只是跳过了 Captain 的意图分析步骤。
