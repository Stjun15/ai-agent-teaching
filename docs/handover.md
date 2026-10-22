# 项目接手文档

> **最后更新**：2026-10-22
>
> **铁律**：本文档的每一个断言都可以在仓库源码中找到对应证据。接手项目时，**不要仅凭文档判断现状**——文档可能是过期的。用以下命令核实：
> ```bash
> git log --oneline -20          # 最近改动
> pnpm typecheck 2>&1 | tail -5  # 当前类型错误数
> pnpm test                       # 当前测试通过率
> ls src/lib/agent/tools/         # 当前注册的工具
> ```

---

## 一、一句话定位

「AI Native 编程教学助手」—— 用 AI Agent 教学生理解 AI Agent 的教学平台。12 个教学模块，七步掌握式学习法（讲解 → 观察 → 模仿 → 校验 → 可视化 → 练习 → 掌握）。

**源码锚点**：`src/lib/modules.ts` 从 `llm-wiki/concepts/*.md` 的 frontmatter 实时读取模块列表，拓扑排序自动计算教学顺序。没有硬编码的模块表。

---

## 二、仓库速览

```
d:\ai-agent-teaching/
├── src/
│   ├── app/                    # Next.js 16 App Router（页面 + 29 个 API 路由）
│   │   ├── api/chat/route.ts   # ⭐ 主 SSE 教学流入口
│   │   ├── api/agent/          # 5 个 Agent 端点（讲解/回答/出题/校验/批改）
│   │   ├── api/auth/           # 3 个认证端点（登录/注册/改密）
│   │   ├── api/session/        # 会话 CRUD + abort
│   │   ├── api/student/        # 6 个学生数据端点
│   │   └── learn/[moduleId]/[step]/page.tsx  # ⭐ 七步教学核心页面
│   ├── lib/
│   │   ├── agent/              # ⭐ Agent 内核（SDK 封装）
│   │   │   ├── loop.ts         # Agent 循环主入口 runAgentLoop()
│   │   │   ├── session.ts      # 会话创建 + 工具白名单类型
│   │   │   ├── ark.ts          # 火山方舟 SDK Provider 注册
│   │   │   ├── ark-config.ts   # 模型/密钥配置（不 import SDK，极轻量）
│   │   │   ├── rag-hybrid.ts   # 双路 RRF 混合检索（关键词+向量）
│   │   │   ├── vision-review.ts # 多模态视觉评审管线
│   │   │   ├── thinking-filter.ts # 思维链内部词过滤
│   │   │   ├── citations.ts    # 引用检索
│   │   │   ├── outputs.ts      # 结构化输出（JSON 提取→Zod 校验→回喂重试→兜底）
│   │   │   ├── prompts/        # 7 个 Agent 身份层提示词
│   │   │   ├── skills/         # 22 个教学 Skill（按模块划分）
│   │   │   ├── tools/          # 3 个工具（calculator / query-wiki / mcp-discover）
│   │   │   ├── orchestrator/   # 4 个编排循环（assess/question/teaching/validation）
│   │   │   └── student/        # 学生 Agent 模拟器（独立进程）
│   │   ├── db/                 # SQLite 数据层（19 个模块，4 个迁移文件）
│   │   ├── security/           # 输入过滤 / 输出打码 / 限流
│   │   ├── mcp/                # MCP 协议集成（wiki-server.ts）
│   │   ├── wiki/               # 自研轻量 Wiki 引擎（ingest/query/maintain）
│   │   ├── stores/             # 8 个 Zustand store（领域切片）
│   │   ├── scenes/             # 9 个可视化场景（React 组件）
│   │   ├── schemas/            # Zod schema（SSE 协议 / API 校验 / 错误码）
│   │   └── hooks/              # 6 个自定义 Hook
│   └── components/             # UI 组件（chat/code/learn/layout/report/settings/ui）
├── scripts/                    # 60+ 测试 spec + 运维脚本
│   ├── run-tests.mjs           # 自研测试编排器（55 组并行→TAP 解析→汇总）
│   ├── ts-loader.mjs           # Node 直接跑 TS 源码的钩子
│   └── *-spec.ts               # 按模块划分的测试文件
├── docs/
│   ├── handover.md             # ← 本文件
│   ├── competition/            # 大赛技术文档
│   ├── architecture.md         # 系统架构
│   ├── deployment.md           # 部署文档
│   └── ai-technical.md         # AI 技术说明
├── vitest.config.ts            # Vitest 配置（2026-10-22 新增）
├── package.json
├── tsconfig.json
└── next.config.mjs
```

