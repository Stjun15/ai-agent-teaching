/**
 * 课程审计的编排层
 *
 * 一次审计 = 取料 → 跑确定性检查 → 落库
 *
 * 为什么不需要浏览器（2026-10-07 的设计修正）
 * -------------------------------------------
 * HANDOVER 10-06 的方案要求 Playwright 驱动真实页面。扇出审计跑完之后
 * 结论变了：**可读性 / 可及性 / 术语断层这三类根本不需要渲染页面** ——
 * 概念页是构建期直读的、讲稿在 `lecture_cache` 表里、内容一致性是两份
 * 文本的对账。全都是文件与数据库。
 *
 * 需要浏览器的只有「页面可达性」（元素有没有真的渲染出来）。那一项交给
 * 开发期的子智能体走查（`student-agent-output/fanout/`），不产品化 ——
 * 课程内容是构建期固定的，运行时不会变，没有理由每次审计都起浏览器。
 *
 * 诚实的边界：确定性检查覆盖不到「讲稿讲得好不好」。那是判断题，交给模型
 * 或人工。本文件产出的是「结构缺陷」，不是「教学质量评价」——
 * `usedModel: false` 就是这条边界的标记，不假装覆盖面更宽。
 */

import {
  auditSubjectDeterministically,
  fingerprintOf,
  type AuditSubject,
} from "@/lib/audit/deterministic";
import { auditDb, lectureCacheDb, type AuditSeverity } from "@/lib/db";
import { splitLecture } from "@/lib/lecture-split";
import { loadModules } from "@/lib/modules";
import { readDemoCode } from "@/lib/teaching-script";
import { listPages, readPageSync } from "@/wiki";

/** 一讲的审计产出。 */
export interface ModuleAuditOutcome {
  moduleId: string;
  moduleName: string;
  /** 本轮没产出任何 finding —— 不代表这一讲没问题，只代表这五项确定性检查没命中。 */
  clean: boolean;
  findingCount: number;
  scores: {
    reachability: number | null;
    demoReadability: number | null;
    terminologyGap: number | null;
    consistency: number | null;
  };
}

/** 审计一讲的完整结果（含全部 finding，供 API 直接返回）。 */
export interface AuditRunResult {
  moduleId: string;
  moduleName: string;
  findings: {
    severity: AuditSeverity;
    dimension: string;
    title: string;
    evidence: string;
    recommendation: string;
  }[];
  scores: ModuleAuditOutcome["scores"];
  /** 概念页读不到时为 true —— 这种情况必须报出来，不能静默跳过。 */
  conceptPageMissing: boolean;
}

/**
 * 审计一讲。
 *
 * 取料口径与运行时一致：模块清单从概念页 frontmatter 现读（`loadModules`），
 * 讲稿从 `lecture_cache` 读 —— 不另抄一份模块表（AGENTS.md 明令：会立刻产生
 * 第三份数据）。
 */
export async function auditModule(
  moduleId: string,
  options?: { earlierTeachings?: string },
): Promise<AuditRunResult> {
  let conceptPage = "";
  let moduleName = moduleId;
  let conceptPageMissing = false;

  try {
    const page = readPageSync(`concepts/${moduleId}.md`);
    conceptPage = page.body;
    // frontmatter 的值类型是联合类型，name 实际总是字符串 —— 窄一下再取。
    const name = page.frontmatter.name;
    moduleName = typeof name === "string" && name !== "" ? name : moduleId;
  } catch {
    // 概念页不存在要如实上报，不能当成「这一讲没问题」—— 那会让缺页的讲
    // 在报告里显示为干净。
    conceptPageMissing = true;
  }

  const cache = await lectureCacheDb.get(moduleId, "explain");

  const subject: AuditSubject = {
    moduleId,
    moduleName,
    conceptPage,
    demoCode: conceptPageMissing ? "" : readDemoCode(moduleId),
    lecture: cache?.content ?? null,
    earlierTeachings: options?.earlierTeachings,
  };

  const result = auditSubjectDeterministically(subject);
  return {
    moduleId,
    moduleName,
    findings: result.findings,
    scores: result.scores,
    conceptPageMissing,
  };
}

