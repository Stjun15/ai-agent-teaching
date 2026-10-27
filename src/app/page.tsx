import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Gauge,
  Layers,
  ListTree,
  MessageSquareQuote,
  RefreshCw,
  ScanEye,
} from "lucide-react";

import {
  AnimatedGrid,
  AnimatedSection,
} from "@/components/layout/animated-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadModules } from "@/lib/modules";
import { siteConfig } from "@/lib/site";

const ABILITIES = [
  {
    icon: MessageSquareQuote,
    name: "意图表达",
    detail: "把想法变成清晰、无歧义的自然语言",
  },
  {
    icon: ListTree,
    name: "任务分解",
    detail: "把复杂目标拆成 AI 能逐步执行的子任务",
  },
  {
    icon: Layers,
    name: "上下文管理",
    detail: "给 AI 提供恰当的背景信息，不多不少",
  },
  {
    icon: ScanEye,
    name: "质量判断",
    detail: "判断 AI 输出是否可用、哪里有问题",
  },
  {
    icon: RefreshCw,
    name: "迭代调优",
    detail: "根据结果反馈调整指令，逐步逼近目标",
  },
  {
    icon: Gauge,
    name: "理解 AI 行为模式",
    detail: "知道 AI 的强项、弱项、幻觉、讨好倾向",
  },
] as const;