**源码统计**：`src/` 下有 265 个 `.ts`/`.tsx` 文件。`scripts/` 下有 80+ 个脚本/测试文件。

---

## 三、技术栈（代码锚点版）

| 层 | 选型 | 源码证据 |
|----|------|----------|
| 框架 | Next.js 16 App Router + Turbopack | `next.config.mjs:L1` |
| 语言 | TypeScript 6，`tsc --noEmit` 门禁 | `tsconfig.json:L2`，`package.json:L18` |
| 样式 | Tailwind CSS 4 + shadcn/ui (Radix) | `package.json:L92-L93` |
| 动画 | Motion (原 Framer Motion) | `package.json:L85` |
| Agent SDK | `@earendil-works/pi-coding-agent ^0.85.1` | `package.json:L74` |
| 文本模型 | 火山方舟 → DeepSeek V4 Flash | `src/lib/agent/ark-config.ts:L34` |
| 视觉模型 | 火山方舟 → 豆包视觉 2.1-pro | `src/lib/agent/ark-config.ts:L37` |
| 数据库 | `node:sqlite`（开发），PostgreSQL 预留 | `src/lib/db/sqlite.ts` |
| 状态管理 | Zustand 5（8 个 store） | `src/stores/index.ts` |
| 校验 | Zod 4 + TypeBox 1.3.7 | `package.json:L90-L91` |
| 测试框架 | `node:test`（运行中）+ Vitest 5（刚装） | `vitest.config.ts`，`scripts/run-tests.mjs` |
| MCP 协议 | `@modelcontextprotocol/sdk ^1.32.1` | `package.json:L75` |

---

## 四、运行环境

### 4.1 必需条件

- **Node.js ≥ 22.5.0**（`package.json:L6`）
- **pnpm**（lockfile 是 pnpm 格式，`pnpm-lock.yaml`）
- **火山方舟 API Key**（`ARK_API_KEY` 环境变量）

### 4.2 启动步骤

```bash
cp .env.example .env.local
# 编辑 .env.local → 填写 ARK_API_KEY

pnpm install
pnpm db:migrate
pnpm db:seed:auth
pnpm wiki:seed
pnpm dev          # → http://localhost:3000
```

### 4.3 质量门禁

```bash
pnpm typecheck    # tsc --noEmit（当前有 57 个类型错误，见 §12 已知问题）
pnpm lint         # ESLint
pnpm check        # eslint + prettier --check + tsc --noEmit（提交前必跑）
pnpm test         # 55 组测试（scripts/run-tests.mjs 编排）
```

---

## 五、页面路由与 API 端点

### 5.1 前端页面

| 路由 | 状态 | 说明 |
|------|------|------|
| `/` | ✅ | 首页 |
| `/auth` | ✅ | 登录/注册 |
| `/auth/change-password` | ✅ | 修改密码 |
| `/learn` | ✅ | 学习中心（模块列表） |
| `/learn/[moduleId]` | ✅ | 模块详情 |
| `/learn/[moduleId]/[step]` | ✅ | 七步教学核心页 |
| `/learn/welcome` | ✅ | 欢迎引导 |
| `/settings` | ✅ | 设置页 |
| `/report` | 🔧 | 学习报告（路由存在，内容待完善） |
| `/playground` | 🔧 | 沙箱实验室（路由存在，内容待完善） |

### 5.2 API 路由（29 个端点）

**教学 Agent**（源码 `src/app/api/`）：
- `POST /api/chat` — **主入口**，SSE 流式教学对话。代码在 `src/app/api/chat/route.ts`
- `POST /api/agent/explain` — 讲稿生成
- `POST /api/agent/answer` — 学生回答评估
- `POST /api/agent/answer-grade` — 答题自动批改
- `POST /api/agent/generate-question` — 变式出题
- `POST /api/agent/validate` — 代码校验

