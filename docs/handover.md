# 项目接手文档

> 最后更新：2026-10-21

---

## 一、项目概述

「AI Native 编程教学助手」—— 一个用 AI 教学生理解 AI 的教学平台。12 个教学模块（从前置工具链到完整 Agent 系统复刻），七步掌握式学习法（讲解 → 观察 → 模仿 → 校验 → 可视化 → 练习 → 掌握），从第一行 Prompt 到完整 Agent 系统。

**当前交付状态**：核心教学环路（讲解 → 对话 → 校验 → 可视化 → 练习）7 步全通，认证登录已打通，测试覆盖 54 组全通过。非教学类页面（playground、report、settings）有待完善。

---

## 二、技术栈速览

| 层       | 选型                                                         |
| -------- | ------------------------------------------------------------ |
| 框架     | Next.js 16 App Router + Turbopack                            |
| 语言     | TypeScript，`tsc --noEmit` 做门禁                            |
| 样式     | Tailwind CSS 4 + shadcn/ui (Radix)                           |
| 动画     | Framer Motion (motion/react)                                 |
| 状态管理 | Zustand（7 个 store：session / student / code / visualization / settings / floating-chat / qa） |
| Agent    | `@earendil-works/pi-coding-agent`                            |
| 模型     | 火山方舟 Ark（OpenAI 兼容端点，DeepSeek V4 Flash）           |
| 数据库   | 开发期 `node:sqlite`，部署期预留 PostgreSQL                  |
| 知识层   | LLM Wiki（自研轻量 wiki 读取系统，`llm-wiki/` 目录）         |
| 校验     | Zod（HTTP 契约）+ 自定义 schema                              |
| 测试     | `node:test`（纯函数）+ `@testing-library/react`（组件）+ Playwright（E2E） |
| 测试入口 | `npm run test` → `scripts/run-tests.mjs`（54 组秒级全跑）    |

---

## 三、路由与页面（当前状态）

### 3.1 App Router 页面树

```
src/app/
├── page.tsx                             首页（已完成流式拆分）
├── layout.tsx                           根布局（TopNav + AuthGate + Footer）
├── globals.css                          全局样式
├── auth/
│   ├── page.tsx                         登录 / 注册页（✅ 可用）
│   └── change-password/page.tsx         修改密码（✅ 可用）
├── learn/
│   ├── page.tsx                         学习中心（模块列表，✅）
│   ├── loading.tsx                      骨架屏
│   ├── welcome/page.tsx                 欢迎引导页
│   ├── [moduleId]/page.tsx              模块详情页（✅）
│   ├── [moduleId]/loading.tsx           骨架屏
│   ├── [moduleId]/[step]/page.tsx       七步教学页（核心教学环路，✅）
│   └── [moduleId]/[step]/loading.tsx    骨架屏
├── playground/page.tsx                  沙箱实验室（🔧 待完善）
├── report/page.tsx                      学习报告（🔧 待完善）
├── settings/page.tsx                    设置页（✅）
├── audit/page.tsx                       审计评估页
└── demo/adjustments/page.tsx            路径调整演示
```

### 3.2 API 路由（29 个端点）

