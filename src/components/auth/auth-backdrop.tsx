/**
 * 登录页背景：一张「学习仪器」，不是一张装饰画。
 *
 * 为什么不用星空/笔触：那是首页的语言（长卷、氛围），挪到登录页
 * 只是把同一块布换个地方铺。登录页该回答另一个问题 ——
 * **这个产品凭什么值得我注册**。答案不在氛围里，在规则里：
 * 十二讲、一级一级往上、掌握到 3/5 才解锁下一讲。
 *
 * 所以背景画的是三件测量用具：
 *
 * 1. **方格纸** —— 它不是「纹理」，是这个产品的工作台面。
 *    掌握度、分数、进度，全都在这张格子上被量出来。
 * 2. **十二级阶梯** —— 十二讲沿对角线升起，每一级就是一讲。
 *    它是内容本身的形状，不是编出来的装饰。
 * 3. **掌握线** —— 一条横切虚线，标在 3/5 的高度上。
 *    线下是「还没过」，线上才解锁。这是产品唯一的硬规则，
 *    值得直接画在门面上。
 *
 * 左下角另有四分之一圈刻度盘，是掌握度的量具。
 *
 * 全部 `aria-hidden` + `pointer-events-none`，且刻意压到极淡：
 * 它是版面的底纹，不是主角。文字区由 `.auth-paper` 兜一层纸。
 */

/** 十二讲，与课程大纲同数。 */
const STEPS = 12;
/** 掌握线高度：`MASTERY_PASS_SCORE` 是 3/5。 */
const PASS_RATIO = 3 / 5;

const STEP_W = 88;
const STEP_RISE = 34;
const BASE_Y = 560;

/** 阶梯折线：踏面 + 踢面交替，第 i 级的上表面 y = BASE_Y - (i+1)*RISE。 */
function stepPath(): string {
  const pts: string[] = [`M 0 ${BASE_Y}`];
  for (let i = 0; i < STEPS; i++) {
    const y = BASE_Y - (i + 1) * STEP_RISE;
    pts.push(`H ${(i + 1) * STEP_W}`);
    pts.push(`V ${y}`);
  }
  return pts.join(" ");
}

const STAIR = stepPath();
const PASS_Y = BASE_Y - STEPS * STEP_RISE * PASS_RATIO;

/**
 * 刻度盘的 24 根 tick，**在模块顶层算好并取整到 2 位小数**。
 *
 * 不能放在 JSX 里现算 `Math.cos(a) * 168`：Node 与浏览器的浮点
 * 序列化在末位可能不同（`-1.0296148594093497e-14` vs `-1.03e-14`），
 * React 水合时逐字符比对属性，末位不同就报 hydration mismatch。
 * 实测这确实发生了一次（加上背景后 auth 页开始报 mismatch）。
 * 顶层算好 + 固定小数位，两侧拿到的是同一个字符串。
 */
const TICKS = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
  const major = i % 6 === 0;
  const inner = major ? 150 : 160;
  const f = (n: number) => Number(n.toFixed(2));
  return {
    major,
    x1: f(Math.cos(a) * inner),
    y1: f(Math.sin(a) * inner),
    x2: f(Math.cos(a) * 168),
    y2: f(Math.sin(a) * 168),
  };
});

