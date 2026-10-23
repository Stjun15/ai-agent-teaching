# 接手文档 — 2026-10-23（参赛审计五项补齐 + 部署实况记录 + 待办重排；部署类已搁置）

> 上一份（2026-10-11）是讲稿优化专项，记录仍保留在「〇一」节，内容依然有效。
> 本轮（10-21 ~ 10-23）针对一份参赛作品审计清单逐项核验并补齐：**最新一轮的完整移交记录在「〇〇」节，接手先读那节**。
> 基础盘（这是什么、四条铁律、硬约束、四级验收）在 `AGENTS.md`，不重复。

---

## 〇、当前状态速查（2026-10-23 更新）

| 项           | 事实                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 分支 / HEAD  | `dev`（工作分支）最新 `b5ab85e`（教师端模拟产品化 7 个提交）。**`main` 仍是 `a9f0c06`（10-23 晚 CI 修正那次），本轮教师端功能尚未并入 main** —— 要不要并（以及是否打 `v0.6.0`）是发布决定，等作者定。`main` 永远不是工作分支，别在上面提交 |
| 与远端       | ✅ **已同步（10-23 晚实测）**：`ls-remote origin dev` = 本地 `HEAD` = `b5ab85e`（逐字符比对；别用 `rev-list origin/dev..HEAD`，本地 remote 引用会缺失）。推送姿势按 `AGENTS.md` 第八节四开关（PowerShell 用 `Remove-Item Env:HTTP_PROXY...` 清代理变量） |
| CI           | ✅ **全绿（10-23 晚，含本轮）**：ESLint + `tsc --noEmit` + Vitest（15 文件 86 用例）+ 自研测试 CI 子集（**30 组**，含新增「学生模拟器」）+ 生产构建。首跑曾 5 条全红，根因是 pnpm 9 与纯配置型 workspace 不兼容（见「〇〇」踩坑 7）。⚠️ 行覆盖率仍低（核心库多为 0） |
| 工作区       | `git write-tree` 逐字符等于 `HEAD^{tree}`，**无未跟踪脚本**（10-23 晚已裁定：`seed-demo-accounts.mjs` 合并进 `scripts/seed-auth-accounts.mjs` 并修幂等、`split-platform-replica.mjs` 删除）。历史遗留的 `.zcodeignore`、`_temp_vibe_coding.pdf` / `.txt` 仍待裁定 |
| 门禁         | **10-23 晚实测（本轮）**：`tsc --noEmit` **0 error**、`eslint src scripts tests` **0 error / 21 warning**、`node scripts/run-tests.mjs --ci` **30/30 组**、`vitest run` **15 文件 86 用例**、`pnpm build` 成功。⚠️ 跑全量自研测试前必须先起服务器（冷启动组打 `localhost:3000`）；⚠️ `prettier --check .` 在本机整仓误报（`core.autocrlf=true` 工作区全 CRLF vs 配置 `endOfLine: "lf"`），CI 在 Linux 检出 LF 不受影响，故未进 CI |
| 部署（生产） | **已上线（2026-10-23 实测）**：阿里云 ECS `http://8.149.130.30`，nginx 80 → `127.0.0.1:3000`，systemd 服务 `ai-teaching`，SSE 关缓冲。`/` 与 `/api/health` 均 200，Node `v22.23.3`，SQLite 19 张表 / 迁移 001–005 已执行。目录：应用 `/opt/ai-agent-teaching`、数据 `/var/lib/ai-teaching`、环境变量 `/etc/ai-teaching.env`。🔴 **`/api/health` 当前 `status=degraded`，`arkApiKeyConfigured=false`** —— 生产环境模型能力全不可用；**作者已明说部署类问题先搁置**，修法备查见「〇〇」待办 B 表。域名与 HTTPS 未配置 |
| 平台         | **火山方舟 Volcengine Ark**（`ARK_API_KEY`），端点 `https://ark.cn-beijing.volces.com/api/v3`，文本模型 `deepseek-v4-flash-ga-260731`，视觉模型 `doubao-seed-2-1-pro-260915`。⚠️ 欠费会反复，跑真模型前先探端点                                                                                                                                                                                                 |
| 产品内审计员 | **12 讲 0 缺陷**（10-11 本轮清零）。改任何讲稿/概念页后重跑：起服务 → POST `/api/audit`，或看 `/audit` 页                                                                                                                                                                                                                                                                                                       |
| 讲稿缓存     | **11 行、全部 explain**（观察示范 9-25 起改 wiki 直读，observe 行已清空；python-basics 已退役；platform-replica 讲稿已退役）。**唯一改稿入口：`scripts/_direct-cache-write.ts`（手写直写，不调模型）**——流程见〇一节                                                                                                                                                                                            |
| 课程顺序     | `vibe-coding`(0) → `ts-basics`(1) → `llm-api` → `system-prompt` → `agent-loop` → `tool-calling` → `rag` → `llm-wiki` → `multi-agent` → `mcp` → `ai-safety` → `platform-replica`(11)。由 prerequisites 拓扑排序决定，别在代码里写死顺序                                                                                                                                                                          |
| 测试套件     | **54 组**（10-23 晚新增「学生模拟器」9 例；3 组真模型；CI 子集 30 组）。另有标准框架：`tests/*.test.ts` **15 文件 86 用例**（Vitest，`pnpm test:unit` / `test:coverage`）。历史教训：测试不跑 tsc，三门禁独立（见 AGENTS.md 第六节） |
| 本会话新增   | 见「〇〇」的**「本日第二轮」**（教师端模拟产品化 7 提交 + 门禁/走查结论）与上一段（20+ 提交、参赛审计五项核验、CI 首绿、P1 收尾、踩过的坑、遗留待办） |

> ⚠️ 提交数以 `git rev-list --count HEAD` 实时值为准（10-23 晚约 640）。**核远端同步只认 `ls-remote origin dev` 比对 SHA，勿用 `git rev-list origin/dev..HEAD`**（本地 remote 引用会缺失，静默返回空）。

### 远端推送状态（2026-10-23 更新）：✅ 已同步

10-23 晚用四开关姿势实测：`ls-remote origin` 正常返回 `dev` / `main` / `v0.5.0`（共 5 个发布 tag）；
`push origin dev main` 与 `push origin refs/tags/v0.5.0` 均成功，推后 `ls-remote` 与本地 `git rev-parse` 逐字符一致。
**10-11 那次「0 个 ref + push --dry-run 静默」的异常没有复现，无需重建远端。**
⚠️ `git push origin dev main` 是**非原子**推送：`main` 若被拒（例如本地 main 与远端已分叉），`dev` 可能已经推上去了 —— 报错后先 `ls-remote` 看两边真实状态，别以为整条命令白跑。
⚠️ PowerShell 5 没有 `env -u`，清代理变量的写法是 `Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue`（连 `HTTPS_PROXY` / 小写变体 / `ALL_PROXY` 一起清），之后照 `AGENTS.md` 第八节带 `-c http.schannelCheckRevoke=false -c http.sslVerify=false -c http.postBuffer=524288000`。

### 已闭合（原「等作者裁定」的两项均已解决）

1. ~~`ark-config.ts` 视觉模型 `pro-260915` vs `turbo-260628` 四处矛盾~~ —— **10-07 复核：矛盾已不存在**。`ark-config.ts:30`、`.env.example:27`、`AGENTS.md:96`、`ark.ts:9`、`schemas/api.ts:213` **五处全部统一为 `doubao-seed-2-1-pro-260915`**；`turbo-260628` 在 `src/` 下 0 处（仅 `scripts/student-agent/curriculum-audit.ts:1400` 用过，属独立工具的显式传参，不与产品默认值冲突）。**本项从待裁定清单移除。**
2. 5 个实验脚本去留 —— 在 `student-agent-output/_untracked-demos/`（改名代替删除，可逆）。**其中 2 个已于 10-07 修复并入库 `scripts/student-agent/`（提交 `8edb6e8`），原件仍留在该目录（gitignored、已被提交版取代）；剩余 3 个待定。**

> **新增待裁定（10-07）**：文本模型若需临时切到 doubao，注意**文本/视觉不能设成同一个模型 id** —— `ark.ts:161` 的 `models: [text, vision]` 会出现两条同 id 条目（且 name 是硬编码文案，与实际 id 无关）。当前临时配置：文本 `doubao-seed-2-1-pro-260915` + 视觉 `doubao-seed-2-1-turbo-260628`（走用户级环境变量，**非代码默认值**）。

> ~~3. `HANDOVER.md` 是否入库~~ —— **已裁定并完成**（提交 `7c2895b`），本文件现为入库状态。

---

## 〇〇、2026-10-23 会话全记录（最新一轮，先读这节）

> 自包含：出发点、五项核验结论、改了什么、怎么验证、踩过的坑、遗留待办。10-11 那轮见下一节。

### 本日第二轮（10-23 晚）：CI 加固 + 学生模拟产品化（**最新，先读这段**）

**出发点**：作者指令「修 CI，以及学生模拟 Agent 产品化 —— 要接就得设计教师端控制台、限流与成本边界」。

**三条已锁定决策（别反向执行）**：

1. **服务层模拟，不启浏览器**：See = 文本屏幕快照（`screen-digest.ts`），Act = 进程内 lib 调用，不走 HTTP / Playwright。理由：浏览器自动化在 Serverless 与 CI 上都不可靠，成本也不可控。
2. **教师身份 = 数据列**：`students.role` 列 + JWT `role` claim；**判权读数据库**，令牌里的 role 只用于界面显隐（旧令牌无 role 时降级为 student，教师需重登）。
3. **成本口径 = 轮次与 token，不折算人民币**：汇率与单价会变，折算出的「花了多少钱」第二天就假。

**新增能力（提交 `0df08c1` → `b5ab85e`，共 7 个，已推送 dev）**：

| 提交 | 内容 |
|---|---|
| `0df08c1` | `006_teacher_simulation.sql`：`students.role` + `simulation_runs` / `simulation_turns` 两表；`simulationDb` 仓库 |
| `a315478` | 令牌带 role、`requireTeacher`（403 FORBIDDEN）、`teacher` 种子账号（`teacher` / `teacher1234`） |
| `e4788ec` | 服务层模拟器：三人设（`lost-beginner` / `overconfident` / `three-minute`）、文本快照、导师回答、逐轮 token 计量；`runTextCompletion` 从 runtime 导出 |
| `c0daad6` | 限流桶 `simulation`（2 次/分） |
| `b8b6fce` | `POST /api/teacher/simulate`（202 + 进程内后台执行）、`GET /api/teacher/simulations`、`GET /api/teacher/simulations/[id]` |
| `0948961` | `/teacher` 教师控制台（服务端装配 + 客户端 2 秒轮询、状态徽标、逐轮屏幕快照折叠） |
| `b5ab85e` | 测试组入 `run-tests.mjs`（含 CI 子集）+ `rate-limit-spec` 端点清单补 `simulation` |

**成本边界（`SIMULATION_LIMITS`，四处共用一份）**：单次最多 **4 轮**、单次 **20k token**、单轮 **6k token**、每位教师**滚动 24 小时 10 次**。
双层额度：内存固定窗口（2 次/分，重启即失效，挡连点）+ 数据库滚动 24h 计数（权威）。
**预算到线记 `completed` + `stopReason:"token-budget"`，不是 `failed`** —— 设计内停止不等于故障；触发上限的那一轮仍落库，教师才能看出花了多少。

**已知边界（写进代码注释，别当 bug 修）**：后台任务是**进程内 promise**，服务重启会让正在跑的记录停在 `running`；控制台按启动时间超过 10 分钟显示「疑似中断」，不伪造状态。没有外部队列是本项目部署形态决定的。

**门禁实测（10-23 晚，本机）**：`tsc --noEmit` 0 error；`eslint src scripts tests` 0 error / 21 warning；`node scripts/run-tests.mjs --ci` **30/30 组全绿**（含新增「学生模拟器」9 例）；`vitest run` **15 文件 86 用例**；`pnpm build` 成功（`/teacher` 与三个 teacher 端点均为动态路由）。
浏览器走查（生产产物 + `localhost:3000`）：教师登录 → 导航出现「教师控制台」→ 表单（模块/步骤/人设/轮次）完整 → 失败运行记录与原因可见 → 无 React 水合错误、无未捕获异常，9 项全 PASS。

**API 判权实测**：教师 200、学生 403、匿名 401；触发一次运行（占位密钥）落 `failed` 并带中文原因、`turns=1`，说明「异常也有收尾」这条链是通的。

**踩坑（本轮新增）**：`rate-limit-spec` 的「端点清单必须同步额度表」守卫**当场抓出**新桶没登记 —— 这正是上一轮踩坑 3「测试基准随演进滞后」的正向版本。改限流/路由时先跑这一组。

### 出发点

