# 项目总纲

## 项目定位
你正在开发一个「AI Native 编程教学助手」，教零基础用户学会「做 Agent」。
产品本身用 piagentSDK 做底座，用 Agent 教 Agent。

## 第一原则
**AI 协作能力 = 把意图转化为 AI 可执行的指令，并判断、迭代、优化这个过程的能力。**

包含六个子能力：
| 子能力 | 含义 |
|---|---|
| 意图表达 | 把想法变成清晰、无歧义的自然语言 |
| 任务分解 | 把复杂目标拆成 AI 能逐步执行的子任务 |
| 上下文管理 | 给 AI 提供恰当的背景信息，不多不少 |
| 质量判断 | 判断 AI 输出是否可用、哪里有问题 |
| 迭代调优 | 根据结果反馈，调整指令，逐步逼近目标 |
| 理解 AI 行为模式 | 知道 AI 的强项、弱项、幻觉、讨好倾向 |

**所有设计必须服务于这六个子能力。不训练这些能力的功能，不做。**

## 产品形态
- **教学层**：Web 应用（Next.js），负责讲概念、可视化、Prompt 训练、测验
- **执行层**：VSCode + Claude Code / Trae，用户实际写 Agent 项目
- **桥梁**：Web 应用生成可粘贴的 Prompt、项目模板、检查清单

## 教学方式
- 总框架：掌握学习 + 自适应路径
- 核心交互：苏格拉底式引导（不直接给答案）
- 过程：认知学徒制（示范 → 辅导 → 退隐）
- 任务：项目驱动 + 刻意练习

## 教学流程
```
Step 1: 导师展示预设代码
         ↓
Step 2: 学生完成场景（写 Prompt / 工具定义 / 核心逻辑）
         ↓
Step 3: AI 校验代码是否正确
         ├─ 不正确 → 点评 Agent 给反馈，学生修改
         └─ 正确 → 触发预设可视化场景
         ↓
Step 4: 可视化展示 Agent Loop
         ↓
Step 5: 出题 Agent 给变式练习，循环
```

## 技术栈（已敲定，不要改）
| 层 | 选择 |
|---|---|
| 前端框架 | Next.js 14+ App Router + React + TypeScript |
| UI | Tailwind CSS + shadcn/ui + AI Elements |
| 状态管理 | Zustand + TanStack Query |
| 代码编辑器 | Monaco Editor |
| 动画 | Framer Motion |
| 图表 | Recharts |
| 流式协议 | SSE |
| 前端 AI 交互 | Vercel AI SDK（流式对话 / Tool Calling / 生成式 UI） |
| 本地持久化 | IndexedDB (Dexie.js) |
| Agent 底座 | piagentSDK |
| 知识层 | LLM Wiki (`@zosmaai/pi-llm-wiki`) + 轻量 RAG |
| 模型平台 | 火山方舟 Volcengine Ark（OpenAI 兼容端点 `/api/v3`） |
| 主模型（文本推理） | `deepseek-v4-flash-ga-260731`，读环境变量 `ARK_TEXT_MODEL` |
| 多模态模型（视觉理解） | `doubao-seed-2-1-pro-260915`，读环境变量 `ARK_VISION_MODEL` |
| 后端平台 | 腾讯云 CloudBase（PostgreSQL 版） |
| 数据库（开发期） | SQLite + repository 抽象层 |
| 数据库（部署） | CloudBase PostgreSQL |
| 向量库 | CloudBase PG + pgvector |
| 认证 | CloudBase Auth |
| 文件存储 | CloudBase COS |
| 部署 | EdgeOne Pages 或 CloudBase 云托管 |
| 包管理器 | pnpm |
| 代码规范 | ESLint + Prettier + TypeScript |
| 输出校验 | Zod（所有 Agent 输出 JSON + Schema 校验） |
| 测试 | Vitest + Playwright |

## 执行架构（四层）
| 层 | 载体 | 内容 |
|---|---|---|
| 1. 身份层 | System Prompt | Agent 是谁、职责、行为准则 |
| 2. 技能层 | Skill 文件 | 具体任务怎么做 |
| 3. 知识层 | LLM Wiki | 概念、评分标准、学生画像 |
| 4. 编排层 | 工作流代码 | 什么时候调用谁、读哪些页面 |

## 四条铁律
1. **不把讨论塞进一个 Prompt**：分层拆解，按需加载。
2. **Agent 输出必须 JSON + Zod 校验**：格式不对就重试，重试失败走兜底。
3. **Agent 权限由代码控制**：只能读代码给它的内容，只能写代码指定的页面。
4. **所有 Prompt 和 Skill 用 Git 管理**：每次修改提交，可回滚。

## Git 提交规范（必须严格遵守）

### 核心原则
**每完成一件事，立即提交。不要攒着。**
比赛明确要求「保留完整的 Git 提交历史，体现真实的开发过程」。

### 提交时机
每完成以下任一动作，立即提交：
- 创建/修改一个配置文件
- 新增一个组件
- 新增一个 API 路由
- 新增一个 Agent 提示词
- 新增一个 Skill 文件
- 新增一个 Wiki 页面
- 修复一个 bug
- 重构一段代码
- 新增一条测试
- 更新一个文档

### 提交粒度
- 每个提交只做一件事
- 一个提交不超过 10 个文件
- 一个提交不超过 500 行改动
- 如果发现一次要做很多事，拆成多个提交

### commit message 格式
```
type(scope): subject

正文说明做了什么、为什么。
```

type 选择：feat / fix / docs / chore / test / perf / refactor / style / ci

scope 选择：agent / teacher / reviewer / examiner / assistant / wiki / rag / mcp / ui / chat / editor / visualization / api / db / auth / config / docs / orchestrator / trace

### 禁止行为
- 不要一次提交所有文件
- 不要用 "update" "fix" "add" 等泛化 message
- 不要 force push 到 main
- 不要 squash 历史
- 不要跳过 pre-commit hook
- 不要提交 .env、node_modules、dist
- 不要提交 API 密钥

### 每个 Phase 完成后的验证
```bash
git log --oneline | head -50
git log --format="%h %ad %s" --date=short
git log --stat --oneline | grep -E ".env|node_modules"
```

检查：
- 提交数量是否合理（每个 Phase 至少 5 个）
- message 是否具体
- 是否有明显的批量提交痕迹
- 时间分布是否自然
- 是否有修补型提交（fix / refactor / docs / test）
- 是否误提交了敏感信息

### 完整规范
详见 `references/git-conventions.md`。

## 约束
- 零基础可学，不教语法，重点在 AI 协作。
- 只写最核心代码（System Prompt、工具描述、核心逻辑 3-5 行）。
- 项目模板由我们提供，用户拿到就能跑。
- 不在浏览器运行代码，用 AI 校验代替。
- API 密钥绝不进仓库，走环境变量。
- TS 和 Python 两个版本。
- 9 个教学模块，4 个 AI 导师 Agent。
- 预设 5 个工具：计算器、天气、文件读写、网络搜索、数据库查询。

## 输出要求
- 每个阶段完成后，必须能独立运行、独立测试。
- 所有代码有注释，遵循 TypeScript 规范。
- 所有 Agent 输出可被 Zod Schema 校验。
- 所有 Prompt 和 Skill 文件放在 `prompts/` 目录。
- 所有设计文档放在 `docs/` 目录。
- Git 提交用 Conventional Commits。

## 当前阶段
见 `06-execution-plan.md`。
