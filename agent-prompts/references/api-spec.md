# API 接口 + SSE 协议完整规格

## 一、API 路由清单

| 路由 | 方法 | 用途 | 认证 |
|---|---|---|---|
| /api/student/profile | GET/PUT | 学生画像 | 是 |
| /api/student/mastery | GET | 掌握度 | 是 |
| /api/student/learning-path | GET | 学习路径 | 是 |
| /api/student/errors | GET | 错题 | 是 |
| /api/student/prompts | GET | Prompt 历史 | 是 |
| /api/student/projects | GET | 项目 | 是 |
| /api/session | POST | 创建会话 | 是 |
| /api/session/[id] | GET/DELETE | 会话详情 | 是 |
| /api/session/[id]/message | POST | 发送消息（SSE） | 是 |
| /api/session/[id]/abort | POST | 中断流式 | 是 |
| /api/agent/explain | POST | 讲解 Agent | 是 |
| /api/agent/validate | POST | 点评 Agent | 是 |
| /api/agent/generate-question | POST | 出题 Agent | 是 |
| /api/agent/answer | POST | 答疑 Agent | 是 |
| /api/visualization/[sceneId] | GET | 获取可视化场景 | 否 |
| /api/project/template/[id] | GET | 项目模板 | 否 |
| /api/report | GET | 学习报告 | 是 |
| /api/wiki/query | POST | 查询 LLM Wiki | 内部 |

## 二、核心接口详细设计

### 1. POST /api/session — 创建会话

**Request:**

```typescript
{
  studentId: string;
  moduleId: string;
}
```

**Response:**

```typescript
{
  sessionId: string;
  currentStep: "explain";
  moduleInfo: {
    id: string;
    name: string;
    difficulty: number;
    estimatedTime: number;
  };
}
```

**错误:**

- 404：学生不存在

- 400：模块 ID 无效

- 403：前置模块未掌握

### 2. POST /api/session/[id]/message — 发送消息（SSE）

**Request:**

```typescript
{
  content: string;
  taskType?: "prompt" | "tool" | "code";
  code?: string;
  language?: "typescript" | "python";
}
```

**Response: SSE 流**

事件序列示例：

```
event: token
data: {"type":"token","data":{"content":"你","messageId":"msg_1"}}
event: thinking
data: {"type":"thinking","data":{"step":"分析学生答案","content":"...","agent":"reviewer"}}
event: tool_call
data: {"type":"tool_call","data":{"toolName":"readFile","params":{"path":"..."},"callId":"call_1"}}
event: tool_result
data: {"type":"tool_result","data":{"callId":"call_1","result":{...},"duration":120}}
event: citation
data: {"type":"citation","data":{"source":"concepts/llm-api.md","snippet":"...","relevance":0.85}}
event: ui
data: {"type":"ui","data":{"component":"ScoreCard","props":{"score":85,"level":"良好"}}}
event: validation
data: {"type":"validation","data":{"totalScore":85,"level":"良好","isCorrect":true,...}}
event: visualization
data: {"type":"visualization","data":{"sceneId":"scene-request-response","params":{}}}
event: error
data: {"type":"error","data":{"code":"RATE_LIMIT","message":"请求过于频繁","recoverable":true}}
event: done
data: {"type":"done","data":{"messageId":"msg_1","tokens":{"input":1200,"output":400}}}
```

### 3. POST /api/agent/validate — 点评 Agent

**Request:**

```typescript
{
  studentId: string;
  sessionId: string;
  taskType: "prompt" | "tool" | "code";
  content: string;
  moduleId: string;
}
```

**Response:**

```typescript
{
  totalScore: number;
  level: "优秀" | "良好" | "及格" | "不及格";
  isCorrect: boolean;
  dimensions: Array<{
    name: string;
    score: number;
    weight: number;
    comment: string;
  }>;
  issues: Array<{
    type: "严重错误" | "优化建议";
    detail: string;
    deduction: number;
    relatedDimension: string;
    relatedAntiPattern: string | null;
  }>;
  suggestions: Array<{
    priority: "高" | "中" | "低";
    action: string;
    example: string;
  }>;
  nextAction: "retry" | "pass" | "lower_difficulty";
}
```

### 4. POST /api/agent/explain — 讲解 Agent

**Request:**

```typescript
{
  studentId: string;
  sessionId: string;
  moduleId: string;
  mode: "normal" | "remedial";
}
```

**Response:**

```typescript
{
  type: "explain" | "question" | "visualize" | "review";
  content: string;
  conceptId: string;
  visualizeScene: string | null;
  checkQuestion: {
    question: string;
    expectedKeywords: string[];
    hintLevels: string[];
  } | null;
  nextAction: "continue" | "practice" | "review_prerequisite";
}
```

### 5. POST /api/agent/generate-question — 出题 Agent

**Request:**

```typescript
{
  studentId: string;
  moduleId: string;
  count: number;
  difficulty?: number;
}
```

**Response:**