**认证与会话**：
- `POST /api/auth/login` / `register` / `change-password`
- `GET/POST /api/session` / `GET /api/session/[id]`
- `POST /api/session/[id]/abort` — 中止流式输出
- `POST /api/session/[id]/message` — 消息落库

**学生数据**（6 个端点）：profile / mastery / learning-path / errors / prompts / projects

**其他**：`/api/wiki/query`、`/api/wiki/ingest`、`/api/visualization/[sceneId]`、`/api/report`、`/api/health`

---

## 六、Agent 内核（`src/lib/agent/`）

### 6.1 核心循环 —— `loop.ts`

`runAgentLoop()` 是 Agent 的唯一入口。关键参数：

```typescript
// 源码：src/lib/agent/session.ts:L59-L66
interface CreateSessionOptions {
  systemPrompt: string;           // 身份层 + 技能层拼好的提示词
  tools?: readonly string[];      // 工具白名单（空数组 = 不开任何工具）
  customTools?: readonly AgentCustomTool[]; // 自定义工具实现
}
```

**工具白名单是三层收紧**（`session.ts:L44-L55` 的注释详述了为什么）：
1. `tools` 参数是总白名单
2. `customTools` 的实施必须同步列入 `tools`
3. `noBuiltin: true` 关闭 SDK 内置工具

空数组 = "一个工具都不要"（教学场景的默认行为）。

### 6.2 模型平台

**唯一平台：火山方舟（Volcengine Ark）**。双模型配置：

| 角色 | 模型 ID | 配置文件 |
|------|---------|----------|
| 文本推理 | `deepseek-v4-flash-ga-260731` | `src/lib/agent/ark-config.ts:L34` |
| 视觉理解 | `doubao-seed-2-1-pro-260915` | `src/lib/agent/ark-config.ts:L37` |
| 端点 | `https://ark.cn-beijing.volces.com/api/v3` | `src/lib/agent/ark-config.ts:L31` |

**密钥只读不存**：配置层 `ark-config.ts` 只读环境变量、不 import SDK；SDK 注册层 `ark.ts` 负责 provider 注册。这样健康检查路由不必拖进整个 SDK（266 个文件）。

### 6.3 工具系统

当前注册了 3 个工具：

| 工具名 | 文件 | 接入方式 |
|--------|------|----------|
| `calculate` | `tools/calculator.ts` | 内置 `defineTool` |
| `query_wiki` | `tools/query-wiki.ts` | 内置 `defineTool`，2-gram 关键词检索 |
| `search_wiki` | `mcp/wiki-server.ts` | MCP 协议，StdioServerTransport |

MCP 工具通过 `tools/mcp-discover.ts` 自动发现并转为 `AgentCustomTool` 格式，在 `route.ts:L228-L240` 通过 `dynamic import` 注入 loopOptions。失败时静默回退为不注入（不影响对话）。

### 6.4 结构化输出

`outputs.ts` 实现了三重保障（代码有详细注释）：
1. JSON 提取（正则从模型输出中提取 JSON）
2. Zod 校验
3. 回喂重试（校验失败时把错误回传给模型让它修正）
4. 兜底标记（重试仍失败则标记为结构化输出失败）

### 6.5 多模态视觉评审

`vision-review.ts` 独立于 `loop.ts`，直接 HTTP fetch 调方舟视觉模型。原因是 pi SDK 的 `session.prompt()` 只接受纯文本。两条管线的 SSE 流结构完全一致——前端不需要区分。

### 6.6 混合检索（RAG）

`rag-hybrid.ts` 双路 RRF 融合检索：
- **关键词路**：2-gram 分词，毫秒级，零依赖
- **向量路**：embedding API 调用，补语义改述的召回缺口
- **降级纪律**：向量路任何失败 → 整体回退纯关键词路，打 `usedFallback` 标记

### 6.7 身份层 —— Agent 提示词

