/**
 * 课程审计的确定性检查器
 *
 * 为什么是确定性检查而不是调模型
 * ------------------------------
 * 2026-10-07 的扇出审计（10 讲，学生子智能体 + 独立裁判）抓出的缺陷里，
 * 有一批**不需要判断力就能判定**，判据是结构与计数：
 *
 * - 讲稿缓存缺「现在轮到你」任务节 → 任务卡整卡不渲染（上一轮的 C2）
 * - 概念页「## 示范代码」节只有代码、夹在代码块之间的说明会被丢弃
 * - 讲稿要求用某语法，但该语法在讲稿/概念页里一次都没出现过（超纲）
 * - 讲稿里出现术语却从未定义（术语断层）
 * - 概念页与讲稿的核心机制不重合（内容不一致）
 *
 * 这类判据交给模型只会得到「感觉不太对」这类不可复核的结论，且每次
 * 跑出来都不一样。**能确定性判定的就不烧 token** —— 这是本文件存在的
 * 全部理由。判断类的维度（讲稿好不好懂）留给模型，另行编排。
 *
 * 每个 finding 的 evidence 必须能独立复核：文件路径 + 行号 + 原文摘录。
 * 写不出这三样的，不报 —— 宁可漏报也不报「感觉不对」。
 *
 * 本文件是纯函数 + 只读文件，不 import 数据库、不调模型、不碰浏览器。
 */

import { createHash } from "node:crypto";

import { segmentByCode } from "@/lib/markdown";
import { splitLecture } from "@/lib/lecture-split";
import type { AuditSeverity } from "@/lib/db";

// ---------------------------------------------------------------------------
// 输入类型（与调用方解耦：编排层从 wiki / lecture_cache 取料后传进来）
// ---------------------------------------------------------------------------

export interface AuditSubject {
  moduleId: string;
  moduleName: string;
  /** 概念页全文（llm-wiki/concepts/<id>.md）。 */
  conceptPage: string;
  /** 概念页里 `## 示范代码` 小节的内容。 */
  demoCode: string;
  /** explain 步讲稿缓存；null = 本轮没缓存。 */
  lecture: string | null;
  /**
   * 课程顺序里排在**前面**的各讲讲稿正文（已截掉任务节，可选）。
   *
   * 术语是跨讲累积的：Agent 在 agent-loop 讲正式定义，后面的讲再用就不算
   * 断层。没有这个字段时（单讲审计），只看本讲 —— 那会对课程后段误报。
   */
  earlierTeachings?: string;
}

/** 代码类构造：讲稿「教过」与「要求用」的判定词表。 */
const SYNTAX_TERMS = [
  "interface",
  "async",
  "await",
  "const",
  "let",
  "import",
  "export",
  "def",
  "lambda",
  "function",
  "=>",
  "as string",
  "Promise<",
  "try/catch",
] as const;

/** 零基础学生不该被默认要求掌握、但讲稿可能直接用的词。 */
const CONCEPT_TERMS = [
  "Agent",
  "token",
  "embedding",
  "向量",
  "MCP Client",
  "MCP Server",
  "JSON-RPC",
  "frontmatter",
  "schema",
  "上下文",
  "熔断",
] as const;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 幂等键：(讲, 维度, 标题)。同一问题重复审计不堆叠行。 */
export function fingerprintOf(
  moduleId: string,
  dimension: string,
  title: string,
): string {
  return createHash("sha256")
    .update(`${moduleId}\0${dimension}\0${title}`)
    .digest("hex")
    .slice(0, 16);
}

export interface RawFinding {
  severity: AuditSeverity;
  dimension: string;
  title: string;
  evidence: string;
  recommendation: string;
}

/**
 * 概念页里「小节标题所在行号」。
 *
 * evidence 要能被复核，就得能指到具体位置 —— 只说「第 X 节有问题」，
 * 复核者还得自己找。
 */
function lineOfSection(page: string, heading: string): number {
  const lines = page.split("\n");
  const index = lines.findIndex((line) => line.trimStart().startsWith(heading));
  return index === -1 ? 0 : index + 1;
}

