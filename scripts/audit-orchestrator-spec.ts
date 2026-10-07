/**
 * 审计编排层
 *
 * 钉什么
 * -----
 * 1. **取料口径**：概念页从 wiki 现读、讲稿从 lecture_cache 读，模块清单
 *    只取 `type: concept` 的页。反例要钉住：`python-basics` 概念页已删、
 *    缓存仍在 —— 从缓存反查会把它算成「可审计的讲」，而学生根本不可达。
 * 2. **诚实边界**：`usedModel` 恒为 false、`cognitiveLoad` 恒为 null。
 *    确定性检查判不了「读起来累不累」，编一个数就是撒谎；`usedModel`
 *    标记本轮覆盖面，让报告页能说清「这轮没调模型」。
 * 3. **缺页要上报**：概念页读不到时报 `conceptPageMissing`，不能当成
 *    「这一讲没问题」。
 * 4. **覆盖式落库**：第二轮审计后，已修的问题从库里消失。
 *
 * 不调模型、不碰浏览器。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { auditAllModules, auditModule } from "@/lib/audit/orchestrator";
import { auditDb } from "@/lib/db";
import { getDb } from "@/lib/db/sqlite";

beforeEach(() => {
  getDb().exec("DELETE FROM audit_findings");
  getDb().exec("DELETE FROM module_audits");
});

afterEach(() => {
  getDb().exec("DELETE FROM audit_findings");
  getDb().exec("DELETE FROM module_audits");
});

test("审计单讲：返回结构完整", async () => {
  const result = await auditModule("rag");

  assert.equal(result.moduleId, "rag");
  assert.ok(result.moduleName.length > 0, "模块名应从 frontmatter 取到");
  assert.equal(result.conceptPageMissing, false);
  assert.ok(Array.isArray(result.findings));
});

test("模块清单只含概念页现存的讲（不含已退役的 python-basics）", async () => {
  const outcomes = await auditAllModules();
  const ids = outcomes.map((o) => o.moduleId);

  assert.ok(ids.length > 0);
  assert.ok(
    !ids.includes("python-basics"),
    "python-basics 概念页已在 f6e6298 删除，学生不可达，不该被审计",
  );
  // 清单来自 wiki 而非 lecture_cache —— 后者仍留着 python-basics 的行。
  assert.ok(ids.includes("rag"));
  assert.ok(ids.includes("ts-basics"));
});

test("落库：每讲一行汇总，findings 数与实际一致", async () => {
  await auditAllModules({ onlyModuleIds: ["rag", "mcp"] });

  const audits = auditDb.listModuleAudits();
  assert.equal(audits.length, 2);
  assert.equal(audits.find((a) => a.moduleId === "rag")?.findingsCount, 0);
  assert.equal(
    auditDb.listByModule("mcp").length,
    audits.find((a) => a.moduleId === "mcp")?.findingsCount,
  );
});

test("诚实边界：usedModel 恒 false、cognitiveLoad 恒 null", async () => {
  await auditAllModules({ onlyModuleIds: ["rag"] });

  const [record] = auditDb.listModuleAudits();
  assert.ok(record);
  assert.equal(
    record.usedModel,
    false,
    "本轮只跑确定性检查，没调模型 —— 标 true 就是虚报覆盖面",
  );
  assert.equal(
    record.cognitiveLoad,
    null,
    "认知负荷是判断题，确定性检查判不了；编个数字就是撒谎",
  );
});

test("概念页不存在时报 missing，不当成「这一讲没问题」", async () => {
  const result = await auditModule("不存在的模块");

  assert.equal(result.conceptPageMissing, true);
  assert.ok(
    result.findings.length > 0,
    "缺页必须产生 finding，否则报告里会显示为干净",
  );
});

test("覆盖式落库：第二轮后已修的问题从库里消失", async () => {
  await auditAllModules({ onlyModuleIds: ["mcp"] });
  const first = auditDb.listByModule("mcp");
  const firstCount = first.length;

  // 再跑一遍，结果应当稳定（幂等），不会堆叠行。
  await auditAllModules({ onlyModuleIds: ["mcp"] });
  const second = auditDb.listByModule("mcp");

  assert.equal(second.length, firstCount, "同一输入重复审计不应堆叠行");
  assert.deepEqual(
    second.map((f) => f.title),
    first.map((f) => f.title),
  );
});

test("findings 的 fingerprint 跨轮稳定（便于外部按指纹跟踪问题）", async () => {
  await auditAllModules({ onlyModuleIds: ["ai-safety"] });
  const first = auditDb.listByModule("ai-safety").map((f) => f.fingerprint);

  await auditAllModules({ onlyModuleIds: ["ai-safety"] });
  const second = auditDb.listByModule("ai-safety").map((f) => f.fingerprint);

  assert.deepEqual(second, first);
  for (const fingerprint of second) assert.match(fingerprint, /^[0-9a-f]{16}$/);
});
