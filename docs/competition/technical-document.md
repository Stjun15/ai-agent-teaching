# AI Native 编程教学助手 — 技术文档

> 传智杯「AI WEB网页开发挑战赛」· C组 · 广东交通职业技术学院 · 江家俊、黄浩喆、黄浚皓
>
> 2026年10月

---

## 一、项目概述

### 1.1 项目背景

2026年被业界称为"AI Agent元年"。以GPT-5、Claude 4、Gemini Ultra为代表的新一代大语言模型在推理能力、多模态理解、长上下文处理等方面取得了突破性进展。AI Native的设计理念正在改变Web应用的产品逻辑、交互方式和用户体验。

然而，市面上AI编程教学产品存在明显的断层：要么只讲模型API的基础调用，要么直接提供现成的Agent框架代码——中间最关键的一环「如何把模糊意图转化为可靠指令、如何让Agent稳定执行、如何判断输出质量」被系统性跳过。学习者完成教程后，面对真实场景仍然无从下手。

### 1.2 项目定位

**AI Native 编程教学助手** 是一款面向零基础学习者的AI协作能力训练平台。核心命题是：**不教学生"怎么让AI替你把代码写完"，而是训练六项可迁移的AI协作能力**——意图表达、任务分解、上下文管理、质量判断、迭代调优、理解AI行为模式。

教学形式不是传统视频+选择题，而是让学生在真实代码环境中，通过与4个AI Agent（导师/点评/出题/答疑）实时对话，完成"听讲→观察→模仿→点评→可视化→练习→掌握"七步学习闭环。产品同时提供三端：**Web教学平台**（学习概念与交互）、**终端验收脚本**（独立脚本自查）、**VSCode+AI编程助手**（实际动手编码）。

### 1.3 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 前端框架 | Next.js 16 (App Router) + React 19 | SSR/SSG混合渲染，服务端组件可读文件系统构建模块索引 |
| 语言 | TypeScript | 全量`tsc --noEmit`通过，类型系统覆盖Agent输出到数据库全部链路 |
| 样式 | Tailwind CSS v4 + shadcn/ui (Radix) | 无运行时开销的原子化CSS，Radix原语保证可访问性 |
| 状态管理 | Zustand 5 | 体积小、无Provider包裹、按需订阅，适合多组件分权消费 |
| Agent SDK | `@earendil-works/pi-coding-agent` | 原生支持工具调用白名单、流式输出、多轮对话 |
| 模型平台 | 火山方舟 Volcengine Ark <br/>文本: `deepseek-v4-flash-ga-260731` <br/>视觉: `doubao-seed-2-1-pro-260915` | 同一OpenAI兼容端点驱动文本+视觉双模型，无需跨平台维护 |
| Embedding | 百炼 `qwen3.7-text-embedding` (1024维) | 免费额度独立、同端点零改流 |
| 数据库(开发) | SQLite (`node:sqlite`) | 零依赖、免原生编译、部署期换PostgreSQL改一处`sqlite.ts` |
| 数据库(部署) | PostgreSQL + pgvector（预留，未验证） | 驱动名只在 `sqlite.ts` 一处出现，换 PG 是预留出口；当前所有环境实测均跑 SQLite |
| 校验 | Zod 4 (HTTP) + TypeBox (工具参数) | 运行时字段级校验，失败回喂精确错误信息给模型重试 |

---

## 二、需求分析

### 2.1 目标用户与痛点

| 用户 | 典型痛点 | 本平台的解法 |
|---|---|---|
| **零基础学习者** | 知道AI很强大但不知从何入手，教程要么太浅(只讲API)要么太深(直接给框架) | 12个模块按依赖拓扑排序，从LLM API起步逐步到多Agent、MCP、安全，每步都有概念页+可视化场景+动手任务 |
| **自学者** | 做完教程没有反馈，不知道自己写的Prompt/Agent对不对 | 4个Agent中的点评Agent与出题Agent提供结构化评分(维度分+扣分清单+改进建议)，掌握度追踪全程 |
| **教师/培训者** | 批改学生AI作业费时费力，难以量化掌握水平 | 点评Agent自动批改代码和Prompt，校验规则写死在Skill文件中保证一致性 |

### 2.2 功能性需求

| 编号 | 需求 | 实现状态 |
|---|---|---|
| F1 | 模块化概念教学，支持流式讲解 | 已完成 — teacher Agent SSE流式讲解 |
| F2 | 交互式可视化场景展示Agent工作原理 | 已完成 — 9个React动画场景 |
| F3 | 代码/Prompt自动点评与维度评分 | 已完成 — reviewer Agent + 16个validate Skill |
| F4 | 变式练习题自动生成 | 已完成 — examiner Agent按掌握度出题 |
| F5 | 学生掌握度追踪与学习路径调整 | 已完成 — 4规则引擎自动分析 |
| F6 | LLM Wiki知识库与RAG检索 | 已完成 — 关键词+向量双路RRF融合 |
| F7 | 平台复刻项目制教学(从零搭建教学平台) | 已完成 — 六阶段专属教学路径 |
| F8 | 学习报告与错题本 | 已完成 — `/report`页+趋势图+错题汇总 |
| F9 | 安全防护(输入过滤+输出打码+限流) | 已完成 — 四道安全门 |
| F10 | 多学生数据隔离与认证 | 已完成 — 注册/登录/改密+单库隔离 |

### 2.3 非功能性需求

| 需求 | 目标 | 达成方式 |
|---|---|---|
| 性能 | SSE首Token延迟 < 3s | 引用检索与模型调用并行，引用先于首Token到达 |
| 可靠 | Agent输出不合法时自动重试+兜底 | Zod校验+最多3次重试+`usedFallback`标记 |
| 安全 | 提示注入拦截、密钥零泄露 | 输入过滤(不落库)+输出递归打码(structural pattern) |
| 可观测 | 每次Agent调用可追溯 | `agent_traces`表记录agent/skill/tokens/duration/retries |
| 可维护 | 教学内容改Markdown不碰代码 | wiki驱动：模块定义、讲稿缓存、概念页全部文件化管理 |
| 兼容 | 跨浏览器一致性 | `cross-browser-spec` 按 Chromium / Firefox / WebKit 三引擎写断言；本机只装了 Edge，实测 11/11，未安装的引擎在报告里照实标注未覆盖 |

### 2.4 与传统教学方案的优势对比

传统AI编程教学面临三个死结：

| 传统模式 | 问题 | 本平台解法 |
|---|---|---|
| 视频课/文档自学 | 学生对着屏幕看，没人看他的代码。学了20小时不知道自己对不对 | 七步教学—观察（评审别人的代码）→模仿（写自己的）→点评（16个专属Skill逐维度批改），每一步都有反馈 |
| 通用AI聊天 | ChatGPT能给答案，但不会教"为什么这么想"。学生复制粘贴就跑 | 导师Agent的System Prompt禁止直接给完整答案，而是引导分析+给范例框架+让学生填空 |
| 一次性的Camp/训练营 | 3天集训后无跟踪，效果不可衡量 | 掌握度系统0-5持续跟踪，四规则自动推荐复习/跳过，路径调整有据可查 |

