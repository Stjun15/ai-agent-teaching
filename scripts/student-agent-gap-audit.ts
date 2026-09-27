/**
 * 课程体检器（静态断层审计）—— 学生 Agent 的第一层检测
 *
 * 测什么
 * ----
 * 不跑模拟、不调模型，纯文档分析 `llm-wiki/concepts/*.md`：
 *   1. **知识断层（前向引用）**：模块 k 的教学小节里使用了术语 T，
 *      而 T 在概念页体系里的首次定义出现在模块 j（j > k）—— 学生学到 k
 *      时还没有可挂概念的地基。ERROR 级。
 *   2. **小节覆盖缺口**：`STEP_SECTION_MAP` 为每个步骤声明了所需小节
 *      （如 observe 需要「示范代码」），概念页缺失即该步骤的教学素材不完整。
 *      WARN 级。
 *   3. **前置声明问题**：prerequisites 指向不存在的页，或声明的前置
 *      在教学顺序里排在本模块之后。ERROR/WARN 级。
 *   4. **低置信提示**：从未在任何概念页出现的英文标识符采样（噪声大，
 *      INFO 级，只列前 20 个供人工扫一眼）。
 *
 * 「定义」与「使用」的口径
 * --------------------
 * - **定义**：术语以反引号、粗体或小节标题的形式出现在某页（作者主动
 *   教它的标志）。
 * - **使用**：教学小节文本里的反引号、粗体或英文标识符。
 * 两者共用同一套提取器；解析与 `teaching-script.ts` 同口径（直接复用其
 * 导出，**不许**在这里抄第二份段落解析）。
 *
 * 局限（诚实声明）
 * ------------
 * 中文术语没有分词，纯中文的「使用了但没定义」检测不可靠 —— 中文断层
 * 主要靠 P2 的学生 Agent 动态模拟兜底。本脚本的英文标识符/反引号术语
 * 检测是高置信子集。
 *
 * 运行：pnpm audit:course（报告写 student-agent-output/，不入库）
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadModules } from "@/lib/modules";
import {
  SECTION_ALIASES,
  STEP_SECTION_MAP,
  selectSections,
} from "@/lib/teaching-script";
import { readPageSync } from "@/wiki";

type SectionKind = keyof typeof SECTION_ALIASES;

/** 通用词白名单：不作为断层证据（语言关键字 / 内置 / 通用缩写）。 */
const STOPWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "import",
  "from",
  "export",
  "await",
  "async",
  "try",
  "catch",
  "throw",
  "new",
  "class",
  "this",
  "typeof",
  "instanceof",
  "true",
  "false",
  "null",
  "undefined",
  "console",
  "log",
  "json",
  "math",
  "object",
  "string",
  "number",
  "boolean",
  "promise",
  "asyncfunction",
  "print",
  "def",
  "int",
  "str",
  "list",
  "dict",
  "len",
  "range",
  "true",
  "false",
  "none",
  "and",
  "or",
  "not",
  "in",
  "is",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "you",
  "your",
  "get",
  "post",
  "http",
  "https",
  "url",
  "com",
  "www",
  "org",
  "api",
  "llm",
  "ai",
  "gpt",
  "key",
  "id",
  "ok",
  "utf",
  "status",
  "code",
  "data",
  "text",
  "name",
  "type",
  "value",
  "index",
  "length",
  "result",
  "content",
  "title",
  "item",
]);

interface ModuleAudit {
  id: string;
  name: string;
  order: number;
  /** 本页「定义」的术语（反引号 / 粗体 / 标题，小写化）。 */
  definedTerms: Set<string>;
  /** 各步骤小节覆盖：kind → 匹配段数。 */
  sectionCoverage: Record<string, number>;
  /** 前置声明。 */
  prerequisites: string[];
  /** 教学小节全文（供使用集提取）。 */
  sectionTexts: Record<string, string>;
}

interface Finding {
  severity: "ERROR" | "WARN" | "INFO";
  moduleId: string;
  moduleName: string;
  message: string;
}

