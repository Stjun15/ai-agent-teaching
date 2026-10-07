# 接手文档 — 2026-10-07（当日 19:20 更新：三步全部完成）

> 上一份（2026-10-06）的「课程审计员」命题已经走完一个完整闭环：**学生 Agent 试点审计 → 抓出 2 个 critical → 根因定位 → 修复 → 缓存重生成 → 浏览器验证**。本文件记录这个闭环，以及扇出与产品内审计员的落地结果。
> 基础盘（这是什么、四条铁律、硬约束、四级验收）在 `AGENTS.md`，不重复。

---

## 〇、当前状态速查（2026-10-07 19:20）

| 项           | 事实                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| 分支 / HEAD  | `dev` @ `2605173`                                                               |
| 与远端       | **完全同步**（`git ls-remote` 直连核对）                                        |
| 工作区       | 只剩 `HANDOVER.md` 未提交（作者笔记）                                           |
| 仓库完整性   | `write-tree` == `HEAD^{tree}` 逐字符相等；`git fsck` missing 0                  |
| 门禁         | `pnpm check` **0 error**、prettier 全过、`tsc` 0 错                             |
| 当日提交     | **27 个**（11 fix / 6 feat / 5 test / 2 chore / 1 style / 1 refactor / 1 docs） |
| 产品内审计员 | **可用**：`/audit` 页 + `/api/audit`，DB 里 11 讲已审、3 缺陷                   |
| 三步进度     | 第 0/1/2 步 ✅ 全部完成（见下）                                                 |

**仍未闭合的三项（等作者裁定，本轮未动）**：

1. `ark-config.ts` 视觉模型 `pro-260915` vs `turbo-260628` —— 与 `AGENTS.md` 第五节、`ark.ts:9`、`schemas/api.ts:213`、`.env.example:27` **四处记载矛盾**，已 `git checkout --` 还原保持工作区干净
2. 5 个实验脚本去留 —— 已移到 `student-agent-output/_untracked-demos/`（改名代替删除，可逆）
3. `HANDOVER.md` 是否入库（本文件，唯一未提交文件）

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

- `high` `ai-safety` 内容一致性 —— 与扇出裁判独立收敛
- `medium` `llm-api` 术语断层（「上下文」1 次未定义）
- `medium` `tool-calling` 术语断层（「Agent」1 次未定义）

**API 与前端**：`/api/audit`（GET 读 / POST 触发，独立限流桶 `curriculum-audit` 3 次/分）+ `/audit` 页（拆 5 个文件）+ 顶栏导航项 + `scripts/audit-page-acceptance.mjs`（浏览器验收 12/12）。

**两条诚实边界写死在界面上**（不是写在注释里）：「没查到 ≠ 没问题」（判断类缺陷不在五项里）、「分数 null 显示未检测而非 0」（本轮不调模型，画 0 就是编数据）。

---

## 三、修复后的架构要点（**别改回去的部分**）

1. **`selectStepMessages` 的开场判定**（`src/lib/lecture-split.ts`）：「讲稿 = 该步第一条消息是助手」。改回「第一条助手消息」会复活 C1。skip/truncate 两种模式共用此判定。
2. **`LECTURE_TASK_SECTION` + `OUTPUT_PACING_NOTICE`**（`teaching-chat.ts`）：两个讲解提示词共用一份任务节定义。**改任何一处讲解提示词的结构节 = 换缓存口径 → 必须 `--force` 重跑 `generate-lecture-cache.ts`**，缺任务节的产出会被生成器拒写（这是特性不是故障；失败信息里带 `--only` 重跑命令）。
3. **`inFlightThinking`**（`src/stores/session.ts`）：新消息的 thinkingSteps 只带未封口段。全局 thinking 数组仍跨轮累积（Agent 时间线要展示历史），两者边界靠 `endedAt`。
4. **生成器两道守卫**（`generate-lecture-cache.ts`）：截断守卫（output ≥8000 tok 或正文 <800 字）+ 结构守卫（`splitLecture(text).assignment === null` 拒写）。都是「失败 + 带 `--only` 的重跑提示」，无自动重试——见遗留 ②。
5. 观察示范的代码来源**没变**：wiki `## 示范代码` 构建期直读（2026-09-25 裁定），observe 缓存是遗留物不消费。

---

## 四、当前问题清单

