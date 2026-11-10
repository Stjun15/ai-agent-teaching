/**
 * 登录页背景。
 *
 * 为什么单独做一个组件而不是直接在 `auth/page.tsx` 里铺几个 div：
 * 这一页是全站的门面 —— 评委、访客、学生第一次打开看到的就是它。
 * 背景要同时满足三个互相打架的约束：
 *
 * 1. **不能是空白纸**。纯 `bg-background` 的登录页看起来像没做完，
 *    而首页已经有满版笔触，两者并排会让登录页显穷。
 * 2. **不能挡住表单**。这是登录页，人在这里要做一件具体的事；
 *    纹理压到表单上会像水印，降低输入框的可信度。
 * 3. **必须比首页克制**。首页是长卷，可以浓铺；登录页只有一屏，
 *    纹理一旦抢眼，人记不住「这是个什么产品」，只记得一片漩涡。
 *
 * 所以这里不做满版，只做**右侧的一道夜带 + 左侧页边的余韵**：
 * 视线从左栏文字流向右栏表单，笔触从右上斜切下来收在页边，
 * 中间那条竖缝是留给表单的干净区。
 *
 * 复用首页的 `StripeSprite` / `StripeField` / `CypressBand` ——
 * 图形只定义一份（`stripe-field.tsx` 的 `<symbol>` + `<defs>`），
 * 这里只是排布。整页看到的四条笔触共用一份几何，不是四份拷贝。
 */

import {
  CypressBand,
  StripeField,
  StripeSprite,
} from "@/components/home/stripe-field";

export function AuthBackdrop() {
  return (
    <>
      {/* 几何定义：必须在使用它的 <use href="#..."> 之前出现 */}
      <StripeSprite />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <AuthBackdropStyles />
        {/* ---- 第一层：整片纸的暖色起伏 ----
            一块从上到下的极淡渐变，让顶部比底部略暖一点。
            人眼对这种「纸被灯照过」的明度差是有感的，但它不足以形成图形，
            所以不会和下面的笔触抢。 */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_78%_-10%,var(--warn-soft)_0%,transparent_55%)] opacity-70" />

        {/* ---- 第二层：右侧夜带 ----
            主视觉。三片笔触错开叠在右半，从视口顶外斜插进来。
            浓度刻意放开到 0.9 —— 起作用的是下方的 .auth-paper：
            文字与表单站在一层不透明纸面上，所以背景可以任意浓，
            这是首页已经验证过的结构（纸面兜底，而不是把纹理压淡）。 */}
        <div className="auth-night absolute -top-[26rem] -right-[16rem] w-[78rem] opacity-[0.9] sm:-right-[12rem] sm:w-[72rem]">
          <StripeField depth={2.2} rotate={140} />
        </div>
        <div className="auth-drift-slow absolute -top-[10rem] right-[14rem] hidden w-[50rem] opacity-[0.62] lg:block">
          <StripeField depth={1.4} rotate={158} />
        </div>
        <div className="auth-drift absolute top-[26rem] -right-[26rem] hidden w-[64rem] opacity-[0.5] xl:block">
          <StripeField depth={1.8} rotate={126} />
        </div>

        {/* ---- 第三层：左侧页边余韵 ----
            压在左上角视口之外，只在页边露出一角，
            作用是让左栏不是一片死白，又不进入标题的视线。 */}
        <div className="auth-drift-slow absolute -top-[28rem] -left-[24rem] w-[56rem] opacity-[0.72]">
          <StripeField depth={1.6} rotate={-24} />
        </div>

        {/* ---- 第四层：柏树 ----
            《星月夜》唯一的纵向结构，也是唯一能打断「全是横流」的东西。
            放在中缝偏右（表单左边缘外侧），窄屏隐藏 —— 窄屏没有中缝可用。 */}
        <CypressBand className="auth-drift absolute -top-[10rem] left-[48%] hidden h-[52rem] w-[13rem] opacity-[0.42] lg:block" />

        {/* ---- 第五层：极细的星点 ----
            24 个 1px 的圆点，用固定坐标铺开（不是随机，随机每次刷新都变，
            验收时对不上）。它们只在浓笔触那一侧，密度低到像纸里的杂质。 */}
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          {STARS.map(([x, y, r], i) => (
            <circle
              key={i}
              cx={`${x}%`}
              cy={`${y}%`}
              r={r}
              fill="var(--primary)"
              opacity={0.14 + ((i * 7) % 5) * 0.045}
            />
          ))}
        </svg>
      </div>
    </>
  );
}

/**
 * 登录页自己的漂移节奏。
 *
 * 不复用首页的 `sky-drift-*`：那套是 92–134 秒，配长卷滚动正好；
 * 登录页只有一屏、人停留几十秒，同样的速度会显得「在动」，
 * 而不是「有生命」。这里放到 180–260 秒，配 `no-preference` 保护 ——
 * 系统开了「减少动态效果」时整页静止，只剩形状。
 */
function AuthBackdropStyles() {
  return (
    <style>{`
@keyframes auth-drift-frames {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
  50%  { transform: translate3d(-1.2%, 1.6%, 0) rotate(-1.1deg); }
  100% { transform: translate3d(0, 0, 0) rotate(0deg); }
}
@media (prefers-reduced-motion: no-preference) {
  .auth-drift {
    animation: auth-drift-frames 180s ease-in-out infinite;
  }
  .auth-drift-slow {
    animation: auth-drift-frames 260s ease-in-out infinite reverse;
  }
  .auth-night {
    animation: auth-drift-frames 220s ease-in-out infinite;
  }
}

/* 纸面兜底：文字与表单站在不透明底上，所以上面的背景可以任意浓。
   两端渐隐 —— 直接铺一块实色会在容器边界剪出直边，纹理看着像被切断。 */
.auth-paper {
  background-image: linear-gradient(
    to right,
    transparent 0%,
    var(--background) 1.8%,
    var(--background) 98.2%,
    transparent 100%
  );
}
@media (max-width: 1023px) {
  /* 窄屏是单列满宽，没有可渐隐的侧边留白，直接给实底 */
  .auth-paper {
    background-image: none;
    background-color: var(--background);
  }
}
`}</style>
  );
}

/**
 * 星点坐标：手挑的一组百分比。
 *
 * 为什么不用 `Math.random()`：服务端与客户端各生成一次，
 * 水合时坐标不一致会直接报 hydration mismatch；而且每次刷新位置都变，
 * 截图验收没法比对。固定坐标是这一层唯一正确的做法。
 */
const STARS: readonly (readonly [number, number, number])[] = [
  [62, 8, 1.1],
  [71, 14, 0.8],
  [80, 6, 1.4],
  [88, 19, 0.9],
  [66, 26, 1.0],
  [75, 33, 1.3],
  [84, 41, 0.8],
  [92, 28, 1.1],
  [58, 44, 0.9],
  [69, 52, 1.2],
  [78, 61, 0.8],
  [87, 55, 1.0],
  [64, 68, 1.1],
  [73, 76, 0.9],
  [82, 84, 1.2],
  [90, 71, 0.8],
  [60, 86, 1.0],
  [70, 92, 0.9],
  [85, 12, 0.7],
  [94, 46, 1.0],
  [56, 19, 0.8],
  [77, 22, 0.7],
  [89, 88, 1.1],
  [67, 97, 0.8],
];
