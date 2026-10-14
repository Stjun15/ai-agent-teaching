# 项目接手文档

> 最后更新：2026-10-14

---

## 一、项目概述

「AI Native 编程教学助手」—— 一个用 AI 教学生理解 AI 的教学平台。12 个教学模块，七步掌握式学习法（讲解 → 观察 → 模仿 → 校验 → 可视化 → 练习 → 掌握），从第一行 Prompt 到完整 Agent 系统。

**当前交付状态**：核心教学环路（讲解 → 对话 → 校验 → 可视化）可运行，认证登录已打通。非教学类页面（playground、report、settings）有待完善。

---

## 二、技术栈速览

| 层       | 选型                                                         |
| -------- | ------------------------------------------------------------ |
| 框架     | Next.js 16 App Router + Turbopack                            |
| 语言     | TypeScript，`tsc --noEmit` 做门禁                            |
| 样式     | Tailwind CSS 4 + shadcn/ui (Radix)                           |
| 动画     | Framer Motion (motion/react)                                 |
| 状态管理 | Zustand（5 个 store：session / student / code / visualization / settings） |
| Agent    | `@earendil-works/pi-coding-agent`                            |
| 模型     | 火山方舟 Ark（OpenAI 兼容端点，DeepSeek V4 Flash）           |
| 数据库   | 开发期 `node:sqlite`，部署期预留 PostgreSQL                  |
| 知识层   | LLM Wiki（自研轻量 wiki 读取系统，`llm-wiki/` 目录）         |
| 校验     | Zod（HTTP 契约）+ 自定义 schema                              |
| 测试     | `node:test`（纯函数）+ Vitest + Playwright                   |

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
│   ├── loading.tsx                      骨架屏（新）
│   ├── welcome/page.tsx                 欢迎引导页
│   ├── [moduleId]/page.tsx              模块详情页（✅）
│   ├── [moduleId]/loading.tsx           骨架屏（新）
│   ├── [moduleId]/[step]/page.tsx       七步教学页（核心教学环路，✅）
│   └── [moduleId]/[step]/loading.tsx    骨架屏（新）
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

## 五、状态管理（5 个 Zustand Store）

| Store              | 文件               | 职责                                         |
| ------------------ | ------------------ | -------------------------------------------- |
| `SessionStore`     | `stores/session.ts` | 会话、消息、Agent 事件、引用、SSE 流式状态   |
| `StudentStore`     | `stores/student.ts` | 学生画像、掌握度、学习路径、错题、Prompt 史  |
| `CodeStore`        | `stores/code.ts`    | 代码内容、语言、校验状态与结果               |
| `VisualizationStore` | `stores/visualization.ts` | 场景步骤、播放状态、速度           |
| `SettingsStore`    | `stores/settings.ts` | 模型、主题、语言偏好                         |

---

## 六、教学模块（12 个）

模块数据从 `llm-wiki/concepts/*.md` 的 frontmatter 实时读取，拓扑排序自动计算教学顺序。

| 序号 | ID              | 名称               | 难度 | 时长    |
| ---- | --------------- | ------------------ | ---- | ------- |
| 1    | `llm-api`       | LLM API 调用       | 1/5  | 20min   |
| 2    | `system-prompt` | System Prompt      | 2/5  | 25min   |
| 3    | `agent-loop`    | Agent 控制循环     | 3/5  | 30min   |
| 4    | `tool-calling`  | Function Calling   | 3/5  | 30min   |
| 5    | `rag`           | RAG 检索增强生成   | 3/5  | 30min   |
| 6    | `llm-wiki`      | LLM Wiki 知识层    | 3/5  | 35min   |
| 7    | `multi-agent`   | 多 Agent 协作      | 4/5  | 40min   |
| 8    | `mcp`           | MCP 工具集成       | 4/5  | 50min   |
| 9    | `ai-safety`     | AI 安全与可控性    | 4/5  | 35min   |

---

## 七、可视化场景（9 个）

每个教学模块对应一个可视化场景，位于 `src/scenes/`：

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

## 八、开发环境

