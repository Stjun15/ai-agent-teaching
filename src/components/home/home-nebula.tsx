/**
 * 首页的星云底：与登录页同构，只是铺成长卷。
 *
 * 为什么要统一到星云
 * ------------------
 * 登录页定的背景语言是「同心环 + 放射梁 + 螺旋臂」（见 `auth-backdrop.tsx`），
 * 它由产品的真实规则构成：24 圈 = 掌握度刻度，12 道梁 = 十二讲。
 * 首页此前的底是四片《星月夜》笔触 —— 好看，但和登录页是两个世界，
 * 从首页点「登录」像换了一个产品。
 *
 * 这一版把同一套几何搬到首页，并按长卷的需要重排：
 *
 * - 登录页只有一屏，星云是**一个**，居中偏右；
 * - 首页是一卷长图，星云得**分散成三处**，跟随滚动逐段出现，
 *   否则整页只有顶部有东西，往下又滑回白纸。
 *
 * 与登录页共享的是「画什么」，不共享「怎么排」。
 *
 * 可读性
 * ------
 * 首页沿用 `.paper-panel` 兜底（文字站在不透明纸面上），
 * 所以这里的浓度可以放开到登录页的水平，不需要 mask。
 * 这是两种场景的正确差别：登录页内容居中无法预知位置 → 用 mask；
 * 首页每个区块的版心是确定的 → 用纸面更省。
 */

/** 十二讲。与 `auth-backdrop.tsx` 同数，改一处要同时改两处。 */
const RAYS = 12;
/** 同心环数。 */
const RINGS = 24;

/** 一处星云的完整几何。`size` 是它在页面上的视觉直径（rem）。 */
function Nebula({
  className = "",
  opacity = 1,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`sky-turn pointer-events-none absolute ${className}`}
      style={{ opacity }}
    >
      <svg viewBox="-500 -500 1000 1000" fill="none" className="h-full w-full">
        <defs>
          <radialGradient
            id="home-ring-grad"
            cx="0"
            cy="0"
            r="500"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.1" stopColor="var(--warn)" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0.08" />
          </radialGradient>
          <radialGradient
            id="home-core"
            cx="0"
            cy="0"
            r="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--warn)" stopOpacity="0.26" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle r="220" fill="url(#home-core)" />

        {/* 24 圈：掌握度刻度。每 6 圈加粗，对应六项子能力。 */}
        {Array.from({ length: RINGS }, (_, i) => {
          const r = 46 + i * 18.5;
          const major = i % 6 === 5;
          return (
            <circle
              key={i}
              r={Number(r.toFixed(2))}
              stroke="url(#home-ring-grad)"
              strokeWidth={major ? 1.6 : 0.7}
              strokeOpacity={major ? 0.6 : 0.28}
            />
          );
        })}

        {/* 12 道放射梁：十二讲，长度递增 = 越外圈越「未解锁」。 */}
        {Array.from({ length: RAYS }, (_, i) => {
          const a = (i / RAYS) * Math.PI * 2;
          const inner = 60 + i * 6;
          const outer = 250 + i * 18;
          const f = (n: number) => Number(n.toFixed(2));
          return (
            <line
              key={i}
              x1={f(Math.cos(a) * inner)}
              y1={f(Math.sin(a) * inner)}
              x2={f(Math.cos(a) * outer)}
              y2={f(Math.sin(a) * outer)}
              stroke="var(--primary)"
              strokeOpacity={0.14 + i * 0.02}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          );
        })}

        {/* 两道对数螺线：给星云「在转」的方向感。 */}
        {[0, Math.PI].map((offset, arm) => (
          <g key={arm}>
            {Array.from({ length: 64 }, (_, k) => {
              const t = k / 64;
              const a = offset + t * Math.PI * 3.1;
              const rad = 40 + t * 470;
              const f = (n: number) => Number(n.toFixed(2));
              return (
                <circle
                  key={k}
                  cx={f(Math.cos(a) * rad)}
                  cy={f(Math.sin(a) * rad)}
                  r={Number((0.7 + t * 2.1).toFixed(2))}
                  fill="var(--primary)"
                  fillOpacity={Number((0.46 - t * 0.3).toFixed(2))}
                />
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * 整页星云底：三处星云沿长卷分布。
 *
 * 位置不是随手放的 —— 它跟着区块走：
 * - 第一处在首屏右侧（`top-[4rem]`），托住标题与终端卡；
 * - 第二处落在能力模型区（`top-[62rem]`），那一带文字最多，星云在后；
 * - 第三处压在下半卷（`top-[130rem]`），保证滚到最底仍有东西。
 *
 * 三处大小递减、浓度递减：越往下越安静，避免整页都在抢。
 */
export function HomeNebulaField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* 底色光斑：让整卷纸不是纯灰白 */}
      <div className="absolute inset-0 bg-[radial-gradient(46%_30%_at_84%_6%,var(--warn-soft)_0%,transparent_62%)] opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(52%_26%_at_6%_46%,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_64%)] opacity-90" />

      <Nebula
        className="-top-[14rem] -right-[26rem] h-[74rem] w-[74rem]"
        opacity={0.62}
      />
      <Nebula
        className="top-[58rem] -left-[30rem] h-[64rem] w-[64rem]"
        opacity={0.44}
      />
      <Nebula
        className="top-[126rem] -right-[30rem] h-[58rem] w-[58rem]"
        opacity={0.34}
      />
    </div>
  );
}
