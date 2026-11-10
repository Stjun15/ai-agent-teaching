/**
 * 学习中心的星云底。
 *
 * 与首页、登录页共用同一份几何（`home-nebula.tsx` 的 `Nebula`）：
 * 24 圈 = 掌握度刻度，12 道梁 = 十二讲，两道对数螺线。
 * 这一页的差别只在**排布**：课程是纵向滚动的卡片流，所以星云
 * 沿两侧交替出现，跟着卡片一行行往下走，而不是像首页那样铺三处。
 *
 * 可读性
 * ------
 * 每个阶段都把星云压在卡片背后（卡片自己有不透明底 `bg-card`），
 * 所以不需要额外纸面。卡片之外那圈留白里的星云可以放开浓度。
 */

import { Nebula } from "@/components/home/home-nebula";

export function LearnNebula() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 底色光斑：与首页同一组，保证两页的「纸」是同一个温度 */}
      <div className="absolute inset-0 bg-[radial-gradient(44%_24%_at_88%_4%,var(--warn-soft)_0%,transparent_60%)] opacity-75" />
      <div className="absolute inset-0 bg-[radial-gradient(46%_22%_at_4%_40%,color-mix(in_oklch,var(--primary)_9%,transparent)_0%,transparent_62%)] opacity-90" />

      {/* 首屏右上：托住标题与复习提示条。
          尺寸与浓度对齐首页首屏（首页在同位置叠了两块 76rem/0.66 与 74rem/0.62，
          实测可见覆盖率 57%/56%）；学习中心原来只有 62rem/0.5，实测 39%，
          视觉上明显比首页「薄」。这里改成与首页同规格的一对。 */}
      <Nebula
        className="-top-[30rem] -right-[30rem] h-[76rem] w-[76rem]"
        opacity={0.5}
      />
      <Nebula
        className="-top-[18rem] -right-[16rem] hidden h-[74rem] w-[74rem] lg:block"
        opacity={0.5}
      />
      {/* 卡片流中段：左侧 */}
      <Nebula
        className="top-[42rem] -left-[28rem] hidden h-[54rem] w-[54rem] lg:block"
        opacity={0.34}
      />
      {/* 卡片流下段：右侧 */}
      <Nebula
        className="top-[96rem] -right-[26rem] hidden h-[50rem] w-[50rem] lg:block"
        opacity={0.26}
      />
    </div>
  );
}
