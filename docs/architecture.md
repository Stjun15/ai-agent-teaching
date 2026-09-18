# 系统架构

> 一句话：一个 9 模块的 AI 工程教学产品。学生跟着对话、可视化与练习走完七步，
> 每一步由四个 Agent 中的一个承担；知识层是仓库里的 Markdown Wiki，
> 检索用加权关键词而不是向量。

本文写给三类人：接手代码的人、评审、以及三个月后的自己。

## 一、产品形态与定位

学生看到的是 Web 应用，五组界面：

| 路由                                  | 界面                   | 作用                                             |
| ------------------------------------- | ---------------------- | ------------------------------------------------ |
| `/`                                   | 首页                   | 学习入口与进度概览                               |
| `/learn`                              | 模块列表               | 9 个模块，顺序由前置依赖拓扑排序得出             |
| `/learn/[moduleId]`                   | 模块页                 | 概念、场景、练习的汇集处                         |
| `/learn/[moduleId]/[step]`            | 七步教学               | 讲解 → 观察 → 模仿 → 校验 → 可视化 → 练习 → 掌握 |
| `/playground`、`/report`、`/settings` | 沙箱 / 学习报告 / 设置 | 自由练习、学情回顾、偏好设置                     |

比赛要求明写「以前端 Web 应用为主要呈现形态，后端服务仅作为 AI 能力的接入层」。
架构上因此有一条自检标准：**没有为后端而存在的模块** —— 每个 API 端点都能指到
它服务的那个界面。

## 二、六层结构与代码位置

| 层         | 职责                                 | 代码位置                                                  | 硬约束                                 |
| ---------- | ------------------------------------ | --------------------------------------------------------- | -------------------------------------- |
| 呈现层     | 页面、组件、9 个可视化场景           | `src/app/**/page.tsx`、`src/components`、`src/scenes`     | 服务端组件可读文件系统，客户端组件不行 |
| 接入层     | HTTP 契约、身份、校验、限流          | `src/app/api/**/route.ts`（21 个）                        | **只有这里知道「这是谁」**             |
| 编排层     | 何时调用哪个 Agent、重试与降难度     | `src/lib/agent/orchestrator`（4 个循环）                  | 不碰 HTTP、不构造身份                  |
| Agent 内核 | 提示词组装、模型调用、校验兜底、观测 | `src/lib/agent/{runtime,loop,prompts,skills,tools,trace}` | 想调模型必须过 `runAgent`              |
| 知识层     | 教学内容的权威来源                   | `llm-wiki/`（Markdown）+ `src/wiki`（解析与检索）         | 改内容只改 Markdown，不改代码          |
| 数据层     | 表与仓库                             | `src/lib/db`（按表拆分）                                  | 驱动名只允许出现在 `sqlite.ts`         |

三条边界值得单独记住：

1. **身份只在接入层构造。** 编排层与内核都不知道「学生是谁」从哪来，只是透传 ——
   在编排层硬凑上下文会写出归属错误的观测数据。
2. **模型调用只有一个入口**（`runAgent`）。trace 记录、输出打码、Skill 越权检查
   都挂在那一个出口上，所以不存在「某个端点漏了」这种漏法。
3. **知识层是文件而不是数据库。** 9 个模块的 id / 名称 / 难度 / 前置依赖都从
   `llm-wiki/concepts/*.md` 的 frontmatter 现读（`src/lib/modules.ts`），
   在教学顺序上做拓扑排序 —— 改了页面里的依赖关系，顺序自动跟着改。

## 三、一次真实请求走完六层

以「学生在对话里发一句话」为例（`POST /api/session/[id]/message`）：

| 步骤 | 发生什么                                            | 位置                               |
| ---- | --------------------------------------------------- | ---------------------------------- |
| 1    | 解析身份：读请求头拿到学生 id 并确认存在            | `api-auth.ts`                      |
| 2    | 限流：身份一确定就挡，早于解析请求体                | `security/rate-limit.ts`           |
| 3    | 校验请求体（Zod）                                   | `schemas`                          |
| 4    | 载入会话并校验归属                                  | `db/sessions.ts`                   |
| 5    | 输入过滤：提示注入拦在模型之前，拦下的**不落库**    | `security/input-filter.ts`         |
| 6    | 读近期历史（按字符预算截断）                        | `agent/loop.ts`                    |
| 7    | 检索引用（本地 Wiki，毫秒级，先于模型发出）         | `agent/citations.ts`               |
| 8    | 学生消息立即落库                                    | `db/messages.ts`                   |
| 9    | 起一轮 Agent：SSE 流式回答，逐 token 推给前端       | `agent/loop.ts`                    |
| 10   | 流结束后落地助手消息 + 回填引用 + 累加 token 与时长 | `db/messages.ts`、`db/sessions.ts` |

第 7 步的顺序是刻意的：引用来自本地检索，能在等第一个 token 的空档里先到，
学生先看到「本节参考了哪几页」，再看到答案。

## 四、教学七步与四个 Agent

七步的来源是数据库契约 `StepType`（不是界面自定的）：

| 步骤 id     | 中文     | 依据                                  |
| ----------- | -------- | ------------------------------------- |
| `explain`   | 概念讲解 | 概念页的「## 定义」与《关键点》       |
| `observe`   | 观察示范 | 教学流程 Step 1 导师展示预设代码      |
| `imitate`   | 动手模仿 | 教学流程 Step 2 学生完成场景          |
| `validate`  | 校验点评 | 教学流程 Step 3 + 点评 Agent          |
| `visualize` | 可视化   | 教学流程 Step 4                       |
| `practice`  | 变式练习 | 教学流程 Step 5 出题 Agent 给变式练习 |
| `mastery`   | 掌握判定 | 掌握学习总框架 + `mastery` 表         |