| 类别           | 路由                                                         | 说明           |
| -------------- | ------------------------------------------------------------ | -------------- |
| 认证           | `POST /api/auth/login`                                       | 登录，返回 JWT |
| 认证           | `POST /api/auth/register`                                    | 注册，返回 JWT |
| 认证           | `POST /api/auth/change-password`                             | 修改密码       |
| 教学 Agent     | `POST /api/chat`                                             | 主 SSE 教学流  |
| 教学 Agent     | `POST /api/agent/explain`                                    | 讲解生成       |
| 教学 Agent     | `POST /api/agent/answer`                                     | 回答评估       |
| 教学 Agent     | `POST /api/agent/answer-grade`                               | 答题批改       |
| 教学 Agent     | `POST /api/agent/generate-question`                          | 出题           |
| 教学 Agent     | `POST /api/agent/validate`                                   | 代码校验       |
| 会话           | `GET/POST /api/session`                                      | 会话管理       |
| 会话           | `GET /api/session/[id]`                                      | 会话详情       |
| 会话           | `POST /api/session/[id]/abort`                               | 中止流式输出   |
| 会话           | `POST /api/session/[id]/message`                             | 消息落库       |
| 学生数据       | `GET /api/student/profile`                                   | 学生画像       |
| 学生数据       | `GET /api/student/mastery`                                   | 掌握度         |
| 学生数据       | `GET /api/student/learning-path`                             | 学习路径       |
| 学生数据       | `GET /api/student/errors`                                    | 错题记录       |
| 学生数据       | `GET /api/student/prompts`                                   | Prompt 历史    |
| 学生数据       | `GET /api/student/projects`                                  | 项目列表       |
| 可视化         | `GET /api/visualization/[sceneId]`                           | 场景数据       |
| Wiki           | `POST /api/wiki/ingest`                                      | 内容导入       |
| Wiki           | `POST /api/wiki/query`                                       | 内容检索       |
| 模块内容       | `GET /api/module-content`                                    | 模块内容缓存   |
| 报告           | `GET /api/report`                                            | 学习报告生成   |
| 项目模板       | `GET /api/project/template/[id]`                             | 项目模板       |
| 审计           | `POST /api/audit` / `POST /api/audit/evaluate`               | 安全审计       |
| 健康检查       | `GET /api/health`                                            | 部署自检       |

---

## 四、认证系统

### 4.1 认证体系

- **登录**：`POST /api/auth/login`，scrypt 验证密码，返回 JWT token
- **注册**：`POST /api/auth/register`，scrypt 哈希密码存库，返回 JWT token
- **令牌**：JWT，有效期 7 天，密钥来自环境变量 `AUTH_SECRET`
- **内置账号**：
  - `test` / `test1234`
  - `eval` / `eval1234`

### 4.2 认证门禁机制（三重保护）

| 层级     | 位置                                                | 机制                                           |
| -------- | --------------------------------------------------- | ---------------------------------------------- |
| 第一层   | `layout.tsx` 内原生 `<script>`（IIFE）               | HTML 解析阶段立即检测 token，无 token 则 `location.replace` 到 `/auth` |
| 第二层   | `auth-gate.tsx`（React 组件）                       | `useEffect` 兜底重定向                         |
| 第三层   | API 路由 `lib/api-auth.ts`                          | 读取 `x-auth-token` 头验证 JWT                 |

### 4.3 已知问题

- **Turbopack bug**：`useEffect` / `useLayoutEffect` 在某些条件下不触发，因此主重定向逻辑已迁移到 layout.tsx 的原生 `<script>` 标签
- **登录后跳转**：登录成功 → 写 token 到 `localStorage` → `window.location.href` 跳转目标页

---

## 五、状态管理（7 个 Zustand Store）

| Store               | 文件                  | 职责                                                    |
| ------------------- | --------------------- | ------------------------------------------------------- |
| `SessionStore`      | `stores/session.ts`   | 教学会话、消息、Agent 事件、引用、SSE 流式状态          |
| `StudentStore`      | `stores/student.ts`   | 学生画像、掌握度、学习路径、错题、Prompt 史             |
| `CodeStore`         | `stores/code.ts`      | 代码内容、语言、校验状态与结果                          |
| `VisualizationStore` | `stores/visualization.ts` | 场景步骤、播放状态、速度                        |
| `SettingsStore`     | `stores/settings.ts`  | 模型、主题、语言偏好                                    |
| `FloatingChatStore` | `stores/floating-chat.ts` | 悬浮球独立对话（多会话，持久化 localStorage）       |
| `QAStore`           | `stores/qa.ts`        | 问答题状态                                              |

**注意**：悬浮球对话 (`FloatingChatStore`) 与教学主对话 (`SessionStore`) 完全隔离，消息互不可见。悬浮球支持多会话（历史对话列表）、本地持久化（按 studentId 隔离）、自助 SSE 流。

## 六、核心 Hooks（6 个）

