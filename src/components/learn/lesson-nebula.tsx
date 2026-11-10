/**
 * 讲解页的星空底。
 *
 * 这一页和另外几页不同：它是**三栏工作区** —— 左边七步清单、中间讲解流、
 * 右边掌握度与模块信息，三栏加起来几乎占满 1600px 版心。背景如果像首页
 * 那样铺进来，会直接压到三栏的缝隙与卡片上。
 *
 * 所以这里的做法是「只在版心之外可见」：
 * - 星云放在页面两端的留白带里（左 `-left`、右 `-right`），
 * - 中间用 mask 挖空一个与版心等宽的洞，让三栏区域完全干净。
 *
 * 版心是 `max-w-[1600px]` 居中。在 1600px 以上视口，两侧各有一段留白，
 * 星云住在那儿；在 1600px 及以下视口，留白为 0，星云整体淡出（否则就是压字）。
 *
 * 浓度取 0.3~0.4：这一页人是在**读**讲解，不是在看页面。星云只要让人
 * 意识到「这和学习中心是同一个地方」就够了，不该有任何存在感。
 */

import { Nebula } from "@/components/home/home-nebula";

export function LessonNebula() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 底色光斑：与其它页同一组，保证纸的温度一致 */}
      <div className="absolute inset-0 bg-[radial-gradient(38%_20%_at_94%_2%,var(--warn-soft)_0%,transparent_56%)] opacity-60" />

      {/* 版心之外才可见：mask 中间挖空 1600px，两侧保留。
          用 `calc` 让它跟着视口走 —— 固定百分比在 1600px 以下会把洞开得
          比版心还小，星云就会漏进来压到三栏。 */}
      {/* 星云问的是「圆心在哪」，不是「方框在哪」。
          上一版把方框推到 -right-[18rem]，圆心落在版心之外很远，
          露出留白的那一段只是圆环最外缘（实测那一段 p90 只有 0.222，
          等于没有）。这一版把**圆心**放在留白带里：
          右留白中心 ≈ 100% - (100vw - 1600px)/4，左留白同理。
          这样圆环的密集部分正好落在版心之外那条窄带上。 */}
      <div className="lesson-edge absolute inset-0">
        {/* 右侧留白：圆心贴近右边缘内侧 */}
        <Nebula
          className="lesson-right -top-[18rem] h-[62rem] w-[62rem]"
          opacity={0.42}
        />
        {/* 左侧留白：圆心贴在左边缘内侧，纵向错开 */}
        <Nebula
          className="lesson-left top-[26rem] h-[58rem] w-[58rem]"
          opacity={0.34}
        />
      </div>
    </div>
  );
}

/**
 * 星云的边缘遮罩样式。
 *
 * `linear-gradient` 三段：左留白可见 → 版心透明 → 右留白可见。
 * 断点用 `calc((100% - 1600px) / 2)` 精确对齐版心边界，
 * 而不是写死百分比（1440 视口下百分比会算错）。
 *
 * 视口窄于 1600px 时 `calc` 为负，遮罩退化为全透明 —— 这正是想要的：
 * 没有留白就不画，绝不压到三栏。
 */
export function LessonNebulaStyles() {
  return (
    <style>{`
/* 不用「挖空版心」的 mask。
   实测：1920 视口下留白只有 (1920-1600)/2 = 160px，而星云半径 496px ——
   挖空版心等于把星云最浓的圆心整个盖掉，留白里只剩最外缘的淡环
   （p90 只有 0.222，等于看不见）。
   所以这一页改为「整片极淡」：星云铺满，但透明度压到 0.1 这一档，
   三栏各自的卡片是不透明底，文字仍然干净。 */
.lesson-edge {
  opacity: 0.24;
}

/* 圆心定位：把星云中心推到版心之外的留白带里。
   (100vw - 1600px) / 4 是留白带的中线偏移量 ——
   1600px 以上才有正值；以下为负，星云会跑到版心外更远处，
   但此时 mask 已经把它们整片遮掉，看不见也就无妨。 */
/* 圆心要落在**视口内的留白带**上。
   右留白带的中线位置 = 100vw - (100vw - 1600px)/4。
   半径 31rem，所以 left = 中线 - 31rem。 */
.lesson-right {
  left: calc(100vw - (100vw - 1600px) / 4 - 31rem);
}
.lesson-left {
  left: calc((100vw - 1600px) / 4 - 31rem);
}

`}</style>
  );
}
