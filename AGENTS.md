# AGENTS.md — 接手本仓库的 Agent 从这里开始

> 这份文件写给**下一个进入本仓库的 AI Agent**，只回答三件事：这是什么、现在到哪了、动它之前必须知道什么。
> 设计文档在 `agent-prompts/`；**本机环境地雷与移交操作在 `HANDOVER.md`**（仓库根，已入库，与本文档同步更新）。

## 一、这是什么

**AI Native 编程教学助手** —— 用 Agent 教 Agent，训练学生六项可迁移的 AI 协作能力。

参赛作品。省赛**报名与作品提交截止 2026-11-18**（同一天）。

赛题硬约束（原文「特别说明」）：作品须**以前端 Web 应用为主要呈现形态，后端服务仅作为 AI 能力的接入层，不作为重点考察对象**。

评分权重：AI 技术深度 35% / 创新性 25% / 前端工程质量 10% / 实用性 10% / 用户体验 10% / 社会价值与商业潜力 10%。

## 二、现在到哪一步（2026-10-07 20:25 实测，本会话收尾后）

| 项           | 事实                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 当前分支     | `dev`（工作分支）@ `2dd3ef7`，**本地领先 origin/dev 未推送**（领先数用 `git ls-remote origin dev`（带四个开关，见第八节）比对远端 SHA 与本地 `git rev-parse HEAD` 得之；本地 `origin/dev` 引用可能缺失，勿用 `git rev-list origin/dev..HEAD`；**实测远端 `dev`=`d4077d1`（2026-10-07 接手核查 `ls-remote` 实测），本地领先 6 个提交未推送**）。`main` 仍在 `v0.4.0`（001dcd3）。⚠️ 推送需带四个开关（绕代理 + 关证书吊销 + 关 SSL 校验 + `http.postBuffer`），**逐条命令临时指定、别写进 .gitconfig** —— 见第八节                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 提交总数     | **514**（dev，本地；实时值用 `git rev-list --count HEAD`）；**远端 `dev`=`d4077d1`（`ls-remote` 实测，本地 `origin/dev` 引用缺失），本地领先 6 个提交未推送**。当日新增约 **39 个**（含本会话收尾与接手文档修正）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 标签         | `v0.1.0`、`v0.2.0`（978fc5e）、`v0.3.0`（71e3864，走查修复 + 点评闭环 + 等待计时）、`v0.4.0`（001dcd3，讲稿缓存 + 七步全通 + 编辑器焦点守卫）。另有 `dev-phase5-backup`（非发布）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 远端         | GitHub 私有仓库 `github.com/jiajunjiang15/ai-agent-teaching`，`dev` 已同步。⚠️ **推送会被 Windows schannel 的证书吊销检查阻断**（`CRYPT_E_NO_REVOCATION_CHECK`），且该报错不稳定复现 —— 不要据单次失败断定网络不通。提交截止前需改 Public 或给评审加协作者                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 质量门禁     | `pnpm check` **0 error**、prettier 全过、`tsc` 0 错。⚠️ `pnpm test` **当前 3~4 组失败（偶发）**：3 个真模型回归组（点评/讲解/出题 Agent）因 **Ark 文本端点返回空内容**（外部 API 故障，非产品缺陷，见 `HANDOVER.md` 4.2）全部失败；另 1 个 `thinking-seal-spec` 毫秒竞态（测试自身 `flush()` bug，非产品，见 4.4）。**当前无法用真模型组证明 Agent 输出契约仍合法，待 Ark API 恢复后重跑**。另两条历史教训：① 本文档原写「`npm run check` 全绿」是错的 —— 当时 `tsc` 有 3 条 error 且生产构建失败，被 `pnpm test` 全绿掩盖（**测试不跑 tsc**）；② `eslint.config.mjs` 的 `globalIgnores` 与 `tsconfig.json` 的 `exclude` 是同一份清单，改一份就要想另一份                                                                                                                                                                                                                                                                                                                     |
| 产品内审计员 | **2026-10-07 已上线**：`/audit` 页 + `/api/audit`（GET 读 / POST 触发，独立限流桶 `curriculum-audit` 3 次/分）。判据 `src/lib/audit/deterministic.ts` 五项确定性检查（任务节可达性 / 示范代码可读性 / 任务超纲语法 / 术语断层 / 内容一致性），落 `audit_findings` + `module_audits` 两表。首次结果：**11 讲 3 缺陷**（high 1 / medium 2）。浏览器验收 `scripts/audit-page-acceptance.mjs` 12/12 PASS。⚠️ **null 分数必须显示「未检测」而非 0**——本轮不调模型，画 0 就是编数据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 部署套件     | `deploy/`（一键脚本 + 说明）：常驻主机路线，装环境→拉代码→建表→systemd→nginx 反代（SSE 关缓冲）；**待租服务器执行**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 参赛信息     | README 已填（传智杯「AI WEB网页开发挑战赛」C 组 · 广东交通职业技术学院 · 江家俊）；参赛技术文档初稿与演示视频脚本已交付（`docs/competition/`，2026-09-30）；视频录制与 PDF 转档待作者                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Phase 0–6    | 已完成（9/9 可视化场景，场景断言 17 例）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Phase 7      | **9/12 完成**（安全 3 + 文档 3 + 提示词预算 + 跨浏览器测试 + 标签；见第八节）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 仓库完整性   | `git fsck` missing 0；`git write-tree` == `HEAD^{tree}`（判据要逐字符比，不是 `git status` 干净）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 学生 Agent   | ⚠️ **是离线审计工具，不是产品运行时**（2026-10-07 19:31 核验）。`src/lib/agent/student/` 三个子智能体共 1598 行（screen-describer「See」/ action-executor「Act」/ comprehension-verifier「Verify」），已跑出真实数据（`student-agent-output/autonomous-run-log.json`，10-05）。但 `grep -rn 'agent/student' src/` **返回空** —— 产品零引用。另有 630 行主脚本 `student-autonomous-run.ts` **从未入库**、两个 demo 首字符被写坏（`tsc` 报 `TS2304`）。详见 `HANDOVER.md` 4.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 待裁定       | ① `ark-config.ts` 视觉模型 `pro-260915` vs `turbo-260628`，与第五节/`ark.ts:9`/`schemas/api.ts:213`/`.env.example:27` **四处矛盾**；② 5 个实验脚本去留（在 `student-agent-output/_untracked-demos/`，可逆，其中 2 个已损坏）。~~③ 模拟学生 Agent 定位~~ 与 ~~④ 5 工具只做 1 个~~ **已于 2026-10-07 裁定**（选 A 离线审计工具 / 有意裁剪），见 `HANDOVER.md`「三件事裁定结果」节                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 教学循环     | **已在真实数据库上跑通**（`agent_traces` 等已有真实流量行，见第八节）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 学生数据     | **已接到前端**：`StudentBootstrap` 每页 hydrate，掌握度卡显示真实 80% / 优秀                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 点评闭环     | **已接到界面**（2026-09-19）：「提交点评」→ 建会话 + `/api/agent/validate`，真实模型批改并落 `validation_results` / `prompt_history` / `errors`，面板展示维度分 / 扣分问题 / 建议及兜底提示；讲解步骤进入即自动开讲；走查发现的学生界面开发术语已清除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 讲稿缓存     | **点开即有**（2026-09-19）：9 模块 × 讲解/示范讲稿预生成进 `lecture_cache` 表（`scripts/generate-lecture-cache.ts`，提示词/模型升级后 `--force` 重跑），讲解步命中缓存零等待显示；未命中回退实时生成。提示词/开场词/模型三处口径与运行时同源，守卫 7 例                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 路径调整     | **2026-09-21 已上线**：`src/lib/agent/path-adjuster.ts` 规则引擎，基于掌握度下降、连续失败、错题积压自动生成学习路径调整建议。前端统一 `PathAdjustmentCard` 组件（模块页 + 报告页复用）。单元测试 4 条规则 + 边界。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| SSE 优化     | **2026-09-21–26 连续三轮优化**：① Token 批量合并（setTimeout(0) 按 buffer 合并渲染，频次从 30-80/s → ~20/s）；② 引用检索与会话创建并行执行（`preludeEvents` 改为异步回调，消除 2-5s 空等）；③ 思维链先于首 token 可见（追加 planner 替换分段、默认展开、中文思考指令）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 界面分屏     | **2026-09-19/20**：讲解/示范/模仿三步分离（示范卡=讲稿代码提取 + 确认门控跳转，任务卡=「现在轮到你」，聊天按步过滤不串内容）；**模块会话隔离**（activeModuleId 清空 + 事件守卫，修跨模块串台 d63810a）；原型门仅第 1 讲，**待用户确认后批量到 9 讲**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 混合检索     | **2026-09-30 已上线**：关键词 + 向量双路召回、RRF 融合（`src/lib/agent/rag-hybrid.ts`），`knowledge_embeddings` 预留表启用（003 迁移，375 块按 `##` 章节切块，`pnpm rag:index` 重建）。**2026-10-05 embedding 换代**（fa137b8）：`text-embedding-v4` 免费额度耗尽（FreeTierOnly）+ 方舟侧实测不可用（文本 embedding 全 Retiring 不可开通、vision-251215 服务端 500 高频），换百炼 **`qwen3.7-text-embedding`**（1024 维、额度独立、同端点零改流）。重建后三路 recall@3：关键词 72.7% / **纯向量 95.5%** / 混合 90.9%——**融合倒挂**（关键词路稀释向量命中）记录在案待裁决。换 embedding 模型必须全量重建 + 重启服务（新旧向量不可混算）。向量路失败自动降级关键词并打 usedFallback。守卫 5 例（`pnpm test:rag`）                                                                                                                                                                                                                                                               |
| 懒加载裁决   | **2026-09-30 实测定案**：场景组件 `next/dynamic` 懒加载（含 loading 骨架）首屏 JS 1262KB，优于静态导入 1305KB——v1「净负收益」结论在当前代码上不成立，**保留懒加载**，别再回退。A/B 方法：预渲染 HTML 的 script 标签求和对比                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 参赛材料     | **2026-09-30**：`docs/competition/` 四件（技术文档初稿·对齐官方七节大纲 / 演示视频分镜脚本 / 零基础试用引导 / 评审账号在 `.workbuddy/` 不入库）。官方赛道章程要点：报名+提交均 2026-11-18，缴费后从个人中心提交，提交后不得修改                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 讲解口径     | **2026-10-01 统一**：教学提示词受众只有「没有任何编程基础」一个口径（曾写「零基础但有编程底子」致讲稿开口暴露）；explain 结构第一节是「开场」非「门禁确认」，内部术语禁止出现在学生面前（`teaching-step-spec` 双向钉死）；TS/PY 讲解门与其它九讲统一（冷启动门只剩 platform-replica）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 复刻环节     | **2026-10-03 P1-P4 改造**：第二斧补可抄 Agent 循环示范代码（点评 Agent 曾抓出示范代码缺 res.ok——已修）；验收清单 7 条含点评闭环；提交形态=关键文件+清单自查；`platform-replica-phases.ts` 是 wiki 的界面镜像，**两边必须同步改**（曾漂移出虚构文件路径与不存在的验收端点）；启动台补 Node≥22.5；模拟七步全通 grounding ✓。**2026-10-05 学生走查后补两断层**（bce9f5b）：对话 Composer 补 `step="explain"`（/api/chat 身份层+注入的总开关，曾答错 Node≥22.5 硬要求）；结算阶段内嵌「交付与检验单」编辑器走 `/api/agent/validate` 正式落库（ValidateSubmit 加 redirectOnComplete 开关）；阶段位置持久化（use-replica-phase.ts）。前置门控实测有效（ai-safety 掌握度需 ≥3）。**2026-10-05 检验单 rubric 定制**（2b35dff）：复刻点评题面=wiki 现读「动手任务：最终验收」节（`readPracticeTask`→question_text），skills 层 `module-rubric.ts` 追加段要求维度跟清单走、无证据条目不编分，通道是 runtime 的 `skillSupplement`（skill id 与白名单不变）；通用四维降为代码质量支撑维度 |
| 验收修复     | **2026-10-01**：浏览器验收脚本三处修复（AuthGate 种身份 / B 系列落点 imitate / aria-label）后**首次完整 PASS**；全站水合失败根治（麦克风检测渲染期读 window，React #418）；裸选项文本判 0 修复（`gradeObjective` 三形态对账，守卫钉死）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

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
- 🔴 **推送 / 核验远端要带四个开关，单靠绕代理不够**（10-07 19:55 实测踩通）：

  ```bash
  # 核验（拿远端真实 SHA，别信 git rev-list origin/dev..HEAD）
  env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    git -c http.schannelCheckRevoke=false -c http.sslVerify=false \
    ls-remote origin dev

  # 推送：比上面多一个 postBuffer，缺了会在发送阶段失败并报同一个证书错误
  env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    git -c http.schannelCheckRevoke=false -c http.sslVerify=false \
    -c http.postBuffer=524288000 \
    push origin dev
  ```

  症结是 Windows schannel 的 `CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`。⚠️ **它不稳定复现** —— 同一条命令有时成功有时报，**不要据单次失败就断定网络不通**（19:40 我就是这么误判的，写下「远端未核实」并拒绝再试，白等了 15 分钟）。⚠️ `ls-remote` 成功**不代表** `push` 会成功 —— 两者所需开关不同。⚠️ **只作用于单条命令，别写进 `.gitconfig`**：`sslVerify=false` 是安全降级。