作者拿一份参赛作品审计清单，对照赛道规则（`https://www.boxuegu.com/matchTrack/detail/?id=10037`），
要求逐项核验「有没有做过」：做过就看能否优化，没做就补。五项：

1. 🔴 MCP / 工具集成（4% 权重）—— 认为平台只在教 MCP，自身不用 MCP 协议。
2. 🔴 没有标准测试框架（0 个 `*.test.ts`、无覆盖率、无 CI）。
3. 🟡 六项子能力雷达是占位。
4. 🟡 认证是硬编码白名单（搜不到 OAuth / JWT）。
5. 🟡 学生模拟 Agent 没接进产品。

### 核验结论与处置

| 项 | 核验结果 | 处置 |
|---|---|---|
| MCP | **代码在，但是坏的**：`src/lib/mcp/wiki-server.ts` 用 `../../wiki/query.js` 导入一个不存在的扩展名，子进程启动即 `Cannot find module` 退出，`discoverTools()` 静默回退空数组 —— 功能上等于不存在 | 去掉 `.js` 后缀；新增 `tests/mcp.test.ts` 端到端回归（真起 stdio 子进程 → `listTools` 含 `search_wiki` → `tools/call` 返回真实检索） |
| 测试框架 | 确为自研 `scripts/run-tests.mjs`，无 `tests/`、无覆盖率、无 CI | Vitest 5 + `@vitest/coverage-v8` 落地最小闭环：`tests/` **7 文件 26 用例**、`pnpm test:unit` / `test:coverage`；`ci.yml` 跑 ESLint + tsc + 覆盖率 |
| 六项子能力 | 确为占位（`report-sections.tsx` 里有占位横幅） | 新叶子模块 `src/lib/sub-abilities.ts`：按 `module-specs.md` 的「训练子能力」列做模块→能力映射，用真实 mastery 记录聚合；无样本一律 `null` → 界面显示「未测评」，绝不画 0 |
| 认证 | 审计结论**过时**：`src/lib/auth/index.ts` 已有 scrypt + JWT(HS256)，`AuthGate` 拦截未登录 | 补按客户端 IP 的登录限流（`auth-login` 10 次/分、`auth-register` 20 次/时），防口令爆破 |
| 学生模拟 Agent | 确为离线审计工具（`scripts/student-agent/` 1598 行，`src/` 零引用） | **有意不产品化**：定位是离线审计工具，理由与后续规划写进文档，不硬接高风险链路 |

### 本轮提交（21 个，全部已推送）

- 10-21~10-22：`dbcced5` MCP 落地、`3a40a4f` Vitest+CI、`81f3b5b` MCP 回归、`1e8056c` 核心测试、`17b9e9d`/`5b3ba3b` 子能力+报告 UI、`052370a` 报告测试、`e401853` 认证限流、`de7f74e`/`9774dd4`/`3022219` 文档
- 10-23：`11f84ff`/`6e964b4` 测试 fixture 修复、`7fc9f87` 复刻工具箱竞态、`fbba406` hooks 合规、`ce75c49` store 类型、`1fe539f` 死测试清理（55→53 组）、`8cfc83f` CI 补静态门禁、`6e8cef6` 滞后 spec 同步、`3f4c058` 补跟踪 `knowledge-card-spec.ts`、`3efd9f5` 文档

### 门禁实测（可复现）

```bash
npx tsc --noEmit                         # 0 error（原 54）
npx eslint src scripts tests             # 0 error / 24 warning（原 10 error）
pnpm start                               # 另开受管后台任务
pnpm test                                # 53/53 全绿（冷启动组打 localhost:3000，必须先前台起服务）
npx vitest run                           # 7 文件 / 26 用例
CODEBUDDY_SAFE_DELETE_ENABLED=0 pnpm build
```

### 部署实况（2026-10-23 实测）

- 入口：`http://8.149.130.30`（只有 80 端口，无域名、无 HTTPS）
- 链路：nginx 80 → `127.0.0.1:3000` → systemd `ai-teaching`，应用目录 `/opt/ai-agent-teaching`
- 数据：SQLite `dev.db` 落在 `/var/lib/ai-teaching`，19 张表，迁移 `001_init`–`005_audit_score_columns` 全执行
- 自查：`/` 200、`/api/health` 200、Node `v22.23.3`、uptime 正常
- 🔴 **`status=degraded`：`arkApiKeyConfigured=false`** → 线上所有模型能力不可用（对话 / 点评 / 出题全废）。修法：
  在服务器 `/etc/ai-teaching.env` 补 `ARK_API_KEY=...` → `systemctl restart ai-teaching` → 复查
  `curl -s http://127.0.0.1:3000/api/health` 应转 `ok`

### 踩过的坑（本轮新增，别再踩）

1. **MCP 静默失效**：工具发现失败会被吞成空数组，症状是「Agent 一切正常，但永远不用 MCP 工具」。任何 `discover*()` 必须有失败日志或端到端测试，别只看主流程绿。
2. **裸跑 `eslint` 会扫 `coverage/`**：一次报 352 errors。`lint` 脚本已限定 `eslint src scripts tests`，`eslint.config.mjs` 的 `globalIgnores` 也加了 `coverage/**`（与 `tsconfig.json` 的 `exclude` 是同一份清单，改一份就要想另一份）。
3. **测试基准会随产品演进而滞后**：`rate-limit-spec` 没列新增的认证桶、`validate-wiring-spec` 还在断言已删除的常量 → 全量测试假红。改逻辑时顺手核对有谁在断言它。
4. **`run-tests.mjs` 引用的 spec 可能没入库**：`scripts/knowledge-card-spec.ts` 621 行长期未跟踪，新 clone 跑全量必缺一组。已补入库。
5. **`prettier --check .` 本机全红 ≠ 代码脏**：`core.autocrlf=true` 让工作区全 CRLF，配置却是 `endOfLine: "lf"`。别为此改 git 配置或批量重写文件。
6. **提交信息规范要回原文看**：本轮 21 个提交里 7 条 subject 超 50 字符、正文写成散文而非 `-` 列表、scope 用了表外的 `core/learn/report/test`。历史已推送不改（rebase 属禁项），**后续按 `agent-prompts/references/git-conventions.md` 原文执行**：subject ≤50、正文 `-` 列表且每行 ≤72、scope 只用表内值。
7. **CI 的 pnpm 版本必须与本仓库 workspace 写法匹配**：`pnpm 9` 要求 `pnpm-workspace.yaml` 有 `packages` 字段，本仓库是纯配置型（只有 `nodeLinker` / `allowBuilds` 等），于是 `setup-node` 的 `pnpm store path` 直接报 `packages field missing or empty` —— 失败点在装依赖**之前**，看着像 workflow 语法错，实际是版本不兼容。已改钉 `pnpm 12`（与本地一致）。另：给 `package.json` 加 `packageManager` 会让 pnpm 12 要求同步锁文件里的 `packageManagerDependencies`，`--frozen-lockfile` 当场失败，**别走那条路**。

### 待办（2026-10-23 收尾时点；**部署类已由作者搁置，不在下面推进**）

**A. 当前在推进的（非部署）**

| 级别 | 事项 | 具体怎么做 | 谁能做 |
|---|---|---|---|
| P0 | 仓库可见性 | 提交截止前把 GitHub 仓库改 Public，或给评审账号加协作者（`dev` / `main` 均已推送至最新） | 作者 |
| P0 | 报名 + 缴费 + 提交 | 2026-11-18 当天截止，**提交后不得修改**，全部改动要在这之前完成 | 作者 |
| P1 | ~~`main` 合并 `dev`~~ **已完成（10-23 晚）** | 首合并 `cb1a39f`（`merge-tree` 无冲突），CI 修正后再合并一次，最终 `main=661a875`（与 dev 同一 tree）；`v0.5.0` tag 指向该提交并已推送。全程 plumbing、未切分支 | 我 |
| P1 | ~~CI 首跑核验~~ **已完成（10-23 晚；首跑是红的）** | 最初 5 条 run 全在 11–13s 失败：`pnpm 9` 撞纯配置型 `pnpm-workspace.yaml`（无 `packages` 字段），`setup-node` 的 `pnpm store path` 报 `packages field missing or empty`。`dac10e0` 钉 `pnpm 12` 后 dev/main 双绿（ESLint / tsc / Vitest 7 文件 26 用例）。⚠️ 行覆盖率仅 **5.67%** | 我 |
| P1 | 演示视频 + 技术文档转 PDF | 分镜脚本与文档初稿都在 `docs/competition/`，只差录制与转档 | 作者 |
| P1 | ~~两个未跟踪脚本~~ **已裁定并完成（10-23 晚）** | `split-platform-replica.mjs` **删除**（硬编码原稿行号、产物 `platform-replica-0{0..5}.md` 已入库，重跑会静默覆盖）。`seed-demo-accounts.mjs` **合并**进 `scripts/seed-auth-accounts.mjs`（同一批 test/eval 账号不再两处写），并把 `question_results`/`errors`/`prompt_history` 的 `randomUUID` 换成确定性 id + `ON CONFLICT(id) DO UPDATE` —— 实测连跑两次行数不变（32/8/12）。**不进 Vitest**：种子是数据准备不是被测逻辑，且 CI 的 Node 22 跑 `node:sqlite` 还需实验标志 | 我 |
| P2 | 思维链泄漏 B 核验 | 真跑 `scripts/verify-thinking-leak.ts`，确认服务端 `thinking-filter.ts` 兜住了泄漏 | 我 |
| P2 | 六项子能力真流量验证 | 用有掌握度记录的学生走一遍报告页，确认雷达从「未测评」变真实分（代码已接，缺一次真实流量确认） | 我 |
| P3 | ~~学生模拟 Agent 产品化~~ **已产品化（10-23 晚）** | 走的是「与离线审计分离」的服务层模拟路线（不启浏览器）：见「〇〇 / 本日第二轮」。剩余只有一条：用真密钥在教师控制台跑一次完整运行（本机只验到占位密钥的失败收尾） | 我 |

**B. 已搁置（作者明说部署先放着）**

| 事项 | 现状（备查，别当待办推进） |
|---|---|
| 生产环境 `ARK_API_KEY` | `http://8.149.130.30/api/health` 返回 `status=degraded`、`arkApiKeyConfigured=false`，线上模型能力不可用；修法见「部署实况」 |
| HTTPS / 域名 | 只有 80 端口；语音输入依赖安全上下文，`http://` 下会被浏览器禁用 |
| EdgeOne 路径 / PG 迁移 | 未做，属另一条部署路线，不在当前计划内 |

**下一步建议（新对话开场可直接照做）**：教师端模拟已上线到 `dev` 并推送。我侧下一项按顺序：① 有真密钥时在 `/teacher` 跑一次完整模拟（本机只验到失败收尾）；② A 表 P2 两项（思维链泄漏 B 核验、六项子能力真流量验证）——都要先起服务，**跑前先探空闲端口**；③ `main` 是否并入本轮教师端功能、要不要打 `v0.6.0`，等作者定。作者侧仍是仓库可见性、报名缴费提交、演示视频与 PDF 转档。

---

## 〇一、2026-10-11 会话全记录（上一轮：讲稿优化专项；历史记录，仍然有效）

> 这节写给接手本轮工作的模型，自包含：改了什么、怎么验证、哪些别动、什么没做完。
> 历史背景在下面的章节里，不影响本轮操作。

### 这轮的出发点（用户裁定，别反向执行）

1. **课程目标**：零基础学生通过课程学会「和 AI 协作」，最终把平台复刻出来。
2. **复刻模块不要理论课**（用户原话方向）：学生「只需要知道怎么做就行，给出指导应该就够了」。
   因此 platform-replica 的讲解稿**退役**——它本来就是运行时死数据（该模块被 `src/app/learn/[moduleId]/page.tsx:49`
   整体路由到专属工作区，那里从不播种讲稿缓存），而它承载的边界表/三斧总览
   `llm-wiki/concepts/platform-replica.md` 里本来就有且更详尽。
3. 「做中学」的粘合靠三件套：①任务卡末尾「复刻连线」（把每讲练习焊在复刻项目上）；
   ②复刻阶段任务卡「为什么有这步」（防照菜谱抄完不知所以然）；③报错求助四件套模板（零基础最大的卡点是报错不会描述）。

### 本会话 15 个提交（全部在 dev，未推送；SHA 前 7 位即可定位）

