"use client";

/**
 * 单个分数格
 *
 * 这个组件存在的唯一理由是守住一条规矩：**null 不画成 0**。
 *
 * 审计员这一轮不调模型，「认知负荷」判不了 —— 那是判断题。写 0 分就是编数据，
 * 而编出来的 0 分会被后续决策当成「这项很糟」来读，与实际情况（没测过）
 * 完全相反。所以：
 *
 *   null → 「未检测」（灰色、明确说没测）
 *   0    → 「0 / 100」（红色、确实测了而且很差）
 *
 * 这两者在界面上必须一眼可分。项目里已有同一条规矩的另一个实例 ——
 * 报告页的掌握度卡「尚未测评 ≠ 0 分」。别把这条改回去。
 *
 * 判定实测 0 分的唯一正当来源是检查真的跑过、且结果为 0（例如某讲的概念页
 * 承诺了机制结构、讲稿里一项都没出现）。这种格子该红，不该藏。
 */
export function ScoreCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">未检测</span>;
  }
  return (
    <span className="text-xs tabular-nums">
      {Math.round(value * 100)}
      <span className="text-muted-foreground"> / 100</span>
    </span>
  );
}
