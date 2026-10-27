import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Code2,
  MessageSquare,
  ScrollText,
  Wrench,
  Workflow,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadModules } from "@/lib/modules";

export const metadata: Metadata = {
  title: "写在最前面",
};

/**
 * 「这不是比喻」那一节列的六块，与产品现状一一对应：
 * 七步流程（会话状态机）、四个 Agent、混合检索与引用、SSE 流式 + 思维链、
 * 掌握度与复习排期、九个可交互场景。改这里之前先确认对应能力还在。
 */
const SUBSYSTEMS = [
  {
    icon: Workflow,
    title: "七步教学流程",
    detail: "讲解 → 示范 → 模仿 → 点评 → 可视化 → 变式 → 判掌握，写进会话状态",
  },
  {
    icon: MessageSquare,
    title: "四个 Agent",
    detail: "讲解、点评、出题、答疑各管一件事，权限由代码分配，不靠提示词自觉",
  },
  {
    icon: ScrollText,
    title: "混合检索与引用",
    detail: "关键词 + 向量双路召回，答案上标出参考了知识库哪几页",
  },
  {
    icon: Code2,
    title: "流式输出与思维链",
    detail: "回答逐字打出来，第一个字出现之前先看见它想什么",
  },
  {
    icon: Brain,
    title: "掌握度与复习排期",
    detail: "哪一讲会了、哪道题错过，按第 1、3、7、14 天回来找你",
  },
  {
    icon: CheckCircle2,
    title: "九个可交互场景",
    detail: "Agent 循环、检索管线、MCP 握手、提示注入拦截，一步一步放给你看",
  },
];

/**
 * 建造顺序取自 `llm-wiki/concepts/` 的前置依赖链（vibe-coding → ts-basics →
 * llm-api → … → platform-replica），不是另排的课表。改这里要同步改依赖图。
 */
const ROADMAP = [
  {
    color: "text-emerald-500",
    label: "先学会指挥",
    items: "有纪律的 Vibe Coding → TypeScript 基础速通",
  },
  {
    color: "text-amber-500",
    label: "让 AI 动起来",
    items: "LLM API → System Prompt → Agent Loop → 工具调用",
  },
  {
    color: "text-orange-500",
    label: "让 AI 有知识",
    items: "RAG → LLM Wiki",
  },
  {
    color: "text-red-500",
    label: "让 AI 会协作",
    items: "多 Agent → MCP → AI 安全",
  },
  {
    color: "text-sky-500",
    label: "毕业课题",
    items: "教学平台复刻 —— 把前面十一讲拼成一个能用的产品",
  },
];

