/**
 * 课程审计结果的数据访问
 *
 * 与 `errors` 的分工（别混）
 * ----------------------
 * errors         —— 学生的错题，来自点评 / 判分路径
 * audit_findings —— 课程内容的缺陷，来自审计编排层
 * 两者都是「问题清单」，但主体不同（学生 vs 课程），混表会让报告页
 * 无法按主体筛选。
 *
 * 幂等写入
 * --------
 * fingerprint = (module_id, dimension, title) 的哈希，作为唯一约束。
 * 同一讲重复审计不会堆叠行，而是覆盖 evidence —— 内容改了要能反映出来，
 * 而同一问题反复报会让报告页变成噪声墙。
 *
 * 只有**本轮查出且仍存在**的 finding 会被 upsert；一轮里消失的问题
 * （已修）由 `replaceModuleFindings` 整块替换语义保证不会留下旧记录。
 */

import { getDb } from "./sqlite";
import {
  newId,
  asString,
  asNumber,
  asNullableNumber,
  asBool,
  fromBool,
  type Row,
} from "./helpers";
import type {
  AuditFindingRecord,
  AuditSeverity,
  ModuleAuditRecord,
} from "./types";

const SEVERITIES: readonly AuditSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

function mapFinding(row: Row): AuditFindingRecord {
  const severity = asString(row.severity);
  return {
    id: asString(row.id),
    moduleId: asString(row.module_id),
    moduleName: asString(row.module_name),
    severity: (SEVERITIES.includes(severity as AuditSeverity)
      ? severity
      : "info") as AuditSeverity,
    dimension: asString(row.dimension),
    title: asString(row.title),
    evidence: asString(row.evidence),
    recommendation: asString(row.recommendation),
    fingerprint: asString(row.fingerprint),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapModuleAudit(row: Row): ModuleAuditRecord {
  return {
    moduleId: asString(row.module_id),
    moduleName: asString(row.module_name),
    // NULL 一律映射成 null 而不是 0 —— 「没检测过」与「检测过但很差」
    // 是两件事，前端要分开显示。
    reachability: asNullableNumber(row.reachability),
    demoReadability: asNullableNumber(row.demo_readability),
    terminologyGap: asNullableNumber(row.terminology_gap),
    consistency: asNullableNumber(row.consistency),
    // 认知负荷本轮不判（要模型），恒为 null。列留着是为了让「这一维度存在
    // 但本轮没测」这个边界在表里看得见，删掉列反而看不出。
    cognitiveLoad: asNullableNumber(row.cognitive_load),
    usedModel: asBool(row.used_model),
    findingsCount: asNumber(row.findings_count),
    updatedAt: asString(row.updated_at),
  };
}

/** 审计结果的数据访问。 */
export const auditDb = {
  /**
   * 覆盖式写入某一讲的 findings。
   *
   * 为什么整块替换而不是逐条 upsert：审计是「全量重扫」，一轮的结果就是
   * 该讲的当前状态。逐条 upsert 会让上一轮有、这一轮已修的问题永远留在
   * 报告里 —— 而「修好了」本身是这轮最该被看见的结论之一（靠 findings
   * 变少体现，不靠留一条「已修复」的记录）。
   *
   * 单事务：替换失败不能留半份数据。
   */
  replaceModuleFindings(
    moduleId: string,
    findings: readonly Omit<
      AuditFindingRecord,
      "id" | "createdAt" | "updatedAt"
    >[],
  ): void {
    const db = getDb();
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM audit_findings WHERE module_id = ?").run(
        moduleId,
      );
      const insert = db.prepare(
        `INSERT INTO audit_findings (
           id, module_id, module_name, severity, dimension, title,
           evidence, recommendation, fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const finding of findings) {
        insert.run(
          newId(),
          moduleId,
          finding.moduleName,
          finding.severity,
          finding.dimension,
          finding.title,
          finding.evidence,
          finding.recommendation,
          finding.fingerprint,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },

  /** 某讲的 findings，按严重度排序。 */
  listByModule(moduleId: string): AuditFindingRecord[] {
    return (
      getDb()
        .prepare(
          `SELECT * FROM audit_findings WHERE module_id = ?
           ORDER BY CASE severity
             WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
             WHEN 'low' THEN 3 ELSE 4 END, dimension, title`,
        )
        .all(moduleId) as Row[]
    ).map(mapFinding);
  },

  /** 全部 findings，按严重度排序（报告页总览用）。 */
  listAll(): AuditFindingRecord[] {
    return (
      getDb()
        .prepare(
          `SELECT * FROM audit_findings
           ORDER BY CASE severity
             WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
             WHEN 'low' THEN 3 ELSE 4 END, module_id, dimension`,
        )
        .all() as Row[]
    ).map(mapFinding);
  },

  /** 写入/覆盖某一讲的审计总分。 */
  upsertModuleAudit(record: Omit<ModuleAuditRecord, "updatedAt">): void {
    getDb()
      .prepare(
        `INSERT INTO module_audits (
           module_id, module_name, reachability, demo_readability,
           cognitive_load, terminology_gap, consistency, used_model,
           findings_count
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(module_id) DO UPDATE SET
           module_name = excluded.module_name,
           reachability = excluded.reachability,
           demo_readability = excluded.demo_readability,
           cognitive_load = excluded.cognitive_load,
           terminology_gap = excluded.terminology_gap,
           consistency = excluded.consistency,
           used_model = excluded.used_model,
           findings_count = excluded.findings_count,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .run(
        record.moduleId,
        record.moduleName,
        record.reachability,
        record.demoReadability,
        record.cognitiveLoad,
        record.terminologyGap,
        record.consistency,
        fromBool(record.usedModel),
        record.findingsCount,
      );
  },

  listModuleAudits(): ModuleAuditRecord[] {
    return (
      getDb()
        .prepare("SELECT * FROM module_audits ORDER BY module_id")
        .all() as Row[]
    ).map(mapModuleAudit);
  },
};