/** 计数（含大小写不敏感的子串计数）。 */
function countOf(haystack: string, needle: string): number {
  if (needle === "") return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (haystack.match(new RegExp(escaped, "gi")) ?? []).length;
}

/** 取包含关键词的首行原文，供 evidence 摘录（截断到 80 字符）。 */
function excerptOf(haystack: string, needle: string): string {
  const line = haystack.split("\n").find((l) => l.includes(needle));
  if (line === undefined) return "";
  const trimmed = line.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

/**
 * 术语是否在讲稿里被**当作独立词**使用。
 *
 * 与 `countOf` 的区别：中文没有词边界，`上下文` 是「模型上下文协议」的
 * 子串 —— 按子串数会把「只是在 longer 词组里路过」也算成被使用，从而漏报。
 * 这里要求前后不是「构成更长词」的汉字。
 *
 * 排除的构成字：修饰性汉字（模 / 上 / 下 / 前 / 后 / 内 / 外）与常见后缀。
 * 刻意保守：宁可少算一次使用（多报一点），也不要虚报术语在用。
 */
const NON_STANDALONE_BEFORE = /[模上 下前后内外]/;
const NON_STANDALONE_AFTER = /[协议境]/;

function countStandalone(haystack: string, term: string): number {
  let count = 0;
  let index = haystack.indexOf(term);
  while (index !== -1) {
    const before = index === 0 ? "" : (haystack[index - 1] ?? "");
    const after = haystack[index + term.length] ?? "";
    if (
      !NON_STANDALONE_BEFORE.test(before) &&
      !NON_STANDALONE_AFTER.test(after)
    ) {
      count += 1;
    }
    index = haystack.indexOf(term, index + term.length);
  }
  return count;
}

/**
 * 讲稿里是否有解释该术语的句式。
 *
 * 覆盖三类真实形态（都是 2026-10-07 逐条核实讲稿原文后加进来的）：
 * - `X 就是 …` / `X 是 …` —— 直接定义
 * - `先给大白话定义：**X …` —— 讲稿用固定格式声明「接下来定义」
 * - `X（解释）` —— 括号内联解释，如「设熔断（停止条件）」
 */
function isDefinedSomewhere(teaching: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    // 直接定义
    new RegExp(`${escaped}\\s*(是|就是|指|叫做|意味着|可以理解|可以记成|即)`),
    new RegExp(`(所谓|什么是|怎么理解)\\s*${escaped}`),
    // 讲稿自述的「我要定义它」格式
    new RegExp(`(大白话|人话|简单说)[^。\\n]{0,12}${escaped}`),
    // 括号内联解释：紧跟全角/半角括号且括号里有实质内容
    new RegExp(`${escaped}\\s*[（(]\\s*[^）)]{2,}\\s*[）)]`),
  ];
  return patterns.some((pattern) => pattern.test(teaching));
}

// ---------------------------------------------------------------------------
// 各项检查
// ---------------------------------------------------------------------------

/**
 * 检查 1：讲稿缓存缺任务节。
 *
 * 这就是上一轮的 C2（11/11 模块全中）—— 任务卡取不到任务节就整卡不渲染，
 * 学生面对空编辑器。判据复用渲染层同一个 `splitLecture`，避免两处口径漂移。
 *
 * 讲稿由专属工作区承载的模块（复刻：六阶段任务卡 + 概念页手册）刻意不设
 * 讲稿缓存，缺失不算缺陷 —— 名单与 `learn/[moduleId]/page.tsx` 的路由分流
 * 对应，那边的分支多了要同步这里。
 */
const LECTURE_LESS_MODULES = new Set(["platform-replica"]);