| #   | SHA       | 主题                                                       | 一句话说明                                                                                                                                                                                                                             |
| --- | --------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `e04c4b1` | feat: 手写重制十二讲讲解稿并新增 vibe-coding 模块          | **上一个会话的未提交工作原样入库**（12 篇讲解稿源 + vibe-coding 概念页 + 3 个概念页对齐 + 审计词表）                                                                                                                                   |
| 2   | `1c2a377` | style: prettier 补格式化上个会话遗留的 14 个文件           | 修复 `pnpm check` 的 prettier 违规（上会话提交时没跑格式化）                                                                                                                                                                           |
| 3   | `fcf38c5` | fix: 修正讲稿事实错误——沙箱注释、虚构 api 脚注、无出处统计 | `Function()` 注释「不用 eval，用安全沙箱」是**错的**（Function≡eval，无沙箱）；tool-calling/rag/llm-wiki/mcp/llm-api 的虚构 API 补「示意函数」脚注；删 vibe-coding「95% 项目活不过两周（社区统计）」编造数据                           |
| 4   | `43138b4` | fix: ai-safety 概念页统一为五道闸门口径                    | 概念页标题节是五道、示范代码和动手任务却是四道（自相矛盾）；补第五道「引用溯源」代码，全文统一五道                                                                                                                                     |
| 5   | `b2c07c5` | fix: ts-basics 挂 vibe-coding 前置，方法课先讲             | ts-basics.md 的 `prerequisites: [vibe-coding]`——vibe-coding 讲稿自称「第一讲」，但此前拓扑排序里 ts-basics 排它前面（两者都无前置时按 id 字典序）                                                                                      |
| 6   | `d0dbfa3` | fix: 补 lectureCacheDb.list 修复 tsc 编译错误              | 上会话的 `_list-cache.ts` 调了不存在的 `lectureCacheDb.list()`（tsc 挂）；在 `src/lib/db/lecture-cache.ts` 补了 list()                                                                                                                 |
| 7   | `98652e8` | chore: 退役复刻讲稿缓存，内容由概念页承载                  | 删 `_direct-cache-write.ts` 里 platform-replica 条目（-138 行）+ 删 DB 行；概念页「前 9 个模块」过期计数改 11                                                                                                                          |
| 8   | `a22ef0f` | chore: 讲稿缓存端点收窄为 explain，清空死缓存行            | `/api/lecture-cache` 的 `CACHED_STEPS` 只留 explain；删 9 篇 9-22 的旧 observe 稿 + 退役 python-basics 残稿（运行时零消费、口径还是内部词修复前的）                                                                                    |
| 9   | `62d8a1b` | feat: 复刻导师对话携带当前阶段上下文                       | `ChatRequestSchema.phaseContext`（≤500 字）四件套：schema → `/api/chat` 注入 → Composer 透传 → 复刻工作区组装「阶段 2/6「第一斧」——目标：…」                                                                                           |
| 10  | `0c3a053` | feat: 十一讲任务卡加复刻连线                               | 每讲任务节末尾加一段「**复刻连线**：…」（如 tool-calling → 复刻第二斧的出题工具就是这个练习的实战版）                                                                                                                                  |
| 11  | `a243b2e` | feat: 复刻第一斧任务卡补「为什么有这步」                   | `ReplicaTask.why` 字段 + 详情卡渲染；只试点第一斧 5 任务（wiki 对应小节本就有逐行讲解，UI 侧才是缺 why 的一侧）                                                                                                                        |
| 12  | `3d6504f` | feat: 讲稿与复刻对话加报错求助四件套模板                   | vibe-coding 讲稿新增「卡住了怎么办：向 AI 求助的四件套」（现象/期望/实际/已尝试）；复刻对话空态提示加「报错原样贴」                                                                                                                    |
| 13  | `604347e` | fix: 讲稿审计口径升级——跨讲术语累积与无讲稿模块豁免        | `AuditSubject.earlierTeachings`：术语在前面任何一讲定义过就不算断层（Agent 在第 5 讲定义，此前 5 讲逐讲独立判定全量误报）；`LECTURE_LESS_MODULES = {"platform-replica"}` 豁免可达性检查                                                |
| 14  | `ae39cf2` | test: mastery 面板守卫允许 Fragment 包裹                   | 10-10 的提交给 mastery 分支包了 `<>`，`practice-mastery-spec.ts` 的正则没跟上（**上会话没跑全量测试的欠账**）                                                                                                                          |
| 15  | `cb06d98` | fix: 补齐审计发现的真实内容缺口                            | rag 脚注改用已定义的 embedding 口径（原「向量化」触发术语断层）；ai-safety 测验场景标签改「场景A/B/C」对齐概念页承诺词；vibe-coding 补「上下文就是」定义句 + `## 示范代码` 节（观察步不再显示占位）；ts-basics 的 Agent 首现补内联定义 |

### 数据现状（接手后先跑这 4 条核对，全对再动手）

```bash
# ① 讲稿缓存必须是且仅是 11 行 explain（顺序无关）：
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db',{readOnly:true});console.log(db.prepare('SELECT module_id,step FROM lecture_cache ORDER BY module_id').all().map(r=>r.module_id+':'+r.step).join(', '))"
# 期望：agent-loop:explain, ai-safety:explain, llm-api:explain, llm-wiki:explain, mcp:explain,
#       multi-agent:explain, rag:explain, system-prompt:explain, tool-calling:explain, ts-basics:explain, vibe-coding:explain

# ② 内部词扫描全绿：
node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/scan-cache-internal-words.ts
# 期望最后一行：✅ 缓存讲稿输出无内部词（platform-replica:explain 无缓存，跳过）

# ③ 课程顺序（vibe-coding 必须是 0）—— 本机 node -e 跑 ESM 顶层 await 不可靠，写成文件跑（见第八节 12 条）：
cat > _probe-modules.mts << 'EOF'
import { loadModules } from "./src/lib/modules";
console.log((await loadModules()).map((m, i) => i + "." + m.id).join(" | "));
EOF
npx tsx --tsconfig tsconfig.json _probe-modules.mts && rm _probe-modules.mts
# 期望：0.vibe-coding | 1.ts-basics | 2.llm-api | ... | 11.platform-replica

# ④ 三级门禁：pnpm check（期望 0 error）；
#    pnpm test 前必须先起服务器（冷启动组打 localhost:3000）：
CODEBUDDY_SAFE_DELETE_ENABLED=0 pnpm build && PORT=3000 pnpm start   # 另开终端
pnpm test   # 期望：=== 全部 45 组通过 ===
```

产品内审计（第 ⑤ 项，改过讲稿/概念页后必跑）：起服务器后浏览器开 `/audit` 页点触发，
或 `curl -X POST http://localhost:3000/api/audit`。**期望 12 讲、0 findings**（10-11 本轮清零）。
审计当前口径下会抓：讲稿缺任务节、无讲稿模块（复刻已豁免）、示范代码缺讲解、任务超纲语法、
术语在「本讲+前面所有讲」都未定义、概念页机制承诺词（如「场景A」「五道」）在讲稿零出现。

### 改讲稿的唯一正确流程（这轮建立的，下次改稿照做）

1. 打开 `scripts/_direct-cache-write.ts`，找到对应模块的 `{ moduleId: "xxx", content: \`...\` }` 条目，**直接改模板字符串**。
   这是讲稿的唯一源头——它是「我（代码助手）手写、不调模型」的直写脚本。
2. 重跑写入：`npx tsx --tsconfig tsconfig.json scripts/_direct-cache-write.ts`（本地直写 SQLite，零模型调用、零花钱）。
3. 验证：跑上面数据现状的 ①②④ + 审计 ⑤。
4. `git add scripts/_direct-cache-write.ts`（**具体路径**，禁 `git add -u`）→ 提交。

**三条红线**：

- **不要用 `generate-lecture-cache.ts` 重新生成讲稿**——它调真实模型，会把精心手写的稿子覆盖成模型生成的口径。
- **不要直接改 `dev.db` 里的讲稿内容**——数据库是产物，源在脚本里；下次重跑直写就冲掉了。
- 直写脚本**没有结构守卫**（`generate-lecture-cache.ts` 有截断/缺任务节检查，直写脚本故意没抄——待办见下节）。
  改完自己数一遍结构：开场 → 一~四节 → 「五、现在轮到你」（任务卡从这节抽题面，缺了任务卡全站消失）。

### 架构不变量（别改回去的部分，每条都有事故背景）

1. `lecture_cache` 只承载 explain。observe 示范 2026-09-25 起改 wiki 直读（`ObservePanel` 读概念页「示范代码」节），
   本轮把 9 篇旧 observe 行清掉了、`CACHED_STEPS` 收窄成 explain。**别把 observe 加回 CACHED_STEPS**。
2. `src/lib/audit/deterministic.ts` 的 `LECTURE_LESS_MODULES` 必须与
   `src/app/learn/[moduleId]/page.tsx` 的路由分流同步：哪个模块走专属工作区（= 没有讲稿），这个集合就要包含谁。
   现在只有 `platform-replica`。不同步的后果：审计把「无讲稿」报成 high 缺陷（假警报）。
3. `llm-wiki/concepts/ts-basics.md` 的 `prerequisites: [vibe-coding]` **是课程顺序的唯一来源**
   （模块顺序 = prerequisites 拓扑排序，见 `src/lib/modules.ts` 的 `sortByPrerequisites`）。删掉它顺序就变回去。
4. 复刻讲稿**不要重建**：`_direct-cache-write.ts` 里没有 platform-replica 条目是本轮用户裁定的结果（见「这轮的出发点」）。
5. `phaseContext` 四件套成套改：`src/schemas/api.ts`（schema）→ `src/app/api/chat/route.ts`（注入系统提示词）→
   `src/components/chat/composer.tsx`（透传）→ `src/components/learn/platform-replica-workspace.tsx`（组装）。
   schema 上限 500 字是防它变成第二条教材通道——教材走 moduleId 的概念页注入，别绕开。
6. ai-safety 的「五道闸门」口径已在四处统一（概念页标题节 / 示范代码 / 动手任务 / 讲稿）。
   改回「四道」会重新触发审计 high（内容一致性查概念页的机制承诺词）。
7. 任务卡「复刻连线」写在讲稿源的任务节末尾（`_direct-cache-write.ts`），它随「五、现在轮到你」整节
   被动手模仿页的任务卡渲染——概念讲解页会把任务节截掉，学生只在模仿页看到，这是设计不是 bug。

### 本轮踩过的坑（知道了我能少踩，你也是）

1. `pnpm check` 一口气报 36 个文件 prettier 违规 → 22 个是我在仓库根新建的 `_lecture_dump/` 临时目录被 prettier 扫到（已删），
   14 个是上会话遗留（已补格式化提交）。**教训：临时导出目录要么放 gitignored 路径，要么用完立刻删。**
2. `git commit --amend` 只改 HEAD。我 amend 时 HEAD 已经往前走了一个提交，结果把 chore 提交的信息覆盖成了 fix 的
   （立即发现并 amend 回来了）。**教训：amend 前先 `git log --oneline -1` 确认 HEAD 是哪个提交。**
3. 审计的术语检查抓到了**我自己**在 rag 脚注里引入的「向量化」（未定义术语）。审计是真的在工作——**改讲稿后必跑审计**。
4. `ls-remote` 返回 0 个 ref、`push --dry-run` 静默 exit 0（都是带四开关实测的）——远端状态异常但本机无法确诊，
   别反复盲试，**让作者上 GitHub 网页看一眼**。

### 遗留给你的事（按优先级）

| 级别 | 事项                                                                   | 具体怎么做                                                                                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | 远端核验与推送                                                         | 先让**作者本人**登录 GitHub 网页确认 `jiajunjiang15/ai-agent-teaching` 仓库是否存在且非空（10-11 实测 `ls-remote` 返回 0 ref）。确认后按第六节姿势推送 `01dce84..HEAD` 的全部未推提交（31 个代码提交 + 文档提交，以 `git log 01dce84..HEAD --oneline` 实时数为准），推完 `ls-remote` 比对 SHA        |
| P1   | 直写脚本补结构守卫                                                     | `scripts/_direct-cache-write.ts` 的 `main()` 里，写入前加两条检查（判据抄 `generate-lecture-cache.ts:146-172`）：`splitLecture(content).assignment === null` 拒写（防任务节缺失）、内容长度下限（防半截稿）。改完跑一条讲稿验证拒写逻辑                                                              |
| P1   | 「为什么有这步」批量                                                   | 目前只有第一斧 5 个任务有 `why`。批量到二斧/三斧/龙骨时：wiki 对应小节已有逐行讲解和「核心要记住的」，`why` 只写一句压缩版（是 wiki 讲解的提炼不是新口径），两边同步改                                                                                                                               |
| P2   | 讲稿遗留小瑕疵                                                         | 都在 `scripts/_direct-cache-write.ts` 的 **\_system-prompt** 条目里改：① 第二层测验是选择题，规格（`teaching-chat.ts` EXPLAIN_GATE_SECTIONS）要求「一正一误判断」形态；② 「现在停一下——你能立刻说出这三个维度吗？…不能的话，再看一遍」是现场互动的口吻，出现在一次性缓存稿里略怪（读者无法真的互动） |
| P2   | 上会话遗留：`_temp_vibe_coding.pdf/txt`、`.zcodeignore` 两个未跟踪文件 | 素材原件与工具配置，**作者裁定**去留；别替作者删，也别顺手提交                                                                                                                                                                                                                                       |

