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

      {/* 首屏右上：托住标题与四张统计卡。
          与首页、学习中心同一规格（76rem / 0.62 + 74rem / 0.56）。
          报告页数字密集，所以第二块比学习中心略低一点，但仍在同一档，
          不再像之前那样明显发白。 */}
      <Nebula
        className="-top-[34rem] -right-[34rem] h-[76rem] w-[76rem]"
        opacity={0.56}
      />
      <Nebula
        className="-top-[22rem] -right-[22rem] hidden h-[74rem] w-[74rem] lg:block"
        opacity={0.5}
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
      {/* 错题本：标题在文档 1859px（实测），卡片流一直延伸到 ~3200px。
          这一段的星云必须**更靠内**：之前放在 -right-[28rem]，
          1440 视口下大半被推出屏幕右缘（实测该区域饱和度 max 只有 0.222，
          等于没有）。收到 -right-[18rem] 并提高浓度，让卡片缝隙里能看见。 */}
      <Nebula
        className="top-[118rem] -right-[10rem] hidden h-[58rem] w-[58rem] lg:block"
        opacity={0.46}
      />
      <Nebula
        className="top-[152rem] -left-[16rem] hidden h-[54rem] w-[54rem] lg:block"
        opacity={0.38}
      />
    </div>
  );
}

/**
 * 报告页卡片列表的星空纹路。
 *
 * 卡片不能做成半透明（会连带影响全站 Card 的观感），所以改成
 * **卡片自己带一层极淡的同心环纹路**：不透明纸底之上再叠一圈圈
 * 同心的星图刻度，与页面背景的星云同构，但浓度只有它的十分之一。
 *
 * 为什么不做满整张卡片：这些列表一屏十几条，很密。纹路如果铺满，
 * 十张卡各带一圈环，页面会变得很吵；所以环心放在卡片右上角之外
 * （`at 118% -18%`），只在卡片的右上角露出弧线的一小段 ——
 * 远看是干净的纸，近看才发现有星图。
 *
 * 环间距 22px、线宽 1px、透明度 0.05~0.07：这三个数是在
 * 1440 截图上看不出来的量级，但并排十张卡时能读出「有东西」。
 */
export function ErrorCardPattern() {
  return (
    <style>{`
.star-card {
  position: relative;
  isolation: isolate;
  background-color: var(--card);
}
.star-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  /* 同心环：每 20px 一圈。
     透明度从 7% 提到 16% —— 7% 时实测卡片右上角亮度跨度只有 6.1/255，
     肉眼看不见，等于没加。16% 落在「近看有环、远看是干净的纸」这一档。 */
  background-image: repeating-radial-gradient(
    circle at 118% -18%,
    transparent 0 19px,
    color-mix(in oklch, var(--primary) 16%, transparent) 19px 20px
  );
  /* 可见范围比之前 62% 放宽到 78%：原来只在右上角一小块，
     一块卡片上只有两三条弧，读不出「同心」。仍向左下淡出，不铺满整卡。 */
  mask-image: radial-gradient(125% 125% at 118% -18%, #000 14%, transparent 78%);
  -webkit-mask-image: radial-gradient(125% 125% at 118% -18%, #000 14%, transparent 78%);
}
`}</style>
  );
}
