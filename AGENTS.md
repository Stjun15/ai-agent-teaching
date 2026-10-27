# AGENTS.md — 接手本仓库的 Agent 从这里开始

> 这份文件写给**下一个进入本仓库的 AI Agent**，只回答三件事：这是什么、现在到哪了、动它之前必须知道什么。
> 设计文档在 `agent-prompts/`；**本机环境地雷与移交操作在 `HANDOVER.md`**（仓库根，**本地留存、已 gitignore 不入库**，clone 仓库看不到它）。

## 一、这是什么

**AI Native 编程教学助手** —— 用 Agent 教 Agent，训练学生六项可迁移的 AI 协作能力。

参赛作品。省赛**报名与作品提交截止 2026-11-18**（同一天）。

赛题硬约束（原文「特别说明」）：作品须**以前端 Web 应用为主要呈现形态，后端服务仅作为 AI 能力的接入层，不作为重点考察对象**。

评分权重：AI 技术深度 35% / 创新性 25% / 前端工程质量 10% / 实用性 10% / 用户体验 10% / 社会价值与商业潜力 10%。

## 二、现在到哪一步（2026-10-23 更新；详细移交记录见 `HANDOVER.md` 〇〇节 = 最新一轮，〇一节 = 10-11 上一轮；该文件只在本地，不入库）

