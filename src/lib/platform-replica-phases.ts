/**
 * 教学平台复刻 —— 专属六阶段，从零搭建教学平台
 *
 * 与通用七步教学法（explain/observe/imitate/…）完全不同的教学路径：
 * 这不是"学概念"模块，而是"做项目"模块。学生用前面 9 讲学的每个零件，
 * 亲手搭出一个能用的教学平台。
 *
 * 阶段的权威来源：`llm-wiki/concepts/platform-replica.md`
 * 「关键步骤：三板斧 + 一条龙骨（详细步骤）」。
 *
 * ⚠️ 同步义务：本文件是 wiki 页的**镜像**（界面要的是结构化数据，
 * wiki 是唯一事实源）。改 wiki 的三板斧内容时必须同步改这里——
 * 两处都改过再跑 `pnpm test:lecture-cache` 与复刻模拟复核，
 * 否则学生看到的阶段与讲稿口径会脱节（2026-10-01 曾因此漂移：
 * 文件路径指向了本仓库不存在的文件、验收端点 /api/agent/teach 不存在）。
 */

export interface ReplicaTask {
  label: string;
  moduleRef?: string;
  file?: string;
  /** 怎么做：具体操作步骤（零基础可照抄）。 */
  detail?: string;
  /** 为什么有这步：一句话讲清它在整盘棋里的作用——防「照菜谱抄完不知所以然」。 */
  why?: string;
  /** 常见坑：做完后对照检查。 */
  pitfalls?: string[];
}

export interface ReplicaPhase {
  /** 阶段序号（0 基）。 */
  index: number;
  /** 阶段名称（标题）。 */
  title: string;
  /** 阶段目标（一句话）。 */
  goal: string;
  /** 任务列表。 */
  tasks: ReplicaTask[];
  /** 验收脚本（bash / sql）。 */
  acceptanceScript?: string;
  /** 验收说明。 */
  acceptanceDesc?: string;
}