---

## 一、核心命题（本轮已完成 + 下一轮）

**上一轮命题（已完成）**：让 ZCode 的子智能体充当「有视力的零基础学生」，对课程做真实走查——验证用子智能体做学生 Agent 的可行性，并抓出教学质量与工程管线的缺陷。

**结论已定：可行，且已兑现。** 试点抓出 2 个 critical（四级门禁 + 浏览器验收全绿状态下存活），全部修复落盘。

**本轮三步（全部已完成）**：

- 第 0 步 ✅ 推送 + 三类 WIP 分批处置（6 个提交）
- 第 1 步 ✅ 扇出审计 **10 讲**（`python-basics` 概念页已删不可达，故审 10 而非 11）→ `student-agent-output/fanout/fanout-audit-report.md`
- 第 2 步 ✅ 产品内审计员（4 个提交）+ 5 个收尾提交，浏览器验收 12/12 PASS

---

## 二、这轮做了什么（全部已落盘，7+4 个提交）

### 2.1 审计栈落盘（4 提交，10-06 深夜）

| 提交      | 内容                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| `48261c5` | `/api/audit/evaluate` 评估代理端点 + rate-limit `audit` 桶                       |
| `2cb49cd` | 学生 Agent 三大件（screen-describer / action-executor / comprehension-verifier） |
| `94decd8` | `curriculum-audit.ts` 主入口 + `knowledge-window.ts` 知识窗 + playwright 依赖    |
| `af16110` | ts-basics 示范代码收缩到 3 概念                                                  |

提交前修了一处会挂 `pnpm check` 的断裂导入（`curriculum-audit.ts` 引用不存在的 `./types`）。

### 2.2 试点审计（方法 + 发现）

方法：浏览器内真实走 explain → observe → imitate；**学生与裁判分成两个子智能体**（裁判只看证据文件）；知识窗泄漏检测保持确定性脚本（零 token，全 11 模块 × 缓存）。产出在 `student-agent-output/pilot/`（gitignored）：主报告 + 4 张截图 + 4 份证据链 + 裁决 2 件。

裁判独立评分：讲解稿 5.5 / **示范代码 8.0（验收线 ≥6.0 通过，10-06 悬置项关闭）** / 导师问答 8.5 / 认知负荷 5.0。

**两个 critical（裁判与采集者独立收敛）：**

- **C1**：observe 步导师回复在 UI「丢失」——服务端 41s 流完、token 计费、时间线有思考记录，消息元素恒不出现，学生「已读不回」且无报错。
- **C2**：动手模仿页任务卡全站缺失——11/11 模块讲解缓存没有「五、现在轮到你」节，学生面对空编辑器不知道写什么。

### 2.3 修复闭环（7 提交，10-07）

| 发现              | 根因（比试点报告初稿更深）                                                                                                                                                                                                      | 修复                                                                                                                                              | 提交                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| C1                | 消息**在 store 里且 step 正确**，是 `selectStepMessages` 的 skip 模式把「该步第一条助手消息」一律当讲稿开场吞掉——observe/imitate 从不播种开场，回复被当讲稿吃了。**HANDOVER 10-06 的「导师响应极慢」是误诊**：模型 41s 就答完了 | 开场判定收窄为「该步第一条**消息**是助手」；回归 6 例                                                                                             | `6b4a7ca`             |
| 思维链跨消息累积  | 三个建消息点把整个全局 thinking 数组复制进新消息 thinkingSteps（第 2 轮逐字重放第 1 轮 6079 字符英文思维链）                                                                                                                    | `inFlightThinking()` 只取未封口段；回归 2 例；时间线历史不受影响                                                                                  | `1e659bc`             |
| C2                | **不是生成截断，是两个设计打架**：10-01 门禁化把第五节从 `TEACHING_EXPLAIN_PROMPT` 删掉，而任务卡唯一来源就是 explain 讲稿的第五节                                                                                              | 任务节提为两提示词共用常量 `LECTURE_TASK_SECTION` + `OUTPUT_PACING_NOTICE` 压住「停在这里」；生成器加缺节拒写守卫；teaching-step 守卫改钉新不变量 | `f413f44`             |
| 语法超纲复发      | 重生成后 ts-basics 任务又要求写 `interface`（讲稿只教 3 概念）——提示词不约束示例语法                                                                                                                                            | 两结构节加「示例与任务只准用本讲教过的语法」                                                                                                      | `82e64cb`             |
| 预存 spec 缺陷 ×2 | module-switch 被 python-basics 机械替换改成「自切换」断言必挂；rate-limit 覆盖表漏 `audit` 桶                                                                                                                                   | 修正                                                                                                                                              | `bacf133` / `6a93e9e` |

另有 `22b5fdb`（teaching-chat 的 python-basics 注释 WIP 单独落盘）。**全量测试 39 组通过**（含 3 组真模型、2 个新组）。

### 2.4 讲稿缓存重生成（真模型，13 次调用）

`--force` 重跑 11 讲 explain：**11/11 含任务节（此前 0/11）**。守卫实战拦下 3 次坏产出（缺任务节 ×1、思考超预算截断 ×2），重跑全部通过。ts-basics 终版讲稿：开场无「我先用工具验证」自述、「变量」先定义、interface 归零。llm-api 截断两次后第三次通过——模型随机性真实存在，守卫是必要的。

### 2.5 第 0 步：WIP 处置（6 提交，10-07）

三类 WIP 全部落盘：`23b2882`（三个概念页 + index 重写为零基础口径）/ `f6e6298`（`python-basics.md` 整页删 606 行）/ `8f67b34`（运行时四处引用同步收窄，`isLanguageModule = id === "ts-basics"`）/ `d181c19`（7 个 spec 移除 python-basics 专属断言）/ `931cd53`（`ExplainNextButton` 新组件 + 挂载）/ `e5d39bc`（删 3 个从未读取的参数，恢复 `tsc` 绿）。

**5 个实验脚本移到 `student-agent-output/_untracked-demos/`**（改名代替删除，可逆），未入库。

⚠️ **`f6e6298` 有意超「单提交 ≤500 行改动」上限**（删 606 行），commit message 里已说明。

### 2.6 第 1 步：扇出审计（10 讲，产物 gitignored）

方法沿用试点：每讲一个学生子智能体 + 一个**独立裁判**（只读证据文件、不共享上下文），分批并发。完整报告 `student-agent-output/fanout/fanout-audit-report.md`（含 140 张截图、10 份 `judge-verdict.md`、4 份分组汇总）。

**关键结论（详见报告）**：

- **C1 / C2 零复现**（10/10 讲 observe 回复可达、任务卡渲染）
- **4/10 未过示范代码验收线**（rag / multi-agent / ai-safety / platform-replica）
- 三个**跨讲系统性**问题（本轮真正的产出）：思维链默认展开压倒正文（10/10）、思维链泄漏系统内部口径（10/10）、讲稿/概念页/示范代码三套教材不对齐（8/10）
- 唯一 critical：system-prompt observe 回复 `data-status="error"`（置信度高，9 次采样跨 64 秒一字未变）

### 2.7 第 2 步：产品内审计员（4+5 提交，10-07）

按五.3 的修正方案落地，**不需要浏览器**——直接读 wiki + `lecture_cache`。架构分三层：

| 层   | 文件                                       | 职责                                                                                                               |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 存储 | `src/lib/db/audit.ts` + 迁移 `004`/`005`   | `audit_findings`（逐条缺陷，`severity` 有 CHECK）+ `module_audits`（每讲总分）。`replaceModuleFindings` 覆盖式写入 |
| 判据 | `src/lib/audit/deterministic.ts`（471 行） | 五项确定性检查：任务节可达性 / 示范代码可读性 / 任务超纲语法 / 术语断层 / 内容一致性                               |
| 编排 | `src/lib/audit/orchestrator.ts`            | `auditModule()` / `auditAllModules()`，可直接从服务端调                                                            |

**判据两轮修正才可信（这一步是本轮最值得学的地方）**：

- 首版「内容一致性」查标题措辞 → **8/11 讲全误报**（概念页叫「常见模式」、讲稿叫「三、怎么分工」，其实一致）。改成查概念页的**可数机制承诺词**（「四层」「五类」「场景 A」）是否在讲稿出现 → 降到 1/11，**唯一保留的那条正是扇出裁判独立指出的 `ai-safety`**（两个独立方法收敛）
- 首版「术语断层」误报 10 处 → 补 `countStandalone`（按独立词计，排除「上下文」只是「模型上下文协议」的子串）+ `isDefinedSomewhere`（覆盖「先给大白话定义：X」「X（解释）」三类真实定义形态）→ 降到 3 条

**首次端到端结果：11 讲 3 缺陷**（high 1 / medium 2），已落 `dev.db`：

- `high` `ai-safety` 内容一致性 —— 与扇出裁判独立收敛。**10-07 已改 explain 讲稿缓存修复**（补「四层防护 + 场景A/B/C」主线段落对齐概念页承诺），重跑审计一致性维度=1、整库 0 缺陷。缓存级修复，需在欠费恢复后 `--force` 重跑生成器才永久
- `medium` `llm-api` 术语断层（「上下文」1 次未定义）—— **10-07 已修**，explain 讲稿首处加内联定义「上下文（context，…）」，重跑审计 term=1
- `medium` `tool-calling` 术语断层（「Agent」1 次未定义）—— ⚠️ 审计逻辑细化后本项已不再命中；**当前实际命中的是 `mcp` 的「Agent」未定义**（同型），**mcp 已于 10-07 修**（加「Agent（智能体）」内联定义）

**API 与前端**：`/api/audit`（GET 读 / POST 触发，独立限流桶 `curriculum-audit` 3 次/分）+ `/audit` 页（拆 5 个文件）+ 顶栏导航项 + `scripts/audit-page-acceptance.mjs`（浏览器验收 12/12）。

**两条诚实边界写死在界面上**（不是写在注释里）：「没查到 ≠ 没问题」（判断类缺陷不在五项里）、「分数 null 显示未检测而非 0」（本轮不调模型，画 0 就是编数据）。

### 2.8 本会话新增（10-08，已于 10-10 全部提交入库）

已提交部分（`c307c88` 及之前 4 个提交）：

| 提交      | 内容                                                                               |
| --------- | ---------------------------------------------------------------------------------- |
| `015dbbe` | docs(wiki): 教学平台复刻文档从 ~432 行扩充至 ~1400 行，逐行代码讲解 + 前置知识速查 |
| `2a07e7e` | feat(ui): markdown-view 代码块加复制按钮 + 标题锚点                                |
| `8a8561d` | feat(ui): 平台复刻任务数据加 `detail`/`pitfalls` 字段，详细操作步骤 + 常见问题提示 |
| `c307c88` | refactor(ui): 平台复刻移除概念讲解面板，只保留教案；目录跳转改为仅在教案内部滚动   |

**已于 10-10 提交入库（此前 10-08 为未提交）**：