| 项           | 事实                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 当前分支     | `dev`（工作分支），最新提交以 `git log -1 --format=%h` 为准，**已与远端同步**。`main` 已并入 dev 全部工作（plumbing 合并，同一 tree）。**10-23 夜间：教师端 / 学生模拟器整套已下线**（实现无缺陷，作者裁定「变量太难掌握」，见 `HANDOVER.md` 〇〇「教师端 / 模拟器」节）——历史提交仍在，别默认恢复。⚠️ 推送需带四个开关（绕代理 + 关证书吊销 + 关 SSL 校验 + `http.postBuffer`），**逐条命令临时指定、别写进 .gitconfig** —— 见第八节；**核同步用 `ls-remote` 比对远端 SHA 与本地 `git rev-parse HEAD`，勿用 `git rev-list origin/dev..HEAD`**（本地 `origin/dev` 引用会缺失）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 提交总数     | **以 `git rev-list --count HEAD` 实时值为准**（10-23 深夜写这行时为 659；写死的数字下一次提交就过期，别照抄）。10-21~10-23 共两轮：先 22 个（MCP 修复 / Vitest+CI / 六项子能力 / 认证限流 / 类型与 lint 清零 / 死测试清理 / 移交文档），后一轮 = 教师端 + CI 修复 + 下线                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 标签         | `v0.1.0`、`v0.2.0`（978fc5e）、`v0.3.0`（71e3864，走查修复 + 点评闭环 + 等待计时）、`v0.4.0`（001dcd3）、`v0.5.0`（661a875，安全 / 文档 / 预算 / 跨浏览器 / 标签）。**`v0.6.0` 已删除**（它标的教师端已下线，留着会误导评审）。另有 `dev-phase5-backup`（非发布）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 远端         | ✅ 已同步：`dev` / `main` 指向同一 tree，发布 tag 为 `v0.1.0`–`v0.5.0`（`v0.6.0` 已删）。推送姿势仍按第八节四开关（PowerShell 没有 `env -u`，用 `Remove-Item Env:HTTP_PROXY...` 清代理变量）。**提交截止前需把仓库改 Public 或给评审加协作者**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 质量门禁     | **2026-10-24（复习闭环 + 覆盖率）实测**：`tsc --noEmit` **0 error**、`eslint src scripts tests` **0 error / 21 warning**、`node scripts/run-tests.mjs --ci` **28/28**、`vitest run` **18 文件 134 用例全绿**（行覆盖率 25.36%，10-27 补了 markdown / SSE 两组）、`pnpm build` 成功、浏览器验收 `browser-acceptance` PASS、`report-details` 8/8、`mastery` 4/4。⚠️ **CI 子集不含 `rag-hybrid-spec`**：它要求库里已有 `pnpm rag:index` 建的向量索引，CI 是空库必红（本轮 CI 变红的真因之一）。⚠️ `prettier --check .` 在本机整仓误报——`core.autocrlf=true` 让工作区全是 CRLF，配置却是 `endOfLine: "lf"`；CI 在 Linux 检出 LF，不受影响，故 prettier 未进 CI。**但在本机要判断「我改的文件格式对不对」，得加 `--end-of-line auto`**——不带这个开关，连没动过的文件也全红。⚠️ 冷启动测试组打 `localhost:3000`——**跑全量测试前先起服务器**。历史教训仍在：① `pnpm test` 全绿 ≠ 门禁全绿（测试不跑 tsc）；② `eslint.config.mjs` 的 `globalIgnores` 与 `tsconfig.json` 的 `exclude` 是同一份清单，改一份就要想另一份；③ 方舟欠费 403 会反复，跑真模型前先探端点                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 产品内审计员 | **已下线（10-24 复核）**：`/audit` 页与 `/api/audit` 在提交 `116d6eb`（加部署脚本/隧道那轮）连同 `src/lib/audit/` 一起移除，**全仓 grep `audit` 只剩安全限流桶与场景文案**；`src/lib/db/audit.ts`、迁移 `004`/`005`、`scripts/audit-page-acceptance.mjs` 是残留（无消费方）。历史成绩「10-11 12 讲 0 缺陷」只存档在 `HANDOVER.md` 〇一节。⚠️ **改任何讲稿/概念页后已无自动审计入口**，必须人工比对可数承诺词（「四层」「五道」「场景 A」）是否在讲稿出现——曾因此抓出未定义术语 |                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 部署（生产） | **2026-10-23 深夜换版成功**：阿里云 ECS `http://<ECS-IP>`（nginx 80 → `127.0.0.1:3000`，systemd 服务 `ai-teaching`，SSE 关缓冲）。应用目录 `/opt/ai-agent-teaching-app`（git clone，`git pull` 即可更新），数据 `dev.db` 就在应用目录内，环境变量 `/etc/ai-teaching.env`（`ARK_API_KEY` 已配）。旧目录 `/opt/ai-agent-teaching` 保留作回滚。⚠️ **2026-10-27 复验：公网 `8.149.130.30:80` 已恢复可达，`/api/health` 200（wiki `schemaIssues=0`），当日已用「本机构建 + 传包」方式换版成功**。**1C1G 上千万别跑 `pnpm build`**——会把机器打进 swap 风暴连 SSH 都断（已发生一次，只能控制台强制重启）；正确姿势是**本机 build → 只传 `.next`（排除 `cache`/`dev`，13.6MB）→ 解压 → 改 `required-server-files.json` 里的本地绝对路径 → `systemctl restart`**。域名与 HTTPS 仍未配置。**部署凭据的变量名固定为 `DEPLOY_PASSWORD`（root 密码），只允许从环境变量读取并直接传入进程，禁止写进代码、脚本、提交、文档或日志**；本机无 `sshpass`/`plink`，非交互部署走 Python `paramiko`（SFTP 传包 + exec 执行），已验证可行。⚠️ **打包 `.next` 时 zip 内路径必须带 `.next/` 前缀**——曾因前缀丢失把 `.next/package.json` 解到应用根目录，直接覆盖真 `package.json`（内容变成 `{"type":"commonjs"}`），服务重启即失败，只能用 `git checkout -- package.json` 恢复 |
| 部署套件     | `deploy/`（`deploy-local.sh` 一键脚本 + `README.md`）：常驻主机路线，装环境→拉代码→建表→systemd→nginx 反代（SSE 关缓冲）。⚠️ 脚本里的 `pnpm build` **不适合 1C1G 小机**（会 OOM / swap 风暴），小机请改用「本机构建 + 只传 `.next`」，见上一行                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 参赛信息     | README 已填（传智杯「AI WEB网页开发挑战赛」C 组 · 广东交通职业技术学院 · 江家俊）；参赛技术文档初稿与演示视频脚本已交付（`docs/competition/`，2026-09-30）；视频录制与 PDF 转档待作者                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Phase 0–6    | 已完成（9/9 可视化场景，场景断言 17 例）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Phase 7      | **9/12 完成**（安全 3 + 文档 3 + 提示词预算 + 跨浏览器测试 + 标签；见第八节）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 仓库完整性   | `git fsck` missing 0；`git write-tree` == `HEAD^{tree}`（判据要逐字符比，不是 `git status` 干净）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 学生 Agent   | ⚠️ **是离线审计工具，不是产品运行时**（2026-10-07 19:31 核验）。`src/lib/agent/student/` 三个子智能体共 1598 行（screen-describer「See」/ action-executor「Act」/ comprehension-verifier「Verify」），已跑出真实数据（`student-agent-output/autonomous-run-log.json`，10-05）。但 `grep -rn 'agent/student' src/` **返回空** —— 产品零引用。630 行主脚本 `student-autonomous-run.ts` 已于 10-07 入库 `scripts/student-agent/`、两个损坏 demo 同批修复（见 `HANDOVER.md` 4.3）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 待裁定       | ② 5 个实验脚本去留（在 `student-agent-output/_untracked-demos/`，可逆，其中 2 个已修复入库）。~~① `ark-config.ts` 视觉模型四处矛盾~~ **10-07 复核：矛盾已不存在**（五处统一为 `doubao-seed-2-1-pro-260915`）；~~③ 模拟学生 Agent 定位~~ 与 ~~④ 5 工具只做 1 个~~ **已于 2026-10-07 裁定**（选 A 离线审计工具 / 有意裁剪），见 `HANDOVER.md`「三件事裁定结果」节；⑤ ~~`.zcodeignore` 与 `_temp_vibe_coding.pdf/txt` 三个未跟踪文件去留~~ **10-24 已处理**：`.zcodeignore`、`HANDOVER.md`、`docs/handover.md`、`比赛要求.docx` 全部写入 `.gitignore` 并 `git rm --cached`（历史提交仍在，clone 看不到工作区文件）；`_temp_vibe_coding.*` 已不在工作区                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 教学循环     | **已在真实数据库上跑通**（`agent_traces` 等已有真实流量行，见第八节）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 学生数据     | **已接到前端**：`StudentBootstrap` 每页 hydrate，掌握度卡显示真实 80% / 优秀                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 点评闭环     | **已接到界面**（2026-09-19）：「提交点评」→ 建会话 + `/api/agent/validate`，真实模型批改并落 `validation_results` / `prompt_history` / `errors`，面板展示维度分 / 扣分问题 / 建议及兜底提示；讲解步骤进入即自动开讲；走查发现的学生界面开发术语已清除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 讲稿缓存     | **点开即有 + 直写为源**（2026-10-11 起）：`lecture_cache` 表**只存 11 讲的 explain 讲稿**（observe 示范 09-25 起改 wiki 直读，旧 observe 行与退役模块行已清空；端点 `CACHED_STEPS` 只留 explain）。**改稿唯一入口是 `scripts/_direct-cache-write.ts`（手写直写、零模型调用）**——改模板字符串后重跑脚本即入库；⚠️ **不要跑 `generate-lecture-cache.ts --force`**，它调真实模型会把手写稿整批覆盖。手写直写暂无结构守卫，改完自查任务节（详见 `HANDOVER.md` 〇一节「改讲稿的唯一正确流程」）。守卫 7 例（`pnpm test` 的 lecture-cache 组）                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 路径调整     | **2026-09-21 已上线**：`src/lib/agent/path-adjuster.ts` 规则引擎，基于掌握度下降、连续失败、错题积压自动生成学习路径调整建议。前端统一 `PathAdjustmentCard` 组件（模块页 + 报告页复用）。单元测试 4 条规则 + 边界。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| SSE 优化     | **2026-09-21–26 连续三轮优化**：① Token 批量合并（setTimeout(0) 按 buffer 合并渲染，频次从 30-80/s → ~20/s）；② 引用检索与会话创建并行执行（`preludeEvents` 改为异步回调，消除 2-5s 空等）；③ 思维链先于首 token 可见（追加 planner 替换分段、默认展开、中文思考指令）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 界面分屏     | **2026-09-19/20**：讲解/示范/模仿三步分离（示范卡=讲稿代码提取 + 确认门控跳转，任务卡=「现在轮到你」，聊天按步过滤不串内容）；**模块会话隔离**（activeModuleId 清空 + 事件守卫，修跨模块串台 d63810a）；步骤分屏同日（09-20）已从 llm-api 原型推广到全部模块（`module-workspace.tsx:109` 现行注释为准）。**10-11 新增**：复刻工作区对话携带 `phaseContext`（阶段序号/标题/目标）注入导师系统提示词                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
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