```typescript
{
  questions: Array<{
    id: string;
    type: "选择题" | "填空题" | "简答题" | "实战题";
    conceptId: string;
    difficulty: number;
    scenario: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    hintLevels: string[];
    relatedAntiPattern: string | null;
  }>;
  totalCount: number;
  estimatedTime: string;
}
```

### 6. POST /api/agent/answer — 答疑 Agent

**Request:**

```typescript
{
  studentId: string;
  sessionId: string;
  question: string;
  currentModule: string;
}
```

**Response:**

```typescript
{
  type: "answer" | "counter_question" | "hint" | "redirect";
  content: string;
  relatedConcepts: string[];
  hintLevel: "L1" | "L2" | "L3" | null;
  shouldLog: boolean;
  logCategory: "高频问题" | "概念困惑" | "环境问题" | "跑偏";
}
```

### 7. POST /api/wiki/query — 查询 LLM Wiki

**Request:**

```typescript
{
  query: string;
  options?: {
    related?: string;
    topK?: number;
  };
}
```

**Response:**

```typescript
{
  page: string;
  content: string;
  relatedPages: string[];
}
```

### 8. GET /api/report — 学习报告

**Request:**

```
GET /api/report?studentId=s001&range=30d
```

**Response:**

```typescript
{
  overview: {
    completedModules: number;
    averageMastery: number;
    totalQuestions: number;
    averagePromptScore: number;
  };
  subAbilities: {
    intentExpression: number;
    taskDecomposition: number;
    contextManagement: number;
    qualityJudgment: number;
    iterativeOptimization: number;
    understandingAI: number;
  };
  masteryTrend: Array<{
    date: string;
    score: number;
  }>;
  weaknesses: Array<{
    concept: string;
    issue: string;
  }>;
  recommendations: string[];
}
```

### 9. GET /api/visualization/[sceneId] — 获取可视化场景

**Response:**

```typescript
{
  sceneId: string;
  name: string;
  steps: Array<{
    id: number;
    type: "thinking" | "tool_call" | "observation" | "answer" | "retrieve" | "generate";
    content: string;
    duration: number;
    animation: string;
    metadata?: object;
  }>;
  interactive: {
    editableParams: string[];
    comparisons: Array<{
      label: string;
      before: object;
      after: object;
    }>;
  };
}
```

## 三、SSE 事件协议完整定义

```typescript
type SSEEvent =
  | TokenEvent
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | CitationEvent
  | UIEvent
  | ValidationEvent
  | VisualizationEvent
  | ErrorEvent
  | DoneEvent;
interface TokenEvent {
  type: "token";
  data: {
    content: string;
    messageId: string;
  };
}
interface ThinkingEvent {
  type: "thinking";
  data: {
    step: string;
    content: string;
    agent: string;
  };
}
interface ToolCallEvent {
  type: "tool_call";
  data: {
    toolName: string;
    params: object;
    callId: string;
  };
}
interface ToolResultEvent {
  type: "tool_result";
  data: {
    callId: string;
    result: object;
    duration: number;
  };
}
interface CitationEvent {
  type: "citation";
  data: {
    source: string;
    page?: number;
    snippet: string;
    relevance: number;
  };
}
interface UIEvent {
  type: "ui";
  data: {
    component: string;
    props: object;
  };
}
interface ValidationEvent {
  type: "validation";
  data: ValidationResult;
}
interface VisualizationEvent {
  type: "visualization";
  data: {
    sceneId: string;
    params: object;
  };
}
interface ErrorEvent {
  type: "error";
  data: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}
interface DoneEvent {
  type: "done";
  data: {
    messageId: string;
    tokens: { input: number; output: number };
  };
}
```

## 四、前端 SSE 客户端

```typescript
// src/lib/sse.ts
export async function handleSSE(
  url: string,
  body: object,
  onEvent: (e: SSEEvent) => void,
  signal?: AbortSignal
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    throw new Error(`SSE failed: ${response.status}`);
  }
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent;
          onEvent(event);
        } catch (e) {
          console.error("Failed to parse SSE event", e);
        }
      }
    }
  }
}
```

## 五、后端 SSE 服务端工具

```typescript
// src/lib/sse-server.ts
export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    }
  });
  function send(event: SSEEvent) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    controller.enqueue(encoder.encode(data));
  }
  function close() {
    controller.close();
  }
  return { stream, send, close };
}
// 使用示例
export async function POST(req: Request) {
  const { stream, send, close } = createSSEStream();
  (async () => {
    try {
      send({ type: "thinking", data: { step: "分析", content: "...", agent: "reviewer" } });
      for await (const token of callLLMStream(...)) {
        send({ type: "token", data: { content: token, messageId: "msg_1" } });
      }
      send({ type: "done", data: { messageId: "msg_1", tokens: { input: 1200, output: 400 } } });
    } catch (error) {
      send({ type: "error", data: { code: "INTERNAL", message: String(error), recoverable: false } });
    } finally {
      close();
    }
  })();
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
```

## 六、错误码

