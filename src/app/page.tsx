import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";

import { AgentLoop } from "@/components/home/agent-loop";
import {
  CypressBand,
  StripeField,
  StripeSprite,
} from "@/components/home/stripe-field";
import { Button } from "@/components/ui/button";
import { loadModules } from "@/lib/modules";

const ABILITIES = [
  {
    name: "意图表达",
    detail: "把想法变成清晰、无歧义的自然语言",
  },
  {
    name: "任务分解",
    detail: "把复杂目标拆成 AI 能逐步执行的子任务",
  },
  {
    name: "上下文管理",
    detail: "给 AI 提供恰当的背景信息，不多不少",
  },
  {
    name: "质量判断",
    detail: "判断 AI 输出是否可用、哪里有问题",
  },
  {
    name: "迭代调优",
    detail: "根据结果反馈调整指令，逐步逼近目标",
  },
  {
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

/**
 * 首页。
 *
 * 版式是「一张星图长卷」而不是落地页模板：没有 kicker 胶囊、
 * 没有横排三张数字卡、没有功能卡网格 —— 装饰是画出来的图形纹理
 * （波段 + 柏树 + 刻度盘），内容压在纹理上用分隔线而不是容器分块。
 *
 * 色板只在根节点挂局部变量：globals.css 是全站的，不往那里塞首页专用色。
 */
export default function HomePage() {
  return (
    <main
      className="relative w-full overflow-x-clip"
      style={
        {
          "--ink-soft": "oklch(0.33 0.03 264)",
          "--ink-mid": "oklch(0.45 0.1 258)",
          "--ink-deep": "oklch(0.28 0.09 266)",
          "--star": "oklch(0.7 0.11 92)",
          "--rule": "oklch(0.87 0.018 250)",
        } as React.CSSProperties
      }
    >
      <StripeSprite />
      <PageTexture />
      <Hero />
      <Abilities />
      <Flow />
      <Suspense fallback={<CurriculumSkeleton />}>
        <HomeCurriculum />
      </Suspense>
      <Closing />
      <HomeStyles />
    </main>
  );
}

/**
 * 整页纹理底：一组超大、极淡的波段铺在正文下面，贯穿首屏到页脚。
 *
 * 为什么要有这一层：区块内各挂一片波纹只能让局部有东西，
 * 中间几段之间仍是白纸 —— 观感会滑向「极简文档风」，那正是作者否过的方向。
 * 这一层横向连成一片，保证任何一屏都有图形纹理在，同时透明度压到 0.16 以下，
 * 不跟正文抢对比度。
 */
function PageTexture() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* 中段：一片横跨全宽的旋涡，压住能力区与流程区之间的空白 */}
      <div className="sky-drift-b absolute top-[34rem] -left-[30rem] w-[110rem] opacity-[0.2]">
        <StripeField depth={2.5} rotate={-7} />
      </div>
      {/* 柔光：不改变纹理分布，只把正文落点抬亮一档。
          纯白径向、透明度 0.62，肉眼只当作「纸被灯照到」，看不出有图层。 */}
      <div className="absolute inset-0 bg-[radial-gradient(62rem_38rem_at_26%_10%,oklch(0.995_0.002_85/0.9),transparent_74%),radial-gradient(56rem_34rem_at_22%_58%,oklch(0.995_0.002_85/0.86),transparent_72%),radial-gradient(54rem_32rem_at_24%_86%,oklch(0.995_0.002_85/0.8),transparent_72%)]" />
      {/* 下段：偏右倾的另一片，让视觉重心从中间平移到右下方 */}
      <div className="sky-drift-a absolute top-[92rem] -right-[34rem] w-[104rem] opacity-[0.18]">
        <StripeField depth={1.5} rotate={17} />
      </div>
      {/* 收尾段：压在深色带上，颜色由深色的 mix-blend 吸收，只留笔触 */}
      <div className="sky-drift-c absolute top-[150rem] -left-[26rem] w-[96rem] opacity-[0.16]">
        <StripeField depth={1.9} rotate={-21} />
      </div>
    </div>
  );
}