| Hook                    | 文件                | 职责                                    |
| ----------------------- | ------------------- | --------------------------------------- |
| `useChatStream`         | `hooks/useChatStream.ts` | 教学对话 SSE 流控、事件分发、abort/reset |
| `usePractice`           | `hooks/use-practice.ts` | 练习四阶段状态机（出题→作答→评分→结果） |
| `useStudentHydrate`     | `hooks/use-student-hydrate.ts` | 学生学习数据水合              |
| `useReplicaPhase`       | `hooks/use-replica-phase.ts`  | 平台复刻阶段推进              |
| `useSpeechRecognition`  | `hooks/use-speech-recognition.ts` | 语音输入（实验）            |
| `useElapsed`            | `hooks/use-elapsed.ts` | 会话计时                                |

---

## 七、教学模块（12 个）

模块数据从 `llm-wiki/concepts/*.md` 的 frontmatter 实时读取，拓扑排序自动计算教学顺序。

| 序号 | ID               | 名称                  | 难度 | 时长     |
| ---- | ---------------- | --------------------- | ---- | -------- |
| 1    | `ts-basics`      | TypeScript 基础速通   | 1/5  | 30min    |
| 2    | `vibe-coding`    | 有纪律的 Vibe Coding  | 2/5  | 40min    |
| 3    | `llm-api`        | LLM API 调用          | 1/5  | 20min    |
| 4    | `system-prompt`  | System Prompt         | 2/5  | 25min    |
| 5    | `agent-loop`     | Agent 控制循环        | 3/5  | 30min    |
| 6    | `tool-calling`   | Function Calling      | 3/5  | 30min    |
| 7    | `rag`            | RAG 检索增强生成      | 3/5  | 30min    |
| 8    | `llm-wiki`       | LLM Wiki 知识层       | 3/5  | 35min    |
| 9    | `multi-agent`    | 多 Agent 协作         | 4/5  | 40min    |
| 10   | `mcp`            | MCP 工具集成          | 4/5  | 50min    |
| 11   | `ai-safety`      | AI 安全与可控性       | 4/5  | 35min    |
| 12   | `platform-replica`| 教学平台复刻         | 5/5  | 180min   |

> 前两讲（TS 基础 + Vibe Coding）是工具链前置，不依赖 AI Agent；最后三讲（安全 + 复刻）难度最高。

---

## 八、可视化场景（9 个）

仅 9 个 AI 概念模块有可视化场景（`ts-basics` / `vibe-coding` 是工具链前置，`platform-replica` 是项目实践，三讲无场景）。

| 模块            | 场景文件                          | 说明             |
| --------------- | --------------------------------- | ---------------- |
| `llm-api`       | `scene-request-response.tsx`      | 请求-响应流程    |
| `system-prompt` | `scene-role-filter.tsx`           | 角色过滤         |
| `agent-loop`    | `scene-loop-weather.tsx`          | Agent 控制循环   |
| `tool-calling`  | `scene-tool-chain.tsx`            | 工具调用链       |
| `rag`           | `scene-retrieve-generate.tsx`     | RAG 检索生成     |
| `llm-wiki`      | `scene-rag-vs-wiki.tsx`           | RAG vs Wiki 对比 |
| `multi-agent`   | `scene-orchestration.tsx`         | 多 Agent 编排    |
| `mcp`           | `scene-mcp-flow.tsx`              | MCP 协议流       |
| `ai-safety`     | `scene-attack-defense.tsx`        | 攻击-防御对抗    |

共享组件：`scene-stage.tsx`（场景容器）、`scene-controls.tsx`（播放控制）、`scene-canvas.tsx`（画布）、`scene-typewriter.tsx`（打字机效果）。

---

## 九、测试体系（⭐ 2026-10-21 完成补全）

### 9.1 测试架构

```
54 组测试 → scripts/run-tests.mjs → node:test + @testing-library/react
```

| 分类       | 工具                        | 说明                     |
| ---------- | --------------------------- | ------------------------ |
| 纯函数     | `node:test`                 | 无 DOM、无模型、秒级     |
| 组件交互   | `@testing-library/react`    | JSDOM 环境，模拟点击/输入 |
| 集成测试   | `node:test` + dev server    | 需先启动 `npm run dev`   |
| 真模型回归 | `node:test` + `ARK_API_KEY` | 调用火山方舟，慢且有随机性 |

