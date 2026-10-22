/**
 * 教学平台复刻 —— 专属六阶段，从零搭建教学平台
 *
 * 与通用七步教学法（explain/observe/imitate/…）完全不同的教学路径：
 * 这不是"学概念"模块，而是"做项目"模块。学生用前面 11 讲学的每个零件，
 * 亲手搭出一个能用的教学平台。**每一步都先引导你跟 AI 导师对话，再自己动手。**
 *
 * 阶段的权威来源：`llm-wiki/concepts/platform-replica.md`
 * 「关键步骤：三板斧 + 一条龙骨（详细步骤）」。
 *
 * ⚠️ 同步义务：本文件是 wiki 页的**镜像**（界面要的是结构化数据，
 * wiki 是唯一事实源）。改 wiki 的三板斧内容时必须同步改这里——
 * 两处都改过再跑 `pnpm test:lecture-cache` 与复刻模拟复核，
 * 否则学生看到的阶段与讲稿口径会脱节（2026-10-01 曾因此漂移：
 * 文件路径指向了本仓库不存在的文件、验收端点 /api/agent/teach 不存在）。
 *
 * wiki 对应章节映射（方便 grep 核对同步）：
 * - Phase 0 → wiki「前置知识速查」+「三板斧 · 材料清单」
 * - Phase 1 → wiki「第一斧 · 对话骨架（详细步骤）」第 1-6 步
 * - Phase 2 → wiki「第二斧 · 多步 Agent（详细步骤）」第 1-3 步
 * - Phase 3 → wiki「第三斧 · 知识 + 数据库 + 点评（详细步骤）」第 1-4 步
 * - Phase 4 → wiki「龙骨 · 页面连线」+「页面地图」
 * - Phase 5 → wiki「动手任务」+「结算」
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
  /**
   * AI 协作提示：先别往下看 detail，试试把这句话发给 AI 导师，
   * 让导师帮你写第一版代码。做完再对照 detail 核对。
   */
  askAI?: string;
  /**
   * 卡住了怎么办：告诉你怎么跟 AI 导师描述你遇到的问题。
   * 贴报错时说明三件事：①你在做什么 ②期望看到什么 ③实际看到什么。
   */
  stuckPrompt?: string;
}

/** 前置知识速查词条。零基础学生在进入阶段前可以先扫一眼，
 *  遇到不认识的词直接问导师「xxx 是什么意思？」 */
export interface PreKnowledgeEntry {
  term: string;
  /** 一句话大白话解释。 */
  explanation: string;
}