export function AuthBackdrop() {
  return (
    <>
      {/* 第一层：纸面之下的底纹（方格纸）—— 它需要在最底下 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <AuthBackdropStyles />
        <div className="auth-grid absolute inset-0" />

        {/* 掌握度刻度盘：左下角露出四分之一圈，圆心在视口外。
            24 根 tick 用 JS 生成 —— 手写会数错。 */}
        <svg
          className="absolute -bottom-[18rem] -left-[16rem] hidden h-[46rem] w-[46rem] lg:block"
          viewBox="-200 -200 400 400"
          fill="none"
        >
          <circle
            r="168"
            stroke="var(--primary)"
            strokeOpacity="0.11"
            strokeWidth="1"
          />
          <circle
            r="196"
            stroke="var(--primary)"
            strokeOpacity="0.06"
            strokeWidth="1"
            strokeDasharray="1 13"
          />
          {TICKS.map((tick, i) => (
            <line
              key={i}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="var(--primary)"
              strokeOpacity={tick.major ? "0.28" : "0.14"}
              strokeWidth="1.5"
            />
          ))}
          {/* 0–100 的弧：只画三成，暗示「还没学完」 */}
          <path
            d="M 168 0 A 168 168 0 0 1 84 145"
            stroke="var(--primary)"
            strokeOpacity="0.4"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        {/* 超大衬线水印：一个「掌」字压在右下角格线上，
            字号大到只剩字形轮廓，是这一页唯一的大字。 */}
        <span className="absolute -right-6 bottom-[6%] hidden font-serif text-[16rem] leading-none font-semibold text-primary/[0.05] select-none lg:block">
          掌
        </span>
      </div>

      {/* 第二层：纸面之上、文字之下 —— 阶梯与掌握线。
          它必须夹在纸和内容中间：放在纸下会被纸整片盖掉（实测重叠 503px），
          放在文字上会压字。夹在中间，它才既是背景又能读出来。 */}
      <svg
        aria-hidden
        className="auth-scan pointer-events-none absolute right-0 bottom-0 -z-[5] hidden h-[58%] w-[70%] lg:block"
        viewBox="0 0 1240 600"
        fill="none"
        preserveAspectRatio="xMaxYMax meet"
      >
        <path
          d={STAIR}
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeOpacity="0.42"
          strokeLinejoin="round"
        />
        {/* 每级踏面的延长虚线，让「每一级就是一讲」读得出来 */}
        {Array.from({ length: STEPS }, (_, i) => {
          const y = BASE_Y - (i + 1) * STEP_RISE;
          return (
            <line
              key={i}
              x1={(i + 1) * STEP_W}
              y1={y}
              x2={1240}
              y2={y}
              stroke="var(--primary)"
              strokeOpacity="0.13"
              strokeWidth="1"
              strokeDasharray="2 10"
            />
          );
        })}
        {/* 掌握线：横切全宽，标在 3/5 的高度 */}
        <line
          x1="0"
          y1={PASS_Y}
          x2="1240"
          y2={PASS_Y}
          stroke="var(--warn)"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="10 8"
        />
        <rect
          x="4"
          y={PASS_Y - 4}
          width="8"
          height="8"
          fill="var(--warn)"
          fillOpacity="0.7"
        />
      </svg>
    </>
  );
}

/**
 * 底纹与动效。
 *
 * 动效只有一处：阶梯那条线沿 x 轴极慢地扫一遍（`auth-scan`），
 * 像仪表自检。50 秒一轮、幅度 3%，不盯着看不出 —— 登录页不该把
 * 注意力从表单上拽走。
 *
 * 包在 `prefers-reduced-motion: no-preference` 里，
 * 系统开了「减少动态效果」时整页静止。
 */
function AuthBackdropStyles() {
  return (
    <style>{`
.auth-grid {
  background-image:
    linear-gradient(to right, var(--rule) 1px, transparent 1px),
    linear-gradient(to bottom, var(--rule) 1px, transparent 1px);
  background-size: 68px 68px;
  /* 四周淡出：格线若在视口边缘被硬切，会像一张没画完的表格 */
  mask-image: radial-gradient(130% 100% at 62% 38%, #000 12%, transparent 72%);
  -webkit-mask-image: radial-gradient(130% 100% at 62% 38%, #000 12%, transparent 72%);
  opacity: 0.8;
}

@keyframes auth-scan {
  0%, 100% { transform: translate3d(0, 0, 0); opacity: 1; }
  50%      { transform: translate3d(-3%, 0, 0); opacity: 0.82; }
}

@media (prefers-reduced-motion: no-preference) {
  .auth-scan { animation: auth-scan 50s ease-in-out infinite; }
}

/* 纸面兜底：文字与表单站在不透明底上，背景才敢有东西。
   实底必须覆盖到表单右边界 —— 收到 86% 时实测有 17 处文字越出实底
   （含表单说明与输入框），那是可读性回归，不能拿背景好看去换。
   两端各留 2.2% 渐隐，避免在容器边界剪出直边。 */
.auth-paper {
  background-image: linear-gradient(
    to right,
    transparent 0%,
    var(--background) 2.2%,
    var(--background) 97.8%,
    transparent 100%
  );
}@media (max-width: 1023px) {
  /* 窄屏是单列满宽，没有可渐隐的侧边留白，直接给实底 */
  .auth-paper {
    background-image: none;
    background-color: var(--background);
  }
}
`}</style>
  );
}
