# AGENTS.md — 接手本仓库的 Agent 从这里开始

> 这份文件写给**下一个进入本仓库的 AI Agent**，只回答三件事：这是什么、现在到哪了、动它之前必须知道什么。
> 设计文档在 `agent-prompts/`；**本机环境地雷与移交操作在 `.workbuddy/HANDOFF.md`**（不入库，需单独拷贝）。

## 一、这是什么

**AI Native 编程教学助手** —— 用 Agent 教 Agent，训练学生六项可迁移的 AI 协作能力。

参赛作品。省赛**报名与作品提交截止 2026-11-18**（同一天）。

赛题硬约束（原文「特别说明」）：作品须**以前端 Web 应用为主要呈现形态，后端服务仅作为 AI 能力的接入层，不作为重点考察对象**。

评分权重：AI 技术深度 35% / 创新性 25% / 前端工程质量 10% / 实用性 10% / 用户体验 10% / 社会价值与商业潜力 10%。

## 二、现在到哪一步（2026-09-18 实测）

| 项         | 事实                                                      |
| ---------- | --------------------------------------------------------- |
| 当前分支   | `dev`（`main` 已合并到 `ba30e06`，**不是工作分支**）      |
| 提交总数   | 202（`git rev-list --count HEAD`）                        |
| Phase 0–6  | 已完成（9/9 可视化场景，场景断言 17 例）                  |
| Phase 7    | **未启动 0/12**                                           |
| 质量门禁   | `pnpm check` 全绿；`pnpm test` 8 组全绿（含真实模型调用） |
| 仓库完整性 | `git fsck` missing 0；`git write-tree` == `HEAD^{tree}`   |
| 教学循环   | **从未在真实数据库上跑通**（见第六节）                    |

## 三、四条铁律（改代码前先读）

1. 不把讨论过程塞进一个 Prompt。
2. Agent 输出必须 JSON + Zod 校验（`extractJson` 先无损提取再判定，重试回喂字段级错误）。
3. **Agent 权限由代码控制** —— `tools` 白名单 + `noExtensions` + `customTools` 三层收敛，缺一层就漏。
4. Prompt 与 Skill 全用 Git 管理（提示词是 TS 常量而非 `.md`，Serverless 产物不含 `src/`）。

## 四、硬约束与红线

**提交粒度**（详见 `agent-prompts/references/git-conventions.md`）：
每完成一件事立即提交；单提交 ≤10 文件、≤500 行改动、**≤200 行新增**；subject 祈使句小写、≤50 字符、无句号；type ∈ `feat/fix/docs/chore/test/perf/refactor/style/ci`。

**禁止**：squash / rebase / filter-branch / 伪造提交时间戳。

**本机约束（脱离本机后不再适用，但接手时先默认遵守）**：

- **禁用切分支式操作**：`git checkout <branch>`、以及在别的分支上 `git merge`。本机删除被重定向到回收站且有硬上限，切分支要替换近 200 个工作区文件，逐文件搬运会中途失败并削坏 `.git`（已发生三次）。合并请用 plumbing：`git merge-tree --write-tree` → `git commit-tree` → `git update-ref`；看别的分支内容用 `git show <branch>:<path>`。
- **判定「仓库干净」的唯一硬判据**：`git write-tree` **逐字符等于** `git rev-parse HEAD^{tree}`。不要用 `git status --short | wc -l` —— `error: bad tree object HEAD` 走 stderr，被吞掉后输出 0 行，是假绿。
- 恢复后对齐索引/工作区用 `git read-tree HEAD` + `git checkout-index -a -f`（**只写不删**）；**禁用 `git add -u` 重建索引**。

## 五、怎么跑起来

```bash
pnpm install                 # 若已存在 node_modules，先 mv 走再装，否则极慢
cp .env.example .env.local   # 填 ARK_API_KEY（绝不入库）
pnpm db:migrate              # 建 SQLite 表（dev.db 不入库）
pnpm wiki:seed               # 建知识库骨架并报告文档漂移
pnpm db:seed:student         # 造一个测试学生
pnpm dev                     # http://localhost:3000
```

模型平台：**火山方舟** `https://ark.cn-beijing.volces.com/api/v3`，文本模型 `deepseek-v4-flash-ga-260731`，视觉模型 `doubao-seed-2-1-pro-260915`。
pi SDK 的 **provider id 必须是 `ark`**（SDK 由 provider id 推导环境变量名，改名后症状是「模型存在但不可用」）。