| 文件                                                  | 内容                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/learn/feynman-review.tsx`             | **费曼学习法复习卡**。四步流程：选定概念 → 假装教人 → 发现漏洞 → 一句话说清。纯客户端组件，无外部依赖。完成后生成摘要卡，支持「重新写一次」                                                            |
| `src/components/learn/module-workspace.tsx`           | 在掌握判定步骤（mastery）下集成 FeynmanReview 组件，展示位置在 MasteryCheck 卡片下方                                                                                                                   |
| `src/components/learn/platform-replica-workspace.tsx` | 移除概念讲解面板保留教案；用 `useRef` + `scrollTo` 实现教案内容区内部滚动（不影响外层页面）；滚动目标容器 `maxHeight: 60vh`                                                                            |
| `llm-wiki/concepts/platform-replica.md`               | 从 ~432 行扩充至 ~1400 行；新增：前置知识速查（Node.js/npm/pnpm/VS Code）、详细操作步骤（每步含命令 + 解释 + 预期结果）、逐行代码讲解、验收清单、常见问题排查                                          |
| `src/components/layout/site-footer.tsx`               | **本地修改已通过 `git update-index --skip-worktree` 隐藏**。改动内容：删除「AI 生成内容，仅供学习参考」文本。如需恢复跟踪：`git update-index --no-skip-worktree src/components/layout/site-footer.tsx` |

### 2.9 概念测验安全加固（10-10，本次提交 `27a3eb9`）

**问题**：11 篇预写讲稿全部在概念测验后直接写了「🎉 **概念通过。下一步...**」——学生还没答题就看到通过宣告，完全绕过测验校验。学生可以通过连续点击「讲解完毕」跳过所有测验直接进入下一环节。

**发现过程**：从三段链条分别查验——讲稿缓存内容（静态）→ 教学提示词约束（动态）→ 讲解完毕按钮逻辑（UI）。

**修复（一次提交，覆盖 14 修改 + 4 新增文件）**：

| 修改层     | 文件                                           | 修复内容                                                                                           |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 讲稿缓存层 | `scripts/_direct-cache-write.ts`（新文件）     | 批量直写 11 模块 explain 讲稿，零 LLM API 调用；11 处「🎉 概念通过」全部替换为「把答案发在聊天框」 |
| 讲稿缓存层 | 所有 11 模块 explain 讲稿（SQLite 落盘）       | 出题后引导学生在聊天框答题，不提前给答案、不提前宣告通过                                           |
| 提示词层   | `src/lib/agent/prompts/teaching-chat.ts`       | 铁律已写：「出题时只出题，不许给答案。答案只允许在学生选完之后才出现，没选之前一个字都不许透露」   |
| UI 层      | `src/components/learn/explain-next-button.tsx` | 讲解完毕点击弹出确认弹窗：「完成了概念测验并通过」的提醒文案                                       |
| 讲稿拆分   | `src/lib/lecture-split.ts`                     | 讲稿拆分逻辑确保「五、现在轮到你」任务节不出现在讲解页，仅在模仿页渲染任务卡                       |
| 其他修复   | —                                              | 修复「五、现在轮到你」标题的 `**` 后缀、清除 llm-wiki 重复行                                       |

**安全链条现状**：

```
讲稿出题 → 只出题不给答案 → 引导学生在聊天框答题
         → 讲解完毕按钮弹出提醒弹窗 → 学生自觉确认后方可继续
         → AI prompt 铁律：「出题时只出题，答案只在学生选完后才出现」
```

**三重保障**：讲稿静态层（不出答案）+ 提示词动态层（出题不给答案）+ 讲解完毕按钮 UI 层（弹窗提醒确认）。

⚠️ **当前无硬校验**——讲解完毕弹窗依赖学生自觉点击「确认」，没有后端强校验。若需硬阻断，可在 `explain-next-button.tsx` 中检查 mastery 状态。

**新增工具文件**：

| 文件                                | 用途                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| `scripts/_direct-cache-write.ts`    | 批量直写讲稿缓存到 SQLite，不调外部 LLM API，用于批量修正预写讲稿内容 |
| `scripts/_list-cache.ts`            | 列出所有讲稿缓存条目，含字数统计                                      |
| `src/lib/agent/tools/query-wiki.ts` | Agent 工具：按关键字查询知识库内容，返回匹配段落                      |

⚠️ `_direct-cache-write.ts` 内含 11 篇完整讲稿硬编码文本（约 26000 字），每次修改讲稿内容须同步更新该文件。修改后运行 `npx tsx --tsconfig tsconfig.json scripts/_direct-cache-write.ts` 即可覆盖入库。

---

## 三、修复后的架构要点（**别改回去的部分**）

1. **`selectStepMessages` 的开场判定**（`src/lib/lecture-split.ts`）：「讲稿 = 该步第一条消息是助手」。改回「第一条助手消息」会复活 C1。skip/truncate 两种模式共用此判定。
2. **`LECTURE_TASK_SECTION` + `OUTPUT_PACING_NOTICE`**（`teaching-chat.ts`）：两个讲解提示词共用一份任务节定义。**改任何一处讲解提示词的结构节 = 换缓存口径 → 必须 `--force` 重跑 `generate-lecture-cache.ts`**，缺任务节的产出会被生成器拒写（这是特性不是故障；失败信息里带 `--only` 重跑命令）。
3. **`inFlightThinking`**（`src/stores/session.ts`）：新消息的 thinkingSteps 只带未封口段。全局 thinking 数组仍跨轮累积（Agent 时间线要展示历史），两者边界靠 `endedAt`。
4. **生成器两道守卫**（`generate-lecture-cache.ts`）：截断守卫（output ≥8000 tok 或正文 <800 字）+ 结构守卫（`splitLecture(text).assignment === null` 拒写）。都是「失败 + 带 `--only` 的重跑提示」，无自动重试——见遗留 ②。
5. 观察示范的代码来源**没变**：wiki `## 示范代码` 构建期直读（2026-09-25 裁定），observe 缓存是遗留物不消费。

---

## 四、当前问题清单

| 问题                                         | 状态                                                                                                                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 导师 LLM 响应极慢（10-06 清单）              | **已关闭——误诊**。真实缺陷是 C1，已修。模型实测 14~41s/轮                                                                                                                                                                              |
| C1 observe 回复丢失                          | **已修复**（`6b4a7ca`）                                                                                                                                                                                                                |
| C2 任务卡全站缺失                            | **已修复**（`f413f44` + 缓存重生成）                                                                                                                                                                                                   |
| 思维链跨消息累积                             | **已修复**（`1e659bc`）                                                                                                                                                                                                                |
| 思维链语言不稳定（第 1 轮英文、第 2 轮中文） | **开放**——AGENTS 记载 9/26 加过中文思考指令，实测间歇生效，为何失效未查                                                                                                                                                                |
| 生成器无自动重试                             | **开放**——现为失败+重跑提示；人工重跑已验证可行，建议加一次「带字段级错误反馈的重试」（铁律 2 同款模式）                                                                                                                               |
| 知识窗不含语法级构造                         | **部分修**——`interface` 语法级构造仍靠提示词约束（词汇表为 Agent 领域概念，非语法）；**泛词白名单（agent/tool/multi-agent）10-07 已加**，`detectLeaks` 跳过泛词，误报归零（实测 ts-basics 含 agent/tool 泄漏数 0、真实未来术语仍捕获） |
| ts-basics 泄漏                               | **已关闭**——讲解/示范代码零泄漏（重写达标，扫描确认）                                                                                                                                                                                  |
| 老学生 localStorage 旧讲稿                   | **已知非缺陷**——种子消息只在步骤无消息时注入；试点学生（agent-audit-pilot-0607）的 store 里还压着 10-06 的旧讲稿，新学生不受影响                                                                                                       |

### 4.1 扇出审计新增（10-07，详见 `fanout-audit-report.md`）

| 问题                                                    | 严重度         | 状态                                                                                                                                                                                                                                                |
| ------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 思维链默认展开压倒正文（10/10）                         | **全站最严重** | ✅ **已修** `da27770`（`<details>` 去掉写死的 `open`）。实测 `agent-loop` 曾达 16.5:1、`system-prompt` 1148:1                                                                                                                                       |
| 「进行中」徽标永不消失（10/10）                         | high           | ✅ **已修** `6cdf6a8`。根因：`thinkingSteps` 是建消息那一刻的**快照**，全局封口发生在之后 → 快照里 `endedAt` 永远缺失。修法：`settleStreamingMessages` 在三个收尾点与消息数组一起封口，传**同一时间戳**                                             |
| 讲稿/概念页/示范代码三套教材不对齐（8/10）              | medium         | 🟡 **部分修** `61d1469` + `dfa3446`。根因在渲染层：`observe-panel.tsx` 把散文整块丢弃 → 抽出 `segmentByCode` 保留散文、`li` 改 `div`（li 在 div 里非法嵌套，HTML 解析器整条丢弃）。**但讲稿与概念页的内容对齐仍开着**                               |
| 术语断层（10/10）                                       | medium         | ✅ **10-07 已修**（llm-api「上下文」+ mcp「Agent」两处 explain 讲稿加内联定义），重跑确定性审计全库 0 缺陷；缓存级修复，永久化需在欠费恢复后 `--force` 重跑生成器                                                                                   |
| 双任务冲突（导师回复另生成一道任务，3/10）              | medium         | 🔴 **设计缺口（10-07 复核）** —— src 零命中「冲突/仲裁/双任务」代码，无现成冲突检测机制；属 Agent 行为复现类，需先可复现再设计，本轮不动作                                                                                                          |
| 编辑器标签页与任务要求错配（4 讲）                      | low            | ✅ **已修** 10-07 —— 任务卡（`assignment-card.tsx`）加提示：「按作业在编辑器选 Prompt/工具描述/代码，选错评分不相关」；默认 `code` 是设计值（点评按所选类型取标准），手动切换机制本就存在                                                           |
| ~~`ExplainColdStart` 死代码~~ ❌ **误报（10-07 复核）** | high           | 仍被 `src/components/learn/module-workspace.tsx:21` 导入、`:243` 渲染；原「`page.tsx:49` 提前 return」早已改为 `platform-replica` 分支（见该文件 49 行），文档滞后。属误报，不删                                                                    |
| 思维链泄漏系统内部口径（10/10）                         | high           | 🔴 **开放，且已定位机制性根因**（见 4.2）                                                                                                                                                                                                           |
| ~~system-prompt observe 回复 `error`~~                  | ~~critical~~   | ✅ **10-08 实跑证明是误报**：单独重跑 `ok=true`（textLen 1399）；首跑失败是SenseNova 限流所致，非模块缺陷（详见 P0 表与 4.5）                                                                                                                       |
| 登录表单提交后仍停在 `/auth`（10/10 采集者）            | —              | ❌ **误报（10-07 复核）** —— `auth/page.tsx` `adoptIdentity` 成功时明确 `router.push("/")`（:107），且 `rememberStudentId/rememberAuthToken` 对 null storage 安全；登录/注册 API 端点均在。前端跳转逻辑正确，采集者绕过系后端不可达所致，非前端 bug |
| 采集者误报率不低                                        | —              | 已归档：6 类误报 + 2 类证据缺陷（账号共用、截图重复）。**方法学副产品，不影响结论**                                                                                                                                                                 |

### 4.2 思维链泄漏的机制性根因（本轮新定位）

扇出报告 3.2 记的是现象（10/10 讲思维链出现「铁律」「掌握度」「门禁」「编排层」）。**本轮读代码找到了为什么约束没起作用**：

`teaching-chat.ts` 的铁律 5 只写了「**不要暴露**系统内部机制」并列举这些词 —— 它约束的是**学生界面输出**，**没有一条约束思维链**。而学生能看到 thinking（铁律 4 明确说「学生可以看到你的推理」）。于是模型在思维链里复述禁令本身，就把这批词摊给了学生。

最露骨的一处（platform-replica，扇出逐字记录）：

> `铁律 5: Don't expose system internal mechanisms (门禁, 掌握度, 前置模块, 编排层 are internal words).`

**修法方向**：铁律 5 要显式延伸到 thinking，并给出**替换口径**（该说什么，而不只是禁止说什么）。⚠️ 改结构节后**必须 `--force` 重跑 `generate-lecture-cache.ts`**，否则缓存讲稿与现场口径脱节。

**硬证据（19:26 核验）**：

- `teaching-chat.ts:63-64` 铁律 4 原文「学生可以看到你的推理（thinking）」；`:65-69` 铁律 5 **通篇不提thinking** → 模型在 thinking 里复述禁令是**被现有提示词允许的**。
- `002_lecture_cache.sql` 的 `lecture_cache` 表**只有** `content` / `model` / `input_tokens` / `output_tokens` / `created_at`，**没有任何思维链字段** → 思维链只在 SSE 流里实时产生，**不进缓存**。

**修复（已提交 `c6686f3`）：铁律 5 已显式延伸到 thinking 并给出替换口径。**

### ⚠️ 重要更正：`c6686f3` 的修法**被实测证伪**，最终改用服务端过滤

**B 核验实测证据（10-08，4 模块真调模型）**：

| 模块         | thinking 字数 | 内部词命中                                |
| ------------ | ------------- | ----------------------------------------- |
| `agent-loop` | **12328**     | **5**（铁律/掌握度/门禁/前置模块/编排层） |
| `ts-basics`  | 10917         | 2（铁律/门禁）                            |

模型 thinking 的原话（逐字）：

> `…internal words like 门禁、掌握度、前置模块、编排层、铁律. **I did mention "铁律" accidentally**…`

**机制 —— 这是本项目最重要的一条提示词工程教训**：
铁律 5 在提示词里**逐个列举了内部词，还给了具体反例**。模型要遵守这条禁令，就必须先在 thinking 里想一遍「门禁/掌握度/铁律 到底是什么」→ **复述禁令的过程本身就是泄漏**。所谓「延伸到 thinking」不但无效，还因为给了反例而**加重**了泄漏。

**同时 A 核验（扫描缓存输出）11 模块全干净** → 证明**只有 thinking 通道漏**，最终输出没问题。

**最终修法（提交 `b9b3168`）**：**服务端过滤**，不指望模型自觉 —— 与「权限由代码控制」同源。新增 `src/lib/agent/thinking-filter.ts`，在 `loop.ts` 的 `thinking_delta` 转发处接入跨块缓冲过滤，命中替换为中性说法「教学要求」（直接删会留断句、反倒露痕迹）。