AI教学不靠"AI比人讲得好"，而靠**AI永远在线、永不疲倦、逐次追踪**——这是人力教学做不到的。

---

## 三、系统架构设计

### 3.1 六层架构

```
┌──────────────────────────────────────────────┐
│  呈现层  pages / components / 9 scenes       │
│  (React 19 + Tailwind + Zustand)             │
├──────────────────────────────────────────────┤
│  接入层  28 API endpoints (Route Handlers)   │
│  Zod校验 / 身份解析 / 限流 / SSE流式         │
├──────────────────────────────────────────────┤
│  编排层  4 loops: teaching / question /      │
│  validation / assess                        │
│  不碰HTTP、不构造身份                         │
├──────────────────────────────────────────────┤
│  Agent内核  prompts / skills / tools /       │
│  runtime / loop / trace / embeddings         │
│  模型调用唯一入口: runAgent                   │
├──────────────────────────────────────────────┤
│  知识层  llm-wiki/ (Markdown) + wiki/ (TS)   │
│  教学内容权威来源，可读可diff可评审            │
├──────────────────────────────────────────────┤
│  数据层  SQLite 18表 + repository 抽象       │
│  驱动名只允许出现在 sqlite.ts                 │
└──────────────────────────────────────────────┘
```

**三条核心边界**：

1. **身份只在接入层构造**：编排层与内核不知道"学生是谁"，只是透传——在编排层硬凑上下文会写出归属错误的观测数据。

2. **模型调用唯一入口**（`runAgent`）：Trace记录、输出打码、Skill越权检查都挂在这一个出口上，不存在"某个端点漏了"。

3. **知识层是文件而非数据库**：12个模块的id/名称/难度/前置依赖都从`llm-wiki/concepts/*.md`的YAML frontmatter动态读取，通过拓扑排序自动推导教学顺序——改页面依赖关系，顺序自动跟着改。

### 3.2 一次真实请求走完六层

以"学生在对话里发一句话"（`POST /api/session/[id]/message`）为例：

| 步骤 | 操作 | 所在层 |
|---|---|---|
| 1 | 解析身份：读请求头获取学生ID并验证存在 | 接入层 |
| 2 | 限流：身份确认后立即执行，早于请求体解析 | 接入层 |
| 3 | 校验请求体（Zod），不合法则400 | 接入层 |
| 4 | 载入会话并校验归属 | 接入层→数据层 |
| 5 | 输入过滤：检测提示注入模式，命中即拦且不落库 | 接入层 |
| 6 | 读取近期对话历史（按4000字符预算截断） | Agent内核 |
| 7 | 检索引用：本地Wiki关键词+向量双路融合，毫秒级 | 知识层 |
| 8 | 学生消息立即落库 | 数据层 |
| 9 | 启动Agent循环：SSE流式回答，逐token推送 | Agent内核 |
| 10 | 流结束后落库助手消息 + 回填引用 + 累加token与时长 | 数据层 |

### 3.3 数据模型

17张SQLite表，按用途分五组：

| 用途 | 核心表 | 说明 |
|---|---|---|
| 教学主链路 | `sessions`, `messages`, `questions`, `question_results`, `citations`, `agent_events` | 会话→消息→题目→答题→引用→Agent事件的完整链路 |
| 学情 | `mastery`, `learning_paths`, `student_profiles`, `students` | 掌握度(0-5)、路径进度、学习偏好、基本档案 |
| 点评与观测 | `validation_results`, `agent_traces`, `prompt_history`, `errors` | 批改结果、Agent调用追踪、Prompt历史、错题本 |
| 知识库 | `knowledge_embeddings`, `lecture_cache` | 向量索引 + 讲稿缓存 |
| 认证与项目 | `projects` + `students` 认证列 | 没有独立用户表：账号（`username` / `password_hash`）与学情共用 `students` 一行 |

关键设计：`mastery.score`（掌握度）由点评完成后的**代码逻辑**计算，不依赖模型措辞——模型说"很好、很棒"不等于通过，避免"其实没过却被判过"。

### 3.4 前端组件树

```
Layout (globals.css + site-footer + top-nav)
├── HomePage
├── LearnCenter (module-card × 12, 动态读取wiki)
├── ModuleWorkspace (七步教学)
│   ├── StepNav (左侧步骤时间线)
│   ├── MasteryCard (掌握度卡片)
│   ├── PathAdjustmentList (路径调整建议)
│   ├── ExplainFullscreen (流式讲解)
│   ├── ObservePanel (示范代码展示)
│   ├── CodeEditor + ValidateSubmit (代码编辑与提交)
│   ├── PracticePanel (变式练习答题)
│   └── VisualizationPanel (9个交互场景)
├── PlatformReplicaWorkspace (复刻专属六阶段)
│   ├── PhaseNav (阶段导航时间线, 260px)
│   ├── PhaseDetailCard (阶段任务详情)
│   ├── ReplicaToolbox (双模式工具箱)
│   └── 教案区块 (内联于 platform-replica-workspace, 页面底部)
├── ChatPanel (浮动对话面板)
│   ├── Composer (输入框)
│   ├── AgentTimeline (Agent思考过程)
│   ├── CitationPanel (引用来源)
│   └── MarkdownView (富文本渲染)
├── ReportView (学习报告)
└── SettingsView (主题/偏好设置)
```

---

## 四、AI技术方案

### 4.1 模型选型与理由

**对话平台**：火山方舟 Volcengine Ark，OpenAI兼容端点 `https://ark.cn-beijing.volces.com/api/v3`。同一平台上跑两个模型：

| 模型 | 用途 | 特点 |
|---|---|---|
| `deepseek-v4-flash-ga-260731` | 文本推理（教学对话、Agent编排、点评批改） | DeepSeek V4 Flash，原生多模态，128K上下文，16K输出上限 |
| `doubao-seed-2-1-pro-260915` | 视觉理解（截图解析、UI反馈） | 豆包视觉模型，256K上下文 |

| 选型要素 | 理由 |
|---|---|
| **同平台双模** | 文本与视觉模型共享同一个OpenAI兼容端点，无需分平台维护两套密钥和两套SDK适配层——`ark.ts`一次注册、两个模型共用 |
| **兼容端点** | 完全兼容OpenAI `/v1/chat/completions`协议，pi-agent SDK原生适配 |
| **推理速度** | Flash变体延迟显著低于Pro，教学场景的实时对话要求首token延迟<3s |
| **成本可控** | Flash定价远低于Pro，学生高频对话不会产生过高费用 |
| **中文能力** | DeepSeek系列对中文指令的理解与生成质量经过大量验证 |

**Embedding模型**：百炼 `qwen3.7-text-embedding` (1024维)，独立于对话模型的免费额度，向量检索不受对话模型变更影响。

### 4.2 四Agent架构

