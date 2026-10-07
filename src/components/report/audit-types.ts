/**
 * 审计页的响应类型 —— `src/lib/db/types.ts` 里表结构的镜像。
 *
 * 为什么单独一个文件：审计报告有三类消费者（页面外壳 / 逐讲表格 / 缺陷明细），
 * 三者都要这些形状。各文件各写一份 interface，改一处漏两处的概率不低，
 * 而这种不一致**不会报错** —— 只会让某块 UI 默默读到 undefined，
 * 页面照常渲染，只是少一列数据。
 */

import type { AuditSeverity } from "@/lib/db";

/** 一条缺陷。`evidence` 必填是硬约束：没有原文摘录的 finding 不该入库。 */
export interface AuditFinding {
  id: string;
  moduleId: string;
  moduleName: string;
  severity: AuditSeverity;
  dimension: string;
  title: string;
  /** 证据原文（含文件与定位）。**不允许为空** —— 见 audit-db-spec 的守卫。 */
  evidence: string;
  recommendation: string;
}

/** 一讲的检查结果。四个确定性分数 + 一个要模型判的分数。 */
export interface AuditSummary {
  moduleId: string;
  moduleName: string;
  reachability: number | null;
  demoReadability: number | null;
  terminologyGap: number | null;
  consistency: number | null;
  /** 本轮不调模型 → 恒为 null。界面显示「未检测」，不显示 0。 */
  cognitiveLoad: number | null;
  usedModel: boolean;
  findingsCount: number;
  updatedAt: string;
}

export interface AuditResponse {
  findings: AuditFinding[];
  summaries: AuditSummary[];
}