| 问题                                         | 状态                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 导师 LLM 响应极慢（10-06 清单）              | **已关闭——误诊**。真实缺陷是 C1，已修。模型实测 14~41s/轮                                                                                            |
| C1 observe 回复丢失                          | **已修复**（`6b4a7ca`）                                                                                                                              |
| C2 任务卡全站缺失                            | **已修复**（`f413f44` + 缓存重生成）                                                                                                                 |
| 思维链跨消息累积                             | **已修复**（`1e659bc`）                                                                                                                              |
| 思维链语言不稳定（第 1 轮英文、第 2 轮中文） | **开放**——AGENTS 记载 9/26 加过中文思考指令，实测间歇生效，为何失效未查                                                                              |
| 生成器无自动重试                             | **开放**——现为失败+重跑提示；人工重跑已验证可行，建议加一次「带字段级错误反馈的重试」（铁律 2 同款模式）                                             |
| 知识窗不含语法级构造                         | **开放**——`interface` 检测不到（词汇表是 Agent 领域概念，非语法）；现靠提示词约束，确定性检查待设计。另：泛词（agent/tool）误报 5 处已记录，需白名单 |
| ts-basics 泄漏                               | **已关闭**——讲解/示范代码零泄漏（重写达标，扫描确认）                                                                                                |
| 老学生 localStorage 旧讲稿                   | **已知非缺陷**——种子消息只在步骤无消息时注入；试点学生（agent-audit-pilot-0607）的 store 里还压着 10-06 的旧讲稿，新学生不受影响                     |

### 4.1 扇出审计新增（10-07，详见 `fanout-audit-report.md`）

| 问题                                         | 严重度         | 状态                                                                                                                                                                                                                  |
| -------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 思维链默认展开压倒正文（10/10）              | **全站最严重** | ✅ **已修** `da27770`（`<details>` 去掉写死的 `open`）。实测 `agent-loop` 曾达 16.5:1、`system-prompt` 1148:1                                                                                                         |
| 「进行中」徽标永不消失（10/10）              | high           | ✅ **已修** `6cdf6a8`。根因：`thinkingSteps` 是建消息那一刻的**快照**，全局封口发生在之后 → 快照里 `endedAt` 永远缺失。修法：`settleStreamingMessages` 在三个收尾点与消息数组一起封口，传**同一时间戳**               |
| 讲稿/概念页/示范代码三套教材不对齐（8/10）   | medium         | 🟡 **部分修** `61d1469` + `dfa3446`。根因在渲染层：`observe-panel.tsx` 把散文整块丢弃 → 抽出 `segmentByCode` 保留散文、`li` 改 `div`（li 在 div 里非法嵌套，HTML 解析器整条丢弃）。**但讲稿与概念页的内容对齐仍开着** |
| 术语断层（10/10）                            | medium         | 🟡 审计员已能检出（3 条），**讲稿本身尚未改**                                                                                                                                                                         |
| 双任务冲突（导师回复另生成一道任务，3/10）   | medium         | 🔴 **开放** —— 页面无仲裁文案                                                                                                                                                                                         |
| 编辑器标签页与任务要求错配（4 讲）           | low            | 🔴 **开放** —— `code.ts:65` 默认 `taskType:"code"`，任务卡未提示切换                                                                                                                                                  |
| `ExplainColdStart` 死代码                    | high           | 🔴 **开放**（本轮未动）。`page.tsx:49` 提前 return + `[step]/page.tsx` redirect，两条路由都不可达                                                                                                                     |
| 思维链泄漏系统内部口径（10/10）              | high           | 🔴 **开放，且已定位机制性根因**（见 4.2）                                                                                                                                                                             |
| system-prompt observe 回复 `error`           | critical       | 🔴 **开放** —— 扇出唯一 critical                                                                                                                                                                                      |
| 登录表单提交后仍停在 `/auth`（10/10 采集者） | —              | 🔴 **待查** —— 零确认，采集者都改用页内 fetch 写 localStorage 绕过                                                                                                                                                    |
| 采集者误报率不低                             | —              | 已归档：6 类误报 + 2 类证据缺陷（账号共用、截图重复）。**方法学副产品，不影响结论**                                                                                                                                   |

### 4.2 思维链泄漏的机制性根因（本轮新定位）

扇出报告 3.2 记的是现象（10/10 讲思维链出现「铁律」「掌握度」「门禁」「编排层」）。**本轮读代码找到了为什么约束没起作用**：

`teaching-chat.ts` 的铁律 5 只写了「**不要暴露**系统内部机制」并列举这些词 —— 它约束的是**学生界面输出**，**没有一条约束思维链**。而学生能看到 thinking（铁律 4 明确说「学生可以看到你的推理」）。于是模型在思维链里复述禁令本身，就把这批词摊给了学生。