教学系统由4个角色Agent协作完成，每个Agent由"身份层（System Prompt）+ 技能层（Skill文件）+ 知识层（Wiki引用）+ 编排层（工作流代码）"四层组装而成：

```
System Prompt (身份: 你是谁、职责、行为准则)
 +
Skill Content (技能: 当前任务怎么做、步骤、评分维度)
     =
  完整 Prompt → 发送给模型
```

| Agent | 职责 | 默认Skill | 允许额外Skill | 适用教学步骤 |
|---|---|---|---|---|
| teacher (导师) | 讲解概念、触发可视化 | `explain-concept` | `trigger-visualization`, `answer-question` | explain |
| reviewer (点评) | 批改代码/Prompt、维度评分 | `validate-*` (16个) | `trigger-visualization` | validate |
| examiner (出题) | 根据掌握度生成变式练习题 | `generate-question` | 无(单技能) | practice |
| assistant (答疑) | 回答学生疑问、必要时扩展讲解 | `answer-question` | `explain-concept` | 全步骤 |

**Agent权限由代码控制，不靠模型自觉**：每个Agent的`allowedSkills`白名单在代码层硬编码（`src/lib/agent/prompts/index.ts`），运行时入口`runAgent`即拦截越权调用——出题Agent拿不到`validate-code`，导师Agent触发不了`validate-prompt`。此外，Agent之间不直接传消息，共享状态通过知识层与学生画像表交换。

### 4.3 结构化输出、重试与兜底

模型输出不可信是本系统的核心假设。输出须为JSON且必须通过Zod校验，三层保障：

| 环节 | 做法 |
|---|---|
| **提取** | `extractJson`从任意文本中无损抠出最可能是JSON的片段 |
| **校验** | 对Agent专属schema（`TeacherOutput`/`ReviewerOutput`等）逐字段验证 |
| **重试** | 失败时将`previousError`（Zod字段级报错）+`previousRawText`（模型原话）回填prompt，最多3次尝试 |
| **兜底** | 3次均失败后用预置`fallback()`，并标记`usedFallback: true` |

兜底的两个硬原则：**诚实**（`usedFallback`标记必须可被调用方识别，文案明确"本次自动评分未生效"）和**不阻断**（给出继续走的建议方向）。评分兜底刻意给"未评分"而非假分数——外观正常的假分数是最恶劣的兜底。

### 4.4 知识层与混合检索

**LLM Wiki**是教学内容的权威来源：`llm-wiki/`下86个Markdown文件，含18个概念页、9个设计模式、9个反模式、19个评分标准、9个评估题。概念页采用YAML frontmatter声明元信息（id/name/difficulty/prerequisites/tags），前端模块列表直接调用`src/wiki/`解析层动态读取——不存在第二份硬编码副本导致漂移。

**检索方案**：关键词+向量双路召回，RRF融合。

| 指标 | 关键词路 | 向量路 | 混合(RRF) |
|---|---|---|---|
| recall@3 | 68.2% | **95.5%** | 90.9% |

向量路由`qwen3.7-text-embedding`生成1024维嵌入，按`##`章节切块后全量加载到内存做余弦检索。向量路失败时自动降级关键词路并标记`usedFallback`。引用检索在模型调用**之前**以SSE事件发给前端——等首token的空档被本地检索填充，学生先看到"本节参考了哪几页"。

#### 4.4.1 融合倒挂：混合检索为何低于纯向量（已知问题与取舍）

上表如实公布了一个**不利结果**：混合（RRF）recall@3 为 90.9%，比纯向量路的 95.5% 低 4.6 个百分点。评测集是 22 道按课程内容编写的检索题（每题有唯一正确页），三路同题同集（2026-10-27 复跑，索引建立于 10-05，仍含一页已退役的 `concepts/python-basics.md`，属陈旧但不影响结论量级）：

| 路径 | 命中 | recall@3 | 相对纯向量 |
|---|---|---|---|
| 关键词（BM25 风格加权） | 15 / 22 | 68.2% | −27.3pp |
| 纯向量（qwen3.7-text-embedding，1024维） | 21 / 22 | **95.5%** | 基准 |
| 混合（RRF，k=60，两路各取前 8） | 20 / 22 | 90.9% | **−4.6pp** |

**机制原因（不是玄学）**：RRF 只用**排名**、不看绝对相似度（`score = Σ 1/(k+rank)`）。它的隐含假设是两路精度相当，本库却不满足——关键词路落后 27.3 个百分点。于是关键词路靠词面重合挤进前 8 的**语义无关页**，在融合后仍能拿到与向量路正确页同量级的分数，把正确答案从前 3 挤出去。换句话说：**低精度的一路在给结果投票，且票重相同。**

**三条可选路径与当时的选择**：

| 方案 | 做法 | 代价 | 结论 |
|---|---|---|---|
| A. 加权 RRF | 向量权重 1.0、关键词 0.5 | 权重必须用**另一份**评测集验证，否则就是拿答案调参 | 未采用（缺第二份评测集） |
| B. 纯向量 + 关键词仅作降级 | 正常走向量，模型不可用/无索引时才用关键词 | 失去「专有名词（MCP/SSE/Token）词面精确命中」这条兜底 | 未采用（可用性优先于 4.6pp） |
| C. 保留三路，如实记录 | 默认仍走混合，评测数据与原因写进文档 | 承认一个已知弱点 | **当前选择** |

**保留 C 的依据（可核查，不是自我安慰）**：① 混合仍比关键词路高 18.2 个百分点，保证了「向量路异常时的下限」；② 向量路失败会自动降级到关键词并打 `usedFallback`，不会出现空召回；③ 22 题样本上 1 道题的差距不足以支撑架构级改动，且没有第二份评测集时调权重等于过拟合。

**下一步（已列入口径而非口号）**：把评测集扩到 ≥60 题并冻结，再按 A 方案做加权对照；只有当加权方案在**两套**评测集上同时不低于纯向量时，才改默认路径。在那之前，本文档不把混合检索写成「优于纯向量」。


### 4.5 上下文预算与多轮对话管理

多轮对话历史全文进prompt，长会话线性吃token。当前两道上限：

- **条数限制**：只取最近20条进prompt
- **字符预算**：`HISTORY_CHAR_BUDGET = 4000`，超出时从最旧整条丢弃，最新一轮无条件保留（截半条会让模型读断句）

角色归并：库中六种role到模型眼里只有"学生"与"助手"两种，system消息不进历史——区分六个说话人会让模型误以为房间里站着一堆人。

### 4.6 安全防护：四道门

| 门 | 位置 | 拦什么 |
|---|---|---|
| 输入过滤 | 对话路径（`session/[id]/message`, `agent/answer`） | 提示注入：danger words + 结构性注入模式（英文忽略指令、越权角色扮演、套取系统提示词） |
| 输出打码 | `runAgent`出口，递归遍历整个输出对象 | 凭据（`sk-`密钥、Bearer令牌），按结构性模式识别，不读环境变量 |
| 限流 | 每个受限端点首行 | 误刷与脚本循环；进程内固定窗口，多实例各自计数 |
| 权限 | `runAgent`入口 | Skill与工具的越权调用 |