7 个 Agent 身份（`prompts/`）：assistant / examiner / reviewer / student / teacher / teaching-chat + index

### 6.8 教学 Skill

22 个 Skill（`skills/`）：按模块划分，每个模块一个 `validate-<模块名>.ts`，外加通用的 answer-question / explain-concept / generate-question / module-rubric / trigger-visualization。

Skill 机制的作用：在回答学生问题时，先判定问题属于哪个模块，再加载对应 Skill 提示词，让模型拥有模块相关的上下文。

---

## 七、状态管理（8 个 Zustand Store）

| Store | 文件 | 职责 |
|-------|------|------|
| `SessionStore` | `stores/session.ts` | 教学会话、消息列表、Agent 事件、引用、SSE 流式状态 |
| `StudentStore` | `stores/student.ts` | 学生画像、掌握度、学习路径、错题、Prompt 史 |
| `CodeStore` | `stores/code.ts` | 代码内容、语言、校验状态与结果 |
| `VisualizationStore` | `stores/visualization.ts` | 场景步骤、播放状态、速度 |
| `SettingsStore` | `stores/settings.ts` | 模型、主题、语言偏好 |
| `FloatingChatStore` | `stores/floating-chat.ts` | 悬浮球独立对话（多会话，localStorage 持久化） |
| `QAStore` | `stores/qa.ts` | 问答题状态 |
| `AnswerStore` | `stores/index.ts` re-export | 回答评估状态 |

**关键设计**：悬浮球（FloatingChatStore）与教学主对话（SessionStore）完全隔离，消息互不可见。悬浮球支持多会话、本地持久化（按 studentId 隔离）、自助 SSE 流。

---

## 八、教学模块（12 个）

模块数据从 `llm-wiki/concepts/*.md` 的 frontmatter 实时读取，**不硬编码**。

| # | ID | 名称 | 难度 | 时长 | 有可视化场景 |
|---|-----|------|------|------|-------------|
| 1 | `ts-basics` | TypeScript 基础速通 | ⭐ | 30min | ❌（工具链前置） |
| 2 | `vibe-coding` | 有纪律的 Vibe Coding | ⭐⭐ | 40min | ❌（工具链前置） |
| 3 | `llm-api` | LLM API 调用 | ⭐ | 20min | ✅ scene-request-response |
| 4 | `system-prompt` | System Prompt | ⭐⭐ | 25min | ✅ scene-role-filter |
| 5 | `agent-loop` | Agent 控制循环 | ⭐⭐⭐ | 30min | ✅ scene-loop-weather |
| 6 | `tool-calling` | Function Calling | ⭐⭐⭐ | 30min | ✅ scene-tool-chain |
| 7 | `rag` | RAG 检索增强生成 | ⭐⭐⭐ | 30min | ✅ scene-retrieve-generate |
| 8 | `llm-wiki` | LLM Wiki 知识层 | ⭐⭐⭐ | 35min | ✅ scene-rag-vs-wiki |
| 9 | `multi-agent` | 多 Agent 协作 | ⭐⭐⭐⭐ | 40min | ✅ scene-orchestration |
| 10 | `mcp` | MCP 工具集成 | ⭐⭐⭐⭐ | 50min | ✅ scene-mcp-flow |
| 11 | `ai-safety` | AI 安全与可控性 | ⭐⭐⭐⭐ | 35min | ✅ scene-attack-defense |
| 12 | `platform-replica` | 教学平台复刻 | ⭐⭐⭐⭐⭐ | 180min | ❌（项目实践） |

> 源码：`src/lib/modules.ts` 从 wiki 读取模块、`src/lib/learning-steps.ts` 定义七步教学流程。

---

## 九、认证系统

### 9.1 认证流程

- 登录：`POST /api/auth/login`，scrypt 验证密码，返回 JWT（7 天有效）
- 注册：`POST /api/auth/register`，scrypt 哈希存库
- JWT 密钥：环境变量 `AUTH_SECRET`
- 内置账号：`test` / `test1234`，`eval` / `eval1234`

### 9.2 三重门禁