function checkTaskSection(subject: AuditSubject): RawFinding[] {
  if (subject.lecture === null) {
    if (LECTURE_LESS_MODULES.has(subject.moduleId)) return [];
    return [
      {
        severity: "high",
        dimension: "可达性",
        title: "本轮无 explain 讲稿缓存",
        evidence: `lecture_cache 表无 ${subject.moduleId}/explain 行；讲解步会回退实时生成，学生首次进入需等待模型`,
        recommendation: "跑 `node scripts/generate-lecture-cache.ts` 预生成",
      },
    ];
  }

  const { assignment } = splitLecture(subject.lecture);
  if (assignment !== null) return [];

  return [
    {
      severity: "critical",
      dimension: "可达性",
      title: "讲稿缓存缺「现在轮到你」任务节",
      evidence: `splitLecture(${subject.moduleId}) 返回 assignment = null；讲稿共 ${subject.lecture.length} 字符，末尾为「${subject.lecture.trimEnd().slice(-40)}」。assignment-card 取不到任务节就整卡不渲染，学生面对空编辑器（2026-10-07 试点的 C2）`,
      recommendation:
        "重跑 `node scripts/generate-lecture-cache.ts --force`；若仍缺，检查生成器的结构守卫是否拒写",
    },
  ];
}

/**
 * 检查 2：示范代码节只有代码、没有面向学生的说明。
 *
 * 扇出审计在 8/10 讲命中：概念页明明写了类比（multi-agent 的「招聘」、
 * llm-wiki 的「微波炉」、rag 的「你不用懂怎么算」），但观察面板原先只
 * 渲染代码块（已由 `61d1469` 修好）。
 *
 * 这个检查盯的是**内容侧**的对应问题：某一讲的示范代码节若只有光秃秃
 * 的代码，那类比就是缺失而非被丢弃 —— 修渲染层救不回来。
 */
function checkDemoCodeProse(subject: AuditSubject): RawFinding[] {
  if (subject.demoCode.trim() === "") {
    return [
      {
        severity: "high",
        dimension: "内容一致性",
        title: "概念页缺「## 示范代码」小节",
        evidence: `readDemoCode(${subject.moduleId}) 返回空串；观察步会显示「示范代码准备中」占位，学生看不到任何示范`,
        recommendation: `在 llm-wiki/concepts/${subject.moduleId}.md 补「## 示范代码」小节`,
      },
    ];
  }

  const segments = segmentByCode(subject.demoCode);
  const prose = segments.filter((s) => s.kind === "prose");
  if (prose.length > 0) return [];

  return [
    {
      severity: "medium",
      dimension: "可读性",
      title: "示范代码节没有任何面向学生的说明",
      evidence: `llm-wiki/concepts/${subject.moduleId}.md:${lineOfSection(subject.conceptPage, "## 示范代码")} 的「## 示范代码」小节共 ${segments.length} 个代码块、0 段散文。零基础学生看到的是一段没有解释的代码 —— 其他讲在这一节都用「👉 你不需要懂 X，就像用微波炉不用懂磁控管」这类句式`,
      recommendation:
        "在第一个代码块前加一段说明：这段代码解决什么问题、以及哪些部分学生不需要理解",
    },
  ];
}

/**
 * 检查 3：任务节要求的语法在讲稿里从未教过。
 *
 * 上一轮试点出现过「讲稿只教 3 个概念、任务却要求写 interface」。判据是
 * 纯计数：任务节出现某语法、而讲稿与概念页正文里一次都没有。
 */
function checkSyntaxBeyondTaught(subject: AuditSubject): RawFinding[] {
  if (subject.lecture === null) return [];
  const { assignment } = splitLecture(subject.lecture);
  if (assignment === null) return [];

  const taught = `${subject.lecture.replace(assignment, "")}\n${subject.conceptPage}`;
  const findings: RawFinding[] = [];

  for (const term of SYNTAX_TERMS) {
    const inAssignment = countOf(assignment, term);
    if (inAssignment === 0) continue;
    const inTaught = countOf(taught, term);
    if (inTaught > 0) continue;

    findings.push({
      severity: "high",
      dimension: "术语断层",
      title: `任务要求用「${term}」，但本讲从未教过`,
      evidence: `讲稿任务节出现 ${inAssignment} 次「${term}」，而讲稿正文与概念页合计 0 次；本讲教过的语法里没有它。学生在任务里第一次见到这个词（试点已出现过同类缺陷：讲稿只教 3 个概念却要求写 interface）`,
      recommendation: `要么在讲稿里补讲 ${term}，要么把任务改用本讲已教过的语法`,
    });
  }

  return findings;
}

