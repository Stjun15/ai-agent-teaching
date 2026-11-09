/**
 * 不规则线框：一个七边形晶格，顶点不在正多边形上，内部对角线也不对称。
 * 极慢自转（90s 一圈），只为了让静态图形不死板；鼠标悬停时描边加深。
 *
 * 纯 SVG + CSS，无 JS 状态。全站色彩令牌驱动，深色底上把 `text-primary`
 * 换成想要的颜色即可。
 */
export function WireGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden
      className={`animate-[glyph-turn_90s_linear_infinite] text-primary ${className}`}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={0.7}
        strokeLinejoin="round"
      >
        {/* 外轮廓：七个顶点，角度与半径都不均匀 */}
        <path
          d="M60 6 L104 26 L114 74 L86 112 L36 114 L8 82 L10 32 Z"
          opacity={0.55}
        />
        {/* 内部晶格：三条互不相交的对角线 */}
        <path d="M60 6 L86 112" opacity={0.3} />
        <path d="M104 26 L36 114" opacity={0.3} />
        <path d="M10 32 L114 74" opacity={0.3} />
        {/* 次级连线，让图形不是纯对称的架子 */}
        <path d="M10 32 L104 26 M36 114 L114 74 M60 6 L36 114" opacity={0.18} />
      </g>
      {/* 顶点：四个实心小方块，只落在不规则的那几个角上 */}
      {[
        [60, 6],
        [114, 74],
        [36, 114],
        [10, 32],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x - 2}
          y={y - 2}
          width={4}
          height={4}
          className="fill-primary"
          opacity={0.7}
        />
      ))}
    </svg>
  );
}