模型平台：**商汤日日新 SenseNova** `https://api.sensenova.cn/v1`，文本/视觉同模 `deepseek-v4.1-flash`。
密钥环境变量：**`SENSENOVA_API_KEY`**。pi SDK 的 provider id 仍为 `ark`（避免大面积重构，apiKey 显式传 `$SENSENOVA_API_KEY`）。

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
   建好了却没有调用方），另有「评分维度」区块显示真实维度分 —— 六项子能力**已于 10-23 深夜
   从占位改为真实聚合 + 成长曲线**（`src/lib/sub-abilities.ts` 的 `buildSubAbilityTimeline`：
   按截至当日各模块最新分累积重算、只在新证据日取点；`sub-ability-sparkline.tsx` 手写 SVG）。
   口径别改回去：`mastery` 表只有最新一行，按日分桶会把「今天只重测一讲」画成下跌；
   单点/无点时如实显示「首次记录 / 暂无时间点」，不补平点、不画 0。
   验收脚本 `scripts/report-details-spec.mjs`（8/8）：
   断言的文本是从 SQLite 当次读出的真实行，不是写死的常量。
   仍开放的小口子：`question_results.attempts` 恒为 1（每次作答的「第几次」没人写）。
   ~~教学状态机接入后 attemptNumber 要从会话状态读~~ **10-21 已改为从 `validation_results`
   的会话内条数推导，10-24 复核确认**；~~订正与复习调度（is_corrected / next_review_at）
   没有实现路径~~ **10-24 已接线** —— 排期规则在 `src/lib/review-schedule.ts`（纯函数，
   `tests/review-schedule.test.ts` 11 例），写入在 `errorDb.create` / `markCorrected`，
   取数在 `GET /api/student/errors?due=1`，入口是学习页卡片 + 报告页错题本筛选；
   历史行由 `006_review_schedule.sql` 按同一规则回填（超过 14 天留 NULL 退出队列）。
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