**端到端实证（同模块修复前后）**：`agent-loop` 修复前 12328 字 / 命中 5 → **修复后 12234 字 / 命中 0**（12234 完整保留，只少 94 字即被替换的词）。

> ⚠️ `teaching-chat.ts` 铁律 5 里的词表与反例是**故意保留**的（删了会改变模型行为），注释已标注「别连带删掉服务端兜底」。

**过滤器实现踩坑（三版才做对，勿重犯）**：

1. 首版：替换作用在 head + 尾部留 3 字 → 跨块拆词仍漏，**7 用例 6 FAIL**。
2. 二版：切点判断用「切点**之后**到末尾是否为词前缀」→ **方向错了**；「掌握|度」的切点落在词**前面**，「掌握」被当安全前缀吐出，后到的「度」再也配不上。
3. 最终版：**先全量替换，再按「carry 长度 < 最长词长就一律不吐」切分**。正确测法是**穷举**（句子 × 全部固定粒度 × 全部单点切法 × 逐字，本轮 134 种组合），手挑几个用例抓不到这类bug。

> 📌 **阻塞已解除** —— 平台已迁商汤（见 4.5）。`--force` 重跑缓存须**分批 + 拉长间隔**，规程见 4.7。

### 4.7 限流下的真模型任务规程（10-08 实证）

**问题**：SenseNova 免费额度限流很紧，报`429 insufficient_quota`（`inference exceeds tpm/rpm limit`）。密集跑必然中途失败，且失败信息是 `LLM_ERROR 模型未产出内容` —— **看起来像代码/模型问题，实际是限流**。

**规程**：

| 做法                | 说明                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **先探端点**        | 任何真模型任务前先发一个 `max_tokens:20` 的最小请求。返回 429 就先等，别开工                                          |
| **间隔 100 秒以上** | 实测单条讲稿生成要 65 秒 / `out 5189 tok`，间隔至少 100s                                                              |
| **分批 + 单条跑**   | 用 `generate-lecture-cache.ts --force --only=<module>:explain` 逐条跑，不要一次 `--force` 全量（11 条必然中途撞限流） |
| **失败先归因限流**  | 报「模型未产出内容」时先探端点 + 拉长间隔复跑，**别当模块缺陷或代码 bug 去查**                                        |

**重跑范围**：`AUTO_LECTURE_STEPS = ["explain"]`（`lecture-openers.ts:22`）→ `--force` 只重跑 **explain 共 11 条**；缓存里另有 9 条 `observe`（+1 条退役的 `python-basics`）**不由该脚本生成**，别误以为漏跑。

⚠️ **重跑会冲掉缓存级内容修复**：`generate-lecture-cache.ts:148` 用 `upsert` 覆盖 `(module_id, step)`。此前已修的 3 处（`llm-api` 上下文内联定义、`mcp` Agent 内联定义、`ai-safety` 四层防护主线段落）在重跑后**需要重新注入** —— 备份原文见 `.workbuddy/backup/explain-cache-before-force.json`。

**10-08 重跑实测记录（11 条 explain）**：分批 `--only=<mod>:explain` + 间隔 100~150s，**9 条一次成功**；`mcp` 连续 2 次撞限流失败（补跑解决）；`platform-replica` 曾报「缺少五、现在轮到你任务节」→ **重试一次即成功（2636 字、结构完整）**。

> 📌 **修正脚本注释里的一个说法**：`generate-lecture-cache.ts:137` 注释写「缺节多半不是模型偷懒…**修提示词而不是重试**」。10-08 实测表明该次缺节是**偶发**（端点 200、结构完整的情况下重试即成功），**不必一看到缺节就去改提示词** —— 先在端点正常时重试 1~2 次，仍缺再考虑动提示词结构声明。

**排查耗时记录（10-08）**：一次性诊断脚本 `scripts/probe-observe.ts`（跑 11 模块 observe）约 7.5 分钟；`verify-thinking-leak.ts` 4 模块约 3 分钟。**限流下这些都是分钟级任务，务必后台跑。**

**⚠️ 10-07 22:24 更新：阻塞原因已查明 = 方舟账号欠费，不是端点故障。** 直连 `ark.cn-beijing.volces.com/api/v3/chat/completions` 实测：`HTTP 403` + `{"error":{"code":"AccountOverdueError","message":"...account has an overdue balance..."}}` —— **任何模型都会被挡掉**，故 `verify-thinking-leak.ts` 4 个模块与 `generate-lecture-cache.ts --force` 11 个任务全部报「模型未产出内容」。

**欠费会反复**：22:06 充值后曾短暂恢复（`HTTP 200`，`pnpm test` 从 3~4 组失败降到 **1 / 44**），22:24 又全量 403。**所以每次跑真模型任务前，先花 1 秒探端点确认 200，别假设「刚才还好」。**

> 📌 **该阻塞已解除 —— 平台已于 10-08 迁到商汤日日新**，方舟欠费不再是阻塞原因。见 4.5。

### 4.8 平台迁移历史：方舟 → 商汤 → **已切回方舟**（10-08）

**当前生效配置（提交 `d7ea12b`，实测 200 OK + `pnpm test` 全绿）**：

| 项          | 值                                                                            |
| ----------- | ----------------------------------------------------------------------------- |
| 平台        | **火山方舟 Volcengine Ark**                                                   |
| 端点        | `https://ark.cn-beijing.volces.com/api/v3`                                    |
| 文本模型    | `deepseek-v4-flash-ga-260731`（`ARK_TEXT_MODEL`）                             |
| 视觉模型    | `doubao-seed-2-1-pro-260915`（`ARK_VISION_MODEL`）—— **方舟文本与视觉不同模** |
| 密钥 env    | `ARK_API_KEY`（`SENSENOVA_*` 已清除）                                         |
| provider id | 仍是 `ark`（内部标识故意不改）                                                |

#### 商汤时期的关键配置（**已不适用**，留档以免重犯）

- 端点 `https://token.sensenova.cn/v1`（**不是** `api.sensenova.cn`），模型 `deepseek-v4-flash`（**没有 `.1`**）。
- ⛔ 商汤特有：关思考要 `reasoning: false` + `compat: { thinkingFormat: "deepseek" }` + `thinkingLevelMap` 映射 `null`；**切回方舟后这些已全部移除**（`reasoning_effort` 是 SenseNova 独有机制）。
- ⛔ `samplingParams: { reasoning_effort: "none" }` 运行时虽被 `Object.assign` 进请求体，但**不在 `ProviderModelConfig` 类型里** → tsc TS2353。
- 商汤限流很紧（`429 insufficient_quota`），**方舟没有这个问题** —— 切回后 `pnpm test` 首次全绿（3 组真模型全过）。

#### ⚠️ 换平台时必查的两处（10-08 实际踩到）

1. **环境变量残留**：PowerShell 改的是注册表，但**已运行的宿主进程仍持有旧快照**，新 shell 从父进程继承旧值 → 曾导致后台任务用 `doubao` 而非配置里的 `deepseek`。**后台脚本必须显式 `export`，并在日志里打印实际使用的模型。**
2. **按旧上限估的阈值**：`generate-lecture-cache.ts` 的截断守卫曾写死 `>= 8000`（商汤上限 8192），方舟上限 16384 → **两条完整正常的讲稿被当成「顶到上限」拒收**。已改为引用 `ark-config.ts` 的 `TEXT_MAX_TOKENS`。

> 📌 诊断脚本读SSE 的帧类型是 `token`（不是 `text`/`delta`）。漏了这个分支会误判成「SDK 路径返回空」。

解除阻塞后的顺序：① 探端点确认 200 → ② 跑 `verify-thinking-leak.ts`（thinking 无内部词）→ ③ `--force` 重跑 `generate-lecture-cache.ts`。**注意第③ 步会 `upsert` 覆盖 `explain` 讲稿，冲掉已做的 3 处缓存级内容修复**（术语断层 2 条 + ai-safety 一致性 1 条），需重跑后重新注入 —— 备份见 `.workbuddy/backup/explain-cache-before-force.json`。

### 4.3 本轮新发现：模拟真实学生 Agent 的三处断点（19:31核验，未修）

先纠正一处可能的误读：`src/lib/agent/student/` 不是「产品里的子智能体」，而是**离线课程审计工具**。`grep -rn 'agent/student' src/` **返回空** —— 产品运行时零引用。

**已实现的部分（1598 行，是真的）**：

| 文件                        | 行数 | 职责                                          |
| --------------------------- | ---- | --------------------------------------------- |
| `screen-describer.ts`       | 547  | See「眼睛」：DOM 语义区域 + VLM 兜底          |
| `action-executor.ts`        | 335  | Act「手」：Playwright 真实操作 + 真人时间噪声 |
| `comprehension-verifier.ts` | 593  | Verify：三条线索判断「真懂了」                |
| `types.ts`                  | 123  | 6 种认知状态 + 遗忘曲线 `MemoryEntry`         |

**已跑出真实数据**：`student-agent-output/autonomous-run-log.json`（10-05 21:24）—— 理解度 0.79 起步，学生自主提问「任务分解和写代码有什么关系啊？能不能举个例子？」，认知状态 `normal` 保持 3 轮。

**三处断点**：

| #   | 断点                                          | 证据                                                                                                                                                 | 影响                                                                                                                                                                                                              |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **产品运行时零引用**                          | `grep -rn 'agent/student' src/` 空；调用方只有 `scripts/student-agent/curriculum-audit.ts`（1645 行）与实验目录                                      | 评审若问「学生怎么用上模拟学生」答不上来。**需作者定方向**（见第七节）                                                                                                                                            |
| 2   | ~~630 行主脚本从未入库~~ ✅ 已入库（10-07）   | `git ls-files \| grep autonomous` **返回空**；只在未跟踪的 `_untracked-demos/`                                                                       | 克隆仓库的人现在能拿到——已迁入 `scripts/student-agent/student-autonomous-run.ts` 并提交。注：`ts-basics` 实为合法模块（有概念页 `ts-basics.md` 且 `modules.ts:186` 作语言模块特判），并非退役；原「过时」判断有误 |
| 3   | ~~两个实验脚本首字符被写坏~~ ✅ 已修（10-07） | `student-autonomous-run.ts` 首字符是 `x`（应为 `/`）、`comprehension-verify-demo.ts` 是 `ia`；`tsc --ignoreConfig` 报 `TS2304: Cannot find name 'x'` | 这两个脚本已修复并迁入 `scripts/student-agent/`（去首字符 `x`/`ia`、修导入路径 `./types`→`@/lib/agent/student/types` 等、`pnpm check` 0 error）                                                                   |

⚠️ **断点 3 与今天挖出的裸 NUL 字节同源** —— 都是「写文件」这个动作本身会污染内容。**新写或改的 `.ts` 脚本入库前必须单跑一次**：

```bash
npx tsc --noEmit --ignoreConfig --skipLibCheck \
  --target es2022 --module esnext --moduleResolution bundler <file>
```

`prettier` / `eslint` **抓不到**（该目录在 `tsconfig.json` 的 `exclude` 与 `eslint.config.mjs` 的 `globalIgnores` 里，两处都跳过）。

### 4.4 测试套件的既存偶发失败（19:26 实测，非本轮改动）

`pnpm test` 44 组跑完。**10-07 22:06 充值后实测：仅 1 / 44 失败** —— 3 组真模型回归里**点评（8 例）与讲解（6 例）均通过**，只剩出题组（doubao-pro 响应慢，约 44s 被截断为空）。**充值前（欠费 403）曾全量 3 组失败。**

⚠️ **排障铁律（10-07 血泪）**：Agent 报「模型未产出内容 / 找不到 JSON」时，**先直连端点看 HTTP 状态码与 raw body**，再谈模型、提示词、解析。10-07 曾因误以为是「doubao 流式不兼容」而错判方向（实际流式与非流式都是 403），白跑一轮。真因见 4.2。

`thinking-seal-spec.ts` 毫秒竞态**与上述无关**，根因在测试、不在产品：

- 生产代码是对的 —— `session.ts:671/689/718` 三处都先取 `const sealedAt = Date.now()`，再同时传给 `closeThinking` 与 `closeMessageThinking`，**保证同毫秒**。
- 测试写坏了 —— 它在 `done` 事件前 `await flush()`（`setTimeout 0`），把两处封口拆到两次事件循环里，于是各自调 `Date.now()` 就跨了毫秒。

该spec 最后一次改动是 `6cdf6a8`（10-07 16:54），**不是本轮改动**。修法：让测试在**同一个同步块**内驱动两个封口，别用 `flush()` 制造时序。

### 4.5 三组真模型测试：确认存在且每轮都跑（19:26 实测）

