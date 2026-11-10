/**
 * 「写在最前面」的星云底。
 *
 * 这一页的排布与其它页都不同，因为它**内容最窄**：`max-w-3xl` 只有 768px，
 * 1440 视口下两侧各留出约 336px。别的页要费劲把星云挤进版心缝里
 * （复刻页版心 1400px 就没缝），这一页反而是留白最多的那一页 ——
 * 所以这里是全站唯一可以「把星云放在文字两旁、并且放得清楚」的页面。
 *
 * 几何仍是 `home-nebula.tsx` 的那一份（24 圈掌握度刻度 + 12 道梁十二讲 +
 * 两道对数螺线），不另画 —— 全站只有一种星云画法。
 *
 * 浓度
 * ----
 * 这一页是长篇叙事（六节、3700px 高），读者是在**读**，不是在看页面。
 * 所以星云全部落在版心之外，纵向沿六个小节交替出现，让滚动过程里
 * 「两侧一直有东西」，但每一处都压在 0.3 上下。
 *
 * 为什么还要加一道水平 mask
 * ------------------------
 * 这一页与学习中心/报告页/复刻页有一个根本差异：那几页的文字都坐在
 * **不透明卡片**里（`bg-card`），星云铺到卡片底下也没关系；而这一页的正文
 * 直接坐在页面背景上，没有卡片兜底。
 *
 * 实测（1800 视口）：内容栏 506–1274，而首屏那块星云覆盖 893–2317 ——
 * 左边缘伸进正文 381px 深。浓度虽低，但背景色压到文字底下正是作者
 * 反复否决过的事（「我的意思是颜色，有点被背景盖住了」）。
 *
 * 所以容器上挂一道水平 mask：版心区间内淡出到 0，只留两旁的留白区。
 * 这是登录页 `auth-backdrop.tsx` 的同一思路（背景自己让路，而不是
 * 加一层纸盖住它）—— 那一次的经验是「纸盖到哪，背景就消失到哪」，
 * 要在留白里看到星云，只能让背景自己退。
 *
 * 首屏那一处例外地给到 0.46：它是这一讲的第一印象，而这一页的标题区
 * 只有三行字，右侧整块是空的。
 */

import { Nebula } from "@/components/home/home-nebula";

export function WelcomeNebula() {
  return (
    <div
      aria-hidden
      className="welcome-edge pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <WelcomeEdgeMask />
      {/* 底色光斑：与首页、学习中心同一组，保证纸的温度一致 */}
      <div className="absolute inset-0 bg-[radial-gradient(42%_22%_at_88%_2%,var(--warn-soft)_0%,transparent_58%)] opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(44%_20%_at_6%_44%,color-mix(in_oklch,var(--primary)_8%,transparent)_0%,transparent_60%)] opacity-85" />

      {/* 首屏右肩：标题「先给你看一样东西」那三行的右边。
          版心右缘到视口右缘有 300px 以上，圆心放在这条带子的中线上。 */}
      <Nebula
        className="-top-[24rem] -right-[22rem] h-[66rem] w-[66rem]"
        opacity={0.46}
      />

      {/* 第二、三节（「这不是比喻」与「怎么用 AI」）在左：这两节文字最密，
          星云离版心最近的那一圈也要压在 16rem 之外。 */}
      <Nebula
        className="top-[36rem] -left-[26rem] hidden h-[56rem] w-[56rem] lg:block"
        opacity={0.32}
      />

      {/* 建造顺序那一段在右：这是全页唯一有「阶梯」意象的地方，
          星云的同心环正好呼应。 */}
      <Nebula
        className="top-[78rem] -right-[20rem] hidden h-[58rem] w-[58rem] lg:block"
        opacity={0.36}
      />

      {/* 收尾（「动手吧」）在左。实测该节顶端在文档 3082px，而上一块
          星云止于 2972px —— 中间那一段滚到底部时是空的。这里从 2688px
          起笔（`top-[168rem]`），让它跨住收尾与页脚之间。 */}
      <Nebula
        className="top-[168rem] -left-[18rem] hidden h-[52rem] w-[52rem] lg:block"
        opacity={0.3}
      />
    </div>
  );
}

/**
 * 版心让路的水平 mask。
 *
 * 三段：左留白可见 → 版心透明 → 右留白可见。边界用 `calc` 跟着
 * `max-w-3xl`（768px）算，不写百分比 —— 百分比在 `max-w` 生效之后
 * 就不等于版心边界了。
 *
 * 两侧各多让 3rem / 1rem：3rem 给星云的浓环一个淡出过渡，1rem 给
 * 首尾字形的安全距离（`px-4 sm:px-6` 的内边距另算）。视口窄于 lg 时
 * 星云本身 `lg:block` 隐藏，这条 mask 此时不起作用。
 */
function WelcomeEdgeMask() {
  return (
    <style>{`
.welcome-edge {
  mask-image: linear-gradient(
    to right,
    #000 0,
    #000 calc(50% - 384px - 3rem),
    transparent calc(50% - 384px + 1rem),
    transparent calc(50% + 384px - 1rem),
    #000 calc(50% + 384px + 3rem),
    #000 100%
  );
  -webkit-mask-image: linear-gradient(
    to right,
    #000 0,
    #000 calc(50% - 384px - 3rem),
    transparent calc(50% - 384px + 1rem),
    transparent calc(50% + 384px - 1rem),
    #000 calc(50% + 384px + 3rem),
    #000 100%
  );
}
`}</style>
  );
}