10. **~~🟡 思维链泄漏系统内部口径~~（10-23 深夜：A/B 双侧全部闭环）** —— **铁律 5 已修**（`c6686f3`：延伸到 thinking + 替换口径）。**缓存讲稿不再是旧口径**：10-10/10-11 全部 11 讲讲解稿已按新口径手写重制直写入库（`_direct-cache-write.ts`），`scan-cache-internal-words.ts` 全绿（A 侧）。**B 核验已于 10-23 通过**：`verify-thinking-leak.ts` 两轮真调模型（一轮完整 + 一轮交叉）覆盖 agent-loop / ts-basics / system-prompt / mcp 四讲——含两个历史泄漏源（agent-loop 曾命中 5、ts-basics 曾命中 2），全部 `ok=true`、thinking 流 `internalHits=0`、SSE `errors=0`，服务端 `thinking-filter.ts` 在真实流量上确认兜住（历史根因与修法记录见 `HANDOVER.md` 4.2）。
11. **~~🟡 `ExplainColdStart` 是死代码~~（10-10 复核为误报，原记录存档）** —— 原判定「两条路由都不可达」不成立：`module-workspace.tsx` 仍引用该组件（platform-replica 之外的交互模块走它）。platform-replica 本身走专属工作区是**设计分流**（该模块是项目实践不是概念课），且 10-11 起其讲稿缓存按用户裁定退役、教学由六阶段任务卡 + 概念页手册承载。
12. **~~🟡 讲稿 / 概念页 / 示范代码内容不互相对齐~~（10-11 内容层清零）** —— **渲染层早已修**（`segmentByCode` 保留散文）；**内容层本轮清零**：ai-safety 概念页承诺词（五道闸门/场景A/B/C）已对齐讲稿与测验、五道口径四处统一（`43138b4`），全量审计 12 讲 0 缺陷（一致性维度全过）。⚠️ **审计入口（`/api/audit`）已于 `116d6eb` 移除**，守卫方式改为人工比对可数承诺词。
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