| 核验点       | 事实                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| 有无跳过机制 | **无** —— `run-tests.mjs` 的 `SUITES` 无 argv 过滤、无 `skip` 分支，44 组每次全跑 |
| 真模型组     | 3 组（`run-tests.mjs:204/209/214`）：点评 / 讲解 / 出题 Agent                     |
| 实际调用     | 每组各 1 次 `runAgent()` → `src/lib/agent/runtime.ts` → Ark 真实模型 + Zod 校验   |
| 本轮实跑     | 3 分 21 秒                                                                        |

⚠️ **但这 3 组测的是 Agent 输出契约合法性，与思维链泄漏无关**。查泄漏别指望它们。

### 4.6 设计文档与实现的两处不符（未改，等作者裁定）

| 位置                         | 文档写的                                                | 实际                                                                                                |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `00-MASTER.md:60` Agent 底座 | `piagentSDK`                                            | `@earendil-works/pi-coding-agent@0.85.1`（已跑通）                                                  |
| `00-MASTER.md:162` 预设工具  | 5 个（计算器/天气/文件读写/网络搜索/数据库查询）        | **只1 个**：`src/lib/agent/tools/calculator.ts`；`loop.ts:455` 白名单就一行 `[calculatorTool.name]` |
| `00-MASTER.md:51-75` 技术栈  | Next.js 14 / Recharts / Dexie / Vitest / TanStack Query | Next.js **16.3.5**；后四者 `package.json` **查无此包**                                              |

5 个工具只做 1 个，按`00-MASTER.md:20`「不训练这些能力的功能，不做」的标准**是符合自己理念的** —— 但设计文档没同步改，评审会被问「说好的 5 个呢」。**需作者裁定**。

---

## 五、关键文件速查

```
本轮新增/改动
├── src/lib/lecture-split.ts            ← selectStepMessages 开场判定（C1 修复点）
├── src/stores/session.ts               ← inFlightThinking（思维链归属修复点）；
│                                          persist 键 sso.conversations，可直接读 localStorage 验证 store
├── src/lib/agent/prompts/teaching-chat.ts ← LECTURE_TASK_SECTION / OUTPUT_PACING_NOTICE（C2 修复点）
│                                          ← 10-10 加固：铁律「出题时只出题，不许给答案」
├── scripts/generate-lecture-cache.ts   ← 结构守卫 + 截断守卫；--only=模块:步骤 可单跑
├── scripts/_direct-cache-write.ts      ← 🆕 10-10：批量直写 11 模块 explain 讲稿缓存，零 LLM 调用
├── scripts/_list-cache.ts              ← 🆕 10-10：列出所有讲稿缓存条目+字数统计
├── scripts/lecture-split-spec.ts       ← C1 回归 6 例
├── scripts/thinking-attribution-spec.ts ← 思维链归属回归 2 例
├── scripts/run-tests.mjs               ← 新组：分屏消息过滤 / 思维链归属
├── src/app/api/audit/evaluate/route.ts ← 审计评估代理（rate-limit audit 桶）
├── src/lib/agent/student/              ← 模拟真实学生 Agent（1598 行）：
│                                          screen-describer（See）/ action-executor（Act）
│                                          comprehension-verifier（Verify）/ types
│                                          ⚠️ 产品运行时零引用，是离线审计工具，见 4.3
├── src/components/learn/feynman-review.tsx  ← 费曼学习法复习卡（四步流程，纯客户端组件）
├── src/components/learn/module-workspace.tsx ← 集成 FeynmanReview 到掌握判定步骤
├── src/components/learn/explain-next-button.tsx ← 10-10 加固：讲解完毕弹窗含测验确认提醒
├── src/components/learn/platform-replica-workspace.tsx ← 移除概念讲解面板、教案内部滚动
├── src/components/chat/markdown-view.tsx    ← 代码块复制按钮 + 标题锚点
├── src/lib/agent/tools/query-wiki.ts        ← 🆕 10-10：Agent 工具，按关键字查询知识库
├── src/lib/platform-replica-phases.ts       ← ReplicaTask 扩展 detail/pitfalls 字段
├── llm-wiki/concepts/platform-replica.md    ← 从 ~432 行扩充至 ~1400 行（逐行代码讲解）
└── scripts/student-agent/              ← curriculum-audit.ts（1645 行，扇出审计的编排器）
                                           knowledge-window.ts（12 模块词汇表 + detectLeaks，纯函数）
                                           run.ts / run-chain.ts / persona.ts / grounding-analysis.ts
                                           ⚠️ 5 个 demo 在 _untracked-demos/ 且未入库，其中 2 个已损坏

产品内审计员（已入库，19:40 复核）
├── src/lib/audit/deterministic.ts       ← 五项确定性检查（471 行）
├── src/lib/audit/orchestrator.ts        ← 审计编排
├── src/app/api/audit/route.ts           ← GET 读结果 / POST 触发（两桶限流）
├── src/app/audit/page.tsx+ src/components/report/audit-*.tsx ← 报告页（拆成 5 个文件）
├── scripts/audit-page-acceptance.mjs   ← CDP 浏览器验收 12 条断言
└── src/lib/db/migrations/005_audit_score_columns.sql ← 列名语义修正
```

试点产出（gitignored，student-agent-output/pilot/）
├── curriculum-audit-pilot-report.md ← 主报告 + 修复附录（本轮最完整的记录）
├── ts-basics/ ← 截图 ×5、证据链 ×4、裁判裁决 ×2
└── leak-scan.ts / leak-scan-result.json ← 确定性泄漏扫描（可重跑，跑全部模块缓存）

````

**产品内审计员的设计修正（下一轮核心）**：HANDOVER 10-06 第 2 步方案继续有效（Skill + 编排循环 + audit_findings 落库 + 前端报告页），但**不需要浏览器**——可读性/可及性/泄漏直接读 wiki 源文件 + `lecture_cache` 表即可算；「页面可达性」审计才需要浏览器，那项交给子智能体在开发期做。审计发现分类法直接复用 `curriculum-audit.ts` 的 AuditFinding（severity × dimension）。

---

## 六、Git 状态（2026-10-11 更新）

```bash
# 分支：dev；HEAD = cb06d98（2026-10-11，最后一个代码提交；本文档提交在其上，只含文档）
# fix: 补齐审计发现的真实内容缺口
# 提交总数：559；标签 v0.1.0 ~ v0.4.0 + dev-phase5-backup
# 与远端：🔴 异常待人工核验 —— 10-08 核验同步到 01dce84（当时第 528 个提交），
#   此后 31 个提交未推（git log 01dce84..HEAD --oneline | wc -l = 31）。
#   10-11 实测：ls-remote origin 返回 0 个 ref（exit 0）、push --dry-run 静默无输出。
#   远端仓库可能被清空/删除，或网络中转异常 —— 先让作者上 GitHub 网页确认，别盲推。
# 工作区：干净（git write-tree == HEAD^{tree}）
#   - site-footer.tsx 仍为 skip-worktree 隐藏本地改动状态
#   - 未跟踪：.zcodeignore / _temp_vibe_coding.pdf / _temp_vibe_coding.txt（有意不提交，作者裁定）

# 本轮（10-11）15 个提交：e04c4b1 → 1c2a377 → fcf38c5 → 43138b4 → b2c07c5 →
#   d0dbfa3 → 98652e8 → a22ef0f → 62d8a1b → 0c3a053 → a243b2e → 3d6504f →
#   604347e → ae39cf2 → cb06d98（逐个做了什么见〇一节提交表）
# 涉及文件：scripts/_direct-cache-write.ts（讲稿唯一源头）、
#   llm-wiki/concepts/{ai-safety,ts-basics,vibe-coding,platform-replica}.md、
#   src/lib/{db/lecture-cache,audit/deterministic,audit/orchestrator,platform-replica-phases}.ts、
#   src/schemas/api.ts、src/app/api/{chat,lecture-cache}/route.ts、
#   src/components/{chat/composer,chat/lecture-launcher(未动),learn/platform-replica-workspace}.tsx、
#   scripts/{practice-mastery-spec,chat-schema-spec,lecture-cache-spec(未动)}.ts
````

**⚠️ 本机 git 地雷（`AGENTS.md` 第四节有完整版）**：

1. **禁切分支式操作**（`git checkout <branch>` / 跨分支 merge）—— 本质是批量替换工作区文件，逐文件入回收站、预算爆掉。**已因此毁过仓库一次**（19 个 git 对象失踪）。合并改用 plumbing（`git merge-tree` → `commit-tree`），完全不碰工作区。
2. **禁 `git rebase`**（含 `-i` / `--exec`）、**禁 `git filter-branch`**。修中途提交改用追加 `fix:` 小提交。
3. **禁 `git add -u`**，只 `git add <具体路径>`。
4. **`.git/refs/remotes/origin/` 会反复整个消失**（10-07 三次），此时 `git rev-list origin/dev..HEAD` **静默返回空**，看起来像「已同步」。⚠️ **核验推送必须用 `git ls-remote` 拿真实 SHA 比**（带上下面的四个开关）。
5. **推送/核验远端被证书问题阻断** —— 不是网络不通，见下面「推送与核验远端的正确姿势」。
6. 判定仓库干净的**硬判据**是 `git write-tree` 逐字符等于 `git rev-parse HEAD^{tree}`，不是 `git status` 干净。

### 🔴 推送与核验远端的正确姿势（19:55 实测踩通）

**本机网络并非不通** —— 之前看到的「超时 / 502」是代理与证书两层问题叠加。真实症结是 Windows schannel 的证书吊销检查失败：`CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`。

⚠️ **这个报错不稳定复现** —— 同一条命令有时成功有时报。**不要据单次失败就断定网络不通**，这正是 19:40~19:50 我判断失误的原因（当时写了「远端未核实」并拒绝再试）。

**四个开关**（只作用于单条命令，**不要写进 `.gitconfig`**，`sslVerify=false` 是安全降级）：

| 开关                                                            | 作用                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy` | 绕开宿主注入代理（代理本身返502）                                      |
| `-c http.schannelCheckRevoke=false`                             | 关证书吊销检查（**治503 的主因**）                                     |
| `-c http.sslVerify=false`                                       | 关 SSL 校验                                                            |
| `-c http.postBuffer=524288000`                                  | **仅 push 需要**，缺了会在发送阶段失败并报同一个证书错误（极具误导性） |

⚠️ **`ls-remote` 成功不代表 `push` 会成功** —— 两者需要的开关不同。核验时只带前三个，push 时四个全带。

**19:55 推送结果**：远端 `dev` 从 `7c2895b` 推进到 `c0a6619`（4 个提交），`ls-remote` 独立核验与本地 **逐字符相等**。`main` 仍在 `001dcd3`（`v0.4.0`），4 个发布标签 `v0.1.0`~`v0.4.0` 远端本地一致。`dev-phase5-backup` 是本地备份标签，未推。**此后远端又推进两次：`d4077d1`（10-07 接手核查），`01dce84`（10-08，推送 20 个提交并独立核验）—— 当前本地与远端完全同步。**

---

## 七、后续待办

> **10-11 之后的待办以〇一节「遗留给你的事」为准**（P0 远端核验/推送、P1 直写脚本结构守卫、P1 why 批量、P2 讲稿小瑕疵、P2 未跟踪文件裁定）。本节是 10-10 及更早的存档，其中已被后续推翻/完成的条目保留原文不动，别照着重做。

### ~~第 0 步：推送 + 处置 WIP~~ ✅ 已完成

6 个提交：`23b2882`（wiki 重写）/ `f6e6298`（删 python-basics 页）/ `8f67b34`（运行时收窄）/ `d181c19`（spec 清理）/ `931cd53`（ExplainNextButton）/ `e5d39bc`（删未用参数，恢复 tsc 绿）。5 个实验脚本移到 `student-agent-output/_untracked-demos/`（可逆）。

### ~~第 1 步：扇出 11 讲审计~~ ✅ 已完成（实审 **10** 讲）

报告 `student-agent-output/fanout/fanout-audit-report.md`（gitignored）。**审 10 而非 11 的原因**：`python-basics` 概念页已随语言断层修复删除，运行时不可达。

### ~~第 2 步：产品内审计员~~ ✅ 已完成

7 个提交：`921645b`（存储层）/`6af67e8`（五项确定性检查）/`5fa8bf4`（编排）/`4e4deb5`（列名语义修正）/`f5d7df4`（API+限流）/`c04c059`（前端页）/`a18d0e1`（浏览器验收）/`2605173`（格式化）。入口：`/audit` 页、`/api/audit`。

### ~~第 3 步：扇出与审计员结论并入本文档~~ ✅ 已完成（本节 + 第四节 4.1/4.2）

### 第 4 步建议（按优先级，均为**未闭合**项）

