import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Brain,
  CheckCheck,
  GitBranch,
  Layers,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

import { AgentLoop } from "@/components/home/agent-loop";
import { Button } from "@/components/ui/button";
import { GridField } from "@/components/ui/grid-field";
import { Magnetic } from "@/components/ui/magnetic";
import { PointerField } from "@/components/ui/pointer-field";
import { WireGlyph } from "@/components/ui/wire-glyph";
import { WireNet } from "@/components/ui/wire-net";
import { loadModules } from "@/lib/modules";
import { siteConfig } from "@/lib/site";

const ABILITIES = [
  {
    icon: MessageSquare,
    name: "意图表达",
    detail: "把想法变成清晰、无歧义的自然语言",
  },
  {
    icon: GitBranch,
    name: "任务分解",
    detail: "把复杂目标拆成 AI 能逐步执行的子任务",
  },
  {
    icon: Layers,
    name: "上下文管理",
    detail: "给 AI 提供恰当的背景信息，不多不少",
  },
  {
    icon: CheckCheck,
    name: "质量判断",
    detail: "判断 AI 输出是否可用、哪里有问题",
  },
  {
    icon: RefreshCw,
    name: "迭代调优",
    detail: "根据结果反馈调整指令，逐步逼近目标",
  },
  {
    icon: Brain,
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
    <main className="mx-auto w-full max-w-[1160px] flex-1 px-5 pb-20 sm:px-8">
      {/* 封面：左边说话、右边跑一遍。右侧面板不是装饰图，是一次真实教学循环
          按顺序吐出来的四步，让首屏在不用截图的前提下说明「这里在跑什么」。
          整块罩了一层指针场：鼠标划过时出现十字准星与坐标读数（触摸设备没有）。 */}
      <PointerField
        backdrop={<GridField />}
        className="grid items-start gap-12 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:pt-24"
      >
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {siteConfig.name}
          </span>

          <h1 className="mt-6 max-w-[15em] text-[2.1rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-[3.1rem] sm:leading-[1.08]">
            用 AI 教学生
            <span className="text-primary">理解 AI</span>
          </h1>

          <p className="mt-6 max-w-[34em] text-sm leading-7 text-pretty text-muted-foreground sm:text-[0.95rem]">
            12 个教学模块，七步掌握式学习：从第一行 Prompt 到完整 Agent
            系统。每一步都有真实点评与掌握度判定，没学会就不解锁下一讲。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Button asChild size="sm">
                <Link href="/learn">
                  开始学习
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </Magnetic>
            <Button asChild size="sm" variant="outline">
              <Link href="#modules">课程大纲</Link>
            </Button>
          </div>

          <Suspense fallback={<StatsPlaceholder />}>
            <HomeStats />
          </Suspense>
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <AgentLoop />
          {/* 面板下方的空白正好放一块不规则线框，右对齐收住这一列的视觉重量 */}
          <WireGlyph className="mr-2 size-24 self-end" />
        </div>
      </PointerField>

      <Section
        label="能力模型"
        title="六个可迁移的子能力"
        description="所有功能都服务于这六个子能力 —— 不训练它们的功能，不做。"
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ABILITIES.map((ability) => {
            const Icon = ability.icon;
            return (
              <li
                key={ability.name}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <p className="mt-4 text-sm font-semibold transition-colors group-hover:text-primary">
                  {ability.name}
                </p>
                <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                  {ability.detail}
                </p>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 七步是一条真正有先后顺序的流水线：卡片之间用 1px 缝隙当分隔线，
          它们属于同一张图，不是七个互不相干的格子。 */}
      <Section
        label="学习流程"
        title="一次学习的完整过程"
        description="七步一条流水线，前一步的产出就是后一步的输入。"
      >
        <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {TEACHING_FLOW.map((item, index) => (
            <li
              key={item.step}
              className={`group bg-card p-5 transition-colors hover:bg-accent/40 ${
                index === TEACHING_FLOW.length - 1
                  ? "sm:col-span-2 lg:col-span-3"
                  : ""
              }`}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xl leading-none text-primary/35 tabular-nums transition-colors group-hover:text-primary/70">
                  {item.step.padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold">{item.title}</span>
              </div>
              <p className="mt-2.5 text-xs leading-6 text-muted-foreground">
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Suspense fallback={<CurriculumSkeleton />}>
        <HomeCurriculum />
      </Suspense>

      {/* 收尾用同一套反色语言回扣首屏那块面板：一页里只有两处深色，
          正好卡在开头和结尾，中间全是正文。
          背景那层不规则网络跟随鼠标做轻微视差，给深色块一点活的边角。 */}
      <section className="relative mt-16 overflow-hidden rounded-2xl bg-foreground px-7 py-10 text-background sm:mt-20 sm:px-12 sm:py-14">
        <WireNet className="absolute inset-0 h-full w-full" />
        <div className="relative z-10 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-background/50">
              掌握式学习
            </p>
            <h2 className="mt-3 max-w-[18em] text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
              每一讲都走完这七步，掌握度够格才继续往下走。
            </h2>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/learn">
              进入学习中心
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

/**
 * 分节标题：一行等宽小标 + 一个真正的大标题，右侧放这一节的说明。
 * 分节之间只隔一条细线，不叠更多容器。
 */
function SectionHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-primary">
          {label}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-[1.6rem]">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="max-w-[30em] text-xs leading-6 text-muted-foreground sm:text-right">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 sm:mt-20">
      <SectionHeader label={label} title={title} description={description} />
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatsPlaceholder() {
  return (
    <div className="mt-10 grid max-w-[30rem] grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col-reverse gap-2 rounded-lg border border-border bg-card/70 px-4 py-3.5"
        >
          <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          <div className="h-6 w-10 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

async function HomeStats() {
  const modules = await loadModules();
  const sceneCount = modules.filter(
    (teachingModule) => teachingModule.sceneId !== null,
  ).length;

  // 三个数字各占一张小卡；DOM 顺序仍是 dt → dd
  // （flex-col-reverse 只改视觉呈现，不改读屏顺序）。
  const stats = [
    { label: "教学模块", value: modules.length },
    { label: "可视化场景", value: sceneCount },
    { label: "学习步骤", value: 7 },
  ];

  return (
    <dl className="mt-10 grid max-w-[30rem] grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col-reverse gap-2 rounded-lg border border-border bg-card/70 px-4 py-3.5"
        >
          <dt className="text-[11px] text-muted-foreground">{stat.label}</dt>
          <dd className="font-mono text-2xl leading-none tabular-nums">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CurriculumSkeleton() {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="h-14 animate-pulse rounded bg-muted/60" />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded bg-muted/60" />
        ))}
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
    },
    ...modules,
  ];

  return (
    <section id="modules" className="mt-16 scroll-mt-24 sm:mt-20">
      <SectionHeader
        label="课程大纲"
        title="十三讲，按依赖顺序排好"
        description="每个模块的前置知识都已经排在它前面，从第一行 Prompt 一路走到完整 Agent 系统。"
      />

      <ul className="mt-6 overflow-hidden rounded-xl border border-border bg-card/60">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="group flex items-center gap-3 border-t border-border/40 px-4 py-3 text-sm transition-colors first:border-t-0 hover:bg-muted/60"
            >
              <span className="w-6 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums transition-colors group-hover:text-primary">
                {row.orderLabel}
              </span>
              <span className="min-w-0 truncate font-medium">{row.name}</span>
              <span
                aria-label={`难度 ${row.difficulty} / 5`}
                className="ml-auto hidden shrink-0 items-center gap-1 sm:flex"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-1 ${
                      i < row.difficulty ? "bg-primary" : "bg-border"
                    }`}
                  />
                ))}
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline hover:underline-offset-4"
        >
          进入学习中心
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