- **`.git/refs/remotes/origin/` 会反复整个消失**（10-07 三次）。此时 `git rev-list origin/dev..HEAD` **静默返回空**，看着像「已同步」。**唯一的核验手段是 `git ls-remote`**。

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
pnpm test                                         # 44 组（41 纯函数/DB + 3 真模型；已知失败见 §二质量门禁）
CODEBUDDY_SAFE_DELETE_ENABLED=0 pnpm build        # 生产构建（开关只作用于本条命令）
pnpm start                                        # 另开受管后台任务，不要用 (cmd &)
node scripts/browser-acceptance.mjs               # 浏览器内端到端 A0–A8
pnpm test:report-details                          # 报告页明细 R0–R7（断言文本取自数据库真行）
pnpm test:mastery                                 # 掌握度卡 M0–M3（store hydrate 真的生效了）
```

**只有第 4 级能证明客户端真的能跑。** 曾发生 SSR 返回 200、HTML 齐全、`pnpm check` 全绿，但浏览器整页白屏的事故（zustand v5 派生 selector 引用不稳定 → React #185）。HTTP 层验证全是假绿灯。

**第 4 级要在 `pnpm start`（生产产物）上再跑一遍**，不能只跑 `pnpm dev`：dev 与生产的编译与预渲染路径不同，dev 过了不代表产物过了。
2026-09-26 实测：生产构建下报告页明细 8/8、掌握度卡 4/4、跨浏览器 11/11 —— 与 dev 下同分。

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

0. **~~`npm test` 有 1 个已知 fail：「讲解步骤身份层」~~（2026-10-04 已复核：该组通过，
   37/37 全绿）**。但条目背后的**架构事实仍在**：UI 的全部聊天走 `/api/chat`（刻意不落库），
   `/api/session/[id]/message` 这条会话化管线没有 UI 消费方（各模块 sessions 是 0 消息空壳）。
   身份层与概念页注入在 `/api/chat` 上以 `step` 为总开关（`resolveStepAgent` +
   `buildTeachingScript`）——**新增对话入口必须传 step**，否则导师跌回答疑口径（复刻模块
   曾因此答错自己的硬要求，`bce9f5b` 已修）。是否全面落库是平台级决策（见 HANDOFF 十节）。

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
8. **~~`api-auth.ts` 不是真鉴权~~（已关闭）** —— `src/lib/auth/index.ts` 提供了
   密码哈希（scrypt）+ JWT 签名验证（HS256，7 天有效期）；`src/lib/api-auth.ts`
   的 `resolveStudent` 支持两路认证：优先 JWT 令牌（`x-auth-token` 头），
   退回旧 `x-student-id` 头（已有接口兼容）。`/api/auth/register`、
   `/api/auth/login`、`/api/auth/change-password` 三个端点已开发完成，
   前端 `AuthGate` 组件拦截未登录用户。相关测试：`scripts/seed-auth-accounts.mjs`
   （播种内置账号）、`scripts/test-auth-quick.mjs`（快速验证脚本）。
9. **SSE 流式写入了三层缓冲，改动前必须理解边界** —— `session.ts` 的 SSE 翻译器
   有三层累积：① `tokenBuffer`（Map，按 messageId 合并，setTimeout(0) 触发
   `flushTokenBufferImpl`，一个 tick 内同 key 只刷一次）；② `thinking`
   （全局数组，`appendThinking` 按最后一条 open → close 的规则追或封口，
   不再按 step/agent 分段）；③ `thinkingSteps`（写在消息对象上，占位消息
   在首 token 前创建、flush 时原地 id 更新不新建）。`flushTokenBuffer`、
   `drainTokenBuffer` 和 `reset` 三个出口都必须清空 `tokenBuffer` map，
   否则测试间会互相污染。具体代码见 `session.ts` 文件头大块注释。

   ③ 的**封口时序**是本轮（10-07）修过的坑：`thinkingSteps` 是建消息那一刻
   从全局 thinking **拷进去的快照**，而全局 `closeThinking` 发生在之后 →
   快照里 `endedAt` 永远缺失 → 「进行中」徽标永久不消失（10/10 讲复现）。
   修法是 `settleStreamingMessages` 在 `completeTurn`/`failTurn`/`abortTurn`
   **三个收尾点**与消息数组一起封口，且传**同一时间戳**（避免时间线乱序）。
   别把这个函数删掉或只在其中一个出口调用。

10. **🟡 思维链泄漏系统内部口径（10/10 讲命中，机制性根因已定位）** —— **铁律 5 已修**（`c6686f3`：延伸到 thinking + 替换口径，开场节同步收紧）。⚠️ **B 核验（`scripts/verify-thinking-leak.ts` 抓 thinking 流）与 `--force` 重跑 `generate-lecture-cache.ts` 因 Ark 文本模型端点当下返回空内容受阻**，待 API 恢复后实跑；缓存讲稿仍是旧口径，在此之前别声称「已修完」——
    `teaching-chat.ts` 的铁律 5 只禁了「学生界面输出」列举的内部词（门禁 / 掌握度 /
    前置模块 / 编排层），**没有一条约束 thinking**，而铁律 4 明确告诉模型
    「学生可以看到你的推理」。于是模型在思维链里复述禁令本身，把这批词摊给���生 ——
    最露骨一处（platform-replica）：`铁律 5: Don't expose system internal mechanisms