/**
 * 审计全部模块并落库。
 *
 * 覆盖式写入（`replaceModuleFindings`）：一轮全量重扫的结果就是当前状态，
 * 已修的问题必须从报告里消失。
 *
 * `onlyModuleIds` 缺省为「概念页里现存的全部模块」—— 从 wiki 现读而不是
 * 从缓存表反查：缓存里可能留着已退役模块（`python-basics` 概念页已删、
 * 缓存仍在），那类模块学生根本不可达，审它是浪费。
 */
export async function auditAllModules(options?: {
  onlyModuleIds?: readonly string[];
}): Promise<ModuleAuditOutcome[]> {
  const moduleIds = options?.onlyModuleIds ?? (await listAuditableModuleIds());

  // 术语跨讲累积：按课程顺序（prerequisites 拓扑序，与学习页同源）把每讲
  // 之前已讲过的讲稿正文收进池子，随 subject 传下去 —— Agent 在 agent-loop
  // 讲正式定义，课程后段再用就不算断层，逐讲独立判定会全量误报。
  // 池子的取料口径与术语检查自身一致：splitLecture 的 teaching 部分。
  const ordered = await loadModules();
  const earlierPool = new Map<string, string>();
  let accumulated = "";
  for (const teachingModule of ordered) {
    earlierPool.set(teachingModule.id, accumulated);
    const cached = await lectureCacheDb.get(teachingModule.id, "explain");
    if (cached !== null) {
      accumulated +=
        (accumulated === "" ? "" : "\n\n") +
        splitLecture(cached.content).teaching;
    }
  }

  const outcomes: ModuleAuditOutcome[] = [];
  for (const moduleId of moduleIds) {
    const result = await auditModule(moduleId, {
      earlierTeachings: earlierPool.get(moduleId) ?? "",
    });

    auditDb.replaceModuleFindings(
      moduleId,
      result.findings.map((finding) => ({
        moduleId,
        moduleName: result.moduleName,
        severity: finding.severity,
        dimension: finding.dimension,
        title: finding.title,
        evidence: finding.evidence,
        recommendation: finding.recommendation,
        fingerprint: fingerprintOf(moduleId, finding.dimension, finding.title),
      })),
    );

    auditDb.upsertModuleAudit({
      moduleId,
      moduleName: result.moduleName,
      reachability: result.scores.reachability,
      demoReadability: result.scores.demoReadability,
      // 认知负荷要模型判「这一讲读起来累不累」，确定性检查判不了。
      // 写 null 而不是编一个数 —— 报告页会显示「未检测」而不是假分数。
      cognitiveLoad: null,
      terminologyGap: result.scores.terminologyGap,
      consistency: result.scores.consistency,
      // 明确标记：这一轮没调模型，覆盖面就是这五项确定性检查。
      usedModel: false,
      findingsCount: result.findings.length,
    });

    outcomes.push({
      moduleId,
      moduleName: result.moduleName,
      clean: result.findings.length === 0 && !result.conceptPageMissing,
      findingCount: result.findings.length,
      scores: result.scores,
    });
  }

  return outcomes;
}

/**
 * 可审计的模块清单：从 `llm-wiki/concepts/` 的实际页面现读。
 *
 * 不用 `lecture_cache` 反查 —— 那里留着已退役模块的行（`python-basics`
 * 概念页已删、缓存仍在，学生不可达）。
 * 不用硬编码常量表 —— 那会变成第三份模块数据（AGENTS.md 明令禁止）。
 * 只取 `type: concept` 的页：concepts/ 下的其他页面不是教学讲。
 */
async function listAuditableModuleIds(): Promise<string[]> {
  const pages = await listPages();
  return pages
    .filter((page) => page.frontmatter.type === "concept")
    .map((page) => page.frontmatter.id)
    .filter((id): id is string => typeof id === "string" && id !== "")
    .sort();
}