export interface ReplicaPhase {
  /** 阶段序号（0 基）。 */
  index: number;
  /** 阶段名称（标题）。 */
  title: string;
  /** 阶段目标（一句话）。 */
  goal: string;
  /** 前置知识速查：本阶段涉及的工具/概念名词，零基础可先扫一眼。 */
  preKnowledge?: PreKnowledgeEntry[];
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
    preKnowledge: [
      { term: "终端（Terminal）", explanation: "敲命令的黑窗口。Windows 叫 PowerShell，Mac 叫终端。你在这里敲代码让电脑干活。" },
      { term: "Node.js", explanation: "让 JavaScript 能在浏览器外面运行的东西。你后面写的所有后端代码都靠它跑。" },
      { term: "环境变量（PATH）", explanation: "告诉终端「去哪个文件夹找命令」。装完 Node 后终端能识别 `node` 命令，就是因为安装程序把它加进了 PATH。如果装完不认，八成是 PATH 没生效——关掉终端重开就行。" },
      { term: "npm", explanation: "Node 的「应用商店」——一条命令就能下载别人写好的代码包。" },
      { term: "npx", explanation: "不安装、临时借来用一下某个工具。create-next-app 就是借来用一次就丢。" },
      { term: "localhost:3000", explanation: "你电脑上自己跑的一个小网站。localhost = 本机，3000 = 门牌号（端口）。" },
      { term: "端口（Port）", explanation: "一台电脑可以同时跑很多服务，端口号就是区分它们的门牌号。3000 是 Next.js 的默认门牌。" },
      { term: "Git", explanation: "代码的「存档系统」——每做完一步就存个档，做错了能一键回到上一个存档。这不是可选的，是写代码的基本功。" },
      { term: "commit（存档点）", explanation: "Git 里的一个「快照」——把当前所有文件的状态拍一张照片存起来。commit message 写清楚你这步做了什么。" },
      { term: "git log", explanation: "查看所有存档记录。每行一条——能看到谁、什么时候、做了什么。验收时用它证明你每一步都存了档。" },
    ],
    tasks: [
      {
        label: "确认 Node ≥ 22.5",
        file: "node --version",
        why: "后面每一步依赖的运行时——版本不对，后面全白搭。",
        detail:
          "打开终端（Win：Win+R 输入 powershell；Mac：Cmd+空格 输入 Terminal），输入 `node --version`。看到 v22.5.0 或更高 → 通过。\n\n如果提示「'node' 不是内部或外部命令」：\n1. 先去 https://nodejs.org 下载 LTS 版本安装。**安装时注意勾选「Automatically install the necessary tools」**——这一步会把 Node 自动加入 PATH 环境变量，省得手动配。\n2. 装完后**关掉终端重新打开**——PATH 环境变量只在终端启动时加载一次，旧终端窗口不认识新装的命令。\n3. 重新打开终端后再跑 `node --version`。\n\n如果版本 < 22.5 → 同样去下载新版本覆盖安装。",
        askAI: "直接问导师：「我该怎么检查电脑上有没有装 Node.js？版本要 22.5 以上。」导师会告诉你对应你操作系统的具体命令。",
        stuckPrompt: "把终端里显示的版本号贴给导师，问「这个版本够用吗？」导师会判断。如果装了 Node 但终端还是不认，贴报错截图给导师，问「怎么检查 Node 有没有加入 PATH？」",
        pitfalls: [
          "装完 Node 必须关掉终端重新打开——PATH 环境变量只在终端启动时加载，旧窗口不认识新装的命令",
          "Windows 安装时如果漏掉了「Add to PATH」复选框 → 卸载重装，这次记得勾上",
          "Mac 用户用 brew 装的 Node 可能版本很旧，建议去官网下 pkg 安装包",
          "如果不确定 PATH 里有没有 Node：Win 打开「编辑系统环境变量」→「环境变量」→ 系统变量里找 Path → 双击 → 看有没有 nodejs 的路径",
        ],
      },
      {
        label: "创建项目",
        file: "npx create-next-app teaching-platform",
        why: "Next.js 是整座平台的脚手架——页面、路由、API 都在这个壳里长出来。",
        detail:
          "终端里先 cd 到你想放项目的文件夹（如 `cd ~/Desktop`），然后运行 `npx create-next-app teaching-platform`。过程中会问你 6 个问题：TypeScript? → Yes / ESLint? → Yes / Tailwind CSS? → Yes / src/ directory? → Yes / App Router? → Yes / import alias? → No。全选默认就好。",
        askAI: "问导师：「帮我在桌面上用 npx create-next-app 创建一个叫 teaching-platform 的项目，每一步该选什么选项？」",
        stuckPrompt: "如果 npx 卡住不动（网络问题），贴终端截图给导师，问「是不是网络问题？有没有替代方案？」",
        pitfalls: [
          "npx 是临时下载工具，不需要提前 npm install 任何东西",
          "如果下载卡住（网络问题），Ctrl+C 终止后重试一次",
          "项目名叫 teaching-platform，别改成其他名字——后续验收脚本都按这个名字写",
        ],
      },
      {
        label: "启动开发服",
        file: "npm run dev",
        why: "改一行代码立刻在浏览器看到效果——这是你的反馈回路，整个平台搭建就靠它快速迭代。",
        detail:
          "`cd teaching-platform` 进入项目文件夹，然后 `npm run dev`。终端会显示 `Local: http://localhost:3000`。这个终端窗口不要关——关了服务器就停了。",
        askAI: "问导师：「我创建好了项目，下一步怎么启动它？」导师会告诉你 cd 和 npm run dev 两条命令。",
        stuckPrompt: "如果报 EADDRINUSE 错误（端口被占），把报错贴给导师，问「3000 端口被占了怎么办？」",
        pitfalls: [
          "如果报 `EADDRINUSE :::3000`，说明 3000 端口被占了。Windows：`npx kill-port 3000`；Mac：`lsof -ti:3000 | xargs kill`",
          "终端输出里如果只有 `http://localhost:3000` 没有报错，就是跑起来了",
        ],
      },
      {
        label: "浏览器打开 localhost:3000，确认空壳能跑",
        why: "第一步是地基——先看到东西活着，后面加什么都心里有数。",
        detail:
          "打开浏览器，地址栏输入 `http://localhost:3000`，回车。看到 Next.js 的欢迎页（中间有个黑色 N logo，写着「Get started by editing…」）→ 空壳跑通。",
        askAI: "问导师：「我启动了 npm run dev，然后去哪里看效果？」",
        stuckPrompt: "如果浏览器显示「无法访问」，贴终端完整输出给导师，问「服务器是不是没跑起来？」",
        pitfalls: [
          "如果浏览器显示「无法访问」，回去看终端有没有报错",
          "localhost:3000 和 127.0.0.1:3000 是同一个地址，都可以用",
        ],
      },
      {
        label: "检查 Git 是否安装",
        file: "git --version",
        moduleRef: "vibe-coding",
        why: "后面每一步做完都要存档——Git 是代码的「Ctrl+Z」，没装等于裸奔。",
        detail:
          "打开终端，输入 `git --version`。看到 `git version 2.x.x` 或更高 → 通过。如果提示「'git' 不是内部或外部命令」→ 去 https://git-scm.com/downloads 下载安装。Windows 选「64-bit Git for Windows Setup」，一路下一步，安装选项全用默认值。Mac 装完 Xcode Command Line Tools 就行（终端输入 `xcode-select --install`）。装完必须关掉终端重新打开，再跑 `git --version` 验证。",
        askAI: "问导师：「我该怎么检查电脑上有没有装 Git？没装的话怎么安装？」导师会告诉你对应你操作系统的下载地址和安装步骤。",
        stuckPrompt: "把终端的报错贴给导师（'git' 不是内部或外部命令），问「怎么安装 Git？」",
        pitfalls: [
          "装完 Git 必须关掉终端重新打开——和 Node 一样，PATH 环境变量只在终端启动时加载一次",
          "Mac 用户：`xcode-select --install` 装的是 Command Line Tools（含 Git），不需要额外下载",
          "安装 Git 的时候如果弹 UAC（用户账户控制）窗口，点「是」允许",
        ],
      },
      {
        label: "项目初始化 + 第一次存档",
        file: "git init && git add -A && git commit -m \"空项目跑通\"",
        moduleRef: "vibe-coding",
        why: "第一份存档 = 地基快照。后面改了代码跑不通，`git checkout .` 一键回到这个安全点。",
        detail:
          "在项目根目录（teaching-platform/）终端里依次执行三条命令：\n1. `git init` —— 初始化 Git 仓库（把当前文件夹变成一个可以存档的项目）\n2. `git add -A` —— 把当前所有文件加入存档区\n3. `git commit -m \"空项目跑通\"` —— 拍一张快照，标签写「空项目跑通」\n\n做完后跑 `git log --oneline`，看到一条 commit 记录 → 第一次存档成功。\n\n从这开始，**每完成一个阶段就 commit 一次**——存档是你做错的保险，也是你进步的痕迹。",
        askAI: "问导师：「帮我在项目文件夹里执行 git init，然后告诉我怎么做第一次 commit。」",
        stuckPrompt: "如果 `git init` 报错或 `git commit` 提示「please tell me who you are」→ 问导师「Git 怎么配置用户名和邮箱？」导师会告诉你 `git config --global user.name` 和 `git config --global user.email` 两条命令。",
        pitfalls: [
          "`git init` 只执行一次——不要在每个文件夹里都 init",
          "commit message 要写清楚做了什么——不要写「update」「fix」这种没意义的词",
          "如果 Git 报「please tell me who you are」：先配置 `git config --global user.name \"你的名字\"` 和 `git config --global user.email \"你的邮箱\"`",
        ],
      },
    ],
    acceptanceDesc: "浏览器看到 Next.js 默认首页 → 空壳跑通。终端跑 `git log --oneline` 看到一条「空项目跑通」的 commit → 起点已存档",
  },
  {
    index: 1,
    title: "第一斧 · 对话骨架",
    goal: "搭完能跟 AI 聊天。SSE 流式，打字机渲染，角色是教学导师。",
    preKnowledge: [
      { term: "API Key", explanation: "调大模型的「门禁卡」。没有它，大模型不认识你、不让你用。" },
      { term: ".env.local", explanation: "Next.js 专门放密码/密钥的文件。Git 会自动忽略它，所以密码不会泄露到网上。" },
      { term: "fetch", explanation: "浏览器和 Node.js 都内置的「发网络请求」函数。调大模型 = 用 fetch 发一个 HTTP POST。" },
      { term: "System Prompt", explanation: "给 AI 的「角色说明书」。在消息列表最前面塞一条 system 角色的消息，告诉 AI 它是谁、该怎么做。" },
      { term: "SSE（Server-Sent Events）", explanation: "服务器「推送」数据给浏览器的一条单向通道。打字机效果靠它——模型写一个字、服务器推一个字。" },
      { term: "route.ts", explanation: "Next.js App Router 的 API 路由文件。放在 src/app/api/xxx/route.ts 里，自动变成 /api/xxx 这个网址。" },
      { term: "'use client'", explanation: "告诉 Next.js「这个组件要在浏览器里跑」。用了 useState/useEffect 的组件必须加这行。" },
      { term: "export", explanation: "把文件里的函数/变量「暴露」出去，让别的文件可以 import 来用。" },
      { term: "import", explanation: "从别的文件「拿」东西进来用。import { chat } from '@/lib/llm' 就是从 lib/llm.ts 拿 chat 函数。" },
      { term: "useState", explanation: "React 的「记忆格」。const [messages, setMessages] = useState([]) —— messages 是当前值，setMessages 是改它的方法。" },
      { term: "TextDecoder", explanation: "把浏览器收到的字节（0 和 1）翻译成人类能读的文字。SSE 流是一块一块的字节，需要边收边翻译。" },
    ],
    tasks: [
      {
        label: "API Key 配置",
        file: ".env.local",
        moduleRef: "llm-api",
        detail:
          "在项目根目录（teaching-platform/）新建 `.env.local` 文件，写入一行 `ARK_API_KEY=你的密钥`。把「你的密钥」替换成火山方舟控制台申请的 API Key。**等号两边不能有空格**。写完后重启 `npm run dev`（Ctrl+C 停掉，再 `npm run dev` 启动）——`.env.local` 的改动不重启不生效。",
        askAI: "问导师：「我要在 Next.js 项目里配置 API Key，应该放在哪个文件？格式怎么写？」",
        stuckPrompt: "贴 .env.local 的内容给导师（记得把 Key 打码！），问「这个格式对吗？为什么重启后还是读不到？」",
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
        askAI: "问导师：「教我写一个用 fetch 调用火山方舟大模型 API 的函数，函数名叫 chat，接收 messages 数组，支持 stream 模式。」导师会给你一个带 fetch 的完整示例。",
        stuckPrompt: "如果调不通，贴三样东西给导师：①你的 llm.ts 代码 ②终端的报错信息 ③你用的 API 地址。问「哪里写错了？」",
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
        askAI: "问导师：「帮我写一个 System Prompt，让 AI 扮演编程教学导师——用大白话讲概念、每次给代码示例、学生不懂就换种方式解释。」拿到后别照抄，理解每句话的作用再改。",
        stuckPrompt: "问导师：「我的 System Prompt 约束力不够——AI 有时候会跑偏，怎么加强？」把当前 Prompt 贴上去让导师诊断。",
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
        askAI: "问导师：「帮我在 Next.js App Router 的 src/app/api/chat/route.ts 里写一个 POST 接口——接收用户消息，调大模型 API（stream 模式），把返回的 SSE 流原样转发给前端。」",
        stuckPrompt: "贴 route.ts 代码 + 终端报错给导师。重点说明：「前端发 POST 到 /api/chat，但返回的不是流式数据」或「浏览器 Network 标签里这个请求状态码是 500」。",
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
        askAI: "问导师：「帮我在 Next.js 里写一个 ChatPanel 组件——'use client'，发 POST 到 /api/chat，接收 SSE 流式响应，用 getReader + TextDecoder 逐字渲染，打出来像打字机一样。」",
        stuckPrompt: "贴 ChatPanel 代码给导师，问「打字机效果出不来——消息是一次性弹出来的，不是逐字显示。哪里写错了？」让导师帮你定位是 reader 没循环、还是 decode 参数不对、还是 SSE 行解析有问题。",
        why: "把字节流解码成一个一个字追加到界面——学生「看见 AI 正在打字」的体验从这里来。",
        pitfalls: [
          "文件顶部必须有 `'use client'`，否则 useState 会报错",
          "`TextDecoder` 的 `decode(value, { stream: true })`——`stream: true` 参数不能省，否则多字节中文会被截断成乱码",
          "SSE 行以 `data: ` 开头，收到 `[DONE]` 表示流结束——这两个判断缺一不可",
          "消息列表更新用 `setMessages(prev => [...])`，不要直接 push——React 不会检测到变化",
        ],
      },
      {
        label: "🔖 Git 存档：第一斧完成",
        file: 'git add -A && git commit -m "第一斧完成：对话骨架，SSE 流式打字机"',
        moduleRef: "vibe-coding",
        why: "第一斧跑通 = 整个平台的第一步大里程碑。存档后你可以放心大胆改代码——改崩了 `git checkout .` 回到这里。",
        detail:
          "在 teaching-platform/ 目录终端里：`git add -A` 把新增和改动的文件都加入存档区，然后 `git commit -m \"第一斧完成：对话骨架，SSE 流式打字机\"`。做完后跑 `git log --oneline` 确认能看到新的 commit。",
        askAI: "问导师：「我第一斧做完了，教我怎么做 Git 存档。」",
        stuckPrompt: "如果 `git add -A` 把 node_modules 也加进去了 → 问导师「怎么创建 .gitignore 忽略 node_modules？」",
        pitfalls: [
          "commit message 要写清楚做完的是哪个阶段——方便以后 `git log` 一眼看到进度",
          "如果第一次 commit 时还没创建 .gitignore，`git add -A` 会把 node_modules 也加进去——找导师要一份 .gitignore 模板",
        ],
      },
    ],
    acceptanceScript: `# ⚠️ PowerShell 用户注意：把每行末尾的 \\ 换成 ` + "`" + `（反引号）
# CMD 用户：把 \\ 删掉，整条命令写成一行
curl -X POST http://localhost:3000/api/chat \\
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
    preKnowledge: [
      { term: "Agent", explanation: "能「自己决定下一步做什么」的 AI。不是你问一句它答一句，而是它可以先出题、再等你回答、再点评——自己规划步骤。" },
      { term: "Tool Calling", explanation: "你给模型一份「工具菜单」，模型在需要的时候点菜（比如「我要出题，给我 make_quiz 工具」），你帮它执行，把结果喂回去。" },
      { term: "JSON Schema", explanation: "一份「说明书」，精确描述一个 JSON 应该长什么样——有哪些字段、每个字段什么类型、必填还是可选。模型照着 Schema 填空。" },
      { term: "tool_calls", explanation: "模型返回消息里的一个字段。如果 model 觉得需要调用工具，这个字段就有值；如果是普通文字回复，就没有。" },
      { term: "Agent Loop（Agent 循环）", explanation: "while 循环：调模型 → 检查要不要工具 → 要→执行工具→把结果塞回消息→再调模型 → 不要→结束。最多循环 N 次防死循环。" },
      { term: "role: 'tool'", explanation: "消息角色的一种。工具执行完的结果，必须以 role='tool' 的身份塞回 messages 数组，模型才能「看到」工具结果。" },
      { term: "死循环", explanation: "代码一直跑、永远停不下来。Agent Loop 用 maxSteps（如 5）兜底：不管模型还要不要工具，跑满 5 轮强制停止。" },
    ],
    tasks: [
      {
        label: "出题工具 + 参数 Schema",
        moduleRef: "tool-calling",
        file: "src/lib/quiz-tool.ts",
        why: "告诉模型「你可以出题」——不给工具，模型只会动嘴不会动手；Schema 是双方契约，保证每道题格式统一。",
        detail:
          "新建 `src/lib/quiz-tool.ts`。export 一个 `quizTool` 对象：`type: 'function'`，`function.name: 'make_quiz'`，`function.description` 写清楚「什么时候用这个工具」，`function.parameters` 用 JSON Schema 描述 4 个必填参数：question（题干）、options（4 个选项的数组）、answer（正确选项如 B）、explanation（解析）。",
        askAI: "问导师：「帮我写一个 OpenAI 格式的 Tool Definition——工具叫 make_quiz，用来出选择题。需要 4 个必填参数：题干、4 个选项的数组、正确答案、解析。请给我完整的 JSON Schema。」",
        stuckPrompt: "把 quiz-tool.ts 贴给导师，问「这个 Tool Schema 格式对吗？模型一直不调用出题工具——是不是 description 没写清楚触发条件？」",
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
        why: "这是 Agent 的心脏——模型不是一次说完就完，而是「思考→要工具→拿到结果→再思考」的多轮博弈。",
        detail:
          "新建 `src/lib/agent-loop.ts`。export `async function runAgentLoop(userMessage)`：\n1. 初始化 messages 数组（system prompt + user message）\n2. `for (let step = 0; step < 5; step++)`——最多 5 步防死循环\n3. 调大模型 API，传 `tools: [quizTool]`\n4. 检查返回的 `choice.message.tool_calls`：没有 → 返回 `choice.message.content`（循环结束）\n5. 有 tool_calls → 先把 `choice.message` push 进 messages\n6. 遍历 tool_calls，解析 `call.function.arguments`，包装成 `{ role: 'tool', tool_call_id, content }` push 进 messages\n7. 回到 for 循环开头——模型看到工具结果后再次决策\n\n> ⚠️ 第一版的 Agent Loop 先返回**完整文本**（不走 SSE 流式），确保多步循环逻辑正确。\n> 跑通后如果想恢复打字机效果，问导师：「怎么让 Agent Loop 支持 SSE 流式输出？」——这是进阶优化，不影响功能。",
        askAI: "问导师：「帮我写一个 runAgentLoop 函数——接收用户消息，用 for 循环最多 5 轮，每轮调大模型，如果模型返回 tool_calls 就执行工具并把结果塞回 messages，直到模型不调用工具为止。注意：先不用 SSE 流式，返回完整文本就好。」",
        stuckPrompt: "贴 agent-loop.ts 代码 + 终端日志给导师。列三件事：①Agent 循环跑了几轮 ②tool_calls 有没有被正确处理 ③模型最终回复有没有内容。问导师「循环逻辑哪里不对？」",
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
        why: "不验证就是盲搭——亲眼看到「讲概念→出题」全链路跑通，定位问题才有依据。",
        detail:
          "跑验收 curl 命令（下方）。预期：AI 先用 2-3 句话讲清楚概念（带类比或例子），然后出现两道选择题，每题 4 个选项 + 标明正确答案 + 解析。服务端终端能观察到完整的「模型要工具 → 你执行 → 喂回 → 模型继续」日志。",
        askAI: "验证通过后问导师：「Agent 循环跑通了——帮我检查一下我的 agent-loop.ts，看看有没有潜在 bug 或者可以优化的地方。」把代码贴上去让导师 code review。",
        stuckPrompt: "如果只有讲解没有题：贴 agent-loop.ts 给导师，问「模型为什么不调用工具？是 tools 参数没传对，还是 quiz-tool 的 description 没写清触发条件？」。如果循环只跑了一轮：问导师「tool_calls 处理后为什么没有继续循环？」",
        pitfalls: [
          "如果只有讲解没有题 → 检查 tools 参数是否正确传入、quizTool 的 description 是否写清了触发条件",
          "如果循环只跑了一步 → 检查 tool_calls 判断逻辑：先处理 tool_calls，再进入下一轮",
          "如果模型返回时 content 为空但有 tool_calls → 这是正常的，模型调用工具时 content 可以为 null",
        ],
      },
      {
        label: "🔖 Git 存档：第二斧完成",
        file: 'git add -A && git commit -m "第二斧完成：Agent Loop，工具调用 + 多步推理"',
        moduleRef: "vibe-coding",
        why: "Agent Loop 是平台的大脑——讲→示→测的完整链路跑通了。存档后再改 RAG/数据库/点评，每一步都有回头路。",
        detail:
          "终端：`git add -A` 然后 `git commit -m \"第二斧完成：Agent Loop，工具调用 + 多步推理\"`。`git log --oneline` 确认能看到三条 commit（空项目 + 第一斧 + 第二斧）。",
        askAI: "问导师：「我第二斧做完了，教我存档。」",
        stuckPrompt: "如果 `git commit` 提示 nothing to commit → 检查是不是在 teaching-platform/ 目录下、前面有没有改过文件。",
        pitfalls: [
          "每次存档前先用 `git status` 看看有哪些文件改动了——确认没有漏掉也没多出不该有的",
          "`node_modules/` 不应该进 Git——如果 `git status` 里出现了它，回去建 .gitignore",
        ],
      },
    ],
    acceptanceScript: `# ⚠️ PowerShell 用户注意：把 \\ 换成 ` + "`" + `（反引号）；CMD 用户：删掉 \\ 写成一行
curl -X POST http://localhost:3000/api/chat \\
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
    preKnowledge: [
      { term: "RAG（检索增强生成）", explanation: "在问 AI 之前，先从资料库里搜出相关的内容，一起塞进 prompt——AI 就能「看着资料回答」，而不是瞎编。" },
      { term: "YAML front matter", explanation: "Markdown 文件最顶部的 `---` 包裹的配置块。写的是这篇文档的元数据（标题、序号等），正文在第二个 `---` 之后。" },
      { term: "node:fs", explanation: "Node.js 内置的文件系统模块。`readFileSync` 可以读取电脑上的文件——这里用来读取 llm-wiki 里的 .md 讲稿。" },
      { term: "SQLite", explanation: "一个轻量数据库——不需要安装服务器，一个 .db 文件就是整个数据库。Node.js 22.5 内置了，不用装任何东西。" },
      { term: "DatabaseSync", explanation: "Node.js 22.5 内置的 SQLite 同步 API。不需要 async/await，写起来像普通代码。注意名字是 DatabaseSync 不是 Database。" },
      { term: "upsert（插入或更新）", explanation: "如果数据库里已经有这条记录就更新它，没有就插入一条新的。一句话替代「先查有没有 → 有就改 → 没有就加」三行逻辑。" },
      { term: "占位符（?）", explanation: "SQL 防注入的法宝。`db.prepare('SELECT * FROM t WHERE id=?').get(id)`——问号会被 id 的值安全替换，不会被注入恶意代码。" },
      { term: "temperature", explanation: "控制模型「创造力」的参数。0 是最死板（适合评分），1 是最跳脱（适合创意写作）。点评 Agent 设 0.3 保证分数稳定。" },
    ],
    tasks: [
      {
        label: "概念页注入上下文（RAG）",
        moduleRef: "rag",
        file: "src/lib/lecture-context.ts",
        why: "没有讲稿注入，AI 不知道你在学什么——概念页就是 AI 的「备课笔记」，决定了它讲的内容对不对。",
        detail:
          "新建 `src/lib/lecture-context.ts`。用 `node:fs` 的 `readFileSync` 读取 `llm-wiki/concepts/` 下的 .md 讲稿文件。去掉文件头部的 YAML front matter（`---` 包裹的元数据块），返回正文。在 `agent-loop.ts` 里：调模型前先 `loadLectureContent(moduleId)`，把返回的讲稿拼到 System Prompt 末尾（如 `【本讲参考资料】\n...`）。",
        askAI: "问导师：「帮我在 Node.js 里写一个 loadLectureContent 函数——用 readFileSync 读取 llm-wiki/concepts/xxx.md，去掉 YAML front matter（两个 --- 之间的内容），返回正文纯文本。」",
        stuckPrompt: "如果读文件报错（找不到文件）：贴完整路径和报错给导师，问「process.cwd() 返回的是哪个目录？我的 md 文件到底在哪？」",
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
        why: "没有数据库，每次对话都是从零开始——存了掌握度，AI 才知道你哪里弱、该重点练哪里。",
        detail:
          "新建 `src/lib/db.ts`。`import { DatabaseSync } from 'node:sqlite'`，`new DatabaseSync('dev.db')` 创建/打开数据库。用 `db.exec()` 执行 `CREATE TABLE IF NOT EXISTS mastery (...)` 建表（字段：id, module_id, score, dimension_scores, feedback, created_at, updated_at）。实现 `upsertMastery(moduleId, score, dimensions, feedback)`——先查有没有记录，有就 UPDATE，没有就 INSERT。用 `db.prepare(...).get()` 做查询，`?` 占位符防注入。",
        askAI: "问导师：「帮我在 Node.js 里用 node:sqlite 的 DatabaseSync 写一个 upsertMastery 函数——建一张 mastery 表，如果 module_id 已有记录就 UPDATE，没有就 INSERT。用 ? 占位符防注入。」",
        stuckPrompt: "贴 db.ts 代码 + 报错给导师。常见问题：\"DatabaseSync is not defined\"（Node 版本 < 22.5）、\"db.prepare is not a function\"（拼写错误）、\"SQLITE_ERROR\"（SQL 语法错了）。",
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
        why: "这是教学的闭环——学生交作业 → AI 按维度打分+给建议 → 落库记录进度，和数据库串成一条线。",
        detail:
          "分两步：\n\n**① 写点评 Agent**（`src/lib/review.ts`）：定义 `REVIEW_SYSTEM_PROMPT`——评分维度不写死 4 个，改成**从验收清单动态读取**。System Prompt 要求模型先扫描提交文本，找到对应清单条目的证据后设维度打 1-5 分，没找到证据的条目不设维度（宁可少一维，不编一个分）。输出严格 JSON：`{ dimensions: { \"条目1\": 4, ... }, deductions: [...], suggestions: '...', overall: 数字 }`。函数 `reviewHomework(moduleId, homework)` 调模型拿评分 JSON，解析后调用 `upsertMastery` 落库。temperature 设 0.3 让评分稳定。\n\n**② 创建点评入口**（`src/app/api/validate/route.ts`）：export 一个 POST 函数，从 req 取 content 和 moduleId，调 `reviewHomework`，返回结果。这是点评的 API 端点——前端聊天页会通过它提交作业。",
        askAI: "问导师：「帮我写一个 REVIEW_SYSTEM_PROMPT——AI 作为代码评审老师，从验收清单里找证据设维度打分。不写死 4 个维度，而是根据提交内容里实际找到的清单证据动态设维度（1-5 分），没证据的不设维度。必须输出严格 JSON。」写完后再问：「再帮我写一个 /api/validate 的 route.ts，接收 POST 调 reviewHomework 返回结果。」",
        stuckPrompt: "贴 review.ts 代码 + 模型返回的内容给导师。常见问题：①AI 在 JSON 外面套了 markdown 代码块 → 问「怎么从模型回复里提取纯 JSON？」②JSON.parse 报错 → 问「模型返回的 JSON 格式不标准怎么办？」③upsertMastery 没落库 → 问「reviewHomework 到 upsertMastery 的数据流对吗？」④POST /api/validate 返回 404 → 检查文件是否放在 src/app/api/validate/route.ts，文件名必须叫 route.ts。",
        pitfalls: [
          "System Prompt 里的 JSON 示例就是模型的「模板」——它大概率会照抄格式",
          "`JSON.parse` 要包 try-catch——模型偶尔在 JSON 外面套 markdown 代码块",
          "`/api/validate` 的 route.ts 文件名不能改——Next.js 只认 `route.ts`",
          "reviewHomework 接收 moduleId 参数——前端 POST 时 body 里要传 `{ content: '...', moduleId: '...' }`",
        ],
      },
      {
        label: "🔖 Git 存档：第三斧完成",
        file: 'git add -A && git commit -m "第三斧完成：RAG 知识注入 + SQLite 存档 + 点评 Agent"',
        moduleRef: "vibe-coding",
        why: "三斧全做完 = 平台的核心引擎已经就位。这是最重量级的存档——RAG、数据库、点评三条线全部接通。",
        detail:
          "终端：`git add -A` 然后 `git commit -m \"第三斧完成：RAG 知识注入 + SQLite 存档 + 点评 Agent\"`。`git log --oneline` 确认能看到四条 commit（空项目 + 第一斧 + 第二斧 + 第三斧）。",
        askAI: "问导师：「我第三斧做完了，帮我确认一下没有漏掉存档。」",
        stuckPrompt: "如果 `git log --oneline` 看不到第三条 commit → `git status` 看看是不是前面漏存了。把输出贴给导师问「是不是某一步忘了 commit？」",
        pitfalls: [
          "`dev.db` 是 SQLite 数据库文件，不应该进 Git——确保 .gitignore 里有 `*.db` 这一行",
        ],
      },
    ],
    acceptanceScript: `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT * FROM mastery').all())"
# → 有记录，分数随学习变化（无需安装 sqlite3 命令行）

curl -X POST http://localhost:3000/api/validate \\
  -H "Content-Type: application/json" \\
  -d '{"moduleId":"platform-replica","content":"const name = (void 0).name"}'
# → JSON 返回维度分、扣分点、改进建议，并且落库`,
  },
  {
    index: 4,
    title: "龙骨 · 页面连线",
    goal: "把所有页面连成一条完整的学习路径。每连一段跑通一段。",
    preKnowledge: [
      { term: "App Router", explanation: "Next.js 13+ 的路由方式。src/app/ 下的文件夹结构 = 网站 URL 结构。page.tsx 自动变成对应路由的页面。" },
      { term: "动态路由 [id]", explanation: "文件夹名带方括号就是动态路由。src/app/learn/[id]/page.tsx → /learn/任意内容 都会匹配到。params 里能拿到 id 的值。" },
      { term: "<Link>", explanation: "Next.js 的导航组件。和 <a> 标签的区别：Link 做客户端路由跳转，页面不刷新；<a> 会让整个页面重载。" },
      { term: "面包屑（Breadcrumb）", explanation: "页面上方的导航路径，比如「首页 > 学习中心 > 模块名」。告诉学生「你在哪」，还可以点回去。" },
      { term: "layout.tsx", explanation: "共享布局文件。放在文件夹里，该文件夹下的所有页面自动套用这个布局。适合放导航栏、页脚等公共部分。" },
      { term: "服务端组件 vs 客户端组件", explanation: "服务端组件（默认）：在服务器上渲染好 HTML 发给浏览器，不能用 useState。客户端组件（加 'use client'）：在浏览器里运行，能用 React hooks。" },
    ],
    tasks: [
      {
        label: "首页 `/`",
        file: "src/app/page.tsx",
        why: "所有学习路径的起点——没有首页，学生不知道从哪进。",
        detail:
          "修改 `src/app/page.tsx`。用 Next.js 的 `<Link href='/learn'>` 和 `<Link href='/report'>` 做两个入口按钮。标题写「AI 教学平台」+ 一句话介绍。用 Tailwind CSS 居中布局（`flex min-h-screen items-center justify-center`）。\n\n**进阶（龙骨连线）**：首页是整个平台的「大门」——确保两个 Link 都指向正确的路由。写完首页后把第一斧的 ChatPanel import 进来试一下：在首页底部加一个「快速体验」折叠区，里面放 ChatPanel。这样首页既是大门又是快速试用入口。问导师：「怎么在首页加一个可折叠的 ChatPanel？」",
        askAI: "问导师：「帮我用 Next.js + Tailwind CSS 写一个首页——居中布局，标题是『AI 教学平台』，下面两个按钮分别跳转到 /learn 和 /report。用 Link 组件，不要用 a 标签。」",
        stuckPrompt: "贴 page.tsx 代码给导师，问「页面能渲染，但点击按钮没反应——是不是 Link 的用法不对？」",
        pitfalls: [
          "用 `<Link>` 而不是 `<a>`——Next.js 的 Link 做客户端路由跳转，不会整页刷新",
          "`page.tsx` 是服务端组件，不需要 `'use client'`——但如果加了 useState 就必须加",
        ],
      },
      {
        label: "学习中心 `/learn`",
        file: "src/app/learn/page.tsx",
        why: "课程目录——学生从这里选模块、看进度，是整个教学平台的导航枢纽。",
        detail:
          "新建 `src/app/learn/page.tsx`。定义一个模块列表数组（id + name + desc），用 `map` 渲染成卡片列表。每个卡片是 `<Link href={/learn/\${mod.id}}>`，点击跳转到对应模块的工作区。卡片上显示序号、模块名、一句话描述。\n\n**进阶（龙骨连线）**：静态数组能跑就行。学完第三斧的 RAG + node:fs 后，把静态数组替换成动态读取：用 `node:fs` 的 `readdirSync` 读取 `llm-wiki/concepts/` 目录下所有 .md 文件，解析每个文件的 YAML front matter 拿 id/name/description，按拓扑序排列。问导师：「怎么用 node:fs 动态读取文件夹、解析 front matter 生成模块列表？」",
        askAI: "问导师：「帮我在 Next.js 的 src/app/learn/page.tsx 写一个课程目录页——用一个模块数组（11 个模块，每个有 id/name/desc），map 渲染成卡片，点击卡片跳转到 /learn/模块ID。用 Tailwind 做卡片布局。」",
        stuckPrompt: "贴代码给导师，问「卡片渲染出来了但路由不对——Next.js 的动态路由 [id] 文件夹应该建在哪？Link 的 href 怎么写才对？」",
        pitfalls: [
          "Next.js 的 App Router：`src/app/learn/page.tsx` → 自动匹配 `/learn` 路由",
          "模块列表可以先写死（11 个模块的数组），后续再改动态读取",
          "动态读取进阶：`readdirSync` 返回的是文件名数组，需要 filter 出 .md 结尾的，再去掉扩展名",
        ],
      },
      {
        label: "工作区 `/learn/[id]`",
        file: "src/app/learn/[id]/page.tsx",
        why: "这才是学生真正「上课」的地方——左边看讲稿、右边跟 AI 聊，讲练结合的完整学习环境。",
        detail:
          "新建 `src/app/learn/[id]/page.tsx`。用 `async function Page({ params }: { params: Promise<{ id: string }> })` 接收动态路由参数。页面分左右两栏：左侧渲染模块讲稿（先用占位文字跑通布局），右侧嵌入 `ChatPanel` 聊天组件。顶部加面包屑和返回按钮。\n\n**进阶（龙骨连线）**——这是整个复刻最关键的三线汇合点：\n1. **RAG 注入**：左侧面板用第三斧的 `loadLectureContent(id)` 读取 `llm-wiki/concepts/{id}.md`，去掉 front matter 后渲染 Markdown 正文。这样学生打开任意模块，左边就是讲稿。\n2. **Agent Loop**：右侧 ChatPanel 的发消息逻辑，从第一斧的「直接调 /api/chat」升级为走第二斧的 `runAgentLoop`——学生在工作区聊天时，AI 既能讲概念又能出题。\n3. **点评接入**：在工作区底部加一个「提交作业」按钮，调 `/api/validate`，展示点评结果。\n问导师：「帮我把 loadLectureContent 接到工作区左侧面板，把 runAgentLoop 接到 ChatPanel，再加一个提交作业按钮调 /api/validate。」",
        askAI: "问导师：「帮我在 Next.js 的 src/app/learn/[id]/page.tsx 写一个工作区页面——左右两栏布局，左边渲染讲稿内容，右边放我之前写的 ChatPanel 组件。顶部有面包屑导航。params 是 Promise 类型（Next.js 15+）。」",
        stuckPrompt: "贴代码 + 报错给导师。常见问题：①params is not a Promise → 用了 const { id } = params 而不是 const { id } = await params ②ChatPanel 找不到 → import 路径写错了 ③布局错乱 → Tailwind 的 flex/grid 没写对。进阶连线问题：④loadLectureContent 返回 undefined → 检查 llm-wiki/concepts/ 文件夹是否存在 ⑤左侧面板乱码 → Markdown 渲染不能用 innerHTML，问导师「怎么在 React 里渲染 Markdown？」",
        pitfalls: [
          "`[id]` 是 Next.js 的动态路由语法——文件夹名带方括号",
          "params 现在是 Promise 类型（Next.js 15+），需要 `const { id } = await params`",
          "左侧 layout 是服务端组件——loadLectureContent 的 readFileSync 可以在这里直接调",
          "右侧 ChatPanel 是客户端组件（'use client'）——import 进来后可以直接用",
        ],
      },
      {
        label: "设置 `/settings`",
        file: "src/app/settings/page.tsx",
        why: "让学生确认平台配置是否正确——看不到设置页，出问题时连「是不是 Key 没配」都排查不了。",
        detail:
          "新建 `src/app/settings/page.tsx`。显示当前 API Key 状态（脱敏显示，只露后 4 位）、当前使用的模型名称。用一个只读输入框或文本展示即可——这个页面主要是让学生确认「配置对了没有」。\n\n**进阶（龙骨连线）**：①加一个「连通性测试」按钮——点击后发一个测试请求到大模型 API，返回 ✅ 或 ❌。②API Key 脱敏显示通过 Next.js 服务端组件传递（`process.env` 只在服务端可用，通过 props 传给客户端组件）。问导师：「怎么在 Settings 页加一个连通性测试按钮，点一下就知道 API Key 配没配对？」",
        askAI: "问导师：「帮我在 Next.js 里写一个设置页 /settings——展示 API Key 状态（脱敏显示，只露后 4 位）和当前模型名称。纯展示，不需要表单提交。」",
        stuckPrompt: "贴代码给导师问「怎么从 .env.local 里读值显示在页面上？process.env 在客户端组件里能用吗？」——让导师解释 Next.js 里服务端和客户端环境变量的区别。",
        pitfalls: [
          "不要把 API Key 完整显示在前端——用 `●●●●●●●●` 替代",
          "这是一个纯展示页，不需要表单提交功能",
          "`process.env` 只在服务端可用——要在服务端组件里读，通过 props 传给客户端组件",
        ],
      },
    ],
    acceptanceDesc:
      "五条路由都能访问，导航完整，页面不白屏。用浏览器手动点一遍：首页 → 学习中心 → 任意模块工作区 → 报告 → 设置，每个页面都有内容。",
  },
  {
    index: 5,
    title: "结算",
    goal: "三斧全绿 + 龙骨连线完整 = 达标。逐项自查——每项都先用 AI 帮你检查。",
    preKnowledge: [
      { term: "开发者工具（F12）", explanation: "浏览器内置的调试工具。Network 标签可以看所有网络请求的详情——SSE 流有没有在传、状态码是不是 200，全在这里看。" },
      { term: "code review（代码评审）", explanation: "把你的代码贴给 AI，让它逐行检查有没有 bug、写法是否规范——就像老师批改作业。" },
      { term: "回归测试", explanation: "改了一个功能后，把之前跑通的功能重新测一遍——确保新改动没把旧东西搞坏。" },
    ],
    tasks: [
      {
        label: "能跟 AI 实时对话（SSE 流式，打字机渲染）",
        why: "打字机效果在 = 流式 SSE 没断——这是第一斧的核心成果，断了说明水管有问题。",
        detail:
          "在前端输入「你好」，AI 逐字回复，不是一次性弹出一大段。打开浏览器开发者工具（F12）→ Network 标签 → 找到 /api/chat 请求 → 看 Response，应该是逐行 `data: {...}` 的 SSE 格式。",
        askAI: "问导师：「帮我检查我的打字机效果是否正常——我把 ChatPanel 的代码贴给你，你帮我看看 SSE 流的读取逻辑有没有问题？」",
        stuckPrompt: "如果打字机效果没了（整段弹出）：贴 ChatPanel 代码 + 浏览器 Network 标签截图给导师，问「为什么 SSE 流式变成了整段返回？」可能原因：①Agent Loop 改成非流式了（第二斧的正常现象——见下方说明）②reader.read() 的循环写错了。",
      },
      {
        label: "AI 被 System Prompt 约束为教学导师，不讲无关内容",
        why: "如果 AI 回答无关内容，System Prompt 约束力不够——回到第一斧第三步加固。",
        detail:
          "问 AI「今天天气怎么样」或「帮我写一封辞职信」→ AI 应该拒绝或引导回学习话题。如果 AI 回答了无关内容，回到 `agent-prompts/teaching-chat.ts` 加强约束。",
        askAI: "问导师：「帮我检查我的 System Prompt 约束力——当前 Prompt 是：（贴你的 Prompt）。当学生问无关问题时，AI 会跑偏吗？怎么加强？」",
        stuckPrompt: "贴 System Prompt + AI 跑偏的对话记录给导师，问「为什么 AI 还是回答了无关问题？Prompt 里该怎么改才能让它坚定拒绝？」",
      },
      {
        label: "Agent 能多步输出：讲概念 → 给示范 → 出测验题",
        why: "讲→示→测的完整链路 = 第二斧 Agent 循环真跑起来了——只有一步说明 tool_calls 没触发。",
        detail:
          "输入「给我讲讲什么是闭包，再出两道选择题」。观察回复：先有概念讲解 → 然后出现题目。服务端终端日志能看到「模型请求工具 → 执行 → 喂回」的完整链路。",
        askAI: "问导师：「帮我检查我的 Agent Loop——我把 agent-loop.ts 的代码贴给你，你帮我看看：①tool_calls 处理逻辑对不对 ②循环出口条件是否正确 ③有没有潜在的无限循环风险。」",
        stuckPrompt: "如果只有讲解没有题：贴 agent-loop.ts + tools 传递代码给导师。如果循环只跑了一轮：贴终端日志给导师，问「为什么 tool_calls 处理完没有继续循环？」",
      },
      {
        label: "出题 Agent 输出的题目符合 Schema（有选项、有答案、有解析）",
        why: "Schema 是一斧和二斧的接头——题格式不对，要么 quiz-tool 的 JSON Schema 写错了，要么 agent-loop 解析 tool_calls 有问题。",
        detail:
          "看 AI 出的题——4 个选项齐全、标明了正确答案、有解析。缺少任何一项 → 检查 quiz-tool.ts 的 required 数组和 agent-loop.ts 的 tool 结果处理。",
        askAI: "问导师：「帮我检查 quiz-tool.ts 的 JSON Schema——required 数组写全了吗？parameters 的类型描述够清晰吗？贴完整的 Schema 给你看。」",
        stuckPrompt: "把 AI 出的题贴给导师（缺了哪一项标出来），问「为什么模型出的题少了 XX 字段？是我 Schema 的问题还是解析 tool_calls 的问题？」",
      },
      {
        label: "点评 Agent：交作业能拿到维度分、扣分点、改进建议，且落库",
        why: "点评+落库 = 第三斧的闭环——缺一项说明 review.ts 或 db.ts 没对接好。",
        detail:
          "在下方「交付与检验单」编辑器贴一段代码，点「提交点评」。返回的 JSON 里有 dimensions（按验收清单动态设维度，每维 1-5 分）、deductions（扣分点）、suggestions（改进建议）。然后跑 `node -e \"...\"` 验证数据库里有这条记录。",
        askAI: "问导师：「帮我全面检查 review.ts ——System Prompt 的 JSON 格式要求是否明确、JSON.parse 的容错是否到位、upsertMastery 的调用是否正确。我把代码贴给你。」",
        stuckPrompt: "如果点评返回的不是 JSON：贴返回内容给导师，问「模型在 JSON 外面套了东西，怎么提取？」。如果点评没落库：问导师「reviewHomework → upsertMastery 的数据流对吗？是不是字段名没对上？」",
      },
      {
        label: "SQLite 记录学习进度，刷新不丢",
        why: "持久化的铁证——数据没丢说明 upsert 逻辑和 dev.db 文件位置都对。",
        detail:
          "点评完成后关闭浏览器标签页，重新打开 `/learn/platform-replica`，查数据库 `node -e \"...\"`——之前的评分记录还在。如果丢了 → 检查 dev.db 文件是否在项目根目录、是否被 gitignore 忽略了（应该忽略，但文件本身要存在）。",
        askAI: "问导师：「帮我检查我的 db.ts——建表语句、upsert 逻辑、prepared statement 的用法有没有问题？dev.db 文件应该出现在哪个目录？」",
        stuckPrompt: "贴 db.ts + 终端命令输出（查不到记录）给导师，问「为什么重启后数据丢了？是 upsert 没真正写进去，还是 dev.db 的路径不对？」",
      },
      {
        label: "页面导航完整：首页 → 学习中心 → 工作区 → 报告 → 设置",
        why: "龙骨四斧的接头——五条路由全通说明页面连线没断，缺一页整个学习路径就断了。",
        detail:
          "从首页开始，逐一访问 5 个页面。检查：每个页面都能正常渲染（不白屏）、面包屑导航正确、返回按钮能回到上一级。",
        askAI: "问导师：「帮我做一次整体 code review——把 page.tsx（首页）、learn/page.tsx、learn/[id]/page.tsx、report/page.tsx、settings/page.tsx 五个页面的代码贴给你，帮我检查：①Link 用法是否正确 ②动态路由的 params 处理对不对 ③有没有潜在的导入路径错误。」",
        stuckPrompt: "如果某个页面白屏：贴该页面的代码 + 浏览器控制台报错给导师，问「这个页面为什么白屏？」。如果是 404：问导师「文件夹结构对吗？Next.js App Router 的路由约定是什么？」",
      },
      {
        label: "Git 存档完整：`git log --oneline` ≥ 5 条 commit",
        moduleRef: "vibe-coding",
        why: "Git 日志是你整个搭建过程的「时间轴」——每一条 commit 对应一个里程碑。缺一条说明某个阶段没存档，或做完了没留痕迹。",
        detail:
          "终端跑 `git log --oneline`。预期看到至少 5 条 commit：空项目跑通、三斧各一条、龙骨一条。每条 commit message 写清楚做了什么——不能出现「update」「fix」这种无意义的词。如果不够 5 条 → 回到没存档的阶段，补上 `git add -A && git commit -m \"...\"`。\n\n这就是你的交付清单：代码跑通 = 平台能用的证据，Git log = 你一步步搭出来的证据。",
        askAI: "问导师：「帮我检查 git log——我把 `git log --oneline` 的输出贴给你，你帮我看看：①是否覆盖了所有阶段 ②commit message 是否够清晰。」",
        stuckPrompt: "如果 `git log` 只有一两条：把输出贴给导师问「我好像漏了中间几步的存档——怎么补？」导师会告诉你 `git status` → `git add -A` → `git commit -m \"...\"` 的补救流程。",
        pitfalls: [
          "commit message 不能写「update」——看 git log 时完全不知道 update 了什么",
          "如果龙骨阶段跨多个功能（5 个页面），可以不只一条 commit——每个页面做完 commit 一次更安全",
        ],
      },
    ],
    acceptanceDesc:
      "在 localhost:3000 上全部跑通 → 达标。终端跑 `git log --oneline`，看到 5 条以上有意义 commit → 过程留痕。把 agent-loop.ts 全文贴进下方「交付与检验单」编辑器，点「提交点评」拿正式检验单（维度分、扣分点、建议，计入掌握度）；route.ts 用一句话说明改动点即可，清单自查在对话里与导师核对。",
  },
];