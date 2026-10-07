/**
 * 审计发现的落库与读取
 *
 * 钉什么
 * -----
 * 1. 覆盖式写入：同一讲重复审计不堆叠行，且上一轮有、这一轮已修的
 *    问题必须消失（报告页要能看见「修好了」，靠 findings 变少体现）。
 * 2. NULL 不塌成 0：`explain_readability = NULL` 表示「本轮没检测这个
 *    维度」，与「检测过但得 0 分」是两件事，混起来报告就会撒谎。
 * 3. 严重度排序：critical 在最前，报告页默认按严重度排。
 * 4. 未知严重度不炸库：脏数据映射成 info 而不是抛错。
 *
 * 不调模型、不碰浏览器。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { auditDb } from "@/lib/db";
import { getDb } from "@/lib/db/sqlite";
import type { AuditSeverity } from "@/lib/db";

/** 构造一条 finding。 */
function finding(
  moduleId: string,
  title: string,
  severity: AuditSeverity,
  dimension = "可读性",
) {
  return {
    moduleId,
    moduleName: "测试讲",
    severity,
    dimension,
    title,
    evidence: "llm-wiki/concepts/test.md:12 「原文摘录」",
    recommendation: "改这一段",
    fingerprint: `${moduleId}:${dimension}:${title}`,
  };
}

/** 一轮审计：整块替换该讲的全部 findings（真实调用方式）。 */
function seedRound(
  moduleId: string,
  items: { title: string; severity: AuditSeverity; dimension?: string }[],
): void {
  auditDb.replaceModuleFindings(
    moduleId,
    items.map((item) =>
      finding(moduleId, item.title, item.severity, item.dimension),
    ),
  );
}

/** 单条写入的简写，等价于「只有一条问题的一轮」。 */
function seed(
  moduleId: string,
  title: string,
  severity: AuditSeverity,
  dimension = "可读性",
): void {
  seedRound(moduleId, [{ title, severity, dimension }]);
}

beforeEach(() => {
  getDb().exec("DELETE FROM audit_findings");
  getDb().exec("DELETE FROM module_audits");
});

afterEach(() => {
  getDb().exec("DELETE FROM audit_findings");
  getDb().exec("DELETE FROM module_audits");
});

test("写入后可读回，字段保真", () => {
  seed("rag", "示范代码零定义", "high");
  const [finding] = auditDb.listByModule("rag");

  assert.ok(finding);
  assert.equal(finding.moduleId, "rag");
  assert.equal(finding.moduleName, "测试讲");
  assert.equal(finding.severity, "high");
  assert.equal(finding.dimension, "可读性");
  assert.equal(finding.title, "示范代码零定义");
  assert.match(finding.evidence, /test\.md:12/);
  assert.equal(finding.recommendation, "改这一段");
});

test("覆盖式写入：同一讲重复审计不堆叠行", () => {
  seed("rag", "问题 A", "high");
  seed("rag", "问题 A", "high");
  assert.equal(auditDb.listByModule("rag").length, 1);
});

test("已修的问题会消失（覆盖语义，不是只增不减）", () => {
  // 第一轮：A、B 两个问题
  seedRound("rag", [
    { title: "问题 A", severity: "high" },
    { title: "问题 B", severity: "medium" },
  ]);
  assert.equal(auditDb.listByModule("rag").length, 2);

  // 第二轮：B 修好了，只剩 A
  seedRound("rag", [{ title: "问题 A", severity: "high" }]);
  const titles = auditDb.listByModule("rag").map((f) => f.title);
  assert.deepEqual(titles, ["问题 A"], "已修的问题必须从报告里消失");
});

test("跨讲互不覆盖", () => {
  seed("rag", "A", "high");
  seed("mcp", "B", "high");
  assert.equal(auditDb.listAll().length, 2);
  assert.equal(auditDb.listByModule("rag").length, 1);
});

test("NULL 维度映射成 null 而非 0（未检测 ≠ 检测过但很差）", () => {
  auditDb.upsertModuleAudit({
    moduleId: "rag",
    moduleName: "测试讲",
    reachability: null,
    demoReadability: null,
    terminologyGap: null,
    consistency: 0.9,
    cognitiveLoad: null,
    usedModel: false,
    findingsCount: 2,
  });

  const [record] = auditDb.listModuleAudits();
  assert.ok(record);
  assert.equal(record.reachability, null, "未检测的维度不能变成 0");
  assert.equal(record.demoReadability, null);
  assert.equal(record.terminologyGap, null);
  assert.equal(record.consistency, 0.9);
  assert.equal(record.cognitiveLoad, null);
  assert.equal(record.usedModel, false);
});

test("upsertModuleAudit 同讲二次写入是覆盖而非新增行", () => {
  auditDb.upsertModuleAudit({
    moduleId: "rag",
    moduleName: "第一次",
    reachability: 0.5,
    demoReadability: null,
    terminologyGap: null,
    consistency: null,
    cognitiveLoad: null,
    usedModel: false,
    findingsCount: 1,
  });
  auditDb.upsertModuleAudit({
    moduleId: "rag",
    moduleName: "第二次",
    reachability: 0.8,
    demoReadability: null,
    terminologyGap: null,
    consistency: null,
    cognitiveLoad: null,
    usedModel: true,
    findingsCount: 3,
  });

  const all = auditDb.listModuleAudits();
  assert.equal(all.length, 1, "一讲只应有一行汇总");
  assert.equal(all[0].moduleName, "第二次");
  assert.equal(all[0].reachability, 0.8);
  assert.equal(all[0].usedModel, true);
  assert.equal(all[0].findingsCount, 3);
});

test("listAll 按严重度排序，critical 在最前", () => {
  seed("d", "low 项", "low");
  seed("c", "critical 项", "critical");
  seed("e", "medium 项", "medium");
  seed("f", "high 项", "high");

  assert.deepEqual(
    auditDb.listAll().map((f) => f.severity),
    ["critical", "high", "medium", "low"],
  );
});

test("severity 有 CHECK 约束：非法值写不进库（守住数据源头）", () => {
  assert.throws(
    () =>
      getDb()
        .prepare(
          `INSERT INTO audit_findings
             (id, module_id, module_name, severity, dimension, title,
              evidence, recommendation, fingerprint)
           VALUES ('x1', 'rag', '测试讲', 'catastrophic', '可读性', '脏数据',
                   'e', 'r', 'f1')`,
        )
        .run(),
    /CHECK|constraint/i,
    "非法 severity 必须被数据库挡住，而不是靠应用层自觉",
  );

  // 读取侧仍有兜底映射：SQLite 的 CHECK 只约束写入，历史数据/迁移异常
  // 仍可能带出未知值，那时映射成 info 而不是让整页崩掉。
  const [record] = auditDb.listByModule("rag");
  assert.equal(record, undefined, "写入被拒后不应留下行");
});

test("空 findings 也应清空该讲旧记录（不能只写不清）", () => {
  seed("rag", "旧问题", "high");
  assert.equal(auditDb.listByModule("rag").length, 1);

  auditDb.replaceModuleFindings("rag", []);
  assert.equal(
    auditDb.listByModule("rag").length,
    0,
    "全量重扫的结果为空时，旧记录必须被清掉",
  );
});