/**
 * 检查 4：讲稿里的核心术语从未定义。
 *
 * 判据刻意保守：只查**本讲核心机制**的词，且要求讲稿里找不到任何解释性
 * 句式。词汇表是手工维护的（与 `knowledge-window.ts` 同源的取舍），加词
 * 必须同步 —— 所以只在确定的地方报，宁可漏报。
 *
 * 误报实测与修正（2026-10-07）
 * ------------------------
 * 第一版粗判漏掉了三种「其实定义了」的形态，逐条核实讲稿原文后补上：
 * ① `**先给大白话定义：**Agent Loop 就是 …` —— 讲稿用固定格式声明「我要
 *    定义了」，不写成 `Agent 是`。原判据只看 `X 是`，于是 agent-loop 误报。
 * ② `**MCP**（Model Context Protocol，模型上下文协议，你可以把它记成「万能插座」）`
 *    —— 「上下文」只是复合词的一部分，不是术语被使用。原判据数的是子串。
 * ③ 括号内联解释：`设熔断（停止条件）` 里「停止条件」就是解释。
 *
 * ②的修法是**按独立词计**：`上下文` 单独出现在讲稿里才算被使用；只出现在
 * 「模型上下文协议」这类更长词组里不计数。这消掉了 mcp / llm-api 的误报。
 */
function checkUndefinedTerms(subject: AuditSubject): RawFinding[] {
  if (subject.lecture === null) return [];
  const { teaching } = splitLecture(subject.lecture);
  const findings: RawFinding[] = [];

  for (const term of CONCEPT_TERMS) {
    const standalone = countStandalone(teaching, term);
    if (standalone === 0) continue;
    // 定义可以是本讲给的，也可以是课程前面任何一讲给的 —— 术语教学是
    // 跨讲累积的，逐讲独立判定会对课程后段全量误报（Agent 在 5 讲命中 4 讲）。
    if (isDefinedSomewhere(teaching, term)) continue;
    if (
      subject.earlierTeachings !== undefined &&
      isDefinedSomewhere(subject.earlierTeachings, term)
    ) {
      continue;
    }

    findings.push({
      severity: "medium",
      dimension: "术语断层",
      title: `「${term}」在讲稿中出现 ${standalone} 次但从未定义`,
      evidence: `讲稿正文（去掉任务节后）${term} 作为独立词出现 ${standalone} 次，全文没有一句解释它是什么；首处摘录：「${excerptOf(teaching, term) || "（无摘录）"}」。扇出审计实测同类：ai-safety 的「熔断」在第一节叫「停止条件」、第二节改叫「熔断」，讲稿从不说两者是同一事物 —— 直到学生提问，导师才补「你没理解错，就是一回事」`,
      recommendation: `在首次出现处补一句生活化定义（先类比后定义），或改用已教过的说法`,
    });
  }

  return findings;
}

/**
 * 检查 5：讲稿与概念页的内容不重合。
 *
 * 扇出审计的高频项（8/10 讲）：讲稿讲一套、概念页与示范代码讲另一套，
 * 而两边都不给映射（ai-safety：概念页的「四层闸门 / 五类风险 / 机场安检」
 * 在讲稿中零出现）。
 *
 * 判据两次踩坑才定下来，记录在此免得再犯
 * ------------------------------------
 * ① 先试「拿概念页小节标题去讲稿里找字面」—— **8/11 讲全部误报**。
 *    逐条核实发现讲稿与概念页其实高度一致，只是**标题措辞不同**：
 *    概念页叫「常见模式」，讲稿叫「三、怎么分工」；概念页叫
 *    「为什么需要工具？」，讲稿叫「一、为什么需要」。字面 0 命中 ≠ 内容不重合。
 *    （教训同「测试守性质不守快照」：判据要抓实质，不能抓字面形状。）
 * ② 改用「概念页里的实义词是否在讲稿出现」—— 仍然太宽，标题里的
 *    通用词（常见、模式、示例）谁都能命中，等于没判。
 *
 * 现在只查**可判定的具体事实**：概念页的「示范代码」小节是否在讲稿里
 * 被提及为这一讲的内容，以及概念页列出的**具体数字/专有名词**（四层、
 * 五类、场景 A）是否在讲稿出现 —— 这类是内容层面的承诺，缺失就是缺失。
 * 抽象的「讲得不一样」判不了，交给模型或人工，本文件不报。
 */
