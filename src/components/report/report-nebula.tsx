/**
 * 学习报告的星云底。
 *
 * 与首页、登录页、学习中心共用同一份几何（`home-nebula.tsx` 的 `Nebula`）：
 * 24 圈 = 掌握度刻度，12 道梁 = 十二讲，两道对数螺线。
 *
 * 这一页比另外三页更克制（0.42 / 0.28 / 0.22，比学习中心的 0.5 / 0.34 / 0.26 更低），
 * 原因是页面性质不同：报告是一屏全是数字的地方 —— 四张统计卡、六项子能力、
 * 十余行评分维度、一张趋势折线。星云一旦抢眼，读数字的人会累。
 *
 * 所以这里的作用只是「这页和别的页是同一个产品」，不是氛围主角。
 */

import { Nebula } from "@/components/home/home-nebula";

export function ReportNebula() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 底色光斑：与另外三页同一组，保证纸的温度一致 */}
      <div className="absolute inset-0 bg-[radial-gradient(42%_22%_at_90%_2%,var(--warn-soft)_0%,transparent_58%)] opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(44%_20%_at_2%_54%,color-mix(in_oklch,var(--primary)_8%,transparent)_0%,transparent_60%)] opacity-85" />

      {/* 首屏右上：托住标题与四张统计卡 */}
      <Nebula
        className="-top-[22rem] -right-[26rem] h-[58rem] w-[58rem]"
        opacity={0.42}
      />
      {/* 中段左侧：六项子能力那一片 */}
      <Nebula
        className="top-[46rem] -left-[30rem] hidden h-[50rem] w-[50rem] lg:block"
        opacity={0.28}
      />
      {/* 下段右侧：趋势与薄弱点 */}
      <Nebula
        className="top-[104rem] -right-[28rem] hidden h-[46rem] w-[46rem] lg:block"
        opacity={0.22}
      />
    </div>
  );
}