### 9.2 测试分组摘要

| 分组 | 用例数 | 覆盖要点                                       |
| ---- | ------ | ---------------------------------------------- |
| Markdown 解析 | ✓ | Markdown → React 节点 |
| 客户端身份 | ✓ | studentId cookie 优先级 |
| 分数量纲 | ✓ | 掌握度评分计算 |
| 主题偏好 | ✓ | 主题/语言持久化 |
| 沙箱清单 | ✓ | playground 项生成 |
| 可视化场景 | ✓ | 9 个场景数据加载 |
| 项目模板 | ✓ | 模板文件生成 |
| 教学循环 DB | ✓ | session/message 读写 |
| 教学结果表 DB | ✓ | 评分落库 |
| 教学闭环 DB | ✓ | 批改 + 记录 |
| Trace 接线 DB | ✓ | 审计追踪落库 |
| 提示词预算 | ✓ | token 估算 |
| 安全过滤 | ✓ | 恶意输入拦截 |
| 限流 | ✓ | rate-limit 逻辑 |
| 混合检索 | ✓ | RAG 混合检索 |
| 学生记录写入 | ✓ | records 落库 |
| 评分维度汇总 | ✓ | report 维度计算 |
| 提交点评接线 | ✓ | validate wiring |
| 讲解步骤身份层 | ✓ | step 元数据 |
| 讲稿缓存 | ✓ | lecture cache 策略 |
| 练习判定接线 | ✓ | 掌握度判定 |
| 编辑器焦点 | ✓ | editor focus 逻辑 |
| 鉴权流程 | ✓ | auth flow |
| 数据隔离 | ✓ | 用户间数据隔离 |
| SSE 协议 | ✓ | SSE 格式解析 |
| 分屏消息过滤 | ✓ | 讲稿分流 |
| 思维链归属 | ✓ | thinking attribution |
| 思维链封口 | ✓ | thinking seal |
| 思维链内部词过滤 | ✓ | thinking filter |
| 观察面板分段 | ✓ | observe segments |
| 冷启动 + 模块内容 | ✓（集成）| explain 冷启动 25 例 |
| 冷启动组件渲染 | ✓ | cold-start 组件 render |
| 概念页注入链路 | ✓ | concept injection |
| Composer 发送链路 | ✓（组件）| composer moduleId/step |
| Composer 边缘 | ✓（组件）| Shift+Enter 换行/空消息守卫 |
| ChatRequestSchema 安全 | ✓ | schema 校验 |
| ChatStream 静默与历史 | ✓（组件）| stream 历史附件 |
| Chat 事件分发 | ✓ | 11 种 SSE 事件映射 |
| Chat abort/reset 控制器 | ✓（组件）| abort / reset / 并发闸门 |
| 中断注册表 | ✓ | P0——AbortRegistry 10 例 |
| 会话池 | ✓ | P0——SessionPool 11 例 |
| Agent/Skill 注册表 | ✓ | P1——8 Agent / 8 Skill 权限 |
| Agent Loop | ✓ | P2——24 纯逻辑分支 |
| 代码编辑状态 | ✓ | P3——CodeStore 11 例 |
| 练习面板 | ✓（组件）| P3——usePractice 11 例 |
| 学习路径调整 | ✓ | P3——4 条规则 + 去重 + 上限 14 例 |
| 悬浮球会话 | ✓ | P3——FloatingChat 17 例 |
| 知识卡片 | ✓（组件）| knowledge-card 交互 |
| 模块会话隔离 | ✓ | 切换模块清理 |
| SSE dispatch 翻译 | ✓ | SSE→dispatch 翻译 |
| 教学有效性 | ✓ | 教学数据统计 |
| Chat 渲染 | ✓（组件）| 聊天组件渲染 |
| 学生漫游 | ✓ | walkthrough 流程 |
| 部署自检 | ✓ | health check |

> 标 `（集成）`的需要 dev server 在线（`localhost:3311`）；标 `（组件）`的需要 JSDOM。