/**
 * 首屏：标题直接压在星空上，右侧挂一张「贴上去的纸条」（真实教学循环）。
 * 三个数字不是三张卡，是一行图例 —— 星图边上标计量单位的那种写法。
 */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* 主旋涡：圆心压在标题右上方，让它像从文字里升起来的 */}
      <div
        aria-hidden
        className="sky-drift-a pointer-events-none absolute -top-[30rem] -left-[16rem] w-[86rem] opacity-[0.62] sm:-top-[34rem]"
      >
        <StripeField depth={1.9} rotate={-9} />
      </div>
      <div
        aria-hidden
        className="sky-drift-b pointer-events-none absolute -top-[14rem] -right-[26rem] hidden w-[76rem] opacity-[0.48] lg:block"
      >
        <StripeField depth={1.1} rotate={13} />
      </div>
      <CypressBand className="sky-drift-c pointer-events-none absolute -top-[6rem] left-[62%] hidden h-[58rem] w-[14rem] opacity-60 md:block" />

      <div className="relative mx-auto grid w-full max-w-[1160px] gap-12 px-5 pt-20 pb-20 sm:px-8 sm:pt-28 sm:pb-28 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <div>
          <h1 className="max-w-[16em] text-[2.4rem] leading-[1.06] font-semibold tracking-[-0.025em] text-balance sm:text-[3.7rem]">
            用 AI 教学生
            <span className="relative ml-1 inline-block">
              <span className="bg-gradient-to-r from-[var(--ink-deep)] via-[var(--ink-mid)] to-[var(--ink-deep)] bg-clip-text text-transparent">
                理解 AI
              </span>
              {/* 手画的一道下划线：滚动到此处自己画出来 */}
              <svg
                aria-hidden
                viewBox="0 0 240 14"
                fill="none"
                className="absolute -bottom-2 left-0 h-3 w-full"
                preserveAspectRatio="none"
              >
                <path
                  className="sky-arc"
                  d="M3 10C46 3.5 92 4 138 7.5s74 5 99 1"
                  stroke="var(--star)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  pathLength="1"
                />
              </svg>
            </span>
          </h1>

          <p className="mt-9 max-w-[30em] text-[0.95rem] leading-8 text-pretty text-[var(--ink-soft)]">
            七步掌握式学习：从第一行 Prompt 走到完整 Agent
            系统。每一步都有真实点评与掌握度判定，没学会就不解锁下一讲。
          </p>

          <Suspense fallback={<FactsPlaceholder />}>
            <HomeFacts />
          </Suspense>

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button asChild size="sm">
              <Link href="/learn">
                开始学习
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Link
              href="#modules"
              className="group inline-flex items-center gap-2 text-xs font-medium text-[var(--ink-mid)]"
            >
              课程大纲
              <span
                aria-hidden
                className="h-px w-8 bg-[var(--ink-mid)] transition-all group-hover:w-12"
              />
            </Link>
          </div>
        </div>

        {/* 纸条：略歪、带一点投影，像贴在星图上的一角 */}
        <div className="relative lg:-mt-2">
          <div className="-rotate-[0.7deg] shadow-[0_18px_50px_-30px_oklch(0.3_0.08_266/0.6)]">
            <AgentLoop />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionMark({ index, label }: { index: string; label: string }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[10px] tracking-[0.28em] text-[var(--ink-mid)]">
      <span className="text-[var(--star)]">{index}</span>
      {label}
      <span aria-hidden className="h-px flex-1 bg-[var(--rule)]" />
    </p>
  );
}

