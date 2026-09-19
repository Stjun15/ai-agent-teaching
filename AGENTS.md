# AGENTS.md — 接手本仓库的 Agent 从这里开始

> 这份文件写给**下一个进入本仓库的 AI Agent**，只回答三件事：这是什么、现在到哪了、动它之前必须知道什么。
> 设计文档在 `agent-prompts/`；**本机环境地雷与移交操作在 `.workbuddy/HANDOFF.md`**（不入库，需单独拷贝）。

## 一、这是什么

**AI Native 编程教学助手** —— 用 Agent 教 Agent，训练学生六项可迁移的 AI 协作能力。

参赛作品。省赛**报名与作品提交截止 2026-11-18**（同一天）。

赛题硬约束（原文「特别说明」）：作品须**以前端 Web 应用为主要呈现形态，后端服务仅作为 AI 能力的接入层，不作为重点考察对象**。

评分权重：AI 技术深度 35% / 创新性 25% / 前端工程质量 10% / 实用性 10% / 用户体验 10% / 社会价值与商业潜力 10%。

## 二、现在到哪一步（2026-09-19 实测）

| 项         | 事实                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 当前分支   | `dev`（工作分支）；`main` 已合并到 `71e3864`（v0.3.0，main..dev=0）                                                                                                                                                                                                      |
| 提交总数   | 288（dev）；main 294（多 6 个 merge 提交）                                                                                                                                                                                                                               |
| 标签       | `v0.1.0`、`v0.2.0`（978fc5e）、`v0.3.0`（71e3864，走查修复 + 点评闭环 + 等待计时）                                                                                                                                                                                       |
| Phase 0–6  | 已完成（9/9 可视化场景，场景断言 17 例）                                                                                                                                                                                                                                 |
| Phase 7    | **9/12 完成**（安全 3 + 文档 3 + 提示词预算 + 跨浏览器测试 + 标签；见第八节）                                                                                                                                                                                            |
| 质量门禁   | `npm run check` 全绿；`npm test` 23 组（21 纯函数 + 2 真模型）全绿                                                                                                                                                                                                       |
| 仓库完整性 | `git fsck` missing 0；`git write-tree` == `HEAD^{tree}`                                                                                                                                                                                                                  |
| 教学循环   | **已在真实数据库上跑通**（`agent_traces` 等已有真实流量行，见第八节）                                                                                                                                                                                                    |
| 学生数据   | **已接到前端**：`StudentBootstrap` 每页 hydrate，掌握度卡显示真实 80% / 优秀                                                                                                                                                                                             |
| 点评闭环   | **已接到界面**（2026-09-19）：「提交点评」→ 建会话 + `/api/agent/validate`，真实模型批改并落 `validation_results` / `prompt_history` / `errors`，面板展示维度分 / 扣分问题 / 建议及兜底提示；讲解步骤进入即自动开讲；走查发现的学生界面开发术语已清除                    |
| 讲稿缓存   | **点开即有**（2026-09-19）：9 模块 × 讲解/示范讲稿预生成进 `lecture_cache` 表（`scripts/generate-lecture-cache.ts`，提示词/模型升级后 `--force` 重跑），讲解步命中缓存零等待显示；未命中回退实时生成。提示词/开场词/模型三处口径与运行时同源，守卫 7 例                  |
| 七步全通   | **practice / mastery 已接线**（2026-09-19）：变式练习面板（出题→作答→评分→解析，接 `/api/agent/generate-question` + `answer-grade`，答案字段在展示层类型级剥离）与掌握判定面板（判定线 = `MASTERY_PASS_SCORE`，与下一讲解锁同档）——七步每一步点进去都有事可做，守卫 5 例 |

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
pnpm test                                         # 18 组（16 纯函数 + 2 真模型回归）
CODEBUDDY_SAFE_DELETE_ENABLED=0 pnpm build        # 生产构建（开关只作用于本条命令）
pnpm start                                        # 另开受管后台任务，不要用 (cmd &)
node scripts/browser-acceptance.mjs               # 浏览器内端到端 A0–A8
pnpm test:report-details                          # 报告页明细 R0–R7（断言文本取自数据库真行）
pnpm test:mastery                                 # 掌握度卡 M0–M3（store hydrate 真的生效了）
```

**只有第 4 级能证明客户端真的能跑。** 曾发生 SSR 返回 200、HTML 齐全、`pnpm check` 全绿，但浏览器整页白屏的事故（zustand v5 派生 selector 引用不稳定 → React #185）。HTTP 层验证全是假绿灯。

**第 4 级要在 `pnpm start`（生产产物）上再跑一遍**，不能只跑 `pnpm dev`：dev 与生产的编译与预渲染路径不同，dev 过了不代表产物过了。
2026-09-18 实测：生产构建下报告页明细 8/8、掌握度卡 4/4、跨浏览器 11/11 —— 与 dev 下同分。

## 七、目录地图

| 路径                        | 是什么                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `agent-prompts/`            | 设计文档与执行计划。**开工前必读 `00-MASTER.md` 与 `06-execution-plan.md`**                    |
| `agent-prompts/references/` | 契约层：`api-spec.md` / `data-models.md` / `module-specs.md` / `rubrics.md` / `wiki-schema.md` |
| `docs/`                     | 技术文档三件：`architecture.md` / `ai-technical.md` / `deployment.md`                          |
| `llm-wiki/`                 | 知识库（页面类型由 `SCHEMA.md` 现读决定，不写死在代码里）                                      |
| `src/lib/agent/`            | 4 个 Agent（teacher/reviewer/examiner/assistant）+ 4 个编排循环 + Trace                        |
| `src/lib/db/`               | 数据层（SQLite ↔ PG 双形态；驱动名只允许出现在 `sqlite.ts`）                                   |
| `src/wiki/`                 | 知识库读写（路径拼接只出现在 `paths.ts`）                                                      |
| `src/scenes/`               | 9 个可视化场景（`.ts` 放数据供测试 import，`.tsx` 放视觉）                                     |
| `src/app/`                  | 页面与 API 路由                                                                                |
| `scripts/`                  | 迁移 / 播种 / 测试运行器 / 浏览器验收                                                          |

## 八、已知缺口（开工前先看，别以为全绿就没问题）

1. **Phase 7 是 9/12，剩余项全部等待作者本人** —— 已完成：输入过滤、输出打码、限流、提示词预算、
   技术文档三件（`docs/`）、跨浏览器冒烟测试（`scripts/cross-browser-spec.mjs`，Edge 11/11；
   本机只装了 Edge 一个可用引擎，脚本对覆盖数照实报告）、`v0.1.0` 标签（含「不含什么」的诚实说明）。
   未完成且**只能由作者做**：`chore: deploy to edgeone pages`（已交付指南与 `edgeone.json`，
   部署动作待作者执行）。
   另两项 `perf(ui)`（懒加载 / 代码分割）**已实测后放弃**：`next/dynamic` 在
   Next 16 + Turbopack 下 `ssr: true` 仍进首屏 `<script>`，实测 chunk 数 17→26、总量 +62KB，
   净负收益，已整体回退。别再重做一遍，除非换了 Next 版本。
2. **~~`errors` 与 `prompt_history` 没有写入方法~~（2026-09-18 已关闭）** —— 两个仓库补了
   `create`，接线在点评路径的路由层：`/api/agent/validate`（prompt_history 每次真实点评一行、
   errors 不通过时）与 `/api/agent/answer-grade`（主观题判分不通过写 errors，conceptId 取题库行）。
   兜底输出一律不写（编的失败不是学生的失败）。报告页「薄弱点」与「Prompt 平均分」已由真实
   点评流量点亮（端到端验证：交一份弱作业 → errors/problems 带真实点评、报告 weaknesses 出现）。
   客观题答错**已写**（2026-09-18 改：题库自带 `explanation` / `correctAnswer`，
   problems 带「解析：」前缀标明出处不是点评 Agent）。
   **前端已消费**：报告页新增「错题本」与「Prompt 历史」两块明细（此前两个端点
   建好了却没有调用方），另有「评分维度」区块显示真实维度分 —— 六项子能力仍是占位
   且**界面明说不画假进度条**。验收脚本 `scripts/report-details-spec.mjs`（8/8）：
   断言的文本是从 SQLite 当次读出的真实行，不是写死的常量。
   仍开放的小口子：教学状态机接入后 attemptNumber 要从会话状态读；订正与复习调度
   （is_corrected / next_review_at）没有实现路径。
   2b. **~~`StudentStore.hydrate` 没有调用方~~（2026-09-18 已接线）** —— 学习页掌握度卡
   读的是 store 而不是接口，而 store 从来没被灌过数据，卡片恒显示「尚未测评」
   （库里明明有记录）。现在 `StudentBootstrap`（挂在 `layout.tsx`，渲染 `null`，
   与 `ThemeBootstrap` 同构）拉 `profile` / `mastery` / `learning-path` 三个端点
   并 hydrate。验收 `scripts/mastery-hydrate-spec.ts`（4/4：显示真实 80% / 优秀）。
3. **两张表是预留表（2026-09-18 已裁定并记载）**：`citations` —— 引用的唯一存储是
   `messages.citations` 这一列；`agent_events` —— 逐步事件由 SSE 实时推给前端不落库，
   调用级汇总落在 `agent_traces`。两表的启用条件都写在
   `references/data-models.md` 的建表 SQL 注释里（`agent_events` 的启用条件是
   出现「回放历史会话」这类消费方）。别把「表在却没写入」读成疏漏。
4. **~~知识库仍有 3 个目录为空~~（2026-09-18 已补齐）** —— `patterns/` 9 页（每模块一个设计模式，
   与 9 个反模式交叉引用）、`assessments/` 9 份（每模块一份测验，含判分要点）、
   `agents/` 4 页（共同约定 + 讲解/点评/出题三个 Agent 的实测失败模式）。
   `pnpm wiki:seed` 报告：8 个声明目录全部有页面，共 66 个 markdown 文件。
5. **~~`agent-prompts/` 有 8 份文档的 Markdown 表格被空行拆散~~（2026-09-18 已修复）**
   —— `01` / `02` / `03` / `05` / `references/anti-patterns` / `references/api-spec` /
   `references/git-conventions` / `references/rubrics`，共删掉 194 个表格内的空行
   （纯删除、无内容改动；`agent-prompts` 在 `.prettierignore` 里，不会被重排）。
6. **PG 未落地** —— `src/lib/cloudbase.ts` 不存在，`knowledge_embeddings` 表任何环境都没建过（迁移里也没有它）。
   检索目前是**本地加权关键词**，不是向量检索；换 CloudBase PG + pgvector 是代码工作，
   不是配置工作。`docs/deployment.md` 已把它列为上线前置。
7. **部署形态未定** —— Serverless（EdgeOne Makers）上数据库这条腿是断的，运行期读
   `llm-wiki/` 的路径也读不到内容（构建期预渲染的页面不受影响）。两条路径的取舍见 `docs/deployment.md`。
8. **`api-auth.ts` 不是真鉴权** —— 它自述「挡住假冒属于 Phase 7 打磨与提交（含安全加固）」，
   但 Phase 7 的 12 个提交点里**没有「认证」这一项**：文档与计划不一致，未裁定。
   当前限流按学生 id 计数，而 id 来自请求头、可伪造。

## 九、不要做的事

- 不要把 `main` 当工作分支。
- **不要编造未实现的能力**：宁可留 `PlaceholderPanel` 明确写出「这块由哪个提交点交付」，也不塞假数据。
- 不要为「看起来完整」造兜底分数 —— 兜底必须标记 `usedFallback`，且文案写明「未计入掌握度」。
- 不要引 `dangerouslySetInnerHTML`（助手消息渲染靠「转义在先 + 白名单内联标记」方案）。
- 不要在 `src/lib/modules.ts` 之外再抄一份模块元数据表（会立刻产生第三份数据）。
