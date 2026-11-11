/**
 * 教学平台复刻页的星空底。
 *
 * 为什么这一页不能直接复用 `LessonNebula`
 * ----------------------------------------
 * 讲解页是 1600px 版心的三栏工作区，两侧有余量，星空住在那条余量带里即可
 * （圆心公式按 1600px 推的，见 `lesson-nebula.tsx`）。复刻页不是这个结构：
 *
 * - 版心是 `max-w-[1400px]`，1440 视口下两侧只剩 20px —— 圆心公式算出来
 *   的圆心落在屏幕外，星云整片被推走（实测 `.lesson-edge` 的子元素
 *   x=782 / w=1396 与 -725 / 1306，几乎没有一段落在可见区）；
 * - 页面主体是一张 **3493px 高的不透明阶段卡**（`bg-card`）加一条 260px
 *   的阶段导航，星空铺在版心内侧也会被卡片整片盖住。
 *
 * 所以这一页走报告页那条已验证的路子（`report-nebula.tsx`）：星云放在
 * **卡片会挡不到的地方** —— 页头、版心左右两侧的窄带、以及滚到底部之后
 * 的留白；再给卡片本身加一层极淡的同心环星纹，让「这一页也有星空」
 * 在近看时成立。浓度全部低于讲解页，因为这一页是**任务卡**：
 * 学生在这里照着命令行操作，背景只负责让人认出「这是同一个产品」。
 *
 * 几何复用 `Nebula`（24 圈掌握度刻度 + 12 道梁十二讲 + 双螺线），
 * 不另画一份 —— 全站只有那一种星云画法。
 */

import { Nebula } from "@/components/home/home-nebula";

export function ReplicaNebula() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 底色光斑：与首页/报告页同一组，保证纸的温度一致。 */}
      <div className="absolute inset-0 bg-[radial-gradient(44%_22%_at_92%_0%,var(--warn-soft)_0%,transparent_58%)] opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(46%_20%_at_2%_38%,color-mix(in_oklch,var(--primary)_7%,transparent)_0%,transparent_60%)] opacity-85" />

      {/* 首屏右肩：托住标题与「难度 / 前置」那一行。
          版心右缘以内 8rem 处起笔，卡片从 214px 才开始，这一块是页面
          唯一稳定可见的空白。 */}
      <Nebula
        className="-top-[26rem] -right-[18rem] h-[64rem] w-[64rem]"
        opacity={0.5}
      />

      {/* 阶段导航左侧：nav 只有 260px 宽，它的左边缘到版心左缘之间
          有一段常驻空白（1440 实测 24px，1920 更宽），星云圆心放在这里，
          只在导航文字之间的缝里露出一部分 —— 这正是「点缀」的分量。 */}
      <Nebula
        className="top-[28rem] -left-[26rem] hidden h-[52rem] w-[52rem] lg:block"
        opacity={0.26}
      />

      {/* 中下段右侧：阶段卡右侧有 8px 内边距 + 页面边距，
          这一段的星云靠内放，让它在卡片右缘之外可见。 */}
      <Nebula
        className="top-[92rem] -right-[16rem] hidden h-[54rem] w-[54rem] lg:block"
        opacity={0.34}
      />

      {/* 收尾：教案卡片之后到页脚那一段留白，滚到底时才有东西。 */}
      <Nebula
        className="top-[150rem] -left-[14rem] hidden h-[50rem] w-[50rem] lg:block"
        opacity={0.3}
      />
    </div>
  );
}

/**
 * 复刻页卡片的星空纹路。
 *
 * 与报告页 `ErrorCardPattern` 同一套写法（卡片 `::before` 上叠同心环，
 * 不改卡片透明度 —— 半透明卡片是被作者明确否决过的方向）。
 *
 * 差异在两处，都是因为这一页的卡片更大：
 * - 环间距 26px（报告页是 20px）：阶段卡有 3493px 高，20px 一圈会在
 *   一屏里堆出十几道环，读起来像表格线；
 * - 只在**卡片右上角**露出（`at 112% -6%`），向下淡出到 72%。
 *   任务卡重点是正文，纹路不该走到文字下面。
 */
export function ReplicaCardPattern() {
  return (
    <style>{`
.replica-card {
  position: relative;
  isolation: isolate;
  background-color: var(--card);
}
.replica-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  background-image: repeating-radial-gradient(
    circle at 112% -6%,
    transparent 0 25px,
    color-mix(in oklch, var(--primary) 14%, transparent) 25px 26px
  );
  mask-image: radial-gradient(120% 88% at 112% -6%, #000 10%, transparent 72%);
  -webkit-mask-image: radial-gradient(120% 88% at 112% -6%, #000 10%, transparent 72%);
}
`}</style>
  );
}
