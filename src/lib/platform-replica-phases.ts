/**
 * 教学平台复刻 —— 专属六阶段，从零搭建教学平台
 *
 * 与通用七步教学法（explain/observe/imitate/…）完全不同的教学路径：
 * 这不是"学概念"模块，而是"做项目"模块。学生用前面 9 讲学的每个零件，
 * 亲手搭出一个能用的教学平台。
 *
 * 阶段的权威来源：`llm-wiki/concepts/platform-replica.md`
 * 「🔨 怎么造：三板斧 + 一条龙骨」。
 */

export interface ReplicaTask {
  label: string;
  moduleRef?: string;
  file?: string;
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
    goal: "把空壳跑通，浏览器打开 localhost:3000，看到 Next.js 欢迎页",
    tasks: [
      { label: "创建项目", file: "npx create-next-app teaching-platform" },
      { label: "启动开发服", file: "npm run dev" },
      { label: "浏览器打开 localhost:3000，确认空壳能跑" },
    ],
    acceptanceDesc: "浏览器看到 Next.js 默认首页 → 空壳跑通",
  },
  {
    index: 1,
    title: "第一斧 · 对话骨架",
    goal: "搭完能跟 AI 聊天。SSE 流式，打字机渲染，角色是教学导师。",
    tasks: [
      { label: "封装 LLM 调用", moduleRef: "llm-api", file: "src/lib/llm.ts" },
      { label: "写教学 System Prompt", moduleRef: "system-prompt", file: "agent-prompts/teaching-chat.ts" },
      { label: "实现 SSE 流式接口", file: "src/app/api/chat/route.ts" },
      { label: "前端打字机聊天", file: "src/components/chat/" },
      { label: "API Key 配置", file: ".env.local + 设置页" },
    ],
    acceptanceScript: `curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"content":"你好，请介绍一下你自己"}'
# → 200 + SSE 流式响应
# → 角色是"教学导师"
# → 前端打字机正常渲染`,
  },
  {
    index: 2,
    title: "第二斧 · 多步 Agent",
    goal: "搭完 AI 能讲课、能出题。Agent 多步推理，出题带选项和解析。",
    tasks: [
      { label: "runAgent 核心循环", moduleRef: "agent-loop", file: "src/lib/agent/runtime.ts" },
      { label: "教学 Agent（多步讲解）", moduleRef: "agent-loop", file: "src/lib/agent/teaching-agent.ts" },
      { label: "出题 Agent（function calling）", moduleRef: "tool-calling", file: "src/lib/agent/examiner-agent.ts" },
    ],
    acceptanceScript: `curl -X POST http://localhost:3000/api/agent/teach \\
  -d '{"concept":"llm-api","step":"explain"}'
# → Agent 多步输出：概念定义 → 核心原理 → 防踩坑 → 两道测验题`,
  },
  {
    index: 3,
    title: "第三斧 · 知识 + 数据库",
    goal: "搭完 AI 知道你在学什么、学了什么。上下文注入 + 进度持久化。",
    tasks: [
      { label: "概念页注入上下文", moduleRef: "rag", file: "src/lib/lecture-context.ts" },
      { label: "SQLite 存掌握度", moduleRef: "llm-wiki", file: "src/lib/db/sqlite.ts" },
      { label: "进度追踪", file: "掌握度表 + 会话表" },
    ],
    acceptanceScript: `sqlite3 dev.db "SELECT * FROM mastery WHERE student_id = 'default';"
# → 有记录，分数随学习变化`,
  },
  {
    index: 4,
    title: "龙骨 · 页面连线",
    goal: "把所有页面连成一条完整的学习路径。每连一段跑通一段。",
    tasks: [
      { label: "首页 `/` — 模块列表 + 进入学习" },
      { label: "学习中心 `/learn` — 按拓扑顺序排列的模块卡片" },
      { label: "工作区 `/learn/[id]` — 概念讲解 + 观察示范（分屏）" },
      { label: "沙箱 `/playground` — 自由对话" },
      { label: "设置 `/settings` — API Key + 模型选择" },
    ],
    acceptanceDesc: "五条路由都能访问，导航完整，页面不白屏",
  },
  {
    index: 5,
    title: "结算",
    goal: "三斧全绿 + 龙骨连线完整 = 达标。逐项自查。",
    tasks: [
      { label: "能跟 AI 实时对话（SSE 流式，打字机渲染）" },
      { label: "AI 被 System Prompt 约束为教学导师，不讲无关内容" },
      { label: "Agent 能多步输出：讲概念 → 给示范 → 出测验题" },
      { label: "出题 Agent 输出的题目符合 Schema（有选项、有答案、有解析）" },
      { label: "SQLite 记录学习进度，刷新不丢" },
      { label: "页面导航完整：首页 → 学习中心 → 工作区 → 沙箱 → 设置" },
    ],
    acceptanceDesc: "在 localhost:3000 上全部跑通 → 达标",
  },
];