### 9.3 运行测试

```bash
npm run test              # 跑全部 54 组（秒级，不含真模型）
npm run test              # 真模型 3 组已混在主流程中，需 ARK_API_KEY
```

**常见问题**：

- **Windows 上会话池超时**：node:test 进程跑完后 CPU 不退出，`run-tests.mjs` 已加 15s 超时兜底 kill。不影响测试结果（exit code = 0）。
- **集成测试 ECONNREFUSED**：先启 `npm run dev` 再跑。
- **真模型间歇失败**：模型是随机采样，同一用例可能这轮过下轮红。

---

## 十、开发环境

### 10.1 环境变量

```bash
cp .env.example .env.local
# 必须填写：
#   ARK_API_KEY=你的火山方舟 API Key
# 可选：
#   AUTH_SECRET=自定义 JWT 密钥
```

### 10.2 安装与启动

```bash
pnpm install
npm run dev              # 启动开发服务器（localhost:3000）
```

### 10.3 数据库初始化

```bash
npm run db:migrate       # 创建表结构
npm run db:seed:auth     # 写入内置账号 test / eval
npm run wiki:seed        # 写入 LLM Wiki 种子数据
```

### 10.4 质量门禁

```bash
npm run typecheck        # 类型检查
npm run lint             # ESLint
npm run check            # eslint + prettier --check + tsc --noEmit（提交前必跑）
npm run test             # 54 组自动化测试
```

### 10.5 内网穿透（供队员测试）

使用 Cloudflare Tunnel（已封装为 npm script）：

```bash
# 一条命令启动隧道（需先启动 dev server）
npm run tunnel
```

等效的原始命令：

```bash
# 终端 1：开发服务器
npm run dev

# 终端 2（管理员权限）：
cloudflared tunnel --url http://localhost:3000
```

**注意**：免费版 tunnel 每次重启都会换域名，无法固定。tunnel 进程和 dev server 必须同时在线。Windows 休眠后两者都可能挂。

---

## 十一、近期重要改动（2026-10-14 → 2026-10-21）

### 11.1 测试全面补全 ⭐

| 改动                        | 说明                                             |
| --------------------------- | ------------------------------------------------ |
| P0 中断注册表 + 会话池      | 11 例纯逻辑，无外部依赖                          |
| P1 Agent/Skill 注册表       | 8 Agent + 8 Skill 权限约束，铁律"Agent 权限由代码控制" |
| P1 Chat 事件分发            | 11 种 SSE 事件映射全覆盖                         |
| P1 Chat abort/reset         | abort / reset / 并发闸门                         |
| P2 Agent Loop               | 24 个纯逻辑分支全覆盖                            |
| P3 学习路径调整             | 4 条规则 + 7 天去重 + 2 条上限（14 例）          |
| P3 悬浮球多会话             | 创建/切换/删除/流式全链路（17 例）               |
| P3 代码编辑状态             | CodeStore 所有状态操作（11 例）                  |
| P3 练习面板                 | 四阶段状态机 + 兜底 + 已作答守卫（11 例）         |
| P3 Composer 边缘            | Shift+Enter 换行/空消息守卫（4 例）              |
| `run-tests.mjs` 重写        | TAP 解析 + 超时兜底 + 退出码聚合 + model/dom 标记 |

### 11.2 悬浮球聊天（全新功能）

| 改动                       | 文件                              | 说明                                 |
| -------------------------- | --------------------------------- | ------------------------------------ |
| `FloatingChatStore`        | `stores/floating-chat.ts`         | 多会话 Zustand store，持久化 localStorage |
| `FloatingChatBot` 组件     | `components/chat/floating-bot.tsx` | 悬浮球 UI，380×480 面板，自助 SSE     |
| `MarkdownView`             | `components/chat/markdown-view.tsx` | Markdown 渲染组件                   |

**设计要点**：悬浮球对话与教学主对话完全隔离——教学页的讲稿/追问与悬浮球的闲聊互不可见。支持多会话（新建/切换/删除），按 studentId 隔离持久化。

### 11.3 知识点完整链路（⭐）

