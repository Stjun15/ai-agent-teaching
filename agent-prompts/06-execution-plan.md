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

## 排期原则（2026-09-17 重排）

**动因**：比赛要求「特别说明」明写 —— 参赛作品须以**前端 Web 应用为主要呈现形态，后端服务仅作为 AI 能力的接入层，不作为重点考察对象**。原计划把前端排在 Phase 5（倒数第三块），而按 17 个考察点计算：

- 前端直接相关权重 = 前端工程质量 10 + 用户体验 10 + 交互模式创新 7 = **27%**
- 更关键的是 **AI 技术深度那 35% 也只能通过前端呈现给评审** —— ≥3 位专家看的是演示视频与在线演示，不是源码

**调整**：

1. **前端主链路提前到 Phase 3**，紧跟知识层之后。后端只做到「能支撑前端演示」为止。
2. **Phase 3 首个提交点是 `/api/chat` SSE 端点** —— 把 Phase 1 已跑通的 Agent 循环接到 HTTP 层。一个提交点即可让前端对接，无需等待 Agent 系统完工。
3. **后续每个 Phase 完成后，其能力立刻接入已有界面**，作品自 Day 16 起始终处于「可演示」状态，演示视频随时可录。
4. 原 Phase 3 / 4（Agent 系统、数据与接口）整体后移为 Phase 4 / 5，内容不变。
5. 原 Phase 5 前端拆为两块：**主链路进 Phase 3**，**9 个可视化场景与剩余 4 个页面并入 Phase 6**（与原 Phase 6 教学集成合并）。

**切分理由**：9 个可视化场景是「交互模式创新 7%」的核心载体，但它们对应的能力（Agent 编排、RAG、MCP、多 Agent）要到 Phase 4 / 5 才具备，场景必须跟着能力走。而对话界面、模块页、Agent 时间线等主链路只依赖已完成的最小闭环，可以立即开工。

**同步修正的既存偏差**（计划与代码不一致）：

- 原 Phase 4 的 6 个数据访问层提交点已于 Phase 1（`137fcca`）一次性完成，从列表中移除。
- 原 Phase 4 验收标准「15 张表全部创建」已由 Phase 1 验收覆盖，移除。
- Phase 0 提交点中的 `chore: add husky pre-commit hook` 已决策废弃（本机 safe-delete 垫片的删除预算会被 Git 钩子撞爆），实际以显式 `pnpm check` 替代。

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
chore: add husky pre-commit hook          （已废弃，见「排期原则」）
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
- 对接商汤日日新 SenseNova（OpenAI 兼容端点 `/v1`），模型走环境变量
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
- API 密钥全部走环境变量（`SENSENOVA_API_KEY` 不落盘）

---

### Phase 2：C 阶段（知识层）（5 天）

**任务：**

- 实现 LLM Wiki 目录结构
- 写 9 个概念页面
- 写 9 个反模式
- 写 8 个评分标准
- 写学生画像 6 个页面模板
- 自研 `src/wiki/` 最小实现（`@zosmaai/pi-llm-wiki` 无法接入，见下方注记）
- 验证 ingest / query / maintain

