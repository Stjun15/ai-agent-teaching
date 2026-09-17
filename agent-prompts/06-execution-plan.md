# 执行计划

## 总原则

1. 每个阶段完成后必须能独立运行、独立测试，再进入下一阶段。
2. 每完成一个小任务立即提交，不要攒着。
3. 每个 Phase 拆成多个提交点，详见每个 Phase 的「提交点」。

## Git 规范

详见 `references/git-conventions.md`。核心规则：

- 每完成一件事立即提交
- 一个提交只做一件事
- 不超过 10 个文件、500 行改动
- 用 Conventional Commits
- 不 force push，不 squash
- 时间戳自然分布

## 阶段顺序

### Phase 0：项目初始化（1 天）

**任务：**

- 初始化 Next.js 14+ + TypeScript 项目
- 配置 Tailwind CSS + shadcn/ui + AI Elements
- 配置 ESLint + Prettier + pnpm
- 配置 Git 分支策略（main/dev/feat）
- 创建 `.env.example` + `.gitignore`
- 提交第一个 commit

**提交点（9 个）：**

```
chore: init next.js project with pnpm
chore: configure typescript and path aliases
chore: add tailwind css and postcss config
chore: setup shadcn/ui with base components
chore: add eslint and prettier config
chore: add husky pre-commit hook
docs: add .env.example and .gitignore
docs: add README skeleton
chore: create dev branch and initial structure
```

**验收标准：**

- `pnpm dev` 能启动
- 浏览器打开 localhost:3000 看到初始页面
- `git log --oneline` 至少有 9 个提交
- `.env.example` 存在，`.env` 被 gitignore

---

### Phase 1：数据层 + piagentSDK 最小闭环（3 天）

**任务：**

- 搭建开发期数据库：SQLite + repository 抽象层（15 张表）
- 集成 piagentSDK
- 跑通一个 Agent + 一个工具
- 对接火山方舟 Ark（OpenAI 兼容端点 `/api/v3`），模型走环境变量
- 验证 SSE 流式返回
- 提交可运行的最小闭环

**提交点（8 个）：**

```
chore(db): add sqlite dev database with repository layer
feat(db): add 15 table migrations
feat(db): add repository abstraction layer
chore(agent): install piagent sdk
feat(agent): add volcengine ark model provider
feat(agent): add basic calculator tool
feat(agent): implement minimal agent loop
feat(api): add health check endpoint
```

**验收标准：**

- 15 张表全部创建
- Agent 能调用计算器工具
- SSE 流式返回正常
- `/api/health` 返回 200
- API 密钥全部走环境变量（`ARK_API_KEY` 不落盘）

---

### Phase 2：C 阶段（知识层）（5 天）

**任务：**

- 实现 LLM Wiki 目录结构
- 写 9 个概念页面
- 写 9 个反模式
- 写 8 个评分标准
- 写学生画像 6 个页面模板
- 集成 `@zosmaai/pi-llm-wiki`
- 验证 ingest / query / maintain

**提交点（15 个）：**

```
docs(wiki): add SCHEMA.md
docs(wiki): add index.md and log.md
feat(wiki): add llm-api concept page
feat(wiki): add system-prompt concept page
feat(wiki): add agent-loop concept page
feat(wiki): add tool-calling concept page
feat(wiki): add rag concept page
feat(wiki): add llm-wiki concept page
feat(wiki): add multi-agent concept page
feat(wiki): add mcp concept page
feat(wiki): add ai-safety concept page
feat(wiki): add anti-pattern library
feat(wiki): add rubrics library
feat(wiki): add student profile templates
chore(wiki): integrate pi-llm-wiki package
```

**验收标准：**

- 9 个概念页面完整
- 交叉引用正确
- 学生画像 6 个页面模板可用
- ingest / query / maintain 三个操作可用

**前置条件（硬节点）：** RAG 上线前必须把数据层从 SQLite 切到 CloudBase PostgreSQL + pgvector，repository 抽象层需提供 PG 实现。

---

### Phase 3：B 阶段（Agent 系统）（7 天）

**任务：**

- 写 4 个 Agent System Prompt
- 写 7 个 Skill 文件
- 实现 Agent 运行时
- 实现编排层
- 实现 Zod 校验 + 重试 + 兜底
- 实现 Trace 记录
- 写回归测试

**提交点（20 个）：**

```
feat(agent): add teacher system prompt
feat(agent): add reviewer system prompt
feat(agent): add examiner system prompt
feat(agent): add assistant system prompt
feat(agent): add explain-concept skill
feat(agent): add validate-prompt skill
feat(agent): add validate-tool skill
feat(agent): add validate-code skill
feat(agent): add generate-question skill
feat(agent): add answer-question skill
feat(agent): add trigger-visualization skill
feat(agent): add agent runtime
feat(agent): add zod schemas for outputs
feat(orchestrator): add teaching loop
feat(orchestrator): add validation loop
feat(orchestrator): add question loop
feat(agent): add retry and fallback logic
feat(trace): add agent trace logging
test(agent): add reviewer regression tests
test(agent): add teacher regression tests
```

**验收标准：**

- 4 个 Agent 能独立运行
- 7 个 Skill 能被正确加载
- 所有输出通过 Zod 校验
- 编排层能跑通完整教学循环
- Trace 记录写入数据库
- 回归测试全部通过

---

### Phase 4：E 阶段（数据与接口）（5 天）

**任务：**

- 实现 18 个 API 路由
- 实现 SSE 事件协议
- 实现数据访问层
- 实现 API 输入输出校验
- 写 API 测试

**提交点（15 个）：**