两处刻意的不拦：①提交作业路径不过滤（module 9的作业本身就是写攻击样例）；②拦下的输入不落库（否则进入历史后被反复喂给模型）。

### 4.7 SSE流式优化

三轮优化后的SSE传输策略：

| 优化项 | 方法 | 效果 |
|---|---|---|
| Token批量合并 | `setTimeout(0)`按buffer合并渲染 | 渲染频次从30-80次/秒降至约20次/秒 |
| 并行预加载 | 引用检索与模型调用异步并发 | 消除2-5秒空白等待 |
| 思维链前置 | 追加planner替换分段、默认展开、中文思考指令 | 思维过程先于首token可见 |

### 4.8 编排层：状态机设计

教学循环跨多次HTTP请求（讲解后等回答、出题后等提交），不可能在一个请求里跑完。编排层采用**状态机模式**：

```
teaching-loop.ts  →  讲解 ─→ 出题 ─→ 校验 ─→ 可视化 ─→ 掌握度
question-loop.ts  →  生成3道变式练习题
validation-loop.ts →  批改 → 维度评分 → 重试(≤3次) → 兜底
assess-loop.ts    →  掌握度评估
```

每一步都是可独立调用的函数，状态用可序列化的普通对象（非class），调用方持久化`TeachingState`传给下一步。

### 4.9 多模态视觉评审