最露骨的一处（platform-replica，扇出逐字记录）：

> `铁律 5: Don't expose system internal mechanisms (门禁, 掌握度, 前置模块, 编排层 are internal words).`

**修法方向**：铁律 5 要显式延伸到 thinking，并给出**替换口径**（该说什么，而不只是禁止说什么）。⚠️ 改结构节后**必须 `--force` 重跑 `generate-lecture-cache.ts`**，否则缓存讲稿与现场口径脱节。

---

## 五、关键文件速查

```
本轮新增/改动
├── src/lib/lecture-split.ts            ← selectStepMessages 开场判定（C1 修复点）
├── src/stores/session.ts               ← inFlightThinking（思维链归属修复点）；
│                                          persist 键 sso.conversations，可直接读 localStorage 验证 store
├── src/lib/agent/prompts/teaching-chat.ts ← LECTURE_TASK_SECTION / OUTPUT_PACING_NOTICE（C2 修复点）
├── scripts/generate-lecture-cache.ts   ← 结构守卫 + 截断守卫；--only=模块:步骤 可单跑
├── scripts/lecture-split-spec.ts       ← C1 回归 6 例
├── scripts/thinking-attribution-spec.ts ← 思维链归属回归 2 例
├── scripts/run-tests.mjs               ← 新组：分屏消息过滤 / 思维链归属
├── src/app/api/audit/evaluate/route.ts ← 审计评估代理（rate-limit audit 桶）
├── src/lib/agent/student/              ← screen-describer（支持 proxyUrl）/ action-executor / comprehension-verifier
└── scripts/student-agent/              ← curriculum-audit.ts（Playwright 独立栈，已被子智能体路线部分替代）
                                           knowledge-window.ts（12 模块词汇表 + detectLeaks，纯函数）
                                           student-autonomous-run.ts 等 5 个 demo（未提交）

试点产出（gitignored，student-agent-output/pilot/）
├── curriculum-audit-pilot-report.md    ← 主报告 + 修复附录（本轮最完整的记录）
├── ts-basics/                          ← 截图 ×5、证据链 ×4、裁判裁决 ×2
└── leak-scan.ts / leak-scan-result.json ← 确定性泄漏扫描（可重跑，跑全部模块缓存）
```

**产品内审计员的设计修正（下一轮核心）**：HANDOVER 10-06 第 2 步方案继续有效（Skill + 编排循环 + audit_findings 落库 + 前端报告页），但**不需要浏览器**——可读性/可及性/泄漏直接读 wiki 源文件 + `lecture_cache` 表即可算；「页面可达性」审计才需要浏览器，那项交给子智能体在开发期做。审计发现分类法直接复用 `curriculum-audit.ts` 的 AuditFinding（severity × dimension）。

---

## 六、Git 状态（2026-10-07 19:20 实测）

```bash
# 分支：dev；HEAD = 2605173 "style: prettier 格式化（7 个 wiki 概念页 + AGENTS.md + 一个 spec）"
# 与远端：完全同步（git ls-remote origin dev 直连核对 = 2605173）
# 工作区判定：git write-tree == HEAD^{tree} 为真（93390102…）；git fsck missing 0
# 未提交：仅 HANDOVER.md（本文件，作者笔记）

# 移交时（10-07 上午）的三类 WIP 已全部消化为提交：
#   ① 语言断层修复 → 23b2882（wiki）+ 8f67b34（代码）
#   ② ExplainNextButton → 931cd53
#   ③ 5 个实验脚本 → 移出仓库到 student-agent-output/_untracked-demos/（可逆）
```

**⚠️ 本机 git 地雷（`AGENTS.md` 第四节有完整版）**：

1. **禁切分支式操作**（`git checkout <branch>` / 跨分支 merge）—— 本质是批量替换工作区文件，逐文件入回收站、预算爆掉。**已因此毁过仓库一次**（19 个 git 对象失踪）。合并改用 plumbing（`git merge-tree` → `commit-tree`），完全不碰工作区。
2. **禁 `git rebase`**（含 `-i` / `--exec`）、**禁 `git filter-branch`**。修中途提交改用追加 `fix:` 小提交。
3. **禁 `git add -u`**，只 `git add <具体路径>`。
4. **`.git/refs/remotes/origin/` 会反复整个消失**（10-07 三次），此时 `git rev-list origin/dev..HEAD` **静默返回空**，看起来像「已同步」。⚠️ **核验推送必须用** `env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy git ls-remote origin dev` 拿真实 SHA 比。修复：直接 Write `.git/refs/remotes/origin/dev`（40 位 SHA + 换行）—— `mkdir -p` 建出来的下个调用就没了。
5. **推送被代理阻断**（`CONNECT tunnel failed, response 502`）→ 上面那条 `env -u` 组合。
6. 判定仓库干净的**硬判据**是 `git write-tree` 逐字符等于 `git rev-parse HEAD^{tree}`，不是 `git status` 干净。