教学模块从「讲解 → 校验」扩展为「讲解 → 示范观察 → 动手模仿 → 校验点评 → 可视化 → 变式练习 → 掌握判定」七步全通。新增组件：

| 组件                    | 文件                                    | 说明                     |
| ----------------------- | --------------------------------------- | ------------------------ |
| `ExplainColdStart`      | `components/learn/explain-cold-start.tsx` | 讲解生成与流式展示       |
| `ObservePanel`          | `components/learn/observe-panel.tsx`      | 示范代码分段观察         |
| `ValidateSubmit`        | `components/code/validate-submit.tsx`     | 代码提交与校验反馈       |
| `VisualizationPanel`    | `components/chat/visualization-panel.tsx` | 9 个概念场景可视化       |
| `PracticePanel`         | `components/learn/practice-panel.tsx`     | 变式练习（出题→作答→评分） |
| `MasteryCheck`          | `components/learn/mastery-check.tsx`      | 掌握判定展示             |
| `PathAdjustmentList`    | `components/learn/path-adjustment-list.tsx` | 学习路径调整建议         |
| `KnowledgeCard`         | `components/learn/knowledge-card.tsx`     | 技术要点五栏填空卡       |
| `SpoilerCover`          | `components/learn/spoiler-cover.tsx`      | 答案遮罩（防偷看）       |

### 11.4 课间小憩 (`fun-break.tsx`)

待机时展示脑筋急转弯/程序员笑话，含答案揭晓与换一题功能，零 AI 调用。

### 11.5 学习仪表盘 (`learn-dashboard.tsx`)

模块页顶部展示：当前进度（步数/N）、模块难度、学习时长估算。

### 11.6 技术要点卡 (`knowledge-card.tsx`)

替换旧的费曼复习卡。五栏填空（一句话/核心机制/关键零件/常见坑/前后关系），提交后展示参考答案并排对比。学生答案持久化到 localStorage（按 studentId 隔离）。

### 11.7 常见操作速查

```bash
# 彻底清理 Turbopack 缓存（代码改完不生效时用）
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
npm run dev

# 新增演示账号
node scripts/seed-auth-accounts.mjs

# 重新导入 Wiki 内容
node scripts/seed-wiki.mjs

# Cloudflare 隧道（无需手动敲 cloudflared 命令）
npm run tunnel

# 查看当前隧道地址
# 在运行 tunnel 的终端里找 trycloudflare.com 那行
```

---

## 十二、已知问题与待办

| 优先级 | 问题                                                         | 说明                                             |
| ------ | ------------------------------------------------------------ | ------------------------------------------------ |
| 🔴     | Windows 上会话池 node:test 进程跑完不退出                     | 已加 15s 超时兜底 kill，根因在事件循环残留，需排查 |
| 🔴     | 缺少 CI 流水线                                                | 无 GitHub Actions，每次靠手动跑 check + test     |
| 🔴     | Tunnel 域名不固定                                            | 每次重启 dev server 都会变，需告知队员新地址     |
| 🟡     | Turbopack 下 `useEffect` 可能不触发                           | 已通过原生脚本绕开，后续 Turbopack 修复后应恢复 |
| 🟡     | 真模型测试（3 组）混在主流程                                  | 无密钥时跑出"无摘要"，建议拆到 test:model 脚本   |
| 🟡     | Playground 沙箱、Report 报告页功能不完整                     | 路由存在但内容为占位                             |
| 🟡     | 未连接 AI 平台时教学对话会降级                                | 依赖 `ARK_API_KEY` 环境变量                      |
| 🟡     | `useSpeechRecognition` 仍为实验特性                          | 浏览器兼容性有限                                 |
| 🟢     | `optimizePackageImports` 实验特性                            | 已在 next.config.mjs 启用                        |

---

## 十三、部署

详见 [deployment.md](./deployment.md)。简要：

- **目标平台**：EdgeOne Makers（原 EdgeOne Pages）
- **仓库**：<未推送到 GitHub/Gitee>
- **自部署**：`deploy/deploy.sh` 提供常驻主机一键部署脚本（nginx 反代 80 → 3000）