## 六、改完怎么证明没搞坏（四级，缺一不可）

```bash
pnpm check                                        # eslint + prettier --check + tsc
pnpm test                                         # 8 组，含真实模型回归
CODEBUDDY_SAFE_DELETE_ENABLED=0 pnpm build        # 生产构建（开关只作用于本条命令）
pnpm start                                        # 另开受管后台任务，不要用 (cmd &)
node scripts/browser-acceptance.mjs               # 浏览器内端到端 A0–A8
```

**只有第 4 级能证明客户端真的能跑。** 曾发生 SSR 返回 200、HTML 齐全、`pnpm check` 全绿，但浏览器整页白屏的事故（zustand v5 派生 selector 引用不稳定 → React #185）。HTTP 层验证全是假绿灯。

## 七、目录地图

| 路径                        | 是什么                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `agent-prompts/`            | 设计文档与执行计划。**开工前必读 `00-MASTER.md` 与 `06-execution-plan.md`**                    |
| `agent-prompts/references/` | 契约层：`api-spec.md` / `data-models.md` / `module-specs.md` / `rubrics.md` / `wiki-schema.md` |
| `llm-wiki/`                 | 知识库（页面类型由 `SCHEMA.md` 现读决定，不写死在代码里）                                      |
| `src/lib/agent/`            | 4 个 Agent（teacher/reviewer/examiner/assistant）+ 3 个编排循环 + Trace                        |
| `src/lib/db/`               | 数据层（SQLite ↔ PG 双形态；驱动名只允许出现在 `sqlite.ts`）                                   |
| `src/wiki/`                 | 知识库读写（路径拼接只出现在 `paths.ts`）                                                      |
| `src/scenes/`               | 9 个可视化场景（`.ts` 放数据供测试 import，`.tsx` 放视觉）                                     |
| `src/app/`                  | 页面与 API 路由                                                                                |
| `scripts/`                  | 迁移 / 播种 / 测试运行器 / 浏览器验收                                                          |

## 八、已知缺口（开工前先看，别以为全绿就没问题）

1. **Phase 7 未启动 0/12** —— 无真实安全加固（限流与输入/输出过滤只有演示场景）、无 e2e 测试、无技术文档、**无任何部署配置**（`next.config.mjs` 仅有 `reactStrictMode`）、无 `v0.1.0` 标签。
2. **`/api/project/template/[id]` 仍返回 404 占位** —— `project_templates` 表从未建立，前端目前未调用它。
3. **知识库 19 页未建且无提交点归属** —— `patterns/` 0/5、`projects/` 0/9、`assessments/` 0/1、`agents/` 0/4。8 个 Phase、121 个提交点里没有任何一个承接它们。
4. **教学循环从未在真实数据库上跑通** —— dev.db 里 `learning_paths` / `questions` / `question_results` / `validation_results` / `agent_traces` / `citations` / `errors` / `projects` 全 0 行。Phase 6 验收标准「9 个模块能完整跑通教学流程」目前无事实支撑。
5. **`agent-prompts/` 有 8 份文档的 Markdown 表格被空行拆散**（`01` / `02` / `03` / `05` / `references/anti-patterns` / `references/api-spec` / `references/git-conventions` / `references/rubrics`）。属**原始素材形态**（首次入库即如此，非回归），阅读时把每个 `|` 行当成独立一行。
6. **`SCHEMA.md` 缺 `project` 页面类型**，而 `index.md` 专设「项目模板（projects/）」分节列 9 页 —— 文档间不一致，未裁定。
7. **README 状态过期** —— 写着「Phase 0（项目初始化）进行中」，实为 Phase 6 已完成；`<待填写>` 占位 3 处。
8. **PG 未落地** —— `src/lib/cloudbase.ts` 不存在，`knowledge_embeddings` 表任何环境都没建过，但计划声明「RAG 上线前必须切 CloudBase PG + pgvector」。

## 九、不要做的事

- 不要把 `main` 当工作分支。
- **不要编造未实现的能力**：宁可留 `PlaceholderPanel` 明确写出「这块由哪个提交点交付」，也不塞假数据。
- 不要为「看起来完整」造兜底分数 —— 兜底必须标记 `usedFallback`，且文案写明「未计入掌握度」。
- 不要引 `dangerouslySetInnerHTML`（助手消息渲染靠「转义在先 + 白名单内联标记」方案）。
- 不要在 `src/lib/modules.ts` 之外再抄一份模块元数据表（会立刻产生第三份数据）。