---

## 七、后续待办

### ~~第 0 步：推送 + 处置 WIP~~ ✅ 已完成

6 个提交：`23b2882`（wiki 重写）/ `f6e6298`（删 python-basics 页）/ `8f67b34`（运行时收窄）/ `d181c19`（spec 清理）/ `931cd53`（ExplainNextButton）/ `e5d39bc`（删未用参数，恢复 tsc 绿）。5 个实验脚本移到 `student-agent-output/_untracked-demos/`（可逆）。

### ~~第 1 步：扇出 11 讲审计~~ ✅ 已完成（实审 **10** 讲）

报告 `student-agent-output/fanout/fanout-audit-report.md`（gitignored）。**审 10 而非 11 的原因**：`python-basics` 概念页已随语言断层修复删除，运行时不可达。

### ~~第 2 步：产品内审计员~~ ✅ 已完成

7 个提交：`921645b`（存储层）/`6af67e8`（五项确定性检查）/`5fa8bf4`（编排）/`4e4deb5`（列名语义修正）/`f5d7df4`（API+限流）/`c04c059`（前端页）/`a18d0e1`（浏览器验收）/`2605173`（格式化）。入口：`/audit` 页、`/api/audit`。

### ~~第 3 步：扇出与审计员结论并入本文档~~ ✅ 已完成（本节 + 第四节 4.1/4.2）

### 第 4 步建议（按优先级，均为**未闭合**项）

| 优先级 | 事项                                                     | 依据                                                                           |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0     | system-prompt observe 回复 `error`                       | 扇出唯一 critical，学习路径断死                                                |
| P0     | 思维链泄漏内部口径 —— **修铁律 5 并 `--force` 重跑缓存** | 10/10 讲，直接违反「零基础」产品承诺；机制性根因已定位（见 4.2）               |
| P1     | 讲稿与概念页的**内容**对齐（渲染层已修，内容层未修）     | 8/10 命中；审计员仍报 3 条                                                     |
| P1     | 术语断层 3 条改讲稿                                      | 审计员已定位到具体词（`llm-api` 上下文 / `tool-calling` Agent / 另一条待复核） |
| P1     | `ExplainColdStart` 死代码                                | 主交付讲，`explainReadability` 3.5 全场最低                                    |
| P2     | 双任务冲突加仲裁文案                                     | 3/10 命中                                                                      |
| P2     | 4 讲未过示范代码验收线                                   | ai-safety 4.5 最低                                                             |
| P3     | 编辑器标签页与任务错配                                   | 4/10 命中                                                                      |
| P3     | 登录表单提交后不跳转                                     | 10/10 采集者遇到，零确认                                                       |
| P3     | 生成器自动重试（带字段级错误反馈）                       | 现为「拒写 + 重跑提示」                                                        |
| P3     | 知识窗泛词白名单（`agent`/`tool`/`multi-agent` 误报）    | 影响确定性检查可用性                                                           |

### 做判定类缺陷时的两条纪律（本轮学费）

1. **确定性检查会误报，且误报率高到会淹没真缺陷。** 本轮「内容一致性」首版 8/11 全误报、「术语断层」首版误报 10 处。修法不是放宽阈值，是**换判据**：改查概念页的**可数机制承诺词**（「四层」「五类」「场景 A」）而不是标题措辞；加 `countStandalone` 按独立词计（排除「上下文」只是「模型上下文协议」的子串）。
2. **判据要守性质，不守字面形状。** 「任何一格都不能显示 0 分」是错的问题 —— 它把数据层合法的 0 分当渲染 bug。正确判据是**拿数据源真值逐格对账**（null↔「未检测」、有值↔对应数值）。只有对账能把「NULL 被画成 0」和「真 0 分」分开。

---

## 八、注意事项

1. ~~**不要用 Playwright 版 `curriculum-audit.ts` 跑全量审计**~~ —— **已作废**。产品化后的判据在 `src/lib/audit/deterministic.ts`，编排入口 `src/lib/audit/orchestrator.ts`。旧文件（`scripts/student-agent/curriculum-audit.ts`）认知状态机是硬编码的，只当历史参考。子智能体路线（浏览器 + 人格提示词）仍是验证「页面可达性」的正路。
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