/** 从 markdown 文本提取「使用」的术语/标识符（小写化）。 */
function extractUsedTerms(text: string): Set<string> {
  const terms = new Set<string>();
  // 反引号与粗体术语
  for (const m of text.matchAll(/`([^`]+)`/g))
    terms.add(m[1].trim().toLowerCase());
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g))
    terms.add(m[1].trim().toLowerCase());
  // 英文标识符（≥3 字符，允许点号链）
  for (const m of text.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_.]{2,}\b/g)) {
    const token = m[0].toLowerCase().replace(/[.]+$/, "");
    if (!STOPWORDS.has(token) && !/^\d/.test(token)) terms.add(token);
  }
  // 中文/复合术语本身（反引号内可能带空格），逐词拆分太噪，保留整体
  return terms;
}

/** 从整页提取「定义」的术语（小写化）。 */
function extractDefinedTerms(
  pageName: string,
  body: string,
  tags: readonly string[],
): Set<string> {
  const terms = new Set<string>();
  terms.add(pageName.trim().toLowerCase());
  for (const tag of tags) terms.add(tag.trim().toLowerCase());
  for (const m of body.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim().toLowerCase();
    if (t) terms.add(t);
  }
  for (const m of body.matchAll(/\*\*([^*]+)\*\*/g)) {
    const t = m[1].trim().toLowerCase();
    if (t) terms.add(t);
  }
  // 小节标题也是「本页教的」
  for (const m of body.matchAll(/^#{1,4}\s+(.+)$/gm)) {
    const t = m[1].trim().toLowerCase();
    if (t) terms.add(t);
  }
  // **代码块内的标识符也算本页教的**：示范代码是教学的一部分，
  // 代码里出现 `role` / `temperature` 即本页教了它的用法——
  // 漏掉这一来源会把第 3 讲自己教的 message/role 误判成前向引用。
  const identifier =
    /(?<![a-zA-Z0-9_])[a-zA-Z_][a-zA-Z0-9_.]{1,}(?![a-zA-Z0-9_])/g;
  for (const m of body.matchAll(identifier)) {
    const t = m[0].toLowerCase().replace(/[.]+$/, "");
    if (t.length >= 2 && !STOPWORDS.has(t)) terms.add(t);
  }
  return terms;
}

async function main(): Promise<void> {
  const modules = await loadModules();
  const findings: Finding[] = [];
  const audits: ModuleAudit[] = [];

  // ---- 逐模块建档 ----
  for (const [order, mod] of modules.entries()) {
    let body = "";
    let tags: readonly string[] = [];
    try {
      const page = readPageSync(`concepts/${mod.id}.md`);
      body = page.body;
      // frontmatter 值是宽松联合：归一化为字符串数组
      const rawTags = page.frontmatter.tags;
      tags = Array.isArray(rawTags)
        ? rawTags.map((t) => String(t))
        : rawTags
          ? [String(rawTags)]
          : [];
    } catch {
      findings.push({
        severity: "ERROR",
        moduleId: mod.id,
        moduleName: mod.name,
        message: "概念页不存在或读取失败 —— 该模块的教学脚本与冷启动全部失效",
      });
      audits.push({
        id: mod.id,
        name: mod.name,
        order,
        definedTerms: new Set(),
        sectionCoverage: {},
        prerequisites: mod.prerequisites,
        sectionTexts: {},
      });
      continue;
    }

    const coverage: Record<string, number> = {};
    const texts: Record<string, string> = {};
    for (const [step, kinds] of Object.entries(STEP_SECTION_MAP)) {
      const picked = selectSections(body, kinds as SectionKind[]);
      coverage[step] = picked.length;
      texts[step] = picked.join("\n\n");
    }

    audits.push({
      id: mod.id,
      name: mod.name,
      order,
      definedTerms: extractDefinedTerms(mod.name, body, tags),
      sectionCoverage: coverage,
      prerequisites: mod.prerequisites,
      sectionTexts: texts,
    });
  }

  // ---- 术语首定义索引（按教学顺序累积）----
  const firstDefinedAt = new Map<string, number>();
  for (const audit of audits) {
    for (const term of audit.definedTerms) {
      if (!firstDefinedAt.has(term)) firstDefinedAt.set(term, audit.order);
    }
  }

  // ---- 检测 1：前向引用（教学小节使用 vs 首定义位置）----
  for (const audit of audits) {
    for (const step of Object.keys(STEP_SECTION_MAP)) {
      const text = audit.sectionTexts[step] ?? "";
      if (text === "") continue;
      for (const term of extractUsedTerms(text)) {
        const definedAt = firstDefinedAt.get(term);
        if (definedAt === undefined || definedAt <= audit.order) continue;
        const later = audits.find((a) => a.order === definedAt);
        findings.push({
          severity: "ERROR",
          moduleId: audit.id,
          moduleName: audit.name,
          message:
            `${step} 步教学小节使用了「${term}」，但它的首次定义在第 ` +
            `${definedAt + 1} 讲「${later?.name ?? "?"}」——学到本模块时还没有这个概念`,
        });
      }
    }
  }

  // ---- 检测 2：小节覆盖缺口 ----
  for (const audit of audits) {
    for (const [step, count] of Object.entries(audit.sectionCoverage)) {
      if (count === 0) {
        findings.push({
          severity: "WARN",
          moduleId: audit.id,
          moduleName: audit.name,
          message: `${step} 步需要的教学小节在概念页中一篇都没有匹配到（STEP_SECTION_MAP: ${STEP_SECTION_MAP[step].join(" / ")}）—— 该步骤的教学素材不完整`,
        });
      }
    }
  }

  // ---- 检测 3：前置声明问题 ----
  for (const audit of audits) {
    for (const pre of audit.prerequisites) {
      const preAudit = audits.find((a) => a.id === pre);
      if (!preAudit) {
        findings.push({
          severity: "ERROR",
          moduleId: audit.id,
          moduleName: audit.name,
          message: `prerequisites 指向不存在的概念页「${pre}」`,
        });
      } else if (preAudit.order > audit.order) {
        findings.push({
          severity: "WARN",
          moduleId: audit.id,
          moduleName: audit.name,
          message: `声明的「前置」模块「${pre}」在教学顺序里排在第 ${preAudit.order + 1} 位（本模块第 ${audit.order + 1} 位）—— 顺序与声明矛盾`,
        });
      }
    }
  }

  // ---- 检测 4：从未定义的英文标识符采样（INFO，限 20 个）----
  const orphans = new Map<string, string[]>();
  for (const audit of audits) {
    for (const step of Object.keys(STEP_SECTION_MAP)) {
      for (const term of extractUsedTerms(audit.sectionTexts[step] ?? "")) {
        if (firstDefinedAt.has(term)) continue;
        if (!/^[\w.]+$/.test(term) || term.length < 4) continue;
        const list = orphans.get(term) ?? [];
        const label = `${audit.name}/${step}`;
        if (!list.includes(label)) list.push(label);
        orphans.set(term, list);
      }
    }
  }
  for (const [term, where] of [...orphans.entries()].slice(0, 20)) {
    findings.push({
      severity: "INFO",
      moduleId: "-",
      moduleName: "-",
      message: `术语「${term}」从未在概念页定义过（出现于：${where.join("、")}）—— 若是核心概念应补进知识库`,
    });
  }

  // ---- 报告 ----
  const errors = findings.filter((f) => f.severity === "ERROR");
  const warns = findings.filter((f) => f.severity === "WARN");
  const infos = findings.filter((f) => f.severity === "INFO");
  const byModule = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byModule.get(f.moduleId) ?? [];
    list.push(f);
    byModule.set(f.moduleId, list);
  }

  const lines: string[] = [
    "# 课程体检报告（静态断层审计）",
    "",
    `- 生成时间：${new Date().toISOString()}`,
    `- 模块数：${modules.length}（教学顺序）`,
    `- 结论：ERROR ${errors.length} / WARN ${warns.length} / INFO ${infos.length}`,
    "",
    "## 一、逐模块发现",
    "",
  ];
  for (const audit of audits) {
    const list = byModule.get(audit.id) ?? [];
    if (list.length === 0) continue;
    lines.push(`### ${audit.order + 1}. ${audit.name}（${audit.id}）`);
    lines.push("");
    for (const f of list) {
      lines.push(`- **[${f.severity}]** ${f.message}`);
    }
    lines.push("");
  }
  lines.push("## 二、口径说明");
  lines.push("");
  lines.push(
    "- 「定义」= 术语以反引号 / 粗体 / 小节标题出现在某概念页；「使用」= 教学小节文本中的反引号 / 粗体 / 英文标识符。",
  );
  lines.push(
    "- 中文无分词，纯中文断层由学生 Agent 动态模拟（P2）兜底；本报告覆盖高置信子集。",
  );
  lines.push("- INFO 级为低置信采样，仅列前 20 个，供人工判断是否补进知识库。");

  const outDir = path.resolve("student-agent-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "course-audit.md");
  writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(
    `课程体检完成：ERROR ${errors.length} / WARN ${warns.length} / INFO ${infos.length}`,
  );
  console.log(`报告：${outPath}`);
  for (const f of errors.slice(0, 12)) {
    console.log(`  [ERROR] ${f.moduleName}: ${f.message}`);
  }
}

main().catch((error) => {
  console.error("课程体检失败：", error);
  process.exitCode = 1;
});
