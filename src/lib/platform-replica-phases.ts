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
      { label: "确认 Node ≥ 22.5", file: "node --version" },
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
      {
        label: "封装 LLM 调用（原始 fetch）",
        moduleRef: "llm-api",
        file: "src/lib/llm.ts",
      },
      {
        label: "写教学 System Prompt",
        moduleRef: "system-prompt",
      },
      { label: "实现 SSE 流式接口", file: "src/app/api/chat/route.ts" },
      { label: "前端打字机聊天", file: "src/components/chat/" },
      { label: "API Key 配置", file: ".env.local" },
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
        label: "把一次调用包成带工具的循环",
        moduleRef: "agent-loop",
        file: "src/lib/agent-loop.ts",
      },
      {
        label: "出题工具 + 参数 Schema（题目/选项/答案/解析）",
        moduleRef: "tool-calling",
        file: "src/lib/quiz-tool.ts",
      },
      {
        label: "工具结果喂回模型，直到产出讲解 + 测验",
        moduleRef: "agent-loop",
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
        label: "概念页注入上下文",
        moduleRef: "rag",
        file: "src/lib/lecture-context.ts",
      },
      {
        label: "SQLite 存掌握度（内置 node:sqlite，免编译）",
        moduleRef: "llm-wiki",
        file: "src/lib/db.ts",
      },
      {
        label: "点评 Agent：按验收清单给维度分 + 落库",
        moduleRef: "system-prompt",
        file: "src/lib/review.ts",
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
      { label: "点评 Agent：交作业能拿到维度分、扣分点、改进建议，且落库" },
      { label: "SQLite 记录学习进度，刷新不丢" },
      { label: "页面导航完整：首页 → 学习中心 → 工作区 → 沙箱 → 设置" },
    ],
    acceptanceDesc:
      "在 localhost:3000 上全部跑通 → 达标。把 agent-loop.ts 全文贴进下方「交付与检验单」编辑器，点「提交点评」拿正式检验单（维度分、扣分点、建议，计入掌握度）；route.ts 用一句话说明改动点即可，清单自查在对话里与导师核对。",
  },
];