四个 Agent 的权限写在代码里，不是靠模型自觉（`lib/agent/prompts/index.ts`）：

| Agent       | 称呼       | 默认 Skill          | 允许使用的 Skill                                                             |
| ----------- | ---------- | ------------------- | ---------------------------------------------------------------------------- |
| `teacher`   | 讲解 Agent | `explain-concept`   | `explain-concept`、`trigger-visualization`、`answer-question`                |
| `reviewer`  | 点评 Agent | `validate-prompt`   | `validate-prompt`、`validate-tool`、`validate-code`、`trigger-visualization` |
| `examiner`  | 出题 Agent | `generate-question` | `generate-question`                                                          |
| `assistant` | 答疑 Agent | `answer-question`   | `answer-question`、`explain-concept`                                         |

越权调用在 `runAgent` 入口就被拒 —— 出题 Agent 拿不到 `validate-code`，
讲解 Agent 也触发不了 `validate-prompt`。Agent 之间不直接传消息，
共享状态通过知识层与学生画像的表来交换。

## 五、数据模型现状

15 张表建在 `lib/db/migrations/001_init.sql`。规格文档里还有一张
`knowledge_embeddings`，**没有建**（检索走加权关键词，不需要向量）。

开发库（`dev.db`）当前行数，按用途分组：

| 用途       | 表                                                                      | 行数          |
| ---------- | ----------------------------------------------------------------------- | ------------- |
| 教学主链路 | `sessions` / `messages` / `questions` / `question_results`              | 9 / 4 / 4 / 8 |
| 学情       | `mastery` / `learning_paths` / `student_profiles` / `students`          | 5 / 1 / 2 / 2 |
| 点评与观测 | `validation_results` / `agent_traces`                                   | 6 / 11        |
| 有表无数据 | `errors` / `prompt_history` / `projects` / `citations` / `agent_events` | 0             |

最后一行要分清三种不同原因，不要一律当成「没实现」：

- `citations` 是**预留表**：引用的唯一存储是 `messages.citations` 这一列（已裁定并记载）。
- `agent_events` 建了表但没有任何读写代码。
- `errors` 与 `prompt_history` 有查询端点（`/report`、`/api/student/errors`、
  `/api/student/prompts`）却**没有写入方法** —— 报告页的错题本与提示词历史
  因此恒为空。这是当前最实的一处功能缺口，不是数据没跑到。

## 六、关键设计决策

| 决策                                   | 原因                                                                 | 代价                                         |
| -------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| 用 `node:sqlite` 而不是 better-sqlite3 | 零依赖、免原生编译、避开供应链风险                                   | 要求 Node ≥ 22.5，且只能跑在 Node 运行时     |
| 数据库访问一律走仓库层                 | 部署期要换托管数据库时，只改 `sqlite.ts`                             | 多一层间接                                   |
| 知识层用 Markdown 而非向量库           | 教学内容要可读、可评审、可 diff                                      | 检索质量取决于关键词权重，需要调参           |
| 引用先发、答案后到                     | 不浪费等第一个 token 的空档                                          | 引用先入前端状态，要处理「答案与引用不匹配」 |
| 输出打码放在 `runAgent` 出口           | 字段名各端点不同（`content`/`feedback`/`explanation`），逐处调用必漏 | 每次调用都多一次深度遍历                     |
| 限流是进程内固定窗口                   | 实现简单、行为可预测，够挡误刷与脚本循环                             | 多实例各自计数、重启清零（已在代码中声明）   |
| 安全过滤模块不读环境变量               | 纯函数才能被客户端组件安全引用，否则密钥可能被内联进浏览器包         | 只认结构性模式，不认具体密钥值               |
| 场景的过滤规则从安全模块转出           | 演示与实现必须同一份，否则「在演安全、不是讲安全」                   | 场景不能再有自己的规则副本                   |
| 观测失败不静默                         | 写 trace 失败要带回原因，否则「少一半数据」长期不可见                | 调用方要处理 `recorded: false`               |

## 七、技术栈

| 项        | 选择                                                     |
| --------- | -------------------------------------------------------- |
| 框架      | Next.js 16（App Router、Turbopack）                      |
| 语言      | TypeScript，`tsc --noEmit` 进门禁                        |
| 样式      | Tailwind CSS 4 + shadcn/ui（Radix 原语）                 |
| 状态      | Zustand；主题偏好落 localStorage                         |
| Agent SDK | `@earendil-works/pi-coding-agent`                        |
| 模型平台  | 火山方舟（OpenAI 兼容端点）                              |
| 校验      | Zod（HTTP 契约）+ TypeBox（工具参数）                    |
| 数据库    | 开发期 `node:sqlite`，部署期预留 PostgreSQL              |
| 编辑器    | Monaco（沙箱与代码点评）                                 |
| 质量门禁  | ESLint + Prettier + `tsc --noEmit`，一条 `npm run check` |

## 八、想改某个东西，去哪

| 我要改                           | 去这里                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| 教学内容（某个模块的概念、练习） | `llm-wiki/concepts/*.md`                                     |
| 某个 Agent 的性格与职责          | `lib/agent/prompts/{teacher,reviewer,examiner,assistant}.ts` |
| 任务怎么做（评分维度、执行步骤） | `lib/agent/skills/*.ts`                                      |
| 什么时候调用谁、失败怎么办       | `lib/agent/orchestrator/*.ts`                                |
| HTTP 契约（字段、错误码）        | `schemas` + `lib/api-error.ts`                               |
| 可视化场景                       | `src/scenes/scene-*.tsx`（对应表见 `lib/modules.ts`）        |
| 表结构                           | `lib/db/migrations/001_init.sql` + `lib/db/types.ts`         |
| 安全规则与额度                   | `lib/security/*.ts`                                          |