| 层级 | 位置 | 机制 |
|------|------|------|
| ① HTML 解析阶段 | `layout.tsx` 内 `<script>` IIFE | 无 token → `location.replace(/auth)` |
| ② React 渲染阶段 | `auth-gate.tsx` | `useEffect` 兜底重定向 |
| ③ API 层 | `lib/api-auth.ts` | 读取 `x-auth-token` 头验证 JWT |

> 注意：Turbopack 下 `useEffect`/`useLayoutEffect` 可能不触发，因此主重定向在第①层完成。

---

## 十、测试体系

### 10.1 现状

| 指标 | 数值 |
|------|------|
| 测试编排器 | `scripts/run-tests.mjs`（自研，TAP 解析 + 超时兜底） |
| 测试套件数 | 55 组（`run-tests.mjs` 中 `SUITES` 数组） |
| 测试文件数 | 60+ 个 `*-spec.ts` / `*-spec.mjs` |
| 运行时框架 | `node:test` + `node:assert/strict` |
| 运行时通过率 | ✅ 全部通过（纯函数秒级，真模型依赖 ARK_API_KEY） |
| TypeScript 类型检查 | ❌ 54 个类型错误（见 §12 已知问题） |
| 标准测试框架 | ✅ Vitest 5 已落地最小闭环：`tests/` 7 个文件 26 个用例 + `pnpm test:unit` / `test:coverage`；旧 `node:test` 并存不迁 |

### 10.2 运行方式

```bash
pnpm test                          # 跑全部 55 组（纯函数秒级，不含真模型）
pnpm test:scores                   # 单跑分数量纲
pnpm test:security                 # 单跑安全过滤
pnpm test:agent:reviewer           # 真模型回归（需 ARK_API_KEY）
pnpm vitest run                    # Vitest 入口（新）
```

### 10.3 自定义 TS 加载器

`scripts/ts-loader.mjs` 注册了两个 Node 钩子：
- `ts-resolver.mjs` — 解析 `@/` 路径别名 + 无扩展名 import
- `tsx-loader-hook.mjs` — esbuild 转译 JSX

这套机制让测试脚本可以直接 `import` 真实源码，不用为了可测性去改生产代码的 import 风格。

### 10.4 测试分组摘要（run-tests.mjs）

55 组涵盖：Markdown 解析、客户端身份、分数量纲、主题偏好、沙箱清单、可视化场景、项目模板、教学循环 DB、教学结果 DB、教学闭环 DB、Trace 接线、提示词预算、安全过滤、限流、混合检索、学生记录、评分维度、提交点评接线、讲解步骤、讲稿缓存、练习判定、编辑器焦点、鉴权流程、数据隔离、SSE 协议、分屏消息过滤、思维链归属/封口/过滤、观察面板分段、冷启动、概念页注入、Composer 发送链路/边缘、ChatRequestSchema、ChatStream、Chat 事件分发、Chat abort/reset、中断注册表、会话池、Agent/Skill 注册表、Agent Loop、代码编辑状态、练习面板、学习路径调整、悬浮球会话、知识卡片、模块会话隔离、SSE dispatch、教学有效性、Chat 渲染、学生漫游、部署自检。

---

## 十一、近期重要改动（2026-10-21 → 2026-10-22）

### 11.1 MCP 协议集成（新功能）

| 文件 | 说明 |
|------|------|
| `src/lib/mcp/wiki-server.ts` | MCP Server，暴露 `search_wiki` 工具（StdioServerTransport） |
| `src/lib/agent/tools/mcp-discover.ts` | MCP Client 适配层，自动发现工具 → 转 AgentCustomTool |
| `src/app/api/chat/route.ts:L228-L240` | dynamic import 注入 MCP 工具进 Agent Loop |
| `package.json` → `@modelcontextprotocol/sdk ^1.32.1` | MCP SDK 依赖 |

**工作原理**：Agent 每次对话时，`mcp-discover.ts` 启动 MCP Wiki Server 子进程 → 通过 stdio JSON-RPC 连接 → `listTools()` 获取工具列表 → 转为 `AgentCustomTool[]` → 注入 `runAgentLoop`。失败时静默回退（不影响对话）。