**提交点（17 个）：**

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
feat(wiki): add wiki page parsing and schema validation
feat(wiki): add wiki ingest query and maintain operations
chore(wiki): add seed-wiki script
```

**验收标准：**

- SCHEMA 完整，所有页面有 frontmatter
- 9 个概念页面完整
- 交叉引用正确，无死链
- 学生画像 6 个页面模板可用
- ingest / query / maintain 三个操作可用

**原提交点 15 已改写（2026-09-17 取证结论）**：`@zosmaai/pi-llm-wiki@0.12.2` **无 `main` / `module` / `types` / `exports`**，不存在 Node 可导入入口。它只能作为 pi 扩展 / skill / prompt / MCP server 接入，且要求 `{root}/.llm-wiki/wiki/{sources,concepts,entities,syntheses,analyses,requirements}` 的 vault 布局；而本项目是**无点前缀**的 `llm-wiki/`，且含 `anti-patterns/` `validation/` `students/` 三层，该包不识别。若走扩展接入，还需放开 `loop.ts` 的 `noExtensions: true`，而扩展注册的工具**会绕过 `tools` 白名单** —— 与「Agent 权限由代码控制」铁律冲突。

**已按用户裁定（2026-09-17）改为自研最小实现**，`src/wiki/` 按 `references/wiki-schema.md` 第六节的 5 个函数签名自行实现，直接读写本项目的 SCHEMA 格式，且只依赖 `node:` 内置模块。该包的集成整体推到 Phase 4 的 MCP 阶段再定。

**前置条件（硬节点）：** RAG 上线前必须把数据层从 SQLite 切到 CloudBase PostgreSQL + pgvector，repository 抽象层需提供 PG 实现。

---

### Phase 3：D 阶段（前端主链路）（7 天）

**任务：**

- 新增 `/api/chat` SSE 端点，把已跑通的 Agent 循环接入 HTTP 层
- 实现应用外壳与路由布局
- 实现首页、学习页、模块页（三栏布局）
- 实现对话界面：聊天面板、消息组件、浏览器端 SSE 客户端与流式渲染
- 实现 Agent 工作过程可视化：时间线、引用面板、Token 计数、步骤导航、掌握度指示
- 实现 5 个 Zustand Store

**提交点（20 个）：**

```
feat(api): add chat sse endpoint
chore(ui): add app shell and layout
feat(ui): add top navigation
feat(ui): add home page
feat(ui): add learn page with module grid
feat(ui): add module page with three-column layout
feat(ui): add chat panel
feat(ui): add message component
feat(ui): add visualization panel
feat(ui): add agent timeline
feat(ui): add citation panel
feat(ui): add token counter
feat(ui): add step navigation
feat(ui): add mastery indicator
feat(store): add student store
feat(store): add session store
feat(store): add code store
feat(store): add visualization store
feat(store): add settings store
feat(sse): add client-side SSE handler
```

**验收标准：**

- `pnpm dev` 后，浏览器可完成一次真实对话，流式输出可见
- 对话中触发工具调用时，界面显示对应卡片（如 `calculate`）
- 所有路由可访问，无 TypeScript 错误
- 5 个 Zustand Store 状态可读写
- **作品进入「可持续演示」状态** —— 后续 Phase 的能力可立即接入本界面

**与 Phase 5 的边界**：本阶段的 `/api/chat` 是**不落库的最小端点**，只负责把 Agent 循环的输出推给浏览器；会话持久化与消息落库由 Phase 5 的 `feat(api): add SSE message endpoint` 承接。

---

### Phase 4：B 阶段（Agent 系统）（7 天）

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

### Phase 5：E 阶段（数据与接口）（5 天）

**任务：**

- 实现 18 个 API 路由
- 实现 SSE 事件协议
- 实现数据访问层
- 实现 API 输入输出校验
- 写 API 测试

**提交点（9 个，原 15 个中前 6 个数据访问层已于 Phase 1 完成）：**

```
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

- 18 个 API 路由可访问
- SSE 流式返回正常
- 所有输入输出通过 Zod 校验
- API 密钥走环境变量

---

### Phase 6：可视化场景 + 前端收尾 + A 阶段（教学系统集成）（7 天）

**任务：**

- 补齐剩余 4 个页面（代码编辑器、playground、report、settings）
- 实现 9 个可视化场景
- 把 9 个模块接入前端
- 把 4 个 Agent 接入教学流程
- 把可视化场景接入模块
- 端到端测试完整教学循环

**提交点（23 个）：**

```
feat(ui): add code editor with monaco
feat(ui): add playground page
feat(ui): add report page
feat(ui): add settings page
feat(scenes): add scene-request-response
feat(scenes): add scene-role-filter
feat(scenes): add scene-loop-weather
feat(scenes): add scene-tool-chain
feat(scenes): add scene-retrieve-generate
feat(scenes): add scene-rag-vs-wiki
feat(scenes): add scene-orchestration
feat(scenes): add scene-mcp-flow
feat(scenes): add scene-attack-defense
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

- 9 个可视化场景可播放
- 所有路由可访问，所有组件渲染正常
- 响应式适配正常，无 TypeScript 错误
- Lighthouse 性能 ≥ 85
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

| Phase | 内容                    | 提交数 |
| ----- | ----------------------- | ------ |
| Phase 0 | 项目初始化            | 9      |
| Phase 1 | 数据层 + piagentSDK 最小闭环 | 8 |
| Phase 2 | 知识层（LLM Wiki）    | 15     |
| Phase 3 | 前端主链路            | 20     |
| Phase 4 | Agent 系统            | 20     |
| Phase 5 | 数据与接口            | 9      |
| Phase 6 | 可视化场景 + 前端收尾 + 教学集成 | 23 |
| Phase 7 | 打磨与提交            | 12     |
| **总计** | **约 40 天**         | **116** |

40 天 116 个提交，平均每天约 3 个提交。这是真实开发节奏。

省赛提交截止 **2026-11-18**。本计划约 40 天，预留约 22 天缓冲。

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

| 时间   | 里程碑             | 累计提交数 |
| ------ | ------------------ | ---------- |
| Day 1  | 项目初始化         | 9          |
| Day 4  | 最小闭环跑通       | 17         |
| Day 9  | 知识层完成         | 32         |
| Day 16 | 前端主链路可演示   | 52         |
| Day 23 | Agent 系统完成     | 72         |
| Day 28 | 数据与接口完成     | 81         |
| Day 35 | 教学系统集成完成   | 104        |
| Day 40 | 提交材料完成       | 116        |
