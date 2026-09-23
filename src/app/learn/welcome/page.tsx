import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Code2,
  MessageSquare,
  ScrollText,
  Workflow,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "写在最前面",
};

const SUBSYSTEMS = [
  {
    icon: MessageSquare,
    title: "LLM API 调用",
    detail: "让网页能「调 AI」——发请求、收回复",
    module: "模块 2",
  },
  {
    icon: Workflow,
    title: "Agent Loop",
    detail: "AI 不只是聊天——能推教学流程、切换步骤",
    module: "模块 3",
  },
  {
    icon: ScrollText,
    title: "出题 Agent",
    detail: "根据概念自动出题、批改、给反馈",
    module: "模块 7",
  },
  {
    icon: Code2,
    title: "SSE 流式传输",
    detail: "逐字打字的效果——不是刷一下弹出来",
    module: "模块 6",
  },
  {
    icon: Brain,
    title: "掌握度追踪",
    detail: "记录你哪个概念会了、哪个还不行",
    module: "模块 10",
  },
];

const ABILITIES = [
  { name: "意图表达", detail: "说人话，让 AI 听懂你到底要什么" },
  { name: "任务分解", detail: "大事化小，别一下甩 500 字需求" },
  { name: "上下文管理", detail: "给 AI 的信息不多不少、刚好够用" },
  { name: "质量判断", detail: "AI 给的代码能不能跑？哪里不对劲？" },
  { name: "迭代调优", detail: "第一版不行就改，改到行为止" },
  {
    name: "理解 AI 行为模式",
    detail: "知道 AI 会胡扯、会讨好你、会编 API",
  },
];