| 错误码 | HTTP | 说明 | 可恢复 |
|---|---|---|---|
| INVALID_INPUT | 400 | 输入格式错误 | 否 |
| UNAUTHORIZED | 401 | 未登录 | 否 |
| FORBIDDEN | 403 | 无权限（前置未掌握） | 否 |
| NOT_FOUND | 404 | 资源不存在 | 否 |
| RATE_LIMIT | 429 | 请求过于频繁 | 是 |
| LLM_ERROR | 500 | LLM 调用失败 | 是 |
| DB_ERROR | 500 | 数据库错误 | 是 |
| TIMEOUT | 504 | 超时 | 是 |

## 七、请求限流与成本控制

```typescript
// 每个学生的限流配置
const rateLimit = {
  maxRequestsPerMinute: 30,
  maxTokensPerDay: 200000,
  maxSessionsPerDay: 10
};
// Token 预算控制
const tokenBudget = {
  perRequest: 8000,
  perSession: 50000,
  perDay: 200000,
  warningThreshold: 0.8  // 80% 时告警
};
```

## 八、API 输入输出 Zod 校验

```typescript
// src/schemas/api.ts
import { z } from "zod";
export const CreateSessionSchema = z.object({
  studentId: z.string().uuid(),
  moduleId: z.string().min(1)
});
export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  taskType: z.enum(["prompt", "tool", "code"]).optional(),
  code: z.string().max(10000).optional(),
  language: z.enum(["typescript", "python"]).optional()
});
export const ValidateSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  taskType: z.enum(["prompt", "tool", "code"]),
  content: z.string().min(1).max(10000),
  moduleId: z.string().min(1)
});
export const ExplainSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  moduleId: z.string().min(1),
  mode: z.enum(["normal", "remedial"]).default("normal")
});
export const GenerateQuestionSchema = z.object({
  studentId: z.string().uuid(),
  moduleId: z.string().min(1),
  count: z.number().min(1).max(10).default(3),
  difficulty: z.number().min(1).max(5).optional()
});
export const AnswerSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  question: z.string().min(1).max(2000),
  currentModule: z.string().min(1)
});
export const WikiQuerySchema = z.object({
  query: z.string().min(1).max(500),
  options: z.object({
    related: z.string().optional(),
    topK: z.number().min(1).max(20).default(3)
  }).optional()
});
```

## 九、API 调用示例

### 前端调用 SSE

```typescript
// 发送消息
const abortController = new AbortController();
await handleSSE(
  `/api/session/${sessionId}/message`,
  {
    content: studentInput,
    taskType: "prompt"
  },
  (event) => {
    switch (event.type) {
      case "token":
        appendToken(event.data.content);
        break;
      case "thinking":
        addAgentEvent(event.data);
        break;
      case "validation":
        showValidation(event.data);
        break;
      case "visualization":
        loadScene(event.data.sceneId);
        break;
      case "done":
        finalizeMessage(event.data);
        break;
    }
  },
  abortController.signal
);
// 中断
function abort() {
  abortController.abort();
  fetch(`/api/session/${sessionId}/abort`, { method: "POST" });
}
```

### 后端处理消息

```typescript
// src/app/api/session/[id]/message/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const validated = SendMessageSchema.parse(body);
  const sessionId = params.id;
  const { stream, send, close } = createSSEStream();
  (async () => {
    try {
      const message = await messageDb.create({
        sessionId,
        role: "student",
        content: validated.content,
        code: validated.code,
        language: validated.language,
        citations: [],
        metadata: {}
      });
      if (validated.taskType === "prompt") {
        await handlePromptValidation(sessionId, message, send);
      } else {
        await handleChat(sessionId, message, send);
      }
      close();
    } catch (error) {
      send({ type: "error", data: { code: "INTERNAL", message: String(error), recoverable: false } });
      close();
    }
  })();
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
```

## 十、环境变量

```bash
# .env.example
# 模型平台：火山方舟 Ark（OpenAI 兼容端点 /api/v3）
ARK_API_KEY=your-ark-api-key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_TEXT_MODEL=deepseek-v4-flash-ga-260731
ARK_VISION_MODEL=doubao-seed-2-1-pro-260915
# CloudBase
CLOUDBASE_ENV_ID=your-env-id
CLOUDBASE_SECRET_ID=your-secret-id
CLOUDBASE_SECRET_KEY=your-secret-key
# 数据库：开发期 SQLite；Phase 7 部署时改 CloudBase PostgreSQL + pgvector
DATABASE_URL=file:./dev.db
# LLM Wiki
PI_LLM_WIKI_PATH=./llm-wiki
# 应用
NEXT_PUBLIC_APP_URL=https://your-app.com
NODE_ENV=development
```

## 十一、部署检查清单

- [ ] 所有 API 密钥走环境变量

- [ ] `.env` 在 `.gitignore` 中

- [ ] `.env.example` 提供模板

- [ ] SSE 超时设置合理（建议 60s）

- [ ] 限流配置生效

- [ ] Token 预算控制生效

- [ ] 错误码统一

- [ ] Trace 记录写入 CloudBase

- [ ] 健康检查接口 `/api/health`

- [ ] 日志脱敏（不含密钥、用户隐私）