/** 六个子能力：不分卡片，六条顶着分隔线的条目，靠留白分块。 */
function Abilities() {
  return (
    <section className="content-auto relative">
      <div
        aria-hidden
        className="sky-drift-b pointer-events-none absolute top-6 -right-[24rem] hidden w-[62rem] opacity-[0.42] lg:block"
      >
        <StripeField depth={2.5} rotate={-15} />
      </div>

      <div className="relative mx-auto w-full max-w-[1160px] px-5 sm:px-8">
        <SectionMark index="I" label="能力模型" />
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
          <h2 className="text-[1.65rem] leading-tight font-semibold tracking-tight sm:text-[2.1rem]">
            六个可迁移的子能力
          </h2>
          <p className="max-w-[26em] text-xs leading-6 text-[var(--ink-soft)] sm:text-right">
            所有功能都服务于这六个子能力 —— 不训练它们的功能，不做。
          </p>
        </div>

        <ul className="mt-12 border-t border-[var(--rule)]">
          {ABILITIES.map((ability, index) => (
            <li
              key={ability.name}
              className="sky-reveal grid grid-cols-[2.75rem_minmax(0,1fr)] items-baseline gap-x-5 gap-y-1.5 border-b border-[var(--rule)] py-5 sm:grid-cols-[3.25rem_11rem_minmax(0,1fr)] sm:py-4"
            >
              <span className="font-mono text-[11px] text-[var(--star)] tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold">{ability.name}</span>
              <span className="col-start-2 text-xs leading-6 text-[var(--ink-soft)] sm:col-start-3">
                {ability.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * 七步：右边一只刻度盘（七格 + 一圈极慢自转的细分度），左边是七行文字。
 * 刻度盘是「同一台仪器的表盘」，七行文字是它的读数 —— 不是七张并列的卡。
 */
function Flow() {
  return (
    <section className="content-auto mt-24 sm:mt-32">
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-8">
        <SectionMark index="II" label="学习流程" />
        <h2 className="mt-5 text-[1.65rem] leading-tight font-semibold tracking-tight sm:text-[2.1rem]">
          一次学习的完整过程
        </h2>
        <p className="mt-3 max-w-[30em] text-xs leading-6 text-[var(--ink-soft)]">
          七步一条流水线，前一步的产出就是后一步的输入。
        </p>

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <ol className="grid gap-x-10 gap-y-0 sm:grid-cols-2 lg:grid-cols-1">
            {TEACHING_FLOW.map((item) => (
              <li
                key={item.step}
                className="sky-reveal group flex gap-4 border-t border-[var(--rule)] py-4 last:border-b lg:border-t-0 lg:border-b lg:py-3.5 lg:last:border-b"
              >
                <span className="w-6 shrink-0 pt-0.5 font-mono text-[11px] text-[var(--star)] tabular-nums">
                  {item.step.padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <StepDial className="mx-auto hidden w-full max-w-[22rem] lg:block" />
        </div>
      </div>
    </section>
  );
}

const DIAL = buildDial();

/** 刻度盘几何全部在这里算一次：纯函数，SSR 与客户端结果一致。 */
function buildDial() {
  const center = 160;
  const sweep = 280;
  const start = 140;

  const nodes = Array.from({ length: 7 }, (_, index) => {
    const deg = start + (index / 6) * sweep;
    const rad = (deg * Math.PI) / 180;
    const at = (r: number) => ({
      x: Number((center + Math.cos(rad) * r).toFixed(1)),
      y: Number((center + Math.sin(rad) * r).toFixed(1)),
    });
    return { ...at(118), label: at(145) };
  });

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];

  // 280° 的弧只能靠 large-arc 拼出来：起止点固定，半径固定
  const arc = `M${first.x} ${first.y}A118 118 0 1 1 ${last.x} ${last.y}`;

  // 外圈 28 段细分度，极慢自转 —— 只是让「仪器在走」，不参与读数
  const ticks = Array.from({ length: 28 }, (_, index) => {
    const rad = toRad((index / 28) * 360);
    return {
      x1: Number((center + Math.cos(rad) * 138).toFixed(1)),
      y1: Number((center + Math.sin(rad) * 138).toFixed(1)),
      x2: Number((center + Math.cos(rad) * 146).toFixed(1)),
      y2: Number((center + Math.sin(rad) * 146).toFixed(1)),
    };
  });

  return { arc, nodes, ticks };
}

function StepDial({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <svg viewBox="0 0 320 320" fill="none" className="w-full">
        <g className="sky-spin origin-center">
          {DIAL.ticks.map((tick) => (
            <line
              key={`${tick.x1}-${tick.y1}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="var(--rule)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
        </g>

        <circle
          cx="160"
          cy="160"
          r="86"
          stroke="var(--rule)"
          strokeWidth="1"
          strokeDasharray="2 7"
        />

        <path
          className="sky-arc"
          d={DIAL.arc}
          stroke="var(--ink-mid)"
          strokeWidth="1.6"
          strokeLinecap="round"
          pathLength="1"
          opacity="0.7"
        />

        {DIAL.nodes.map((node, index) => (
          <g key={`${node.x}-${node.y}`}>
            <circle
              cx={node.x}
              cy={node.y}
              r={index === 6 ? 4.6 : 3}
              fill={index === 6 ? "var(--star)" : "var(--ink-mid)"}
            />
            <text
              x={node.label.x}
              y={node.label.y}
              textAnchor="middle"
              className="fill-[var(--ink-soft)] font-mono text-[10px] tabular-nums"
            >
              {String(index + 1).padStart(2, "0")}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** 三个数字：一行图例，不是三张卡。 */
async function HomeFacts() {
  const modules = await loadModules();
  const sceneCount = modules.filter(
    (teachingModule) => teachingModule.sceneId !== null,
  ).length;

  const facts = [
    { label: "个教学模块", value: modules.length },
    { label: "个可视化场景", value: sceneCount },
    { label: "步掌握式学习", value: 7 },
  ];

  return (
    <dl className="mt-9 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-[var(--rule)] pt-5">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline gap-2">
          <dd className="font-mono text-[1.6rem] leading-none text-[var(--ink-deep)] tabular-nums">
            {fact.value}
          </dd>
          <dt className="text-[11px] text-[var(--ink-soft)]">{fact.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function FactsPlaceholder() {
  return (
    <div className="mt-9 flex gap-8 border-t border-[var(--rule)] pt-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-7 w-24 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function CurriculumSkeleton() {
  return (
    <section className="mt-24 sm:mt-32">
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-8">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/70" />
        <div className="mt-6 h-10 w-72 animate-pulse rounded bg-muted/60" />
        <div className="mt-10 flex flex-col gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </div>
    </section>
  );
}

/** 十三讲：通栏长表，行与行之间只有一条细线，没有外层容器。 */
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
    <section id="modules" className="content-auto mt-24 scroll-mt-24 sm:mt-32">
      <div className="relative mx-auto w-full max-w-[1160px] px-5 sm:px-8">
        <div
          aria-hidden
          className="sky-drift-a pointer-events-none absolute -top-16 -right-[26rem] hidden w-[64rem] opacity-[0.38] lg:block"
        >
          <StripeField depth={1.5} rotate={22} />
        </div>

        <div className="relative">
          <SectionMark index="III" label="课程大纲" />
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
            <h2 className="text-[1.65rem] leading-tight font-semibold tracking-tight sm:text-[2.1rem]">
              十三讲，按依赖顺序排好
            </h2>
            <p className="max-w-[26em] text-xs leading-6 text-[var(--ink-soft)] sm:text-right">
              每个模块的前置知识都已经排在它前面，从第一行 Prompt 一路走到完整
              Agent 系统。
            </p>
          </div>

          <ul className="mt-10 border-t border-[var(--rule)]">
            {rows.map((row) => (
              <li
                key={row.id}
                className="sky-reveal border-b border-[var(--rule)]"
              >
                <Link
                  href={row.href}
                  className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 py-3.5 text-sm transition-colors hover:bg-[oklch(0.98_0.01_250/0.7)]"
                >
                  <span className="font-mono text-[11px] text-[var(--ink-mid)] tabular-nums transition-colors group-hover:text-[var(--star)]">
                    {row.orderLabel}
                  </span>
                  <span className="min-w-0 truncate font-medium">
                    {row.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span
                      aria-label={`难度 ${row.difficulty} / 5`}
                      className="hidden items-center gap-1 sm:flex"
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-2.5 w-1 ${
                            i < row.difficulty
                              ? "bg-[var(--ink-mid)]"
                              : "bg-[var(--rule)]"
                          }`}
                        />
                      ))}
                    </span>
                    <ArrowRight className="size-3.5 text-[var(--ink-mid)]/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--star)]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex justify-end">
            <Link
              href="/learn"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-mid)] hover:underline hover:underline-offset-4"
            >
              进入学习中心
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 收尾。
 *
 * 上一版这里是一整块深色横幅 —— 从浅色纸面「啪」地切进深蓝，太突兀，
 * 而且在整页低饱和的语境里像另开了个页面。改法：
 * 不做整块底色，只让这一段的笔触场自己慢慢加密、慢慢变深 ——
 * 像夜里走得越远天色越浓，而不是有人关了一次灯。
 *
 * 文字保持深墨色，压在浅底上；重心靠右侧一小块深色标尺收住。
 */
function Closing() {
  return (
    <section className="relative mt-20 overflow-hidden sm:mt-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* 顶部透明、向下渐浓：没有边界线，只有浓度的变化 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.72_0.05_260/0.04)_0%,oklch(0.64_0.07_262/0.16)_18%,oklch(0.56_0.08_263/0.34)_55%,oklch(0.44_0.09_266/0.5))]" />
        <div className="sky-drift-c absolute top-1/2 left-1/2 w-[108rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.62]">
          <StripeField depth={2.1} rotate={-5} />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1160px] px-5 py-20 sm:px-8 sm:py-28">
        <div>
          <p className="flex items-center gap-3 font-mono text-[10px] tracking-[0.28em] text-[var(--ink-mid)]">
            <span className="text-[var(--star)]">IV</span>
            掌握式学习
          </p>
          <h2 className="mt-5 max-w-[17em] text-[1.7rem] leading-tight font-semibold tracking-tight text-balance text-[var(--ink-deep)] sm:text-[2.2rem]">
            每一讲都走完这七步，掌握度够格才继续往下走。
          </h2>
          <Link
            href="/learn"
            className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-mid)]"
          >
            进入学习中心
            <span
              aria-hidden
              className="h-px w-9 bg-[var(--ink-mid)] transition-all group-hover:w-14"
            />
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * 动效全部在这里：极慢漂移、滚动浮现、弧线自绘、刻度盘自转。
 * 每一条都包在 `prefers-reduced-motion: no-preference` 里 ——
 * 系统开了「减少动态效果」时整页是静止的，只剩形状。
 */
function HomeStyles() {
  return (
    <style>{`
.sky-drift-a { animation: sky-drift 92s ease-in-out infinite; }
.sky-drift-b { animation: sky-drift 134s ease-in-out infinite reverse; }
.sky-drift-c { animation: sky-drift 116s ease-in-out infinite; }
@keyframes sky-drift {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  33% { transform: translate3d(-18px, 13px, 0) rotate(1.1deg); }
  66% { transform: translate3d(14px, -9px, 0) rotate(-0.8deg); }
}
.sky-spin { animation: sky-spin 240s linear infinite; }
@keyframes sky-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .sky-reveal {
      animation: sky-reveal linear both;
      animation-timeline: view();
      animation-range: entry 10% entry 92%;
    }
    .sky-arc {
      animation: sky-arc linear both;
      animation-timeline: view();
      animation-range: entry 20% entry 96%;
    }
  }
}
@keyframes sky-reveal {
  from { opacity: 0; transform: translate3d(0, 16px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes sky-arc {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
.sky-arc { stroke-dasharray: 1; stroke-dashoffset: 0; }
`}</style>
  );
}
