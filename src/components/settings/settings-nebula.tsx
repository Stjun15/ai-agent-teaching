/**
 * 设置页的星云底。
 *
 * 与首页、登录页、学习中心、学习报告共用同一份几何（`home-nebula.tsx` 的 `Nebula`）：
 * 24 圈 = 掌握度刻度，12 道梁 = 十二讲，两道对数螺线。
 *
 * 这一页是表单式的短页（`max-w-2xl`、两三屏），所以只铺两处：
 * 首屏右上托住标题，中段左侧补一口气 —— 再多就是装饰了。
 * 浓度取报告页与学习中心之间（0.5 / 0.3）：设置项本身是文字与开关，
 * 星云不能压过它们，但也不该让这页看起来像另一个产品。
 */

import { Nebula } from "@/components/home/home-nebula";

export function SettingsNebula() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 底色光斑：与其它页同一组，保证纸的温度一致 */}
      <div className="absolute inset-0 bg-[radial-gradient(44%_24%_at_88%_4%,var(--warn-soft)_0%,transparent_60%)] opacity-75" />
      <div className="absolute inset-0 bg-[radial-gradient(46%_22%_at_4%_46%,color-mix(in_oklch,var(--primary)_9%,transparent)_0%,transparent_62%)] opacity-90" />

      {/* 首屏右上：与学习中心同规格，位置略下压，避开页头标题 */}
      <Nebula
        className="-top-[32rem] -right-[30rem] h-[74rem] w-[74rem]"
        opacity={0.5}
      />
      {/* 中段左侧：主题与服务端配置那两块后面 */}
      <Nebula
        className="top-[38rem] -left-[28rem] hidden h-[52rem] w-[52rem] lg:block"
        opacity={0.3}
      />
    </div>
  );
}
