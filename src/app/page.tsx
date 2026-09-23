import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadModules } from "@/lib/modules";
import { siteConfig } from "@/lib/site";

/**
 * 首页。
 *
 * 内容全部取自设计文档，不自行发挥：
 * - 「第一原则」的六个子能力 ← `00-MASTER.md`「第一原则」
 * - 教学流程 5 步 ← `00-MASTER.md`「教学流程」
 * - 模块清单与难度 ← 概念页 frontmatter（经 `loadModules()` 现读）
 *
 * 本页是**服务端组件**：它直接读 LLM Wiki，页面上列出的模块卡片与
 * `/learn` 页来自同一份数据源，不会出现「首页说 9 个模块、学习中心说 10 个」。
 */

/** `00-MASTER.md` 第一原则：AI 协作能力的六个子能力。 */
const ABILITIES = [
  { name: "意图表达", detail: "把想法变成清晰、无歧义的自然语言" },
  { name: "任务分解", detail: "把复杂目标拆成 AI 能逐步执行的子任务" },
  { name: "上下文管理", detail: "给 AI 提供恰当的背景信息，不多不少" },
  { name: "质量判断", detail: "判断 AI 输出是否可用、哪里有问题" },
  { name: "迭代调优", detail: "根据结果反馈调整指令，逐步逼近目标" },
  { name: "理解 AI 行为模式", detail: "知道 AI 的强项、弱项、幻觉、讨好倾向" },
] as const;

/** `00-MASTER.md` 教学流程。Step 3 在原文里含两个分支，此处压成一行展示。 */
const TEACHING_FLOW = [
  { step: "1", title: "导师展示预设代码", detail: "先看清「对的」长什么样" },
  {
    step: "2",
    title: "学生完成场景",
    detail: "自己写 Prompt、工具定义或核心逻辑",
  },
  {
    step: "3",
    title: "AI 校验并点评",
    detail: "不通过就给出反馈与扣分理由，学生修改",
  },
  {
    step: "4",
    title: "可视化展示 Agent Loop",
    detail: "看到刚才写的代码如何运转",
  },
  {
    step: "5",
    title: "出题 Agent 给变式练习",
    detail: "换一个条件再练一遍，循环",
  },
] as const;

export default async function HomePage() {
  const modules = await loadModules();
  const requiredMinutes = modules.reduce((total, teachingModule) => {
    const minutes = Number.parseInt(teachingModule.estimatedTime, 10);
    return total + (Number.isNaN(minutes) ? 0 : minutes);
  }, 0);

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-3xl text-center">
        <Badge variant="secondary" className="mb-4">
          <Sparkles className="size-3" />用 Agent 教 Agent
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/learn">
              开始学习
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#modules">查看课程大纲</Link>
          </Button>
        </div>

        <dl className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div>
            <dt className="sr-only">模块数</dt>
            <dd>
              <span className="block text-2xl font-semibold text-foreground">
                {modules.length}
              </span>
              教学模块
            </dd>
          </div>
          <div>
            <dt className="sr-only">总时长</dt>
            <dd>
              <span className="block text-2xl font-semibold text-foreground">
                {requiredMinutes}
              </span>
              分钟主线
            </dd>
          </div>
          <div>
            <dt className="sr-only">可视化场景</dt>
            <dd>
              <span className="block text-2xl font-semibold text-foreground">
                {
                  modules.filter(
                    (teachingModule) => teachingModule.sceneId !== null,
                  ).length
                }
              </span>
              可视化场景
            </dd>
          </div>
        </dl>
      </section>

      {/* ---------- 六个子能力 ---------- */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight">
          我们训练的是这六件事
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          所有功能都服务于这六个子能力 —— 不训练它们的功能，不做。
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ABILITIES.map((ability) => (
            <Card key={ability.name}>
              <CardHeader>
                <CardTitle>{ability.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {ability.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- 教学流程 ---------- */}
      <section className="mt-20">
        <div className="flex items-center gap-2">
          <Workflow className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold tracking-tight">
            一次学习的完整过程
          </h2>
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {TEACHING_FLOW.map((item) => (
            <li key={item.step}>
              <Card className="h-full">
                <CardHeader>
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {item.step}
                  </span>
                  <CardTitle className="mt-2 text-sm">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- 课程大纲 ---------- */}
      <section id="modules" className="mt-20 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold tracking-tight">课程大纲</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              按依赖关系顺序学习：每个模块的前置知识都已经排在它前面。
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/learn">
              进入学习中心
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {/* 写在最前面 */}
        <div className="mt-6 rounded-2xl border bg-muted/20 px-6 py-6 sm:px-8 sm:py-7">
          <Badge variant="outline" className="mb-3">
            写在最前面
          </Badge>
          <h3 className="text-lg font-semibold tracking-tight">
            你的最终目标：做一个带 Agent 的 AI 教学网页
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            这门课不是让你"学过一遍概念"。你要亲手复刻一个 AI
            教学平台——就是你正在用的这个。
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs sm:gap-3">
            {[
              { label: "你", icon: "👤" },
              { label: "教学网页", icon: "🌐" },
              { label: "AI Agent", icon: "🤖" },
              { label: "出题 · 对话 · 追踪", icon: "⚙️" },
            ].map((item, i, arr) => (
              <span key={item.label} className="flex items-center gap-1">
                <span className="rounded-md border bg-background px-2 py-1 font-medium">
                  {item.icon} {item.label}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-muted-foreground">→</span>
                )}
              </span>
            ))}
            <span className="mt-2 w-full text-center text-xs text-muted-foreground sm:mt-0 sm:w-auto">
              ── 你交付的，是一个<strong>能教别人学 AI 的 AI 教学平台</strong>
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "LLM API", detail: "让网页能调 AI——发请求、收回复" },
              { title: "Agent Loop", detail: "AI 推教学流程、切换步骤，不只是聊天" },
              { title: "出题 Agent", detail: "根据概念自动出题、批改、给反馈" },
              { title: "SSE 流式对话", detail: "逐字打字的效果——不是刷一下弹出来" },
              { title: "掌握度追踪", detail: "记录哪个概念会了、哪个还不行" },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border bg-background px-3 py-2">
                <span className="text-xs font-semibold">{item.title}</span>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
            用 AI 教 AI。用 Agent 教 Agent。
          </p>
          <div className="mt-3 text-center">
            <Link
              href="/learn/welcome"
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              进来坐
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((teachingModule) => (
            <li key={teachingModule.id}>
              <Link
                href={teachingModule.href}
                className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-ring/60"
              >
                <span className="w-5 shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums">
                  {teachingModule.orderLabel || teachingModule.order + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {teachingModule.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    难度 {teachingModule.difficulty} ·{" "}
                    {teachingModule.estimatedTime}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}