⚠️ **2026-10-23 修复过一个静默失效**：`wiki-server.ts` 曾写 `import … from "../../wiki/query.js"`，而仓库里是 `src/wiki/query.ts`（无 `.js` 文件）。子进程启动即报 `Cannot find module` 并退出，`discoverTools()` 只拿到空数组并静默回退 —— **对话功能看起来一切正常，MCP 集成实际一天都没工作过**。修法是去掉扩展名（与仓库其它导入保持一致）。`tests/mcp.test.ts` 现在真的启动子进程、走 JSON-RPC 握手并调一次工具，守住这条路径。

### 11.2 Vitest 标准测试框架（已落地最小闭环，2026-10-23）

| 文件 | 说明 |
|------|------|
| `vitest.config.ts` | Vitest 配置（path alias、node 环境、coverage、`tests/**/*.test.ts`） |
| `package.json` → `vitest ^5.0.5` | 测试框架 |
| `package.json` → `@vitejs/plugin-react ^6.1.2` | JSX 支持 |
| `package.json` → `@vitest/coverage-v8 ^5.0.5` | 覆盖率 |
| `tests/` | 7 个标准用例文件（分数/安全/鉴权/维度聚合/Agent 输出校验/子能力/MCP 端到端，26 个用例） |
| `.github/workflows/ci.yml` | CI：`pnpm test:coverage`（Vitest + V8 覆盖率；暂不含 eslint/tsc） |

**当前状态**：`scripts/` 下 57 个 `node:test` 用例仍由 `scripts/run-tests.mjs` 编排（`pnpm test`），**标准框架与旧运行器并存、互不覆盖**。新测试一律写进 `tests/*.test.ts`，用 `pnpm test:unit` 或 `pnpm test:coverage`（覆盖率报告输出到 `coverage/`）。⚠️ CI 暂不跑 `tsc` / `pnpm build`：已知的 54 个类型错误会让流水线假红，先修类型错误再补这两步。

### 11.3 大赛技术文档

`docs/competition/technical-document.md` 已覆盖全部评分维度（13,188 中文字，预估 PDF 22-26 页），所有断言有源码锚点。

---

## 十二、已知问题（按严重程度）

### 🔴 阻塞级

| # | 问题 | 详情 | 验证命令 |
|---|------|------|----------|
| 1 | **54 个 TypeScript 类型错误** | `scripts/` 中 15 个测试文件有类型错误（类型漂移：`"python"` vs `"typescript"`、`ValidationResult` 缺少字段、未使用变量等），另有 4 个组件/store 的未使用导入与泛型不匹配。运行时全部通过，但 tsc 门禁报红。 | `pnpm typecheck` |
| 2 | ~~**无 CI 流水线**~~（2026-10-23 已补 `/.github/workflows/ci.yml`：跑 `pnpm test:coverage`） | 因未修的 54 个类型错误 + 10 个 eslint error，CI 暂不跑 eslint / `tsc` / build | `gh run list` |
| 3 | **Windows 会话池测试进程不退出** | `node:test` 跑完后 CPU 不释放，`run-tests.mjs` 已加 15s 超时兜底 kill | `pnpm test` |

### 🟡 警告级

| # | 问题 | 详情 |
|---|------|------|
| 4 | **Turbopack `useEffect` 可能不触发** | 已通过 layout.tsx 原生 `<script>` IIFE 绕开 |
| 5 | **真模型测试混在主流程** | 无密钥时报"无摘要"，建议拆到独立 `test:model` 脚本 |
| 6 | **Playground / Report 页功能不完整** | 路由存在但内容为占位 |
| 7 | **依赖 `ARK_API_KEY`** | 无密钥时 Agent 对话不可用（`/api/health` 会报缺少密钥） |
| 8 | **Tunnel 域名不固定** | Cloudflare Tunnel 每次重启换域名 |

### 🟢 信息