const ROADMAP = [
  { color: "text-emerald-500", label: "第一步：选语言", items: "Python 基础速通 / TypeScript 基础速通" },
  { color: "text-amber-500", label: "第二步：学会让 AI 做事", items: "LLM API → System Prompt → Agent Loop → 工具调用" },
  { color: "text-orange-500", label: "第三步：让 AI 更聪明", items: "RAG → LLM Wiki" },
  { color: "text-red-500", label: "第四步：进阶玩法", items: "多 Agent 协作 → MCP → AI 安全" },
];

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      {/* ---------- 冷水 ---------- */}
      <section>
        <Badge variant="outline" className="mb-4">
          写在最前面
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          先泼你一盆冷水
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            如果你期待的是「学完 10 节课，拿下 Python 高级证书，面试对答如流」——
          </p>
          <p className="font-semibold text-foreground">
            出门左转。这门课不教这个。
          </p>
          <p>
            如果你期待的是「跟着教程敲完一个 Todo List，截图发朋友圈打卡」——
          </p>
          <p className="font-semibold text-foreground">
            也请出门左转。Todo List 不会自己出题，也不会跟你聊天。
          </p>
        </div>
      </section>

      <hr className="my-10" />

      {/* ---------- 教什么 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          那这门课教什么？
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            你打开的每一个网页，背后都是代码。但{" "}
            <strong className="text-foreground">2026 年了</strong>{" "}
            ——一行一行背代码，和拿着算盘考会计证有什么区别？
          </p>
          <p>这门课只让你做一件事：</p>
          <pre className="overflow-x-auto rounded-lg border bg-muted/50 px-4 py-3 text-sm">
            {`把你脑子里的想法 → 告诉 AI → AI 帮你写成代码 → 你跑起来看看`}
          </pre>
          <p>
            而你要交付的作品，是一个
            <strong className="text-foreground">带 AI 大脑的教学网页</strong>。
          </p>
          <p className="font-semibold text-foreground">
            不是闹着玩的 Demo。不是 Hello World。
            是——一个真正会运转的 AI 教学平台。
          </p>
        </div>
      </section>

      <hr className="my-10" />

      {/* ---------- 魔幻现实 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          你正在用的这个网页，就是你的作业
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          来，抬头看看四周。你现在看的这个页面、这个学习中心、这个聊天框、这个逐字打出来的 AI
          回复——<strong className="text-foreground">它的每一个部件，都是你后面 10 个模块要亲手搭出来的。</strong>
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SUBSYSTEMS.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3"
            >
              <item.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {item.module}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm font-medium">
          你在用它学它。学完你把它再造一遍。
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          这是不是有点魔幻现实主义？你站在一栋楼里学建筑，教授说：期末作业是把这栋楼复刻出来。
        </p>
      </section>

      <hr className="my-10" />

      {/* ---------- 你需要变程序员吗 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          你需要变成程序员吗？
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            不需要。而且坦白讲——<strong className="text-foreground">你也变不成。</strong>
          </p>
          <p>
            一个能独立工作的程序员至少要写几百个小时的代码。你有几百个小时吗？有的话你也不会来学这门课了。
          </p>
          <p>
            你需要的是另一种能力，叫{" "}
            <strong className="text-foreground">AI 协作能力</strong>。六件事：
          </p>
        </div>

        <ol className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {ABILITIES.map((item, i) => (
            <li
              key={item.name}
              className="flex items-start gap-2.5 rounded-lg border bg-background px-4 py-3"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                {i + 1}
              </span>
              <div>
                <span className="text-sm font-semibold">{item.name}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-sm text-muted-foreground">
          这六件事，<strong className="text-foreground">不需要你会写代码</strong>。
          需要的是你会想、会判断、会沟通。
        </p>
      </section>

      <hr className="my-10" />

      {/* ---------- 语言选择 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          那语言呢？Python 还是 TypeScript？
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          两个都行。<strong className="text-foreground">效果一样。</strong>{" "}
          因为你不是去当 Python 工程师或前端工程师——你要的只是：
        </p>

        <pre className="mt-4 overflow-x-auto rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          {`读得懂代码 → 能把报错信息贴给 AI → 能改个参数 → 能跑起来`}
        </pre>

        <p className="mt-4 text-sm text-muted-foreground">所以别纠结。看眼缘：</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/learn/python-basics"
            className="group rounded-xl border bg-background px-5 py-4 transition-colors hover:border-ring/60"
          >
            <span className="text-2xl">🐍</span>
            <h3 className="mt-2 text-base font-semibold">Python</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              对后台逻辑更感兴趣？选它。处理数据、调 AI、写脚本，`def
              main():` 开局。
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium group-hover:underline">
              进入
              <ArrowRight className="size-3.5" />
            </span>
          </Link>

          <Link
            href="/learn/ts-basics"
            className="group rounded-xl border bg-background px-5 py-4 transition-colors hover:border-ring/60"
          >
            <span className="text-2xl">💙</span>
            <h3 className="mt-2 text-base font-semibold">TypeScript</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              对网页界面更感兴趣？选它。写界面、做网页、管状态，`function
              main() {}` 开局。
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium group-hover:underline">
              进入
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </div>

        <blockquote className="mt-5 border-l-2 pl-4 text-sm text-muted-foreground">
          实在选不出来？抛硬币。正面 Python，反面 TypeScript。抛完你心里如果闪过「再来一次」——那就选另一面。人只有在硬币飞起来的时候才知道自己真正想要什么。
        </blockquote>
      </section>

      <hr className="my-10" />

      {/* ---------- 路线图 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          十个模块，一条路
        </h2>
        <div className="mt-5 space-y-0">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
            <span className="text-sm font-medium">写在最前面（你正在看）</span>
          </div>
          <div className="-mt-px ml-[18px] h-5 border-l-2 border-dashed border-border" />
          {ROADMAP.map((step) => (
            <div key={step.label}>
              <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
                <span className={`shrink-0 text-xs font-bold ${step.color}`}>
                  {step.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {step.items}
                </span>
              </div>
              <div className="-mt-px ml-[18px] h-5 border-l-2 border-dashed border-border" />
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <span className="flex size-5 shrink-0 items-center justify-center text-xs">
              🎉
            </span>
            <span className="text-sm font-medium">
              你交付的，是一个能教别人学 AI 的 AI 教学平台
            </span>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          每一步都是上一层的台阶。踩实了，再往上。
        </p>
      </section>

      <hr className="my-10" />

      {/* ---------- 不是作业 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          最后一件事：这作业不是给你自己看的
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          你做出来的 AI 教学平台，最后要能给别人用。让室友点开你的网页，跟你的 AI
          聊两句，学点东西，做个题，看看自己掌握了没有。
        </p>
        <p className="mt-3 text-sm font-semibold">
          你做的不是一个作业。你造的是一个能教人的独立系统。
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          这比「期末考试第 3 道选择题选 B」有意思一万倍。
        </p>
      </section>

      <hr className="my-10" />

      {/* ---------- 出发 ---------- */}
      <section className="text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          准备好了没？
        </h2>
        <div className="mx-auto mt-4 max-w-lg space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>深呼吸。</p>
          <p>
            这门课不会太容易。你会卡住、会烦躁、会想把电脑扔出窗外。
          </p>
          <p>
            但你会走出来——手里捏着一个活的、会说话的、会教人的 AI 系统。
          </p>
          <p className="font-medium text-foreground">
            而且你知道它不是天上掉下来的。是你一行一行提示词、一个一个参数、一次一次「再试一次」攒出来的。
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/learn/python-basics">
              🐍 选 Python
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/learn/ts-basics">
              💙 选 TypeScript
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}