// 七步口径与学习中心 / 模块页侧栏一致（lib/learning-steps.ts 的中文文案）。
const TEACHING_FLOW = [
  { step: "1", title: "概念讲解", detail: "导师讲清核心概念，先建立心智模型" },
  {
    step: "2",
    title: "观察示范",
    detail: "看导师展示的示范代码，看清「对的」长什么样",
  },
  {
    step: "3",
    title: "动手模仿",
    detail: "自己写 Prompt、工具定义或核心逻辑，AI 不代写",
  },
  {
    step: "4",
    title: "校验点评",
    detail: "点评 Agent 按评分标准给分项得分与扣分理由",
  },
  {
    step: "5",
    title: "可视化",
    detail: "把刚写的代码放进场景，看它逐步运转",
  },
  {
    step: "6",
    title: "变式练习",
    detail: "出题 Agent 换一个条件再问一次，真实判分",
  },
  {
    step: "7",
    title: "掌握判定",
    detail: "掌握度达标才解锁下一讲——掌握式学习的关卡",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1">
      {/* Hero —— 纯静态内容，0ms 首帧 */}
      <section className="relative overflow-hidden px-4 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-24">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="bg-grid-fade absolute inset-0" />
          <div className="animate-hero-drift absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-1/4 -bottom-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium tracking-[0.3em] text-primary/80 uppercase">
            Agent as Teacher
          </p>
          <h1 className="mt-4 text-4xl leading-[1.15] font-bold tracking-tighter text-balance sm:text-5xl lg:text-6xl">
            {siteConfig.name}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
            12 个教学模块，七步掌握式学习，用 AI 教学生理解 AI —— 从第一行
            Prompt 到完整 Agent 系统。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="group shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              <Link href="/learn">
                开始学习
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-background/60 backdrop-blur"
            >
              <Link href="#modules">查看课程大纲</Link>
            </Button>
          </div>

          {/* 统计数据 —— 异步加载，先占位 */}
          <Suspense fallback={<StatsPlaceholder />}>
            <HomeStats />
          </Suspense>
        </div>
      </section>

      {/* 六个子能力 + 教学流程（纯静态数据，不依赖 loadModules） */}
      <AnimatedSection className="px-4 sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-medium tracking-[0.3em] text-primary/80 uppercase">
            Abilities
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            我们训练的是这六件事
          </h2>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            所有功能都服务于这六个子能力 —— 不训练它们的功能，不做。
          </p>
          <AnimatedGrid className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ABILITIES.map((ability, index) => {
              const Icon = ability.icon;
              return (
                <Card
                  key={ability.name}
                  className="group relative transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <span
                    aria-hidden
                    className="absolute top-4 right-4 font-mono text-[10px] tracking-widest text-muted-foreground/40"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <CardHeader>
                    <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-4.5" />
                    </span>
                    <CardTitle className="transition-colors group-hover:text-primary">
                      {ability.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {ability.detail}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </AnimatedGrid>
        </div>
      </AnimatedSection>

      {/* 教学流程 */}
      <AnimatedSection className="mt-20 px-4 sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-medium tracking-[0.3em] text-primary/80 uppercase">
            Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            一次学习的完整过程
          </h2>
          <div className="relative mt-8">
            <div
              aria-hidden
              className="absolute top-8 right-0 left-0 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent xl:block"
            />
            <AnimatedGrid className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {TEACHING_FLOW.map((item) => (
                <div
                  key={item.step}
                  className="relative h-full rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-4 ring-background">
                    {item.step}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              ))}
            </AnimatedGrid>
          </div>
        </div>
      </AnimatedSection>

      {/* 课程大纲 —— 异步加载模块列表，先显示骨架 */}
      <Suspense fallback={<CurriculumSkeleton />}>
        <HomeCurriculum />
      </Suspense>
    </main>
  );
}

function StatsPlaceholder() {
  return (
    <dl className="mx-auto mt-14 grid max-w-xl grid-cols-3 divide-x divide-border">
      {[48, 36, 24].map((w) => (
        <div key={w} className="px-2">
          <div
            className="mx-auto h-8 animate-pulse rounded bg-muted"
            style={{ width: w }}
          />
          <div
            className="mx-auto mt-1.5 h-3 animate-pulse rounded bg-muted"
            style={{ width: 40 }}
          />
        </div>
      ))}
    </dl>
  );
}

async function HomeStats() {
  const modules = await loadModules();
  const requiredMinutes = modules.reduce((total, teachingModule) => {
    const minutes = Number.parseInt(teachingModule.estimatedTime, 10);
    return total + (Number.isNaN(minutes) ? 0 : minutes);
  }, 0);
  const sceneCount = modules.filter(
    (teachingModule) => teachingModule.sceneId !== null,
  ).length;

  return (
    <dl className="mx-auto mt-14 grid max-w-xl grid-cols-3 divide-x divide-border">
      <div className="px-2">
        <dt className="sr-only">模块数</dt>
        <dd>
          <span className="block text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
            {modules.length}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            教学模块
          </span>
        </dd>
      </div>
      <div className="px-2">
        <dt className="sr-only">总时长</dt>
        <dd>
          <span className="block text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
            {requiredMinutes}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            分钟主线
          </span>
        </dd>
      </div>
      <div className="px-2">
        <dt className="sr-only">可视化场景</dt>
        <dd>
          <span className="block text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
            {sceneCount}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            可视化场景
          </span>
        </dd>
      </div>
    </dl>
  );
}

function CurriculumSkeleton() {
  return (
    <section className="mt-20 px-4 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mb-2 h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mb-6 h-4 w-80 animate-pulse rounded bg-muted" />
        <div className="mt-8 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </section>
  );
}

async function HomeCurriculum() {
  const modules = await loadModules();
  const rows = [
    {
      id: "welcome",
      href: "/learn/welcome",
      orderLabel: "0",
      name: "写在最前面",
      difficulty: 1,
      estimatedTime: "10min",
    },
    ...modules,
  ];

  return (
    <AnimatedSection id="modules" className="mt-20 scroll-mt-20 px-4 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.3em] text-primary/80 uppercase">
              Curriculum
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              课程大纲
            </h2>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
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

        <ul className="mt-8 space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm transition-all duration-300 hover:translate-x-1 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
              >
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {row.orderLabel}
                </span>
                <span className="font-medium">{row.name}</span>
                <span
                  aria-label={`难度 ${row.difficulty} / 5`}
                  className="hidden items-center gap-1 sm:flex"
                >
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, dot) => (
                      <span
                        key={dot}
                        className={
                          dot < row.difficulty
                            ? "size-1.5 rounded-full bg-primary"
                            : "size-1.5 rounded-full bg-border"
                        }
                      />
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {row.difficulty}/5
                  </span>
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {row.estimatedTime}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AnimatedSection>
  );
}