export default async function WelcomePage() {
  const modules = await loadModules();
  const totalMinutes = modules.reduce((total, teachingModule) => {
    const minutes = Number.parseInt(teachingModule.estimatedTime, 10);
    return total + (Number.isNaN(minutes) ? 0 : minutes);
  }, 0);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      {/* ---------- 冷水 ---------- */}
      <section>
        <Badge variant="outline" className="mb-4">
          写在最前面
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          先给你看一样东西
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>停。别往下翻。抬头看一眼你正在读的这段文字。</p>
          <p>
            它出现在一个网页里。这个网页知道你是谁、学到第几讲、哪一讲卡住了、
            哪道题曾经做错、下次该哪天回来复习——它甚至知道此刻该给你讲什么、不该讲什么。
          </p>
          <p>这些不是写死在页面里的装饰。是一套会自己判断下一步的教学系统。</p>
          <p>
            那就有一个问题了：
            <strong className="text-foreground">
              这套东西是谁写的？它凭什么知道这些？
            </strong>
          </p>
          <p>
            答案可能让你不太舒服——接下来这 {modules.length}{" "}
            讲，你要亲手把它重写一遍。一模一样的。
          </p>
          <p className="font-semibold text-foreground">
            不是你学会怎么用 AI。是你要让 AI 自己跑起来，替别人上课。
          </p>
        </div>
      </section>

      <hr className="my-10" />

      {/* ---------- 这不是比喻 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">这不是一个比喻</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          你正在用的这个平台，拆开来看就是下面这几块东西。前面几讲一块一块搭，
          最后一讲把它们重新拼回去。
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SUBSYSTEMS.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 transition-shadow duration-300 hover:shadow-sm"
            >
              <item.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <span className="text-sm font-semibold">{item.title}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border bg-muted/30 px-5 py-4">
          <p className="text-sm font-medium">你站在一面镜子里。</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            镜子外面是现在的你——在读这一页。镜子里面是做完这一切的你——你交付的网页上，
            另一个人正坐在同样的位置，看着他的 AI
            助教给他讲课。他不知道这段对话是怎么生成的、Agent
            是怎么切换步骤的、出题逻辑是谁写的。他只知道自己学会了。
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            他不需要知道。因为他用的东西，
            <strong className="text-foreground">是你写的。</strong>
          </p>
        </div>
      </section>

      <hr className="my-10" />

      {/* ---------- 你要交付什么 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">你要交付什么</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          一个完整的 AI 教学平台。不是
          Demo。不是截图。是一个人点开浏览器、输入网址、 然后跟着 AI
          从第一讲学到最后一讲——中间不需要你的参与。
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 transition-shadow duration-300 hover:shadow-sm">
            <span className="mt-0.5 shrink-0 text-lg">🏗️</span>
            <div>
              <span className="font-semibold text-foreground">
                它是一个独立运行的系统，不是你的笔记本。
              </span>
              <p className="mt-1">
                不是你电脑 localhost 上跑的一串脚本。是部署到一台公网服务器上、
                谁拿到地址就能用的完整应用。你关掉电脑去睡觉，它还在那里。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 transition-shadow duration-300 hover:shadow-sm">
            <span className="mt-0.5 shrink-0 text-lg">🧠</span>
            <div>
              <span className="font-semibold text-foreground">
                它有自己的大脑。
              </span>
              <p className="mt-1">
                不是那种「点一下按钮弹出一段固定文字」的网页。它能根据学生
                说的话自己决定下一步——讲什么、出什么题、什么时候说你过关了。
                关掉再打开，它还记得你上次卡在哪里、哪道题该复习了。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 transition-shadow duration-300 hover:shadow-sm">
            <span className="mt-0.5 shrink-0 text-lg">👤</span>
            <div>
              <span className="font-semibold text-foreground">
                它的用户不是你。
              </span>
              <p className="mt-1">
                找一个人——室友、同学、网友都行——让他用你做的平台学点东西。
                他不关心你这学期绩点多少。他只关心这东西能不能教会他。
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="my-10" />

      {/* ---------- 建造路线 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">建造顺序</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          从毛坯到交付，共 {modules.length} 讲、约 {totalMinutes} 分钟。
          顺序由前置依赖算出来——上一讲的掌握度达标，下一讲才解锁。跳不过的，踩实了再往上。
        </p>

        <div className="mt-5 space-y-0">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
            <span className="text-sm font-medium">你正在看（写在最前面）</span>
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
              一个能教别人学 AI 的 AI 教学平台，上线运行
            </span>
          </div>
        </div>
      </section>

      <hr className="my-10" />

      {/* ---------- 先把工具备好 ---------- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">先把工具备好</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          这门课不让你手抄代码，但也不替你写。你需要一个能在
          <strong className="text-foreground">你自己的编辑器里</strong>
          陪你干活的 Agent——它动手，你盯着，你决定要不要接受。
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 transition-shadow duration-300 hover:shadow-sm">
            <Wrench className="mt-0.5 size-5 shrink-0 text-emerald-500" />
            <div>
              <span className="font-semibold text-foreground">
                推荐：VS Code + Trae 插件 + DeepSeek V4 Pro。
              </span>
              <p className="mt-1">
                它跑在你自己的编辑器里，改哪个文件、加了哪几行，你都看得见、能拒绝、能回退。
                「能读懂代码」这件事，靠的就是每次改动都从你眼皮底下过。
              </p>
              <p className="mt-1">
                模型选 DeepSeek V4 Pro
                这一档：够用，也够新——不会因为太老而跟不上现在的写法，
                也不会贵到让你不敢多问几句。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <span className="font-semibold text-foreground">
                别一上来就开最顶级的 Agent、最贵的模型。
              </span>
              <p className="mt-1">
                它们会一口气把整个功能写完，你只剩下点「同意」。代码是跑通了，
                但六项能力一个都没练到——开发体验被它们抢完了，你还以为自己学会了。
              </p>
              <p className="mt-1">
                模型也别贪旧：太老的模型连现在的写法都不认识，你会在「它怎么又写错了」
                上白耗半天。用 DeepSeek V4 Pro
                这种够新的中档，让它一次只做一小步——
                先解释你看不懂的那几行，再改一个函数，最后才对整块动手。
                每一步你都要能说清「为什么这么改」。
              </p>
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            装 VS Code → 装 Trae 插件 → 模型选 DeepSeek V4 Pro
            这一档，别急着开最贵的那档。
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            打开一个空文件夹，让它改一个小文件，先确认你能逐行看懂它改了什么。
          </li>
        </ul>
      </section>

      <hr className="my-10" />

      {/* ---------- 开工 ---------- */}
      <section className="text-center">
        <h2 className="text-xl font-semibold tracking-tight">动手吧</h2>
        <div className="mx-auto mt-4 max-w-lg space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>你会卡住。不止一次。会想砸键盘。会觉得「我是不是不该来」。</p>
          <p>
            然后你会查到答案、改完 bug、点开浏览器——那个页面亮了，AI
            开始说话了。
          </p>
          <p className="font-medium text-foreground">
            那一刻你会意识到：这东西不是别人发给你的。是你搭出来的。
          </p>
          <p className="font-medium text-foreground">
            一行一行提示词，一个一个参数，一次一次「再试一次」。
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/learn">
              💙 开始学习
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
