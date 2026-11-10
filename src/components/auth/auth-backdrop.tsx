/**
 * 登录页背景：一片会呼吸的「掌握星云」。
 *
 * 结构上的关键决定
 * ----------------
 * 前几版都在用「不透明纸面盖住背景」保可读性，结果是背景只能从纸边
 * 露出来，永远只能很淡 —— 纸盖到哪，背景就在哪里消失。这是结构错，
 * 不是剂量不够。
 *
 * 这一版改用 `mask-image`：**背景自己知道哪里该让路**。
 * 内容区（左栏文字 + 右栏表单）位置留一个柔和的透明洞，背景在洞里
 * 自动淡到 0；洞外可以浓到肉眼看得见的程度。文字不再需要一层纸，
 * 也就没有「纸边」这道硬线。
 *
 * 画什么
 * ------
 * 星云不是随便的漩涡，它由这个产品的三条真实规则构成：
 *
 * 1. **等距同心环**（24 圈）—— 掌握度是 0–100 的连续量，环是它的刻度。
 *    每 6 圈加粗一圈，对应报告页六项子能力。
 * 2. **十二道放射梁** —— 十二讲。长度各不相同，因为进度不是均匀的：
 *    越靠近中心（已掌握）越短，越外圈（未解锁）越长。
 * 3. **一层极细的网格** —— 它压在最下面，是这个产品的量尺。
 *
 * 动效三组，都极慢（40–120 秒）：
 * - 整团星云缓慢自转；
 * - 环的亮度呼吸（像仪表自检）；
 * - 放射梁各自轻微伸缩。
 *
 * 全部在 `prefers-reduced-motion: no-preference` 里，降级后完全静止。
 */

/** 十二讲。 */
const RAYS = 12;
/** 同心环数。 */
const RINGS = 24;

/**
 * mask 的形状：内容区留透明洞。
 *
 * 两个椭圆 —— 左边盖住文字列，右边盖住表单列，中间不盖（背景在那里
 * 可以完整显示，形成一条竖向的「星云通道」，正好落在视觉中缝上）。
 * 用 `radial-gradient` 而不是 `linear-gradient`：矩形渐变会切出直线，
 * 而柔和的椭圆让背景像是「自然退开的」。
 */
const CONTENT_MASK = `
  radial-gradient(ellipse 26% 58% at 26% 50%, transparent 58%, #000 100%),
  radial-gradient(ellipse 17% 52% at 80% 48%, transparent 62%, #000 100%)
`;

export function AuthBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <AuthStyles />

      {/* ---- 底层：量尺网格 ---- */}
      <div className="auth-grid absolute inset-0" />

      {/* ---- 氛围光斑：三个大色斑，给整页底色 ----
          它们不做 mask，直接铺满，负责「这一页有颜色」这件事。 */}
      <div className="auth-glow absolute inset-0" />

      {/* ---- 主体：星云 ----
          这块单独挂 mask，所以它能在内容区自动让路，
          而在四周浓到能看见环、梁、旋臂。 */}
      <div className="auth-nebula-mask absolute inset-0">
        <svg
          className="auth-spin absolute top-1/2 left-1/2 h-[168vmax] w-[168vmax] -translate-x-1/2 -translate-y-1/2"
          viewBox="-500 -500 1000 1000"
          fill="none"
        >
          <defs>
            {/* 环的颜色沿半径变化：内圈偏暖（已掌握），外圈偏冷（未解锁） */}
            <radialGradient
              id="auth-ring-grad"
              cx="0"
              cy="0"
              r="500"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0.1" stopColor="var(--warn)" stopOpacity="0.55" />
              <stop
                offset="0.45"
                stopColor="var(--primary)"
                stopOpacity="0.45"
              />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0.1" />
            </radialGradient>
            <radialGradient
              id="auth-core"
              cx="0"
              cy="0"
              r="220"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="var(--warn)" stopOpacity="0.3" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 核心光晕 */}
          <circle r="220" fill="url(#auth-core)" />

          {/* 24 圈等距环。每 6 圈加粗，对应六项子能力。 */}
          {Array.from({ length: RINGS }, (_, i) => {
            const r = 46 + i * 18.5;
            const major = i % 6 === 5;
            return (
              <circle
                key={i}
                r={Number(r.toFixed(2))}
                stroke="url(#auth-ring-grad)"
                strokeWidth={major ? 1.6 : 0.7}
                strokeOpacity={major ? 0.62 : 0.3}
                className="auth-breathe"
                style={{ animationDelay: `${(i * 0.31).toFixed(2)}s` }}
              />
            );
          })}

          {/* 十二道放射梁：十二讲。长度按下标递增 —— 越外圈越「未解锁」。 */}
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
                strokeOpacity={0.16 + i * 0.022}
                strokeWidth="1.4"
                strokeLinecap="round"
                className="auth-ray"
                style={{ animationDelay: `${(i * 0.6).toFixed(1)}s` }}
              />
            );
          })}

          {/* 旋臂：两道对数螺线，给星云「在转」的方向感。
              点是等距取样的 —— 手写 60 个坐标会错。 */}
          {[0, Math.PI].map((offset, arm) => (
            <g key={arm} className="auth-spiral">
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
                    fillOpacity={Number((0.5 - t * 0.32).toFixed(2))}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* ---- 超大衬线水印 ---- */}
      <span className="auth-wm absolute right-4 bottom-[4%] font-serif leading-none font-semibold select-none">
        掌
      </span>
    </div>
  );
}

