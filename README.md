# AI Native 编程教学助手

> 用 Agent 教 Agent —— 训练 AI 协作能力的编程教学平台

<!--
  TODO（个人信息相关，留待用户填写）
  - 参赛赛道 / 赛题名称
  - 学校 / 学院 / 指导教师
  - 团队成员与分工
  - 联系方式
-->

**状态**：`v0.1.0` 已打标 —— Phase 7 软件侧 9/12 完成（安全加固 / 提示词预算 / 技术文档 / 跨浏览器测试），剩 EdgeOne 真实部署（指南见 `docs/deployment.md`）与演示材料等人工事项 · 省赛提交截止 2026-11-18

---

## 这是什么

<!-- TODO：以下为基于现有设计文档撰写的电梯陈述草稿，请按实际参赛赛道/学校口径校对 -->

本项目要解决的问题是：**想真正掌握 AI 协作能力的人，缺少「从概念到能跑通的 Agent 项目」之间的训练路径** —— 市面上的教程要么只讲模型 API，要么直接给现成代码，中间那截「怎么把意图变成可靠的 Prompt、怎么让 Agent 稳定干活、怎么判断它靠不靠谱」被跳过了。

目标用户是：**已有一定工程基础、想把 AI 接入实际开发的学习者**（本项目以 Java 背景读者为原型）—— 他们需要的不是又一个聊天框，而是可训练、可评估、可迁移的能力。

---

## 核心思路

本项目不教「怎么让 AI 替你把代码写完」，而是训练六项可迁移的 AI 协作能力。
**所有设计必须服务于这六个子能力——不训练这些能力的功能，不做。**

| 子能力           | 含义                                 |
| ---------------- | ------------------------------------ |
| 意图表达         | 把想法变成清晰、无歧义的自然语言     |
| 任务分解         | 把复杂目标拆成 AI 能逐步执行的子任务 |
| 上下文管理       | 给 AI 提供恰当的背景信息，不多不少   |
| 质量判断         | 判断 AI 输出是否可用、哪里有问题     |
| 迭代调优         | 根据结果反馈，调整指令，逐步逼近目标 |
| 理解 AI 行为模式 | 知道 AI 的强项、弱项、幻觉、讨好倾向 |

### 产品形态

- **教学层**：Web 应用（Next.js）—— 讲概念、可视化、Prompt 训练、测验
- **执行层**：VSCode + AI 编程助手 —— 用户实际动手写 Agent 项目
- **桥梁**：Web 应用生成可粘贴的 Prompt、项目模板、检查清单

### 四条铁律

1. **不把讨论塞进一个 Prompt**：分层拆解，按需加载。
2. **Agent 输出必须 JSON + Zod 校验**：格式不对就重试，重试失败走兜底。
3. **Agent 权限由代码控制**：只能读代码给它的内容，只能写代码指定的页面。
4. **所有 Prompt 和 Skill 用 Git 管理**：每次修改提交，可回滚。

---

## 技术栈

| 层               | 选型                                                        |
| ---------------- | ----------------------------------------------------------- |
| 框架             | Next.js 16（App Router）+ React 19 + TypeScript             |
| 样式             | Tailwind CSS v4 + shadcn/ui                                 |
| 模型平台         | 火山方舟 Volcengine Ark（OpenAI 兼容端点 `/api/v3`）        |
| 主模型           | `deepseek-v4-flash-ga-260731`（环境变量 `ARK_TEXT_MODEL`）  |
| 多模态模型       | `doubao-seed-2-1-pro-260915`（环境变量 `ARK_VISION_MODEL`） |
| Agent 底座       | piagentSDK                                                  |
| 知识层           | LLM Wiki + 轻量 RAG                                         |
| 数据库（开发期） | SQLite + repository 抽象层                                  |
| 数据库（部署期） | 腾讯云 CloudBase PostgreSQL + pgvector                      |
| 包管理器         | pnpm                                                        |
| 代码规范         | ESLint + Prettier + TypeScript 严格模式                     |

---

## 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm

> **Windows 用户注意**：本仓库通过 `pnpm-workspace.yaml` 强制使用 `nodeLinker: hoisted`。
> 非管理员账户无法创建符号链接，默认的 `isolated` 链接器会静默降级为空目录并导致
> `MODULE_NOT_FOUND`。请勿删除该设置。

### 安装与运行

```bash
pnpm install

# 配置环境变量（API Key 绝不落盘，只放在本地 .env.local）
cp .env.example .env.local
# 然后编辑 .env.local 填入 ARK_API_KEY

pnpm dev          # 启动开发服务器 http://localhost:3000
```

### 质量检查

```bash
pnpm check        # eslint + prettier --check + tsc --noEmit（提交前必跑）
pnpm lint:fix     # 自动修复 lint 问题
pnpm format       # 自动格式化
pnpm build        # 生产构建
```

> **本项目刻意不使用 Git 提交钩子。** 早期曾用 `husky + lint-staged`，但已移除，原因有二：
> ① lint-staged 需要「备份原状态」（`git stash` + 临时目录）才能就地修改文件，那条链路
> 曾导致仓库损坏；② 本机安全删除策略会拒绝单次调用内超过阈值的批量删除，导致
> `husky` 的安装步骤直接失败、`pnpm install` 报错退出。
> 因此质量门禁改为**显式命令** `pnpm check`，请在每次提交前手动执行。

---

## 目录结构

```
.
├── src/
│   ├── app/                    Next.js App Router 路由与页面
│   ├── components/             UI 组件（chat / code / learn / playground …）
│   ├── lib/                    业务库（agent / db / wiki / schemas …）
│   ├── scenes/                 9 个可视化场景（数据层 .ts + 组件 .tsx）
│   └── wiki/                   LLM Wiki 自研最小实现（读取 llm-wiki/）
├── llm-wiki/                   知识层内容（概念 / 反模式 / 评分标准 / 项目模板 …）
├── agent-prompts/              设计文档与参考规范（00-MASTER … 06-execution-plan）
├── scripts/                    测试、迁移、种子、探针脚本
├── .env.example                环境变量模板（API Key 绝不落盘）
├── .gitattributes              行尾统一（强制 LF）
├── .gitignore
└── .prettierrc.json            格式化配置
```

<!-- 目录结构随开发推进同步更新；个人参赛信息（赛道/学校/团队/联系方式）见顶部 TODO -->

---

## 文档索引

| 文档                                 | 内容                                   |
| ------------------------------------ | -------------------------------------- |
| `agent-prompts/00-MASTER.md`         | 项目总纲：定位、能力模型、技术栈、铁律 |
| `agent-prompts/06-execution-plan.md` | 分阶段执行计划与全部提交点             |
| `agent-prompts/references/`          | API 规格、数据模型、Git 规范等         |

---

## 开发规范

- **提交信息**：遵循 Conventional Commits（`type(scope): subject`），正文每行 ≤ 72 字符
- **单次提交 ≤ 10 个文件**
- **每完成一件事立即提交**，不攒批；比赛要求保留完整 Git 历史以体现真实开发过程
- **分支策略**：`main`（稳定）/ `dev`（集成分支）/ `feat/*`（功能分支）

---

## 许可

<!-- TODO：填写开源许可协议，或注明「参赛作品，暂不开源」 -->