```
feat(db): add student data access layer
feat(db): add mastery data access layer
feat(db): add learning-path data access layer
feat(db): add session data access layer
feat(db): add message data access layer
feat(db): add trace data access layer
feat(api): add student profile endpoints
feat(api): add session endpoints
feat(api): add SSE message endpoint
feat(api): add agent explain endpoint
feat(api): add agent validate endpoint
feat(api): add agent generate-question endpoint
feat(api): add agent answer endpoint
feat(api): add wiki query endpoint
feat(api): add report endpoint
```

**验收标准：**

- 15 张表全部创建，索引正确
- 18 个 API 路由可访问
- SSE 流式返回正常
- 所有输入输出通过 Zod 校验
- API 密钥走环境变量

---

### Phase 5：D 阶段（前端）（10 天）

**任务：**

- 实现所有路由页面
- 实现所有组件
- 实现 5 个 Zustand Store
- 实现 Vercel AI SDK 流式客户端（SSE）
- 实现 9 个可视化场景
- 响应式适配

**提交点（32 个）：**

```
chore(ui): add app shell and layout
feat(ui): add top navigation
feat(ui): add home page
feat(ui): add learn page with module grid
feat(ui): add module page with three-column layout
feat(ui): add chat panel
feat(ui): add message component
feat(ui): add code editor with monaco
feat(ui): add visualization panel
feat(ui): add agent timeline
feat(ui): add citation panel
feat(ui): add token counter
feat(ui): add step navigation
feat(ui): add mastery indicator
feat(ui): add playground page
feat(ui): add report page
feat(ui): add settings page
feat(store): add student store
feat(store): add session store
feat(store): add code store
feat(store): add visualization store
feat(store): add settings store
feat(sse): add client-side SSE handler
feat(scenes): add scene-request-response
feat(scenes): add scene-role-filter
feat(scenes): add scene-loop-weather
feat(scenes): add scene-tool-chain
feat(scenes): add scene-retrieve-generate
feat(scenes): add scene-rag-vs-wiki
feat(scenes): add scene-orchestration
feat(scenes): add scene-mcp-flow
feat(scenes): add scene-attack-defense
```

**验收标准：**

- 所有路由可访问
- 所有组件渲染正常
- SSE 流式渲染流畅
- 9 个可视化场景可播放
- 响应式适配正常
- 无 TypeScript 错误
- Lighthouse 性能 ≥ 85

---

### Phase 6：A 阶段（教学系统集成）（7 天）

**任务：**

- 把 9 个模块接入前端
- 把 4 个 Agent 接入教学流程
- 把可视化场景接入模块
- 端到端测试完整教学循环
- 优化性能和体验

**提交点（10 个）：**

```
feat(integration): wire llm-api module
feat(integration): wire system-prompt module
feat(integration): wire agent-loop module
feat(integration): wire tool-calling module
feat(integration): wire rag module
feat(integration): wire llm-wiki module
feat(integration): wire multi-agent module
feat(integration): wire mcp module
feat(integration): wire ai-safety module
test(e2e): add full teaching loop test
```

**验收标准：**

- 9 个模块能完整跑通教学流程
- 4 个 Agent 协作正常
- 可视化场景与模块匹配
- 端到端测试通过

---

### Phase 7：打磨与提交（5 天）

**任务：**

- 性能优化
- 安全加固
- 录制演示视频
- 写技术文档
- 部署到 EdgeOne Pages
- 准备在线演示 + 评审测试账号
- 整理比赛提交材料

**提交点（12 个）：**

```
perf(ui): add lazy loading for heavy components
perf(ui): add code splitting
perf(agent): optimize prompt tokens
fix(security): add input filter
fix(security): add output filter
fix(security): add rate limiting
test(e2e): add cross-browser tests
docs: add architecture doc
docs: add AI technical doc
docs: add deployment guide
chore: deploy to edgeone pages
chore: tag v0.1.0 for provincial competition
```

**验收标准：**

- 性能优化生效
- 安全防护完备
- 演示视频 5-8 分钟，1080p
- 技术文档 PDF ≤ 30 页
- 在线演示可访问
- 评审测试账号可用

---

## 提交总数估算

| Phase | 内容 | 提交数 |
|---|---|---|
| Phase 0 | 项目初始化 | 9 |
| Phase 1 | 数据层 + piagentSDK 最小闭环 | 8 |
| Phase 2 | 知识层（LLM Wiki） | 15 |
| Phase 3 | Agent 系统 | 20 |
| Phase 4 | 数据与接口 | 15 |
| Phase 5 | 前端 | 32 |
| Phase 6 | 教学系统集成 | 10 |
| Phase 7 | 打磨与提交 | 12 |
| **总计** | 6 周 | **121** |

6 周 121 个提交，平均每天约 3 个提交。这是真实开发节奏。

省赛提交截止 **2026-11-18**。本计划约 43 天（6 周），预留约 19 天缓冲。

---

## 每个 Phase 完成后的验收流程

1. Agent 完成 Phase，停下来
2. 运行验收命令：

```bash
# 检查提交数量
git log --oneline | head -50

# 检查时间分布
git log --format="%h %ad %s" --date=short

# 检查是否有误提交
git log --stat --oneline | grep -E "\.env|node_modules"
```

3. 逐条检查验收标准
4. 通过则回复「Phase X 验收通过，继续 Phase X+1」
5. 不通过则指出问题，让 Agent 修复

---

## 关键里程碑

| 时间 | 里程碑 | 累计提交数 |
|---|---|---|
| Day 1 | 项目初始化 | 9 |
| Day 4 | 最小闭环跑通 | 17 |
| Day 9 | 知识层完成 | 32 |
| Day 16 | Agent 系统完成 | 52 |
| Day 21 | 数据与接口完成 | 67 |
| Day 31 | 前端完成 | 99 |
| Day 38 | 教学系统集成完成 | 109 |
| Day 43 | 提交材料完成 | 121 |