/**
 * 背景的全部样式。
 *
 * 注意 mask：`auth-nebula-mask` 用两层椭圆把内容区挖空。
 * `mask-composite: intersect` 让两层取交集 —— 任一椭圆内的区域都被挖掉，
 * 于是左栏与表单列都干净，中间的竖向通道保留星云。
 */
function AuthStyles() {
  return (
    <style>{`
.auth-grid {
  background-image:
    linear-gradient(to right, var(--rule) 1px, transparent 1px),
    linear-gradient(to bottom, var(--rule) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(140% 120% at 50% 30%, #000 8%, transparent 76%);
  -webkit-mask-image: radial-gradient(140% 120% at 50% 30%, #000 8%, transparent 76%);
  opacity: 0.9;
}

/* 三个色斑：让整页有底色，而不只是一块白纸上的线条 */
.auth-glow {
  background:
    radial-gradient(46% 54% at 82% 8%, var(--warn-soft) 0%, transparent 62%),
    radial-gradient(52% 60% at 92% 78%, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 68%),
    radial-gradient(44% 50% at 6% 92%, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 66%);
  opacity: 0.95;
}

.auth-nebula-mask {
  mask-image: ${CONTENT_MASK};
  -webkit-mask-image: ${CONTENT_MASK};
  mask-composite: intersect;
  -webkit-mask-composite: source-in;
}

.auth-wm {
  font-size: 17rem;
  color: color-mix(in oklch, var(--primary) 7%, transparent);
}

/* --- 动效：全部极慢，且只在用户没要求减少动态时启用 --- */
@keyframes auth-spin-frames {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes auth-breathe-frames {
  0%, 100% { stroke-opacity: 0.3; }
  50%      { stroke-opacity: 0.62; }
}
@keyframes auth-ray-frames {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.07); }
}

@media (prefers-reduced-motion: no-preference) {
  .auth-spin {
    animation: auth-spin-frames 240s linear infinite;
    transform-origin: center;
  }
  .auth-breathe {
    animation: auth-breathe-frames 40s ease-in-out infinite;
  }
  .auth-ray {
    animation: auth-ray-frames 58s ease-in-out infinite;
    transform-origin: center;
  }
}

/* 窄屏：内容占满整宽，没有中缝可用。
   星云整体后撤成一层极淡的底，文字区不需要 mask 也读得清。 */
@media (max-width: 1023px) {
  .auth-nebula-mask {
    mask-image: none;
    -webkit-mask-image: none;
    opacity: 0.22;
  }
}

/* 表单底：右栏那一片单独垫一层半透明纸。
   mask 已经把星云在表单位置挖空了，但挖空区边缘仍是渐变的 ——
   星云的蓝紫调会从四边渗进来，让表单文字看起来「被盖住」。
   这一层用 92% 的纸色压住渗色，同时留 8% 让格子与外圈纹理若隐若现，
   不至于变成一张死白卡。 */
.auth-form-sheet {
  background-color: color-mix(in oklch, var(--background) 92%, transparent);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--rule) 60%, transparent);
}
@media (max-width: 1023px) {
  /* 窄屏星云已经压到 0.22，不需要再垫，垫了反而多一块框 */
  .auth-form-sheet {
    background-color: transparent;
    box-shadow: none;
  }
}
`}</style>
  );
}