export const REPLICA_PHASES: readonly ReplicaPhase[] = [
  {
    index: 0,
    title: "启动台",
    goal: "装 Node ≥ 22.5，把空壳跑通，浏览器打开 localhost:3000，看到 Next.js 欢迎页",
    tasks: [
      {
        label: "确认 Node ≥ 22.5",
        file: "node --version",
        detail:
          "打开终端（Win：Win+R 输入 powershell；Mac：Cmd+空格 输入 Terminal），输入 `node --version`。看到 v22.5.0 或更高 → 通过。如果提示「不是内部或外部命令」→ 去 https://nodejs.org 下载 LTS 版本安装，装完关掉终端重开。如果版本 < 22.5 → 同样去下载新版本覆盖安装。",
        pitfalls: [
          "装完 Node 必须关掉终端重新打开，否则终端认不到新版本",
          "Mac 用户用 brew 装的 Node 可能版本很旧，建议去官网下 pkg 安装包",
        ],
      },
      {
        label: "创建项目",
        file: "npx create-next-app teaching-platform",
        detail:
          "终端里先 cd 到你想放项目的文件夹（如 `cd ~/Desktop`），然后运行 `npx create-next-app teaching-platform`。过程中会问你 6 个问题：TypeScript? → Yes / ESLint? → Yes / Tailwind CSS? → Yes / src/ directory? → Yes / App Router? → Yes / import alias? → No。全选默认就好。",
        pitfalls: [
          "npx 是临时下载工具，不需要提前 npm install 任何东西",
          "如果下载卡住（网络问题），Ctrl+C 终止后重试一次",
          "项目名叫 teaching-platform，别改成其他名字——后续验收脚本都按这个名字写",
        ],
      },
      {
        label: "启动开发服",
        file: "npm run dev",
        detail:
          "`cd teaching-platform` 进入项目文件夹，然后 `npm run dev`。终端会显示 `Local: http://localhost:3000`。这个终端窗口不要关——关了服务器就停了。",
        pitfalls: [
          "如果报 `EADDRINUSE :::3000`，说明 3000 端口被占了。Windows：`npx kill-port 3000`；Mac：`lsof -ti:3000 | xargs kill`",
          "终端输出里如果只有 `http://localhost:3000` 没有报错，就是跑起来了",
        ],
      },
      {
        label: "浏览器打开 localhost:3000，确认空壳能跑",
        detail:
          "打开浏览器，地址栏输入 `http://localhost:3000`，回车。看到 Next.js 的欢迎页（中间有个黑色 N logo，写着「Get started by editing…」）→ 空壳跑通。",
        pitfalls: [
          "如果浏览器显示「无法访问」，回去看终端有没有报错",
          "localhost:3000 和 127.0.0.1:3000 是同一个地址，都可以用",
        ],
      },
    ],
    acceptanceDesc: "浏览器看到 Next.js 默认首页 → 空壳跑通",
  },
  {
    index: 1,
    title: "第一斧 · 对话骨架",
    goal: "搭完能跟 AI 聊天。SSE 流式，打字机渲染，角色是教学导师。",
    tasks: [
      {
        label: "API Key 配置",
        file: ".env.local",
        moduleRef: "llm-api",
        detail:
          "在项目根目录（teaching-platform/）新建 `.env.local` 文件，写入一行 `ARK_API_KEY=你的密钥`。把「你的密钥」替换成火山方舟控制台申请的 API Key。**等号两边不能有空格**。写完后重启 `npm run dev`（Ctrl+C 停掉，再 `npm run dev` 启动）——`.env.local` 的改动不重启不生效。",
        why: "密钥是调大模型的通行证，后面每一步都靠它；放进 .env.local 而不是代码里，是让它永远不进 Git、不随代码泄露。",
        pitfalls: [
          "`.env.local` 在 VS Code 里可能是灰色——这正常，说明 Git 会忽略它",
          "API Key 是一长串字符，像 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`",
          "改完 `.env.local` 必须重启 `npm run dev`，热更新不生效",
        ],
      },
      {
        label: "封装 LLM 调用（原始 fetch）",
        moduleRef: "llm-api",
        file: "src/lib/llm.ts",
        detail:
          "新建 `src/lib/llm.ts`。用 `fetch` 封装对火山方舟 `/chat/completions` 的调用。**不要装任何 LLM SDK**——本课程的核心就是让你亲眼看到：调大模型 = 一个 HTTP POST 请求。函数签名参考：`async function chat(messages) → 返回模型回复文本`。请求体里要传 `model`、`messages`、`stream: true`。",
        why: "这是全平台的发动机——讲解、出题、点评最终都是「发 messages、收回复」，封装一次处处复用。",
        pitfalls: [
          "请求头里 `Authorization: 'Bearer ' + apiKey`——Bearer 和 Key 之间有一个空格",
          "`Content-Type` 必须是 `application/json`",
          "如果 401 错误 → API Key 不对；如果 404 → 检查 baseUrl 拼写",
        ],
      },
      {
        label: "写教学 System Prompt",
        moduleRef: "system-prompt",
        file: "agent-prompts/teaching-chat.ts",
        detail:
          "在项目根目录新建 `agent-prompts/` 文件夹，里面建 `teaching-chat.ts`。export 一个 `TEACHING_SYSTEM_PROMPT` 常量，内容是给 AI 的「角色说明书」：你是教学导师、用通俗语言讲解、每个概念给示范代码、学生不懂就换方式解释。先写 5-8 行就好，后面会迭代。",
        why: "同一个模型，System Prompt 决定它是客服还是老师——你的平台「会教书」全靠这份说明书。",
        pitfalls: [
          "System Prompt 里不要说「你是一个有用的助手」——太模糊，模型会放飞",
          "用「你做…」「你不做…」的句式，比「请做…」更有约束力",
          "字数不用多——30-50 字足够让模型进入角色",
        ],
      },
      {
        label: "实现 SSE 流式接口",
        file: "src/app/api/chat/route.ts",
        detail:
          "在 `src/app/api/chat/` 下新建 `route.ts`。export 一个 `POST` 函数：用 `await req.json()` 拿到用户消息 → 调大模型 API（stream: true）→ 把模型返回的 SSE 流用 `new Response(upstream.body, { headers: {...} })` 原样桥接给前端。响应头必须设 `Content-Type: text/event-stream`。",
        why: "打字机效果不是前端装出来的——是后端把模型的字节流原样转发给浏览器，这一步就是把水管接通。",
        pitfalls: [
          "文件名必须叫 `route.ts`，Next.js 靠这个名字识别 API 路由",
          "`new Response` 是浏览器内置的，不需要 import——但 Node 18+ 也支持",
          "别忘了 `if (!upstream.ok)` 的错误处理——API Key 错的时候前端至少能看到报错而不是白屏",
        ],
      },
      {
        label: "前端打字机聊天",
        file: "src/components/chat/",
        detail:
          "在 `src/components/chat/` 下新建 `chat-panel.tsx`。文件顶部写 `'use client'`。核心逻辑：发 POST 到 `/api/chat` → 拿到 `response.body` → `getReader()` 创建读取器 → `while(true)` 循环 `reader.read()` → `TextDecoder` 解码字节 → 按 `data: ` 前缀解析 SSE 行 → `JSON.parse` 取 `delta.content` → 逐字追加到消息列表 → React 自动重新渲染 → 打字机效果。",
        why: "把字节流解码成一个一个字追加到界面——学生「看见 AI 正在打字」的体验从这里来。",
        pitfalls: [
          "文件顶部必须有 `'use client'`，否则 useState 会报错",
          "`TextDecoder` 的 `decode(value, { stream: true })`——`stream: true` 参数不能省，否则多字节中文会被截断成乱码",
          "SSE 行以 `data: ` 开头，收到 `[DONE]` 表示流结束——这两个判断缺一不可",
          "消息列表更新用 `setMessages(prev => [...])`，不要直接 push——React 不会检测到变化",
        ],
      },
    ],
    acceptanceScript: `curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"content":"你好，请介绍一下你自己"}'
# → 200 + SSE 流式响应
# → 角色是"教学导师"
# → 前端打字机正常渲染
# （完整可抄版见 wiki「示范代码」节）`,
  },
  {
    index: 2,
    title: "第二斧 · 多步 Agent",
    goal: "搭完 AI 能讲课、能出题。模型点菜（要工具）你端菜（执行）再喂回，直到它说完。",
    tasks: [
      {
        label: "出题工具 + 参数 Schema",
        moduleRef: "tool-calling",
        file: "src/lib/quiz-tool.ts",
        detail:
          "新建 `src/lib/quiz-tool.ts`。export 一个 `quizTool` 对象：`type: 'function'`，`function.name: 'make_quiz'`，`function.description` 写清楚「什么时候用这个工具」，`function.parameters` 用 JSON Schema 描述 4 个必填参数：question（题干）、options（4 个选项的数组）、answer（正确选项如 B）、explanation（解析）。",
        pitfalls: [
          "`type` 必须是字符串 `'function'`，不是 `Function` 类型",
          "`parameters.properties` 里的每个字段都要写 `type` 和 `description`——模型靠 description 判断该填什么",
          "`required` 数组列出所有必填字段，模型会确保一个不少",
        ],
      },
      {
        label: "把一次调用包成带工具的循环",
        moduleRef: "agent-loop",
        file: "src/lib/agent-loop.ts",
        detail:
          "新建 `src/lib/agent-loop.ts`。export `async function runAgentLoop(userMessage)`：\n1. 初始化 messages 数组（system prompt + user message）\n2. `for (let step = 0; step < 5; step++)`——最多 5 步防死循环\n3. 调大模型 API，传 `tools: [quizTool]`\n4. 检查返回的 `choice.message.tool_calls`：没有 → 返回 `choice.message.content`（循环结束）\n5. 有 tool_calls → 先把 `choice.message` push 进 messages\n6. 遍历 tool_calls，解析 `call.function.arguments`，包装成 `{ role: 'tool', tool_call_id, content }` push 进 messages\n7. 回到 for 循环开头——模型看到工具结果后再次决策",
        pitfalls: [
          "第 5 步「先 push choice.message」和第 6 步「再 push tool 结果」——顺序不能反，API 要求 tool_call 消息在 tool 结果消息之前",
          "`tool_call_id` 必须和上一步 tool_call 的 `id` 完全一致——模型靠这个 ID 配对",
          "`JSON.parse(call.function.arguments)` 要包 try-catch——模型偶尔产出非法 JSON",
          "第一斧的 `route.ts` 要改成调用 `runAgentLoop` 而不是直接 fetch 模型",
        ],
      },
      {
        label: "验证：模型能出题 + 讲解",
        moduleRef: "agent-loop",
        detail:
          "跑验收 curl 命令（下方）。预期：AI 先用 2-3 句话讲清楚概念（带类比或例子），然后出现两道选择题，每题 4 个选项 + 标明正确答案 + 解析。服务端终端能观察到完整的「模型要工具 → 你执行 → 喂回 → 模型继续」日志。",
        pitfalls: [
          "如果只有讲解没有题 → 检查 tools 参数是否正确传入、quizTool 的 description 是否写清了触发条件",
          "如果循环只跑了一步 → 检查 tool_calls 判断逻辑：先处理 tool_calls，再进入下一轮",
          "如果模型返回时 content 为空但有 tool_calls → 这是正常的，模型调用工具时 content 可以为 null",
        ],
      },
    ],
    acceptanceScript: `curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"content":"给我讲讲什么是 System Prompt，讲完出两道选择题"}'
# → 回答先讲透（类比 + 定义 + 例子）
# → 结尾有两道选择题，带选项和答案
# → 服务端日志：模型请求工具 → 你执行 → 结果喂回 → 模型继续说
# （完整可抄版见 wiki「Agent 循环（第二斧可抄版）」节）`,
  },
  {
    index: 3,
    title: "第三斧 · 知识 + 数据库 + 点评",
    goal: "搭完 AI 知道你在学什么、学了什么、学得怎么样。注入上下文 + 进度持久化 + 作业点评。",
    tasks: [
      {
        label: "概念页注入上下文（RAG）",
        moduleRef: "rag",
        file: "src/lib/lecture-context.ts",
        detail:
          "新建 `src/lib/lecture-context.ts`。用 `node:fs` 的 `readFileSync` 读取 `llm-wiki/concepts/` 下的 .md 讲稿文件。去掉文件头部的 YAML front matter（`---` 包裹的元数据块），返回正文。在 `agent-loop.ts` 里：调模型前先 `loadLectureContent(moduleId)`，把返回的讲稿拼到 System Prompt 末尾（如 `【本讲参考资料】\n...`）。",
        pitfalls: [
          "`node:fs` 和 `node:path` 都是 Node.js 内置的，不需要 npm install",
          "`process.cwd()` 返回的是你启动 `npm run dev` 的目录（项目根目录）",
          "去掉 front matter 用 `raw.indexOf('---', 3)` 找第二个 `---` 的位置",
        ],
      },
      {
        label: "SQLite 存掌握度",
        moduleRef: "llm-wiki",
        file: "src/lib/db.ts",
        detail:
          "新建 `src/lib/db.ts`。`import { DatabaseSync } from 'node:sqlite'`，`new DatabaseSync('dev.db')` 创建/打开数据库。用 `db.exec()` 执行 `CREATE TABLE IF NOT EXISTS mastery (...)` 建表（字段：id, module_id, score, dimension_scores, feedback, created_at, updated_at）。实现 `upsertMastery(moduleId, score, dimensions, feedback)`——先查有没有记录，有就 UPDATE，没有就 INSERT。用 `db.prepare(...).get()` 做查询，`?` 占位符防注入。",
        pitfalls: [
          "`node:sqlite` 是 Node.js 22.5 才内置的——确认 `node --version` ≥ 22.5",
          "`DatabaseSync` 不是 `Database`——注意名字里的 Sync",
          "dimension_scores 用 `JSON.stringify()` 存成 TEXT",
          "`db.prepare()` 不要放进循环里——预编译一次，多次 .get()/.run()",
        ],
      },
      {
        label: "点评 Agent：按维度打分 + 落库",
        moduleRef: "system-prompt",
        file: "src/lib/review.ts",
        detail:
          "新建 `src/lib/review.ts`。写一个 `REVIEW_SYSTEM_PROMPT`：定义 4 个评分维度（正确性/可读性/完整性/规范性，每个 1-5 分），严格按 JSON 格式输出 `{ dimensions: {...}, deductions: [...], suggestions: '...', overall: 4 }`。函数 `reviewHomework(moduleId, homework)` 调模型拿评分 JSON，解析后调用 `upsertMastery` 落库。temperature 设 0.3 让评分稳定。",
        pitfalls: [
          "System Prompt 里的 JSON 示例就是模型的「模板」——它大概率会照抄格式",
          "`JSON.parse` 要包 try-catch——模型偶尔在 JSON 外面套 markdown 代码块",
          "新建 `src/app/api/validate/route.ts` 作为点评入口——接收 POST，调 reviewHomework，返回结果",
        ],
      },
    ],
    acceptanceScript: `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT * FROM mastery').all())"
# → 有记录，分数随学习变化（无需安装 sqlite3 命令行）

curl -X POST http://localhost:3000/api/validate \\
  -H "Content-Type: application/json" \\
  -d '{"content":"const name = (void 0).name"}'
# → JSON 返回维度分、扣分点、改进建议，并且落库`,
  },
  {
    index: 4,
    title: "龙骨 · 页面连线",
    goal: "把所有页面连成一条完整的学习路径。每连一段跑通一段。",
    tasks: [
      {
        label: "首页 `/`",
        file: "src/app/page.tsx",
        detail:
          "修改 `src/app/page.tsx`。用 Next.js 的 `<Link href='/learn'>` 和 `<Link href='/playground'>` 做两个入口按钮。标题写「AI 教学平台」+ 一句话介绍。用 Tailwind CSS 居中布局（`flex min-h-screen items-center justify-center`）。",
        pitfalls: [
          "用 `<Link>` 而不是 `<a>`——Next.js 的 Link 做客户端路由跳转，不会整页刷新",
          "`page.tsx` 是服务端组件，不需要 `'use client'`——但如果加了 useState 就必须加",
        ],
      },
      {
        label: "学习中心 `/learn`",
        file: "src/app/learn/page.tsx",
        detail:
          "新建 `src/app/learn/page.tsx`。定义一个模块列表数组（id + name + desc），用 `map` 渲染成卡片列表。每个卡片是 `<Link href={/learn/\${mod.id}}>`，点击跳转到对应模块的工作区。卡片上显示序号、模块名、一句话描述。",
        pitfalls: [
          "Next.js 的 App Router：`src/app/learn/page.tsx` → 自动匹配 `/learn` 路由",
          "模块列表可以先写死（9 个模块的数组），后续再改动态读取",
        ],
      },
      {
        label: "工作区 `/learn/[id]`",
        file: "src/app/learn/[id]/page.tsx",
        detail:
          "新建 `src/app/learn/[id]/page.tsx`。用 `async function Page({ params }: { params: Promise<{ id: string }> })` 接收动态路由参数。页面分左右两栏：左侧渲染模块讲稿（后续接 RAG），右侧嵌入 `ChatPanel` 聊天组件。顶部加面包屑和返回按钮。",
        pitfalls: [
          "`[id]` 是 Next.js 的动态路由语法——文件夹名带方括号",
          "params 现在是 Promise 类型（Next.js 15+），需要 `const { id } = await params`",
        ],
      },
      {
        label: "沙箱 `/playground`",
        file: "src/app/playground/page.tsx",
        detail:
          "新建 `src/app/playground/page.tsx`。极简页面——标题「自由对话」+ `ChatPanel` 组件。学生在这里不跟课程内容绑定，纯粹跟 AI 聊天、测试想法。",
        pitfalls: ["ChatPanel 在第一斧已经写好了，这里直接 import 复用即可"],
      },
      {
        label: "设置 `/settings`",
        file: "src/app/settings/page.tsx",
        detail:
          "新建 `src/app/settings/page.tsx`。显示当前 API Key 状态（从 `.env.local` 读取，脱敏显示）、当前使用的模型名称。用一个只读输入框或文本展示即可——这个页面主要是让学生确认「配置对了没有」。",
        pitfalls: [
          "不要把 API Key 完整显示在前端——用 `●●●●●●●●` 替代",
          "这是一个纯展示页，不需要表单提交功能",
        ],
      },
    ],
    acceptanceDesc:
      "五条路由都能访问，导航完整，页面不白屏。用浏览器手动点一遍：首页 → 学习中心 → 任意模块工作区 → 沙箱 → 设置，每个页面都有内容。",
  },
  {
    index: 5,
    title: "结算",
    goal: "三斧全绿 + 龙骨连线完整 = 达标。逐项自查。",
    tasks: [
      {
        label: "能跟 AI 实时对话（SSE 流式，打字机渲染）",
        detail:
          "在前端输入「你好」，AI 逐字回复，不是一次性弹出一大段。打开浏览器开发者工具（F12）→ Network 标签 → 找到 /api/chat 请求 → 看 Response，应该是逐行 `data: {...}` 的 SSE 格式。",
      },
      {
        label: "AI 被 System Prompt 约束为教学导师，不讲无关内容",
        detail:
          "问 AI「今天天气怎么样」或「帮我写一封辞职信」→ AI 应该拒绝或引导回学习话题。如果 AI 回答了无关内容，回到 `agent-prompts/teaching-chat.ts` 加强约束。",
      },
      {
        label: "Agent 能多步输出：讲概念 → 给示范 → 出测验题",
        detail:
          "输入「给我讲讲什么是闭包，再出两道选择题」。观察回复：先有概念讲解 → 然后出现题目。服务端终端日志能看到「模型请求工具 → 执行 → 喂回」的完整链路。",
      },
      {
        label: "出题 Agent 输出的题目符合 Schema（有选项、有答案、有解析）",
        detail:
          "看 AI 出的题——4 个选项齐全、标明了正确答案、有解析。缺少任何一项 → 检查 quiz-tool.ts 的 required 数组和 agent-loop.ts 的 tool 结果处理。",
      },
      {
        label: "点评 Agent：交作业能拿到维度分、扣分点、改进建议，且落库",
        detail:
          '在下方「交付与检验单」编辑器贴一段代码，点「提交点评」。返回的 JSON 里有 dimensions（4 个维度的分数）、deductions（扣分点）、suggestions（改进建议）。然后跑 `node -e "..."` 验证数据库里有这条记录。',
      },
      {
        label: "SQLite 记录学习进度，刷新不丢",
        detail:
          '点评完成后关闭浏览器标签页，重新打开 `/learn/platform-replica`，查数据库 `node -e "..."`——之前的评分记录还在。如果丢了 → 检查 dev.db 文件是否在项目根目录、是否被 gitignore 忽略了（应该忽略，但文件本身要存在）。',
      },
      {
        label: "页面导航完整：首页 → 学习中心 → 工作区 → 沙箱 → 设置",
        detail:
          "从首页开始，逐一访问 5 个页面。检查：每个页面都能正常渲染（不白屏）、面包屑导航正确、返回按钮能回到上一级。",
      },
    ],
    acceptanceDesc:
      "在 localhost:3000 上全部跑通 → 达标。把 agent-loop.ts 全文贴进下方「交付与检验单」编辑器，点「提交点评」拿正式检验单（维度分、扣分点、建议，计入掌握度）；route.ts 用一句话说明改动点即可，清单自查在对话里与导师核对。",
  },
];