平台不是纯文本系统。当学生截代码发过来、贴终端报错、或提交UI作品截图时，走独立的**多模态评审管线**（[vision-review.ts](file:///d:\ai-agent-teaching\src\lib\agent\vision-review.ts)）：

- **路径分离**：文本点评走 `loop.ts` 的标准Agent循环，图片评审走独立的HTTP fetch直连火山方舟视觉模型（`doubao-seed-2-1-pro-260915`）。分离的原因很实际：Agent SDK的 `session.prompt(text)` 只接受纯文本，无法传多模态content array
- **流结构统一**：视觉管线把OpenAI SSE chunk翻译为项目10种SSE事件，前端不需要区分"这次是文本模型还是视觉模型"——打字机效果、Token计数、思维链展开全部复用同一套渲染逻辑
- **篇幅控制**：视觉点评强制500字上限——教学场景的截图评审不需要长篇大论，够说清问题本质即可
- **学生模拟Agent复用**：`screen-describer`（屏幕描述子Agent）复用了同一套VLM调用模式，用视觉模型"看懂"学生操作界面后再做理解推断

### 4.10 MCP协议与工具集成

平台不仅**教**MCP（第11讲），自身也深度集成了工具调用机制：

- **Function Calling**：所有4个Agent都走OpenAI兼容的 `tool_choice` + `tools` 参数完成函数调用——不是手工解析模型输出里的"调用意图"，而是让模型真正执行 `tool_calls`
- **可视化场景**：[scene-mcp-flow.tsx](file:///d:\ai-agent-teaching\src\scenes\scene-mcp-flow.tsx) 用可交互动画展示了 Agent→MCP Client→MCP Server→外部服务 的完整调用链，开关可控制"工具描述为空"时的失败状态——让学生直观理解MCP协议中工具描述的重要性
- **平台自身的 MCP Server**：`src/lib/mcp/wiki-server.ts` 把知识库检索暴露为标准 MCP 工具 `search_wiki`（`StdioServerTransport`）；`src/lib/agent/tools/mcp-discover.ts` 在每次对话时启动子进程、走 JSON-RPC `initialize` → `tools/list` → `tools/call`，把发现的工具转换为 `AgentCustomTool` 注入 Agent Loop（失败静默回退，不影响对话）。`tests/mcp.test.ts` 真实拉起子进程做端到端回归——这条用例曾抓出一次「子进程导入路径错误导致 MCP 静默失效」的事故
- **MCP校验Skill**：[validate-mcp.ts](file:///d:\ai-agent-teaching\src\lib\agent\skills\validate-mcp.ts) 要求学生在动手环节设计一个完整的MCP Server工具集（≥3个工具、每个有name/description/parameters），点评时逐一检查工具设计的完整性和错误处理的Agent Loop闭环

---

## 五、核心功能实现

### 5.1 七步教学法

夜的七步对位认知学徒制（示范→辅导→退隐），ID入URL和数据库契约：

| # | ID | 中文 | Agent | 核心交互 |
|---|---|---|---|---|
| 1 | `explain` | 概念讲解 | teacher | SSE流式讲解+可视化触发 |
| 2 | `observe` | 观察示范 | — | 预设代码展示+确认门控跳转 |
| 3 | `imitate` | 动手模仿 | — | 纯文本代码编辑器（textarea，理由见 `code-editor.tsx` 文件头）+任务卡片 |
| 4 | `validate` | 校验点评 | reviewer | 提交点评→维度分+扣分问题+改进建议 |
| 5 | `visualize` | 可视化 | teacher | 9个交互式动画场景，按模块对应 |
| 6 | `practice` | 变式练习 | examiner | 根据掌握度生成3道变式题 |
| 7 | `mastery` | 掌握判定 | — | 自动更新`mastery`表+是否进入下一模块 |

模块与可视化场景一一对应：`llm-api→请求-响应流程`、`agent-loop→天气Agent循环`、`mcp→MCP调用流程`等9个动画场景，均在`src/scenes/`中以React组件实现。

### 5.2 平台复刻六阶段教学

platform-replica模块不走通用七步法，而是**专属六阶段项目制教学**——学生用前11讲学到的每个零件亲手从零搭建一个能跑的AI教学平台：

| 阶段 | 名称 | 核心任务 |
|---|---|---|
| Phase 0 | 启动台 | 环境检查(Node≥22.5)、git init、项目初始化 |
| Phase 1 | 第一斧·对话骨架 | 搭建`/api/chat` SSE流式端点 |
| Phase 2 | 第二斧·多步Agent | 实现Agent Loop+工具调用 |
| Phase 3 | 第三斧·知识+DB+点评 | LLM Wiki+SQLite+点评Agent |
| Phase 4 | 龙骨·页面连线 | 前端路由+页面+管线串联 |
| Phase 5 | 结算 | 最终验收+交付与检验单 |

工具箱双模式设计：Phase 0/1 下发终端命令清单（bash / sql 片段，随阶段内容展示），Phase 2+ 切换为 Agent 自查交付物；两种口径统一由 `replica-check-parser.ts` 解析，`replica-check-spec.ts` 的 19 条断言守住解析与门控。每种内容框用独立色彩编码（石板灰/琥珀/绿/靛蓝/橙/紫），提高辨识度。

### 5.3 路径调整机制

基于掌握度数据的四规则引擎，每次`validate`或`answer-grade`后自动触发分析：

| 规则 | 触发条件 | 阈值 | 动作 |
|---|---|---|---|
| 连续失败 | 同一概念连续校验不通过 | ≥3次 | 建议插入变式练习题 |
| 错题积压 | 模块errorCount累积过高 | ≥3条 | 暂停推进，集中复习 |
| 掌握度下滑 | 相邻模块掌握度下降 | ≥2分 | 换讲解方式(类比优先) |
| 可跳过 | 掌握度高但模块未完成 | ≥4分 | 建议跳过余下练习 |

引擎是纯函数（`analyzePath`），不依赖数据库或网络，可脱离环境独立单元测试。去重逻辑（同reason 7天内不重复）+限流（每次最多2条）防止刷屏。调整记录写入`learning_paths`表的`adjustments` JSON列，前端`PathAdjustmentList`组件在模块页左栏实时展示。

### 5.4 可视化场景系统

9个交互式动画场景共用一套舞台层：`SceneStage`（`scene-stage.tsx`）+ 布局原语 `SceneFrame/SceneRow/SceneColumn`（`scene-canvas.tsx`）+ 图形原语 `NodeCard/MonoBlock/SceneArrow/ToolCard`（`scene-parts.tsx`）+ 参数控件 `SceneControls`；播放/暂停/步进/倍速由外层 `VisualizationPanel` 统一驱动，场景本身只提供帧数据与专属逻辑层。

| 场景ID | 场景内容 |
|---|---|
| `scene-request-response` | LLM请求-响应完整流程动画 |
| `scene-role-filter` | System Prompt角色滤镜对比 |
| `scene-loop-weather` | Agent Loop天气查询步骤演示 |
| `scene-tool-chain` | 工具调用链可视化 |
| `scene-retrieve-generate` | RAG检索-生成流程 |
| `scene-rag-vs-wiki` | RAG vs Wiki知识管理对比 |
| `scene-orchestration` | 多Agent编排通信 |
| `scene-mcp-flow` | MCP协议调用流程 |
| `scene-attack-defense` | AI安全攻击-防护对比 |

每个场景支持播放/暂停/步进/倍速控制，动画过渡由 `motion`（Framer Motion 的新包名，`motion/react`）实现。

### 5.5 点评与掌握度系统

#### 5.5.1 分层Skill路由

点评Agent (reviewer) 通过16个`validate-*` Skill文件完成批改。Skill选择分三层：

- **模块专属层**（11个）：每个教学模块对应一个`validate-{moduleId}` Skill，精确匹配该模块的动手任务
- **任务类型回退层**（4个）：`validate-prompt`/`validate-tool`/`validate-code`/`validate-qa`，当模块无专属Skill时按`taskType`回退
- **变式练习层**（1个）：`validate-practice` 面对动态生成的题目，没有预设清单，按题面现场判

路由优先级 `forceSkill → VALIDATION_SKILLS[moduleId] → VALIDATION_SKILLS_BY_TYPE[taskType] → "validate-code"` 在 [validation-loop.ts](file:///d:\ai-agent-teaching\src\lib\agent\orchestrator\validation-loop.ts#L207-L211) 中硬编码，不可被模型覆写。

#### 5.5.2 每个模块的专属Skill结构

每个模块专属Skill包含四个固定部分（以`validate-vibe-coding`为例）：

| 部分 | 内容 | 示例 |
|---|---|---|
| 这道题要做什么 | 该模块动手环节的具体任务描述 | "给番茄钟倒计时网页写一份四步工作法策划书" |
| 执行步骤 | 逐条检查清单，包含具体评判标准 | "步四的检查项不能是模糊词（好看/好用/流畅），必须是可判对错的" |
| 通过条件（本模块专用） | 除共性三条外的模块专属门槛 | "四步全有实质性内容 + 步四检查项全部可判对错 + 四步完整维度≥60%权重分" |
| skill_condition_check | 要求模型显式判定met/detail | "逐步说明哪步通过、哪步不通过，若步四有模糊词请列出" |

11个模块的专属通过条件各不相同——不是一套模板拍平所有，而是**每个模块有自己独特的"通过"定义**：

| 模块 | 专属通过条件 |
|---|---|
| ts-basics | 理解准确度 ≥ 60% 权重分 + 五个检查项至少正确解释四个 |
| vibe-coding | 四步全有实质内容 + 步四检查项可判对错 + 四步完整维度 ≥ 60% |
| llm-api | 理解准确度 ≥ 60% + messages 数组语法正确（role/content 齐全） |
| system-prompt | 角色定义 ≥ 60% + 三个维度全覆盖（每个至少两行实际内容） |
| tool-calling | 工具定义 ≥ 60% + name必须动词+名词 |
| agent-loop | 理解准确度 ≥ 60% + 四步全覆盖（Answer 可隐含）+ 有具体例子 |
| rag | 理解准确度 ≥ 60% + 三篇文档全覆盖 + buildContext 匹配到 adopt.md |
| llm-wiki | 理解准确度 ≥ 60% + source/target/schema 三参数完整正确 |
| multi-agent | Agent 数量 ≥ 2 且职责描述清晰 + 输入输出衔接清楚 |
| mcp | 工具设计 ≥ 60% + ≥3个工具 + 错误处理联系Observe步骤 |
| ai-safety | 理解准确度 ≥ 60% + 五道闸门全覆盖 + 拼音绕过分析正确 |

#### 5.5.3 共性通过线 + 模型自判

所有模块共享三条**代码硬条件**（[isPassing()](file:///d:\ai-agent-teaching\src\lib\agent\orchestrator\validation-loop.ts#L133-L147)纯函数）：

- `total_score >= 75`（`PASS_SCORE`硬编码，非60）
- `is_correct === true`
- 无"严重错误"类型的issue

共性三条之后，进入**Skill个性条件**：代码不再按`taskType`硬编码额外条件，而是读取模型输出的`skill_condition_check.met`字段——模型读的就是那份评分标准+Skill内容，最清楚自己给每个维度的分数是否满足通过线。代码只检查"模型是否做了这个判断"，不替代模型做维度名匹配（此前硬编码"角色定义维度≥60%"会因为模型写成"角色设定"而漏判）。

#### 5.5.4 点评格式与校验

`ReviewerOutput` Zod Schema在[outputs.ts](file:///d:\ai-agent-teaching\src\lib\agent\outputs.ts#L140-L201)定义，比设计文档原文收紧三处：

| 收紧点 | 实现 | 原因 |
|---|---|---|
| `deduction`归一化为正数 | `Math.abs(value)` | 提示词示例写-10而校验原要求≥0，矛盾导致间歇失败 |
| 维度权重之和≈1 | `checkDimensionWeights` refine | 模型漏报维度时分数不可复核 |
| `skill_condition_check` | `{ met: boolean, detail: string }` | 模型自判，代码不再硬匹配维度名 |

格式校验失败时走三重保障：`extractJson`提取→`JSON.parse`解析→Zod字段级校验→附带精确错误回喂重试（最多2次）→兜底（`reviewerFallback`，标注`usedFallback`不让调用方当真）。

#### 5.5.5 掌握度更新与路径调整

掌握度计算在点评完成后由**代码逻辑**执行——不依赖模型措辞，避免"很好"式误判。`masteryScoreFromPromptScore()`将点评分0-100映射为掌握度0-5；判定线是 `MASTERY_PASS_SCORE = 3`（5 分制的「良好」档），≥3 分即过关并解锁下一讲。≥4 分是路径引擎「可跳过余下练习」的建议阈值，不是升级门槛——两者不是同一条线，早期文档把这两处混写过，以代码为准。

每次点评落库后触发四规则路径调整引擎（[path-adjuster.ts](file:///d:\ai-agent-teaching\src\lib\agent\path-adjuster.ts)）：连续3次失败→变式题回放、掌握度连续下降→换类比、错误积压≥3→标记复习、掌握度≥4→跳过余下练习。同reason 7天内去重。

### 5.6 前端工程质量

项目前端以TypeScript严格模式驱动，[tsconfig.json](file:///d:\ai-agent-teaching\tsconfig.json) 启用 `strict: true`、`noUnusedLocals: true`、`noUnusedParameters: true`、`noFallthroughCasesInSwitch: true`——不是"建议"，是编译阻断。整个代码库零 `any` 类型（全局搜索 `: any` 返回空）。

**组件化架构**：59 个 React 组件按职责分布在 9 个子目录——`learn/`（23）、`chat/`（12）、`ui/`（6 个通用组件）、`layout/`（5）、`report/`（5）、`code/`（3）、`settings/`（3）、`auth/`（1）、`student/`（1）。每个组件职责单一：例如 `replica-toolbox.tsx` 只管工具箱面板不碰教学逻辑，`platform-replica-workspace.tsx` 只做布局分栏不碰阶段切换。

**状态管理**：[7 个 Zustand store](file:///d:\ai-agent-teaching\src\stores\index.ts) 按领域拆分——`session`（身份会话）、`settings`（模型与主题）、`code`（代码编辑器）、`qa`（问答题，直接 import 未进统一出口）、`student`（学生模式）、`floating-chat`（浮动对话框）、`visualization`（可视化场景）。不设全局store，每个store只管理自己的状态切片，store之间通过selector解耦。

**性能优化**：20 个组件使用 `Suspense` + `React.memo` + `useMemo` + `useCallback` 共 60 处（[skeleton-card.tsx](file:///d:\ai-agent-teaching\src\components\ui\skeleton-card.tsx) 提供统一的骨架屏加载态）。Next.js App Router自动代码分割按路由切chunk；`turbopackIgnore` 注释显式禁止Turbopack将 `sqlite.test.ts` 等测试文件拖入产物。SSE流式输出采用Token批量合并策略——同一个 tick 内到达的 token 合并成一次 `setState`（`setTimeout(0)`），避免 30-80 次/秒的重渲染阻塞主线程。

### 5.7 用户体验设计

**视觉系统**：Tailwind CSS v4 + shadcn/ui 组件体系，统一色彩令牌而非硬编码色值。教学模块按难度分三级色彩编码（绿/黄/红），[difficulty-badge.tsx](file:///d:\ai-agent-teaching\src\components\learn\difficulty-badge.tsx) 确保全平台统一标注。[skeleton-card.tsx](file:///d:\ai-agent-teaching\src\components\ui\skeleton-card.tsx) 用骨架屏替代简单的Spinner——在教学模块加载期间展示占位卡片布局，避免页面抖动，同时给用户一个"具体哪部分在加载"的视觉线索。

**动画与过渡**：5个组件引入 `motion`（Framer Motion 的新包名），整体策略克制——[animated-section.tsx](file:///d:\ai-agent-teaching\src\components\layout\animated-section.tsx) 遵循 `reducedMotion="user"` 系统偏好检测，装饰性入场动画在用户开启"减少动态效果"时自动退化为直接显示。`observe-panel.tsx`、`step-nav.tsx`、`visualization-panel.tsx` 使用 `AnimatePresence` 处理步进切换和面板展开/收起，动画时长控制在0.3-0.4s避免拖沓感。

**AI交互体验**：SSE流式输出逐字渲染（打字机效果），`token-counter.tsx` 实时显示Token消耗，`agent-timeline.tsx` 展示当前Agent执行链。错误边界优雅降级：模型输出不可解析时不是白屏或500，而是标注 `usedFallback` 后给兜底输出+推荐方向。"揭秘"面板在Agent工作时展示模型真实prompt和返回——让学生"看见AI在想什么"，而不只是"看见AI说了什么"。

**响应式适配**：全平台移动端可操作——双面板在小屏自动堆叠为上下布局，工具箱在窄屏收缩为可展开抽屉。`ChatPanel` 在移动端自动切换为全屏模式，确保代码编辑和聊天查看不会挤在一小块区域。

---

## 六、测试与部署

### 6.1 质量门禁

四级门禁（2026-10-27 本轮实测：eslint / tsc / 构建 / 测试全绿）：

| 级别 | 命令 | 当前结果 |
|---|---|---|
| TypeScript | `tsc --noEmit` | **0 error** |
| ESLint | `eslint src scripts tests` | **0 error**（21 条 warning，非阻塞） |
| Prettier | `prettier --check .` | 源码按配置格式化；全仓检查在 Windows CRLF 工作区会误报行尾差异，CI 未纳入该步 |
| 全量测试 | `node scripts/run-tests.mjs` | **53 组**（含 3 组真模型，需模型端点可用）；CI 子集 `--ci` 为 **28 组** |
| 标准测试框架 | `pnpm test:unit`（Vitest） | **18 个用例文件 / 134 条用例全绿**（行覆盖率 25.36%），`pnpm test:coverage` 出 V8 覆盖率报告 |

组合命令：`pnpm check` = eslint + prettier + tsc。

### 6.2 测试体系

53 组测试用例覆盖全部关键路径：

| 分类 | 测试组 | 用例数 |
|---|---|---|
| **Agent回归** | teacher / reviewer / examiner 真模型 | 3组 |
| **教学链路** | teaching-loop, teaching-step, teaching-grade, teaching-results, lecture-cache | 5组 |
| **校验系统** | validate-wiring, scores, scenes, practice-mastery, mastery-hydrate | 5组 |
| **路径调整** | path-adjuster (4规则+边界) | 1组 |
| **复刻验收** | replica-check-parser + replica-check-spec（6阶段×两种交付口径） | 19条 |
| **安全** | security, rate-limit, data-isolation, auth-flow | 4组 |
| **SSE** | sse-protocol, chat-stream, sse-dispatch | 3组 |
| **前端** | markdown, theme, client-identity, project-templates | 4组 |
| **RAG** | rag-hybrid (关键词/向量/混合/降级) | 5条 |
| **浏览器** | cross-browser, browser-acceptance | 2组 |
| **其他** | chat-controller, code-store, knowledge-card, agent-registry, abort-registry, report-dimensions, report-details, student-records, thinking系列, trace | 10+组 |

测试采用分组执行策略：`run-tests.mjs`逐组运行，一组失败不影响后续组。真模型回归因固有的间歇性失败（模型服务波动）不被串联到纯函数组之前。

标准框架入口：新增 `tests/` 目录使用 **Vitest 5**（`pnpm test:unit` / `pnpm test:coverage`），覆盖分数量纲、安全过滤、鉴权、维度聚合、Agent 输出 Zod 校验、六项子能力聚合，以及 **MCP 协议的端到端回归**（真实启动 stdio 子进程、JSON-RPC 握手并调用 `search_wiki`）。旧 `node:test` 用例与标准框架并存，互不覆盖入口。`.github/workflows/ci.yml` 在每次推送时跑 eslint + tsc --noEmit + Vitest（覆盖率）+ 测试子集 + 生产构建；Prettier 未进 CI（Windows CRLF 工作区会整仓误报，Linux 检出不受影响，见 6.1）。

### 6.3 部署方案

两条部署路径；当前采用路径B（常驻Node主机），已部署至阿里云ECS（`http://<ECS-IP>`，nginx→3000，systemd托管，SSE关缓冲）。在线演示地址与评审期可用性以提交材料为准：

| 路径 | 适用场景 | 前提条件 | 操作 |
|---|---|---|---|
| **路径A**：Serverless (EdgeOne Makers) | 免运维、自动扩缩 | 需先做代码改造：数据库换PostgreSQL托管版、知识层不再依赖运行期文件系统 | `deploy/deploy.sh` |
| **路径B**：常驻Node主机 | 功能完整、SSE/文件系统/SQLite全可用 | Node≥22.5 + 持久盘 | 装环境→拉代码→建表→systemd→nginx反代(SSE关缓冲) |

部署套件（`deploy/`目录）已包含一键部署脚本、systemd unit文件、nginx站点配置。`/api/health`端点提供节点版本、数据库连接、表状态自查。

---

## 七、总结与展望

### 7.1 技术创新点

| 编号 | 创新点 | 说明 |
|---|---|---|
| **T1** | **六项能力训练模型** | 不教"让AI写代码"，而是训练意图表达/任务分解/上下文管理/质量判断/迭代调优/理解AI行为六项可迁移协作能力。教学设计和产品功能都围绕这六个子能力展开。 |
| **T2** | **四Agent教学协作架构** | 四个Agent（导师/点评/出题/答疑）各司其职，权限硬编码在代码层而非依赖模型自觉。Agent间不直接传消息，共享状态通过知识层与数据层交换。 |
| **T3** | **结构化输出三重保障** | `extractJson`→Zod字段级校验→回喂精确错误重试→兜底标记。区别于常见做法"模型输出格式错了就报错给用户"，本系统对格式错误有完整的自愈流水线。 |
| **T4** | **知识层文件化管理** | 86个Markdown文件管理全部教学内容，模块定义由概念页frontmatter动态读取并通过拓扑排序推导教学顺序。检索走关键词+向量双路RRF融合，向量路失败自动降级。 |
| **T5** | **双模式教学路径** | 11个概念模块走七步教学法（认知学徒制），1个项目模块走六阶段工程教学。工具箱在独立脚本与Agent自查间自动切换，用色彩编码区分不同内容类型。 |
| **T6** | **路径调整纯函数引擎** | 掌握度驱动的四规则调整引擎是纯函数——可脱离数据库/网络独立测试，去重+限流+优先级排序内置。 |
| **T7** | **教学级安全模型** | 9个安全教学模块的反模式与防护是同一套规则的不同呈现——场景中的过滤代码真实引用了产品级的安全模块，做到"教安全=用安全"，而非"讲一套安全的道理，用另一套普通代码演示"。 |

### 7.2 应用创新点

| 编号 | 创新点 | 说明 |
|---|---|---|
| **A1** | **"浏览器外实操"教学形态** | 教学平台不替代IDE，而是提供任务卡、验收速查、Agent导师。学生在自己终端里敲命令、在自己项目里写代码，平台是"陪跑教练"而非"托管沙箱"。 |
| **A2** | **平台复刻：学完11讲后亲手搭建教学平台** | 教学闭环的终点不是考试——学生用前面学的每个零件（LLM API/Agent Loop/RAG/多Agent/MCP/安全），从零搭建出一个能跑的教学平台。自然形成能力的综合运用与验证。 |
| **A3** | **工具箱双模式** | 初期只给终端命令清单降低认知负荷（Phase 0/1），后期切换为 Agent 自查交付物（Phase 2+ 由解析器与 Skill 比对代码），适应学生能力成长节奏。 |
| **A4** | **掌握度驱动的个性化教学** | 不按固定顺序推进——点评后自动更新掌握度，连续失败触发路径调整建议，掌握度≥4可建议跳过余下练习。学习节奏由学生实际表现决定。 |

### 7.3 当前完成度

| 模块 | 完成度 | 说明 |
|---|---|---|
| 12个教学模块 | **100%** | 概念页全建，讲稿缓存全量入库 |
| 七步教学流程 | **100%** | 讲解→观察→模仿→点评→可视化→练习→掌握全通 |
| 9个可视化场景 | **100%** | 17例场景断言通过 |
| 4 Agent架构 | **100%** | teacher/reviewer/examiner/assistant + 20 个 Skill（16 校验 + 4 通用） |
| 平台复刻六阶段 | **100%** | 19 条验收断言全通（解析器 + 门控） |
| 知识层 | **100%** | 86个MD文件+RAG混合检索+向量索引 |
| 点评闭环 | **100%** | 提交→批改→维度分→掌握度更新→路径调整完成 |
| 路径调整 | **100%** | 4规则引擎+去重+限流+UI展示 |
| 安全防护 | **100%** | 输入过滤+输出打码+限流+权限四道门 |
| 测试体系 | **100%** | 53 组（含 3 组真模型回归）；CI 子集 28 组全绿 + Vitest 18 文件 134 用例全绿 |
| 部署套件 | **100%** | deploy/就绪，已部署至阿里云ECS（<ECS-IP>），systemd+nginx+SSE关缓冲；评审期公网可达性待复验（本机同构建正常，公网 80 端口曾探测不通） |
| Phase 7收尾 | **100%** | 12/12闭环：9完成+2项perf(ui)实测负收益已回退+部署完成 |

### 7.4 已知边界与后续规划

**已知边界**（诚实标注未完成项）：

- 应用级鉴权边界：登录体系已落地（scrypt密码哈希 + HS256 JWT + `AuthGate`拦截 + 注册/登录/改密三端点），但仍是单实例内存态——令牌撤销依赖7天过期，没有刷新令牌与踢下线机制
- 分布式限流：进程内实现，多实例各自计数，不构成分布式防护
- 路径调整执行闭环：当前做"诊断+建议"，尚未自动执行（不改模块状态、不跳练习）
- 向量检索融合倒挂：纯向量recall@3=95.5% > 混合=90.9%，原因与取舍见4.4.1
- 项目模板：`projects/` 9个模板待建

**后续规划**：

1. **路径调整执行闭环**：将诊断结果转化为实际的模块推进/暂停/跳转操作。当前四规则引擎已能准确诊断"该不该换路径"，下一步是实现"换了之后怎么走"——自动插入变式题、回放讲解片段、或跳过已掌握练习，做到真正的自适应教学而非"诊断后等人点按钮"。

2. **六项子能力量化的剩余部分**：已完成——报告页六项子能力不再是占位，而是按`module-specs.md`的"训练子能力"映射，把每个能力对应模块的真实掌握度聚合成分数与样本数（无证据的能力显示"未测评"而非0分），并给出**成长曲线**：因`mastery`表每概念只留最新一行、没有历史快照，曲线采用"截至当日各模块最新分累积重算"，且只在真有新证据的日期取点（按日分桶会把"今天只重测一讲"画成掌握度下跌）。剩余两件：一是把点评的子维度分数细化映射到六项能力（当前刻意不做该映射——映射规则不唯一，硬映射等于编数据）；二是跨日样本积累，种子数据同日写入时界面如实显示"首次记录 N 分——再有新记录才画得出曲线"，不补平点。

3. **学生模拟Agent（已实现后整体下线）**：曾以`screen-describer`（屏幕描述）/`action-executor`（动作执行）/`comprehension-verifier`（理解验证）三个子Agent + 教师端模拟控制台做成一版完整闭环，但作者裁定其"变量太难掌握"而整体移除——模拟器只是采样器不是判定器：输出不可复现、没有对照组、未产出可归档的缺陷证据，而它引入的人设/步骤/成本边界变量远超其验证收益。实现保留在提交区间`0df08c1..b5ab85e`，重启前需先解决"运行对比视图 + 固定采样参数"两个前提。离线走查工具（`src/lib/agent/student`，Playwright 真实页面操作）同样只用于开发期验收，产品运行时不引用。

4. **PostgreSQL + pgvector 生产化迁移**：当前SQLite在单机部署下运行良好，但多实例、高并发场景需要托管数据库。代码层已做分层隔离（`sqlite.ts`是唯一直接引用`node:sqlite`的模块），迁移到PG只需替换两个函数。向量检索一并迁入pgvector，与业务数据共存一套基础设施，告别当前的独立百炼客户端调用。

5. **游戏化激励机制**：完成模块解锁成就徽章、连续学习维持打卡连胜、排行榜（匿名化处理）、点评分数兑换"Agent导师的一句鼓励"——用轻度游戏化提升学习留存率。

6. **语音交互接入**：TTS将讲解稿转为语音播放（已预留`playAudio`接口），STT让学生口述答案而非逐字敲——降低AI编程学习的"第一行代码"心理门槛，让零基础学习者先说出来、再写出来。

7. **学习路径自动生成**：基于现有`generateStaticParams`+概念页frontmatter拓扑排序的路径推导能力，允许教师/企业自定义教学模块——上传Markdown概念页→自动生成教学序列→配验Skill收模板→投入教学。让平台从"一套固定课程"变成"可配置的教学引擎"。

### 7.5 社会价值与商业潜力

**社会价值**：AI编程教学面临三重不公平——一线城市有线下训练营（学费5000+）、技术社区教程假设读者已有编程基础、企业内训只面向在职工程师。本平台瞄准的是三种被忽视的人群：**零编程基础的大学生**（非CS专业想学AI但无从下手）、**中西部技术院校师生**（缺乏AI课程师资）、**想转型AI赛道的职场新人**（自学效率低、需要反馈闭环）。平台免费开放完整12模块课程+4个AI Agent实时辅导+16个专属Skill逐维度批改——这套配置如果用人实现，至少需要1位讲师+3位助教轮流值班，成本上万元。而AI系统用1元API调用费就完成了1小时教学+逐次点评+路径推荐。

**商业潜力**：三条可落地的商业化路径——

1. **高校B2B合作**：将平台打包为"AI通识课实训套件"，院校按学期采购。平台已预留"自定义教学模块"能力（教师上传Markdown概念页→自动生成教学序列），满足不同院校的差异化课程需求。中国2800+所高校、每年400万新生入学，AI通识课覆盖率在十四五期间目标100%，这是一个百亿级的增量市场。

2. **企业内训SaaS**：企业定制专属AI Agent课程（RAG架构、工具调用、MCP集成），结合企业内部知识库做私有化部署。当前平台的教学引擎设计——Markdown驱动课程+Skill校验模板——天然适合白标交付。

3. **职业技能认证**：积累学习者数据后，生成可验证的"AI Agent开发能力证书"——6项子能力雷达图+12模块掌握度趋势图+实战项目作品集，附带区块链存证哈希。解决传统简历"会Python/会AI"无法验证的痛点，与招聘平台对接形成从学到证的闭环。

---

## 附录

### A. 技术栈一览

| 类别 | 技术 | 版本 |
|---|---|---|
| 框架 | Next.js | 16 |
| UI库 | React | 19 |
| 语言 | TypeScript | 5.x |
| CSS | Tailwind CSS | 4 |
| 组件库 | shadcn/ui (Radix) | latest |
| 状态管理 | Zustand | 5 |
| 动画 | Motion (Framer Motion) | 13 |
| Agent SDK | pi-coding-agent | 0.85 |
| 校验 | Zod | 4 |
| 工具参数校验 | TypeBox | 1.3 |
| 数据库 | node:sqlite | Node内置 |
| 文本模型 | deepseek-v4-flash-ga-260731 | 火山方舟 Ark |
| 视觉模型 | doubao-seed-2-1-pro-260915 | 火山方舟 Ark |
| Embedding | qwen3.7-text-embedding (1024维) | 百炼 DashScope |
| 代码编辑器 | 自研轻量编辑区（textarea + 行号） | — |
| 包管理 | pnpm | — |
| 质量门禁 | ESLint + tsc + Vitest + CI | — |

### B. 项目仓库

- GitHub: `https://github.com/Stjun15/ai-agent-teaching`
- 提交总数: 689次 (截至2026-10-27)
- 分支: `dev`（工作分支），`main`（与 dev 同 tree 的发布镜像）
- 标签: v0.1.0 / v0.2.0 / v0.3.0 / v0.4.0 / v0.5.0

### C. 代码规模

| 层 | 文件数 | 说明 |
|---|---|---|
| 页面与路由 | 28 endpoint + 10 page | API路由+前端页面 |
| 组件 | 59个 | 学习/聊天/代码/布局/报告/设置/认证/学生/UI基础 |
| Agent内核 | 61个 | prompts/skills/orchestrator/student/tools + core |
| 数据层 | 24个 | migrations/repositories + SQLite驱动 |
| 知识层 | 86个MD + 13个TS | Wiki页面+解析/检索/维护/注入 |
| 测试 | 77个 | spec文件+浏览器测试+回归测试 |
| 部署 | 3个 | 部署脚本+配置 |