function checkConsistency(subject: AuditSubject): RawFinding[] {
  if (subject.lecture === null) return [];
  const { teaching } = splitLecture(subject.lecture);

  const findings: RawFinding[] = [];

  // ① 概念页承诺的「具体机制承诺词」：形如「四层」「五类」「场景 A」
  //    「三个致命缺点」这类**可数的具体承诺**。讲稿里零出现 = 内容缺口。
  const promises = [
    ...subject.conceptPage.matchAll(
      /(四层|五类|三层|三层防线|场景\s*[A-Z]|[一二三四五六七八九]\s*大|三个致命|四大|五个|三个常见)/g,
    ),
  ].map((m) => m[0]);

  const uniquePromises = [...new Set(promises)];
  const missingPromises = uniquePromises.filter(
    (p) => countOf(teaching, p) === 0,
  );

  if (
    uniquePromises.length >= 2 &&
    missingPromises.length / uniquePromises.length >= 0.6
  ) {
    findings.push({
      severity: "high",
      dimension: "内容一致性",
      title: `概念页承诺的机制结构在讲稿中缺失（${missingPromises.length}/${uniquePromises.length} 项零出现）`,
      evidence: `概念页出现具体机制承诺「${uniquePromises.join("、")}」，其中「${missingPromises.join("、")}」在讲稿正文里一次都没出现。概念页承诺的结构（几层/几类/几个场景）是学生预期会学到的清单，讲稿不讲就等于没有`,
      recommendation:
        "讲稿补上这些机制结构，或调整概念页不再承诺它们 —— 两边口径必须对上",
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

export interface DeterministicAuditResult {
  moduleId: string;
  moduleName: string;
  findings: RawFinding[];
  /** 各维度得分 0-1；null = 本轮未检测。 */
  scores: {
    /** 任务节可达性：有任务节 = 1，缺失 = 0。 */
    reachability: number | null;
    /** 示范代码可读性：有说明散文 = 1，只有代码 = 0.4，无示范节 = 0。 */
    demoReadability: number | null;
    /** 术语断层：按未定义术语数扣分，每处 0.25。 */
    terminologyGap: number | null;
    /** 内容一致性：完全重合 = 1，不重合 = 0。 */
    consistency: number | null;
  };
}

/**
 * 对一讲跑完全部确定性检查。
 *
 * 刻度与 `curriculum-audit.ts` 的裁判评分对齐（0-1），便于把产品内审计员
 * 的结论与开发期子智能体裁判的结论放在同一张表上比。
 */
export function auditSubjectDeterministically(
  subject: AuditSubject,
): DeterministicAuditResult {
  const taskFindings = checkTaskSection(subject);
  const demoFindings = checkDemoCodeProse(subject);
  const syntaxFindings = checkSyntaxBeyondTaught(subject);
  const termFindings = checkUndefinedTerms(subject);
  const consistencyFindings = checkConsistency(subject);

  const findings = [
    ...taskFindings,
    ...demoFindings,
    ...syntaxFindings,
    ...termFindings,
    ...consistencyFindings,
  ];

  const hasDemoSection = subject.demoCode.trim() !== "";
  const demoReadability = hasDemoSection
    ? demoFindings.length === 0
      ? 1
      : 0.4
    : 0;

  const syntaxPenalty = 0.25 * syntaxFindings.length;
  const termPenalty = 0.2 * termFindings.length;

  return {
    moduleId: subject.moduleId,
    moduleName: subject.moduleName,
    findings,
    scores: {
      reachability: taskFindings.length === 0 ? 1 : 0,
      demoReadability,
      terminologyGap:
        subject.lecture === null
          ? null
          : Math.max(0, 1 - syntaxPenalty - termPenalty),
      consistency:
        subject.lecture === null
          ? null
          : consistencyFindings.length === 0
            ? 1
            : 0,
    },
  };
}

/** 供编排层复用的检查项清单（前端报告页按这个维度分组显示）。 */
export const AUDIT_DIMENSIONS = [
  "可达性",
  "可读性",
  "术语断层",
  "内容一致性",
] as const;