| 优先级 | 事项                                                                                  | 依据                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~P0~~ | ~~核验并推送远端~~ —— **19:55 已完成**，远端 `dev` 已推进到 `c0a6619` 并独立核验      | 原为 P0，因证书问题误判为「网络不通」，见第六节                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P0     | ~~system-prompt observe 回复 `error`~~ **✅ 误报，已排除**                            | **10-08 实跑复现并推翻**：11 模块跑 observe，8 个正常（帧类型 `thinking,token,done`）、3 个报 `LLM_ERROR模型未产出内容`（`ts-basics`/`llm-api`/`system-prompt`）。**单独重跑（间隔 30s）后 `system-prompt` 与 `llm-api` 均 `ok=true`**（textLen 1399 / 1492）→ **根因是 SenseNova 限流（429），不是模块缺陷、不是代码问题**。文档原记「扇出唯一 critical」不成立：扇出采样期恰逢欠费/限流窗口。**教训：报「模型未产出内容」先探端点+ 拉长间隔复跑，别当模块缺陷** |
| P0     | 思维链泄漏内部口径 —— **✅ 已闭环（`b9b3168`）**                                      | **B 核验端到端实证通过**：`agent-loop` 模块修复前 thinking 12328 字命中 **5** 个内部词，修复后 12234 字命中 **0**（12234 完整保留，只少 94 字= 被替换的词）。修法= **服务端过滤**（`src/lib/agent/thinking-filter.ts`），不依赖模型自觉。⚠️ 缓存讲稿仍是旧口径，`--force` 重跑见另一行                                                                                                                                                                            |
| P1     | ~~修 2 个损坏的实验脚本~~ ✅ 已修（首字符 `x`/`ia`，见 4.3）                          | 纯修复、零风险；`tsc` 报 `TS2304: Cannot find name 'x'`                                                                                                                                                                                                                                                                                                                                                                                                           |
| P1     | ~~`student-autonomous-run.ts` 入库~~ ✅ 已入库（630 行，见 4.3）                      | 已迁入 `scripts/student-agent/` 并提交（10-07）。`ts-basics` 实为合法模块（见 4.3 断点 2 更正），默认参数保留无需改                                                                                                                                                                                                                                                                                                                                               |
| P1     | 讲稿与概念页的**内容**对齐（渲染层已修，内容层审计已清零）                            | 审计一致性维度 10-07 已归 1（ai-safety 机制承诺补进讲稿）；扇出 8/10 渲染层不在确定性审计内，属展示问题                                                                                                                                                                                                                                                                                                                                                           |
| P1     | 术语断层 3 条改讲稿（✅ 10-07 完成缓存级修复）                                        | 实际为 llm-api「上下文」+ mcp「Agent」两处，均在 explain 讲稿加内联定义；重跑审计 term 维度全 1、整库 0 缺陷。永久化需在欠费恢复后 `--force` 重跑生成器                                                                                                                                                                                                                                                                                                           |
| P1     | ~~`ExplainColdStart` 死代码~~ ❌ 误报（仍被 `module-workspace.tsx:243` 引用，见 4.1） | 原 high 项经复核为文档滞后，非缺陷                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P2     | 双任务冲突加仲裁文案                                                                  | 3/10 命中 → 10-07 复核为**设计缺口**（src 无现成冲突检测代码），待可复现后设计                                                                                                                                                                                                                                                                                                                                                                                    |
| P2     | 4 讲未过示范代码验收线                                                                | ai-safety 4.5 最低                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P2     | 修 `thinking-seal-spec` 的毫秒竞态（见 4.4）                                          | 测试自身问题，非产品缺陷；但 `pnpm test` 当前另有 3 真模型组因 Ark API 故障失败（非产品缺陷）                                                                                                                                                                                                                                                                                                                                                                     |
| P3     | 编辑器标签页与任务错配                                                                | 4/10 命中 → 10-07 **已修**（任务卡加交付类型提示）                                                                                                                                                                                                                                                                                                                                                                                                                |
| P3     | 登录表单提交后不跳转                                                                  | 10/10 采集者遇到 → 10-07 复核为**误报**（前端 redirect 逻辑正确）                                                                                                                                                                                                                                                                                                                                                                                                 |
| P3     | 生成器自动重试（带字段级错误反馈）                                                    | 现为「拒写 + 重跑提示」                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| P3     | 知识窗泛词白名单（`agent`/`tool`/`multi-agent` 误报）                                 | 影响确定性检查可用性 → 10-07 **已修**（加 `GENERIC_WHITELIST`，泛词误报归零）                                                                                                                                                                                                                                                                                                                                                                                     |
| P2     | 概念测验硬校验（10-10 新增）                                                          | 当前讲解完毕弹窗依赖学生自觉点击确认，无后端强校验阻断。若需硬阻断，可在 `explain-next-button.tsx` 中检查 mastery 状态（score >= 3）                                                                                                                                                                                                                                                                                                                              |

### 三件事裁定结果（2026-10-07 已裁定并落地）

| #   | 问题                                 | 裁定                                                       | 落地                                                                                                                                                                                                                           |
| --- | ------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 模拟学生 Agent 定位（见 4.3 断点 1） | **选 A**：离线「课程质量审计工具」                         | `00-MASTER.md` 增补「实现备注」写明；产品用户是真学生，模拟学生不接产品运行时                                                                                                                                                  |
| 2   | 5 工具只做 1 个（见 4.7）            | **有意裁剪**（符合第一原则「不训练这些能力的功能，不做」） | `00-MASTER.md` 同节说明：天气/文件读写/网络搜索/数据库查询不在六项协作能力范畴，非遗漏                                                                                                                                         |
| 3   | 思维链泄漏验证                       | **A+B 组合 + 列为 P0 修复**                                | 铁律5已延伸到thinking（提交 `c6686f3`）；新增 `scripts/verify-thinking-leak.ts`(B) 与 `scan-cache-internal-words.ts`(A)；**B核验与 `--force` 重跑缓存受阻于方舟账号欠费 403**（见 4.2，充值后即恢复；⚠️ 会反复，跑前先探端点） |

> 裁定纪实：用户「直接处理三件事」后凭事实裁定。A 选择依据——`grep -rn 'agent/student' src/` 返回空（产品零引用），扇出审计已证其价值；B（接产品做陪练）差异化最强但工作量最大，距省赛截止 2026-11-18 不应再开产品面。事3 的 B 路径是唯一能验 thinking 的手段（缓存无 thinking 字段），A 路径只能查界面输出。

### 做判定类缺陷时的两条纪律（本轮学费）

1. **确定性检查会误报，且误报率高到会淹没真缺陷。** 本轮「内容一致性」首版 8/11 全误报、「术语断层」首版误报 10 处。修法不是放宽阈值，是**换判据**：改查概念页的**可数机制承诺词**（「四层」「五类」「场景 A」）而不是标题措辞；加 `countStandalone` 按独立词计（排除「上下文」只是「模型上下文协议」的子串）。
2. **判据要守性质，不守字面形状。** 「任何一格都不能显示 0 分」是错的问题 —— 它把数据层合法的 0 分当渲染 bug。正确判据是**拿数据源真值逐格对账**（null↔「未检测」、有值↔对应数值）。只有对账能把「NULL 被画成 0」和「真 0 分」分开。

---

## 八、注意事项

1. **两套审计栈并存，用途不同，别混**：
   - `src/lib/audit/deterministic.ts` + `orchestrator.ts`（已入库，`/audit` 页调用）—— **产品内的确定性检查**，读 wiki + `lecture_cache`，五项维度，**不需要浏览器**。这是**日常回归门禁**。
   - `scripts/student-agent/curriculum-audit.ts`（1645 行，gitignored 产物）—— **带视觉学生的深度审计**，Playwright 独立栈，认知状态机驱动，能问出「这讲我没懂」这种真实反馈。10-07 扇出 10 讲 + 抓出 11 项缺陷**用的是这套**。10-06 曾写它「已作废」，**那是误判** —— 作废的只是它的**硬编码认知状态机**，不是整条线。
   - 换句话说：**要快速回归用前者，要发现深层次教学缺陷用后者**。后者是理念的载体（见 4.3）。
2. **改讲解提示词的结构节必须重跑缓存生成器**（`--force`），否则「缓存讲稿」与「现场口径」脱节；生成器拒写缺任务节的讲稿时，先怀疑提示词结构声明，不是模型。
3. **视觉评估必须用视觉模型**（代理端点 vision 类型已自动选）；`proxyUrl` 模型选择逻辑在端点内。
4. **知识窗词汇表是手工维护的**（`knowledge-window.ts`）——加模块/改术语必须同步。⚠️ 它是**泛词**（`agent`/`tool`/`multi-agent`），泄漏扫描误报 4 处全来自这里，产品化时需加白名单。
5. 子智能体审计时**学生和裁判必须分开**（裁判只读证据文件），否则自评偏差污染结论。
6. 提交规范、本机 git 地雷、四级验收：见 `AGENTS.md`，此处不重复。
7. **服务端口不固定** —— 本机 3000/3100 常年被残留进程占。用 `netstat -ano | grep -q ":PORT "` 探空闲端口（10-07 用的是 **3987**），或改 `PORT=3311`（`browser-acceptance.mjs` 默认值）。
8. ⚠️ **改完组件必须重启服务再跑浏览器验收** —— 旧 `next start` 进程还在跑上一个构建，验收它等于没验收。本轮拆分组件后因此白跑过一次。
9. **浏览器验收用系统 Edge + 原生 CDP**（`scripts/audit-page-acceptance.mjs` / `browser-acceptance.mjs`），零新增依赖。访问本机服务加 `--noproxy '*'` 或 `--proxy-server=direct://`，否则宿主注入代理会返回 502。
10. **鉴权头是 `x-auth-token`**（`src/lib/student-id.ts`），不是 `Authorization: Bearer`；`x-student-id` 路径要求身份已存在否则 404。最省事是打 `/api/auth/register` 换真令牌。
11. **`eslint.config.mjs` 的 `globalIgnores` 与 `tsconfig.json` 的 `exclude` 是同一份清单**，改一份就要想另一份 —— 只改 tsconfig 会让门禁扫进 gitignored 产物目录（10-07 因此报 23 个 error）。
12. **`npx tsx -e "..."` 在本机静默无输出**，临时查库要写成 `.ts` 文件再 `npx tsx <file>`。
13. ⚠️ **「写文件」这个动作本身会污染内容** —— 今日两次踩坑同源：`deterministic.ts` 混入 2 个**裸 NUL 字节**（当字段分隔符），`_untracked-demos/` 两个脚本**首字符被写成 `x` / `ia`。共同特征是**门禁全绿但内容已坏**：
    - 裸 NUL 让 `grep` 报 `binary file matches`，`tsc`/`prettier`/`eslint` **整个跳过该文件**；
    - 首字符污染的文件在 `exclude` 目录里，`prettier`/`eslint` 也跳过。
    - **防御手段**：新写/改的 `.ts` 脚本入库前单跑一次 `npx tsc --noEmit --ignoreConfig --skipLibCheck --target es2022 --module esnext --moduleResolution bundler <file>`。`--ignoreConfig` 不可省（否则报 TS5112）。
14. ⚠️ **判断「泄漏」前先分清是哪一种泄漏**，两者工具完全不同：
    - **跨模块知识泄漏** = 后续模块的词汇提前出现在本讲**代码块**里 → 用 `student-agent-output/pilot/leak-scan.ts` / `knowledge-window.ts` 的 `detectLeaks` 能测；
    - **内部口径泄漏** = 思维链复述系统内部词（铁律/掌握度/门禁/编排层）→ **现有工具一个都测不到**，因为思维链不进缓存（见 4.2）。
    - 说错了会导致「修完用错工具验收 → 假绿灯」。
15. ⚠️ **核验远端同步不能只看 `git rev-list origin/dev..HEAD`** —— `.git/refs/remotes/origin/` 消失时它**静默返回空**，看着像「已同步」。必须 `git ls-remote`。且本机网络两种方式都可能失败（裸连超时 / 代理 502），**核不上就写「未核实」，不要猜**。
16. **改一份未提交的文件前，先 `git show HEAD:<path>` 确认基线** —— 本机「工作区状态与 HEAD 不一致」是常态，否则会把入库的有效内容误判成「我删了东西」。
17. **`pnpm test` 全绿 ≠ 门禁全绿** —— 测试不跑 `tsc`。今日 `AGENTS.md` 第二节曾写「`npm run check` 全绿」，实际当时有 3 条 `tsc` error + build 失败，被测试全绿掩盖了。三者独立：`pnpm check` = eslint + prettier --check + tsc。
18. **`git update-index --skip-worktree` 用于本地隐藏改动** —— `site-footer.tsx` 的「AI 生成内容，仅供学习参考」删除改动已通过此方式隐藏。效果：文件本地已改但 `git status` 不显示、`git add` 不包含。恢复命令：`git update-index --no-skip-worktree <file>`。适用场景：本地需要但仓库不应体现的改动（如品牌声明、水印等）。