(门禁, 掌握度, 前置模块, 编排层 are internal words).`
    已修法（提交 `c6686f3`）：铁律 5 显式延伸到 thinking，并给**替换口径**（该说什么，不只是禁止说什么）。
    ⚠️ 改结构节后必须 `--force` 重跑 `generate-lecture-cache.ts` —— **这一步因 Ark API 故障尚未执行**，缓存讲稿仍是旧口径。
11. **🟡 `ExplainColdStart` 是死代码（扇出独立核实成立，未修）** —— `page.tsx` 对
    `moduleId === "platform-replica"` 提前 return 到 `PlatformReplicaWorkspace`，
    而该组件唯一挂载点在 `module-workspace.tsx`；`[step]/page.tsx` 也 `redirect`
    且 `generateStaticParams` 把本模块整体过滤 → **两条路由都不可达**。
    连带：该组件另两条分支（ts-basics 路径选择、通用正文回退）在集合收窄后同样成死代码。
    影响：platform-replica 是主交付讲，学生实际看到的是替代产物（`explainReadability` 3.5，全场最低）。
12. **🟡 讲稿 / 概念页 / 示范代码是三个独立来源，内容不互相对齐（8/10 命中）** ——
    **渲染层已修**（`segmentByCode` 保留散文 + `<li>` 改 `<div>`，此前
    `observe-panel.tsx` 的 `if (block.type !== "code") return null` 把散文整块丢弃，
    且 li 在 div 里非法嵌套会让 HTML 解析器整条丢弃，**tsc/测试/SSR 状态码全绿**，
    只有第 4 级浏览器验收能抓到）；**内容层仍开着** —— 概念页承诺的机制结构
    在讲稿里零出现（`ai-safety` 四项全缺、`system-prompt` 五要素 vs 三维度互斥无映射、
    `agent-loop` 讲稿 Python 而示范卡 TypeScript）。产品内审计员的「内容一致性」
    检查就是守这条，改讲稿后重跑审计即可看到分数变化。
13. **⚠️ 本机 3000/3100 端口常年被残留进程占用** —— 启动前先探空闲端口
    （`netstat -ano | grep -q ":PORT "`），或用 `PORT=3311`。
    ⚠️ **改完组件必须重启服务再跑浏览器验收**，旧进程还在跑上一个构建，验它等于没验收。

## 九、不要做的事

- 不要把 `main` 当工作分支。
- **不要编造未实现的能力**：宁可留 `PlaceholderPanel` 明确写出「这块由哪个提交点交付」，也不塞假数据。
- 不要为「看起来完整」造兜底分数 —— 兜底必须标记 `usedFallback`，且文案写明「未计入掌握度」。
- 不要引 `dangerouslySetInnerHTML`（助手消息渲染靠「转义在先 + 白名单内联标记」方案）。
- 不要在 `src/lib/modules.ts` 之外再抄一份模块元数据表（会立刻产生第三份数据）。
- **不要去掉 SSE token 批量合并**（`session.ts` 的 `tokenBuffer`）：去掉后每个 token
  触发一次 React setState，30-80 次/秒重渲染会让对话彻底卡死。这不是「可选的优化」，
  是功能性门槛——数据流语义（SSE 逐帧）与渲染性能（React 批量）之间的唯一桥梁。
- **不要用 `git add -u`**：它会从索引重建工作区文件列表，本机文件系统不稳定时会导致
  git log 里随机丢失文件（症状：`git log` 看到提交但 `git show` 缺失 blob）。
  始终用 `git add <具体文件路径>`。
- **不要用「任何一格都不能是 0 分」这类断言验分数表**（2026-10-07 教训）——
  它把数据层**合法的 0 分**（某讲内容一致性 4/4 项缺失）当成渲染 bug，白排查一轮。
  判据要**拿数据源真值逐格对账**（null ↔ 「未检测」、有值 ↔ 对应数值）。
  同理别用 `cell.includes("0 / 100")` —— 子串匹配，`"100 / 100"` 会命中。
- **不要用「标题措辞是否一致」判内容对齐**（同上教训）—— 概念页叫「常见模式」、
  讲稿叫「三、怎么分工」，其实一致，首版判据 8/11 讲全误报。改查概念页的
  **可数机制承诺词**（「四层」「五类」「场景 A」）是否在讲稿出现。
- **不要给「不能做」的铁律只写禁令、不给替代口径**（同上教训）——
  `teaching-chat.ts` 铁律 5 禁了内部词却没说该说什么，模型在思维链里就把禁令
  本身复述给了学生（10/10 讲命中）。凡是要禁止的，同时给替换说法。
- **不要只给 `tsconfig.json` 的 `exclude` 加 gitignored 目录** —— `eslint.config.mjs`
  的 `globalIgnores` 是同一份清单，只改一处门禁会扫进产物目录（本轮报 23 个 error）。