| # | 问题 | 详情 |
|---|------|------|
| 9 | **Vitest 与旧运行器并存** | `pnpm test` 仍走 `node:test`（57 组）；新增测试写 `tests/*.test.ts`，用 `pnpm test:unit`。不强制迁移，避免一次性改动 60+ 文件 |
| 10 | **MCP Server 作为子进程启动** | 每次对话需启动 Node 子进程，首次有数百毫秒延迟（`globalThis` 缓存 5 分钟缓解） |
| 11 | **`useSpeechRecognition` 实验特性** | 浏览器兼容性有限 |

---

## 十三、开发注意事项

### 13.1 全仓库兜底哲学

项目中几乎所有「可能失败」的路径都有兜底：

- **RAG**：向量路失败 → 回退纯关键词路（`rag-hybrid.ts`）
- **MCP**：连接失败 → 空工具数组（`mcp-discover.ts`）
- **结构化输出**：JSON 提取失败 → Zod 校验 → 回喂重试 → 兜底标记（`outputs.ts`）
- **教学对话**：模型不可用 → 返回错误信息而非崩溃（`loop.ts`）
- **SSE 流**：异常分支 close 前做幂等保护（`sse-server.ts`）

接手时不要破坏这些降级路径。

### 13.2 不要硬编码

以下数据源是活的，不要在代码里另立一份：
- **模块列表**：从 `llm-wiki/concepts/*.md` 读取（`modules.ts`）
- **教学步骤**：`learning-steps.ts` 定义，由 `[step]/page.tsx` 消费
- **场景映射**：`modules.ts` 中的 `moduleToScene` 表
- **代码语言**：唯一值域在 `languages.ts`（`CODE_LANGUAGES = ["typescript"]`）

### 13.3 新增依赖时注意

- `@earendil-works/pi-coding-agent` 体量很大（266 个文件），不要把它的 import 放进轻量模块
- 配置与 SDK 分层：读环境变量的模块（`ark-config.ts`）不 import SDK
- MCP SDK（`@modelcontextprotocol/sdk`）通过 `dynamic import` 加载，不进客户端 bundle

### 13.4 常见操作

```bash
# 彻底清理 Turbopack 缓存
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
pnpm dev

# 重置数据库 + 种子数据
pnpm db:migrate && pnpm db:seed:auth && pnpm wiki:seed

# 重置演示账号
node scripts/demo-reset.mjs

# 新增账号
node scripts/seed-auth-accounts.mjs

# Cloudflare 隧道
pnpm tunnel
# 在终端输出中找 trycloudflare.com 那行

# 检查当前类型错误数
pnpm typecheck 2>&1 | Select-String "error TS" | Measure-Object | Select-Object -ExpandProperty Count
```

### 13.5 环境变量

`cp .env.example .env.local` 后必须填写：

| 变量 | 说明 | 必填 |
|------|------|------|
| `ARK_API_KEY` | 火山方舟 API Key | ✅ |
| `ARK_BASE_URL` | 方舟端点（默认已填） | ❌ |
| `ARK_TEXT_MODEL` | 文本模型（默认已填） | ❌ |
| `ARK_VISION_MODEL` | 视觉模型（默认已填） | ❌ |
| `AUTH_SECRET` | JWT 签名密钥 | ❌（不填用默认） |

---

## 十四、接手后建议的前 5 步

1. **跑通质量门禁**：`pnpm install → pnpm typecheck → pnpm test`，确认基线状态
2. **修 57 个类型错误**：`pnpm typecheck` 输出里的 17 个文件，逐一修复（主要是测试 mock 类型漂移）
3. **启动 dev server**：`pnpm dev`，登录 `test/test1234`，走一遍 `/learn/llm-api/0` 看教学流程
4. **读核心文件**：`src/app/api/chat/route.ts`（入口）→ `src/lib/agent/loop.ts`（循环）→ `src/lib/agent/session.ts`（工具白名单）
5. **决定 Vitest 迁移策略**：全部迁移 vs 新测试用 Vitest，选定后更新 `vitest.config.ts`

---

> **最后重申**：本文档的所有数字（模块数、测试数、错误数）在撰写时逐一核实过源码。但你接手后第一时间应该自己跑一遍 `pnpm typecheck` 和 `pnpm test`——数字可能已经变了。文档是地图，代码是实地。