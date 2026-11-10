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
 * 所以星云全部落在版心之外，版心内不铺任何一层；纵向沿六个小节交替出现，
 * 让滚动过程里「两侧一直有东西」，但每一处都压在 0.3 上下。
 *
 * 首屏那一处例外地给到 0.46：它是这一讲的第一印象，而这一页的标题区
 * 只有三行字，右侧整块是空的。
 */

import { Nebula } from "@/components/home/home-nebula";

export function WelcomeNebula() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
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
          星云止于 2972px —— 中间那一段滚到底部时是空的。这里对齐到
          2700px 起笔（`top-[168.75rem]`），让它跨住收尾与页脚之间。 */}
      <Nebula
        className="top-[168rem] -left-[18rem] hidden h-[52rem] w-[52rem] lg:block"
        opacity={0.3}
      />
    </div>
  );
}