### 8.1 环境变量

```bash
cp .env.example .env.local
# 必须填写：
#   ARK_API_KEY=你的火山方舟 API Key
# 可选：
#   AUTH_SECRET=自定义 JWT 密钥
```

### 8.2 安装与启动

```bash
pnpm install
npm run dev              # 启动开发服务器（localhost:3000）
```

### 8.3 数据库初始化

```bash
npm run db:migrate       # 创建表结构
npm run db:seed:auth     # 写入内置账号 test / eval
npm run wiki:seed        # 写入 LLM Wiki 种子数据
```

### 8.4 质量门禁

```bash
npm run typecheck        # 类型检查
npm run lint             # ESLint
npm run check            # 三项全跑
npm run test             # 运行自动化测试
```

### 8.5 内网穿透（供队员测试）

使用 Cloudflare Tunnel：

```bash
# 终端 1：开发服务器
npm run dev

# 终端 2（管理员权限）：
cloudflared tunnel --url http://localhost:3000
```

**注意**：免费版 tunnel 每次重启都会换域名，无法固定。tunnel 进程和 dev server 必须同时在线。Windows 休眠后两者都可能挂。

---

## 九、近期重要改动（2026-10-14）

### 9.1 渲染性能优化

| 改动                          | 文件                                              | 效果                                   |
| ----------------------------- | ------------------------------------------------- | -------------------------------------- |
| `React.cache()` 包裹数据读取  | `src/lib/modules.ts`                              | 同请求内多次调用不复读磁盘             |
| 首页 Streaming 拆分           | `src/app/page.tsx`                                | Hero 秒出，统计/课程用 Suspense 异步   |
| 学习页骨架屏（3 个）          | `src/app/learn/**/loading.tsx`                    | 消除异步加载时的白屏                   |
| TopNav 关闭 prefetch          | `src/components/layout/top-nav.tsx`               | 不再预加载 5 个导航目标               |
| `content-visibility` 工具类   | `src/app/globals.css`                             | 长列表延迟渲染首屏外内容               |

### 9.2 认证门禁重写

- 主重定向从 React `useEffect` 迁移到 layout.tsx 原生 `<script>`，绕开 Turbopack 下 useEffect 不触发的 bug
- `auth-gate.tsx` 简化为纯兜底重定向

### 9.3 配置变更

- `next.config.mjs` 新增 `allowedDevOrigins: ["*.trycloudflare.com", "localhost:3000"]`，解决 Cloudflare Tunnel 跨域资源阻塞

---

## 十、已知问题与待办

| 优先级 | 问题                                                         | 说明                                             |
| ------ | ------------------------------------------------------------ | ------------------------------------------------ |
| 🔴     | Tunnel 域名不固定                                            | 每次重启 dev server 都会变，需告知队员新地址     |
| 🟡     | Turbopack 下 `useEffect` 可能不触发                           | 已通过原生脚本绕开，后续 Turbopack 修复后应恢复 |
| 🟡     | Playground 沙箱、Report 报告页功能不完整                     | 路由存在但内容为占位                             |
| 🟡     | 未连接 AI 平台时教学对话会降级                                | 依赖 `ARK_API_KEY` 环境变量                      |
| 🟢     | `optimizePackageImports` 实验特性                            | 已在 next.config.mjs 启用                        |

---

## 十一、部署

详见 [deployment.md](./deployment.md)。简要：

- **目标平台**：EdgeOne Makers（原 EdgeOne Pages）
- **仓库**：<未推送到 GitHub/Gitee>
- **自部署**：`deploy/deploy.sh` 提供常驻主机一键部署脚本（nginx 反代 80 → 3000）

---

## 十二、常见操作速查

```bash
# 彻底清理 Turbopack 缓存（代码改完不生效时用）
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
npm run dev

# 新增演示账号
node scripts/seed-auth-accounts.mjs

# 重新导入 Wiki 内容
node scripts/seed-wiki.mjs

# 查看当前隧道地址
# 在运行 tunnel 的终端里找 trycloudflare.com 那行
```