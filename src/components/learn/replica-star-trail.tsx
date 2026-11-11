/**
 * 复刻页左栏的星轨。
 *
 * 为什么是「星轨」而不是又一层背景
 * ------------------------------
 * 这一页最大的空白不在页面上方，而在**左栏导航的下方**：六个阶段只占
 * 214–701px，而左栏要跟着右侧 3501px 的阶段卡一路撑到 4568px ——
 * 实测中间有 3867px 什么都没有，占整页高度的 68%。
 *
 * 作者的要求是「用星空的色彩点缀一下空白的地方，不一定要背景」。所以这里
 * 不再铺一层 `Nebula`（那会变成第三层背景，且这块区域窄、星星只会露出一角），
 * 而是让**星空长进这块空白本身**：一条沿着导航节点继续往下的星轨。
 *
 * 为什么是 HTML 而不是 SVG
 * ----------------------
 * 这块空白是高 3867px、宽 260px 的极端比例。SVG 要做到「点和线都按像素
 * 尺寸出现」必须用 `preserveAspectRatio="none"`，而那会把圆点的**填充**
 * 拉成椭圆 —— 3.2 半径在 100×100 视口里映射到实际是 8×124px 的竖条
 * （`vector-effect: non-scaling-stroke` 只管描边，管不了填充）。
 * 所以改用绝对定位的 HTML 节点：`left`/`top` 用百分比跟着容器走，
 * 尺寸写死成 px，点永远是正圆。
 *
 * 它由产品规则构成，不是随手撒的点
 * ------------------------------
 * 六个节点对应六个阶段（`REPLICA_PHASES`），位置按语义分档：
 * - 走得越远，星点越小越暗；前两个是暖金（`--warn`），之后转墨蓝（`--primary`）；
 * - 越往下越淡：这一段说的是「后面还有路，但你还没走到」，
 *   不该比当前阶段的导航更抓眼。
 *
 * 为什么坐标全是**字符串常量**
 * -------------------------
 * 这里踩过真实的坑：第一版用 `Math.hypot` / `Math.atan2` 现算连线的宽度
 * 与角度，SSR 输出 `rotate(129.472deg)`、客户端算出
 * `rotate(129.47245984834385deg)` —— 浮点序列化末位不同，React 逐字符
 * 比对属性，整页报 hydration mismatch（左下角弹出红色「1 Issue」）。
 *
 * 与 `auth-backdrop.tsx` 同因同果。修法也一样：把算好的值**冻结成字符串**
 * 写死在模块顶层，两边拿到的是同一串字节，不再有浮点参与的余地。
 * 代价是改点位要手算一次 —— 但这段几何一共就六个点，值得。
 */

/** 六个阶段的星点：`left`/`top` 是容器百分比，`size` 是 px 直径。 */
const TRAIL = [
  { left: "30%", top: "4%", size: 7, tone: "warn" },
  { left: "54%", top: "20%", size: 6, tone: "warn" },
  { left: "38%", top: "37%", size: 5, tone: "primary" },
  { left: "58%", top: "55%", size: 4, tone: "primary" },
  { left: "44%", top: "72%", size: 3, tone: "primary" },
  { left: "56%", top: "89%", size: 3, tone: "primary" },
] as const;

/** 每颗星的亮度：越往下越淡。 */
const TONE_OPACITY = [0.55, 0.45, 0.34, 0.28, 0.2, 0.14];

/**
 * 相邻星点之间的连线。
 *
 * 数值已预先算好并写成字符串（见文件头「为什么坐标全是字符串常量」）。
 * 容器 260×3867，百分比换算按 260 宽作基准取近似圆角。
 */
const SEGMENTS = [
  { left: "30%", top: "4%", width: "68%", angle: "80deg" },
  { left: "54%", top: "20%", width: "45%", angle: "95deg" },
  { left: "38%", top: "37%", width: "56%", angle: "91deg" },
  { left: "58%", top: "55%", width: "37%", angle: "98deg" },
  { left: "44%", top: "72%", width: "32%", angle: "98deg" },
] as const;

export function ReplicaStarTrail({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`star-trail pointer-events-none relative hidden select-none lg:block ${className}`}
    >
      {/* 连线：路径本身，比星点暗一档，虚线让它是「路」而不是「光」。
          `length` 按百分比算、`transform` 旋转，两端都对上星点。 */}
      {SEGMENTS.map((segment, i) => (
        <span
          key={i}
          className="star-trail-link"
          style={{
            left: segment.left,
            top: segment.top,
            width: segment.width,
            transform: `rotate(${segment.angle})`,
            opacity: 0.5 - i * 0.06,
          }}
        />
      ))}

      {/* 星点：前两颗给外晕，后面只留点本身 —— 越往下越接近「远处的光」 */}
      {TRAIL.map((point, i) => (
        <span
          key={i}
          className="star-trail-dot"
          style={{
            left: point.left,
            top: point.top,
            width: `${point.size}px`,
            height: `${point.size}px`,
            opacity: TONE_OPACITY[i],
            backgroundColor:
              point.tone === "warn" ? "var(--warn)" : "var(--primary)",
            boxShadow:
              i < 2
                ? `0 0 ${point.size * 2.5}px ${point.size * 0.75}px color-mix(in oklch, var(--warn) 22%, transparent)`
                : undefined,
          }}
        />
      ))}

      <ReplicaStarTrailStyles />
    </div>
  );
}

/**
 * 星轨的线与渐隐样式。
 *
 * 渐隐用 mask：这一段是「还没走到的路」，底部淡出比硬收边自然。
 * 线用 1px + 虚线：它表示路径，实线会让空白变成一张图表格。
 */
function ReplicaStarTrailStyles() {
  return (
    <style>{`
.star-trail {
  mask-image: linear-gradient(to bottom, #000 0%, #000 60%, transparent 94%);
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 60%, transparent 94%);
}
.star-trail-link {
  position: absolute;
  height: 1px;
  transform-origin: left center;
  background-image: linear-gradient(
    to right,
    color-mix(in oklch, var(--primary) 55%, transparent) 0 2px,
    transparent 2px 6px
  );
  background-size: 6px 1px;
}
.star-trail-dot {
  position: absolute;
  border-radius: 9999px;
  transform: translate(-50%, -50%);
}
`}</style>
  );
}
