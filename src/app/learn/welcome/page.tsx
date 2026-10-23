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
    detail: "网页能「调 AI」——发请求、收回复",
  },
  {
    icon: Workflow,
    title: "Agent Loop",
    detail: "AI 不只是聊天——能推教学流程、切换步骤",
  },
  {
    icon: ScrollText,
    title: "出题 Agent",
    detail: "根据概念自动出题、批改、给反馈",
  },
  {
    icon: Code2,
    title: "SSE 流式传输",
    detail: "逐字打字——不是刷一下弹出来",
  },
  {
    icon: Brain,
    title: "掌握度追踪",
    detail: "记录哪个概念会了、哪个还不行",
  },
];

const ROADMAP = [
  {
    color: "text-emerald-500",
    label: "选语言",
    items: "Python 基础速通 / TypeScript 基础速通",
  },
  {
    color: "text-amber-500",
    label: "让 AI 动起来",
    items: "LLM API → System Prompt → Agent Loop → 工具调用",
  },
  { color: "text-orange-500", label: "让 AI 变聪明", items: "RAG → LLM Wiki" },
  {
    color: "text-red-500",
    label: "让 AI 协作",
    items: "多 Agent → MCP → AI 安全",
  },
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
          先给你看一样东西
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>停。别往下翻。抬头看看你现在的屏幕。</p>
          <p>
            你正在一个网页里。左边是模块列表，中间是聊天框，AI
            正在回复你。右边可能还有进度条。这个页面知道自己是谁——它知道你在学什么、学到哪了、哪里卡住了。
          </p>
          <p>
            你有没有想过一个问题：
            <strong className="text-foreground">
              这个页面是谁写的？怎么跑起来的？
            </strong>
          </p>
          <p>
            答案可能让你不太舒服——接下来这几个月，你要亲手把它写出来。一模一样的。
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
          我没有在跟你玩修辞。你正在看的这个页面，拆开来看就是下面这几块东西。
          后面每一步都是在搭其中一块。
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
            镜子外面是现在的你——在看这一页。镜子里面是做完这一切的你——你交付的网页上，
            另一个人正坐在同样的位置，看着他的 AI
            助教给他讲课。他不知道这段对话是怎么 生成的、Agent
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
          Demo。不是截图。是一个人点开浏览器、输入网址、 然后开始跟着 AI
          学东西——从第一课到最后一课，全程不需要你的参与。
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 transition-shadow duration-300 hover:shadow-sm">
            <span className="mt-0.5 shrink-0 text-lg">🏗️</span>
            <div>
              <span className="font-semibold text-foreground">
                它是一个独立运行的系统，不是你的笔记本。
              </span>
              <p className="mt-1">
                不是你电脑 localhost
                上跑的一串脚本。是部署到服务器上、有自己域名、
                任何人打开就能用的完整应用。你关掉电脑去睡觉，它还在那里。
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
                关掉再打开，它还记得你上次卡在哪里。
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
          从毛坯到交付。每一层依赖下一层——跳不过的。踩实了，再往上。
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
            <Link href="/learn/ts-basics">
              💙 开始学习
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
