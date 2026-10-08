/**
 * 讲稿断层检测（纯规则，零模型调用）—— v3 阶段 1
 *
 * 为什么不用 LLM
 * --------------
 * 「模型返回空内容」「模型说它困惑」都不可信：今天已实证学生 Agent 自报困惑时
 * 却在用 `max_steps`/`幻觉` 这类术语 —— **模型的知识来自训练，提示词约束不了**。
 * 所以本脚本只做**材料侧的客观检测**：断层由讲稿本身的缺陷决定，
 * 不由模型的自述决定。这样结论可复现、可验证。
 *
 * 三个判据
 * --------
 * 1. prerequisite：讲稿是否给出了「让零基础能提问的脚手架」
 *    - 开头 300 字有没有认知锚点（类比/ 排除法 / 痛点）
 *    - 讲稿有没有说清「这一讲要解决什么问题」
 * 2. blindSpot：概念页声明的关键步骤，讲稿覆盖了几个（认知盲区）
 *    - 权威来源 = 概念页 `## 关键步骤` 下的 `###` 子节
 *    - 讲稿没讲到的步骤 = 学生压根不会的东西
 * 3. reachability：任务节是否可达（`五、现在轮到你` 有没有实际任务）
 *
 * 用法：node --experimental-strip-types --import ./scripts/ts-loader.mjs \
 *         scripts/detect-lecture-gaps.ts [--json]
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { loadModules } from "@/lib/modules";

// ---- 数据读取 ---------------------------------------------------------------

interface Gap {
  moduleId: string;
  /** 模块人读名（用于报告）。 */
  moduleName: string;
  /** 高/中/低 */
  severity: "high" | "medium" | "low";
  dimension: "prerequisite" | "blindSpot" | "reachability";
  detail: string;
  evidence: string;
}

const CONCEPT_DIR = path.resolve("llm-wiki/concepts");

/** 取概念页（用于取「关键步骤」这个权威来源）。 */
function readConcept(moduleId: string): string | null {
  const file = path.join(CONCEPT_DIR, `${moduleId}.md`);
  try {
    return readFileSync(file, "utf-8");
  } catch {
    return null;
  }
}

/**
 * 取讲稿本体 —— 学生实际读到的那份，存在 `lecture_cache` 的 explain 行。
 * ⚠️ 检测对象必须是它，不是概念页：概念页是素材，讲稿才是教学产物。
 */
async function readLectures(): Promise<Map<string, string>> {
  const { getDb } = await import("@/lib/db/sqlite");
  const rows = getDb()
    .prepare(
      "SELECT module_id, content FROM lecture_cache WHERE step = 'explain'",
    )
    .all() as { module_id: string; content: string }[];
  return new Map(rows.map((r) => [r.module_id, r.content]));
}

// ---- 判据 1：prerequisite（认知脚手架）-------------------------------------

/**
 * 认知锚点：类比 / 场景 / 痛点 / 排除法—— 零基础建立挂靠的抓手。
 *
 * ⚠️ 这份词表是**三次误报后**扩出来的，别再删窄：
 * 初次只有「想象/好比/就像…」→ 误报 system-prompt（年夜饭请厨师）、
 * rag（闭卷 vs 开卷）、ai-safety（钟点工阿姨）三讲。
 * 教训：**检测器必须靠抽样核实校准，不能凭直觉定词表**。
 */
const ANCHORS = [
  // 明喻
  "想象",
  "好比",
  "就像",
  "相当于",
  "等于",
  "打个比方",
  "想想",
  "试想",
  "设想",
  "看成",
  "当作",
  "就像…一样",
  // 场景化提问（"你先想一件事…" 也是建立挂靠）
  "先想",
  "先问",
  "你有没有",
  "你会发现",
  "你会怎么",
  "先想一件",
  // 痛点式（说清「没有它会怎样」同样建立动机）
  "你不用",
  "你不需要",
  "否则",
  "就会",
  "麻烦",
  "痛苦",
  "抓瞎",
  "不敢",
  "抓瞎",
  "一头雾水",
  "懵",
  // 生活角色类比
  "厨师",
  "阿姨",
  "师傅",
  "外卖",
  "考试",
  "请一位",
  "请一个",
  "钟点工",
];

/**
 * 问题陈述：讲稿是否说清「这一讲要解决什么」。
 * ⚠️ 首版漏了「我们要解决」「我们要解决一个问题」这类写法→ 误报 rag / llm-wiki。
 */
const PROBLEM_PATTERNS = [
  /这一讲[要解决的|我们只解决|要解决]/,
  /今天要解决的问题/,
  /我们要解决/,
  /学完你能/,
  /本讲[要解决|解决]/,
  /要解决的问题是/,
  /这一讲.*要解决/,
];

function checkPrerequisite(
  moduleId: string,
  moduleName: string,
  lecture: string,
): Gap[] {
  const gaps: Gap[] = [];
  const head = lecture.slice(0, 400);

  const hasAnchor = ANCHORS.some((k) => head.includes(k));
  if (!hasAnchor) {
    gaps.push({
      moduleId,
      moduleName,
      severity: "medium",
      dimension: "prerequisite",
      detail: "开头 400 字没有认知锚点（类比/痛点），零基础学生建不起挂靠",
      evidence: head.slice(0, 80).replace(/\n/g, "⏎"),
    });
  }

  const hasProblem = PROBLEM_PATTERNS.some((re) => re.test(lecture));
  if (!hasProblem) {
    gaps.push({
      moduleId,
      moduleName,
      severity: "medium",
      dimension: "prerequisite",
      detail: "讲稿没有明确陈述「这一讲要解决什么问题」，学生不知道该问什么",
      evidence: "未匹配到问题陈述句式",
    });
  }

  return gaps;
}

// ---- 判据 2：blindSpot（认知盲区）-----------------------------------------

/**
 * 取概念页声明的关键步骤（`## 关键步骤` 下的 `###` 子节）。
 * 这是「这一讲应该掌握什么」的权威来源。
 */
function extractAuthoritativeSteps(conceptMd: string): string[] {
  const lines = conceptMd.split("\n");
  const steps: string[] = [];
  let inSteps = false;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      // 进入或离开「关键步骤」章节
      inSteps = /关键步骤|详细步骤/.test(line);
      continue;
    }
    if (!inSteps) continue;
    const m = /^###\s+(.+)$/.exec(line);
    if (m) {
      const label = m[1].trim();
      // 去掉括号补充说明，只留主干名
      const main = label.replace(/[（(].*?[)）]/g, "").trim();
      steps.push(main);
    }
  }
  return steps;
}

/** 把步骤名拆成关键词，用于在讲稿里做覆盖判定（宽松匹配，宁可多算覆盖）。 */
function stepKeywords(step: string): string[] {
  const cleaned = step
    .replace(/^第[一二三四五六七八九十\d]+[斧步个]*/, "")
    .trim();
  const parts = cleaned.split(/[\s、：:，,和与及]/).filter(Boolean);
  const kws = [cleaned, ...parts].filter((p) => p.length >= 2);
  return kws.length > 0 ? kws : [cleaned];
}

/** 讲稿里是否讲到了这个步骤（宽松：任一关键词出现即算覆盖）。 */
function stepCovered(step: string, lecture: string): boolean {
  return stepKeywords(step).some((kw) => lecture.includes(kw));
}

function checkBlindSpot(
  moduleId: string,
  moduleName: string,
  lecture: string,
  conceptMd: string,
): Gap[] {
  const steps = extractAuthoritativeSteps(conceptMd);
  if (steps.length === 0) return [];

  const uncovered = steps.filter((s) => !stepCovered(s, lecture));
  if (uncovered.length === 0) return [];

  return [
    {
      moduleId,
      moduleName,
      severity: uncovered.length / steps.length >= 0.4 ? "high" : "medium",
      dimension: "blindSpot",
      detail:
        `概念页声明 ${steps.length} 个关键步骤，讲稿未覆盖 ${uncovered.length} 个` +
        `（覆盖率 ${Math.round(((steps.length - uncovered.length) / steps.length) * 100)}%）`,
      evidence: `未覆盖：${uncovered.join("、")}`,
    },
  ];
}

// ---- 判据 3：reachability（任务节可达）-------------------------------------

function checkReachability(
  moduleId: string,
  moduleName: string,
  lecture: string,
): Gap[] {
  if (!lecture.includes("现在轮到你") && !lecture.includes("五、")) {
    return [
      {
        moduleId,
        moduleName,
        severity: "high",
        dimension: "reachability",
        detail:
          "讲稿缺少「五、现在轮到你」任务节 —— 动手模仿页的任务卡会整站消失",
        evidence: "未找到任务节",
      },
    ];
  }
  return [];
}

// ---- 主流程 ----------------------------------------------------------------

async function main(): Promise<void> {
  const modules = await loadModules();
  const lectures = await readLectures();
  const gaps: Gap[] = [];
  const summary: {
    moduleId: string;
    moduleName: string;
    steps: number;
    covered: number;
    missing: string[];
    lectureChars: number;
  }[] = [];

  for (const m of modules) {
    const lecture = lectures.get(m.id);
    if (lecture === undefined) {
      console.error(`跳过 ${m.id}：explain 讲稿缓存缺失`);
      continue;
    }
    const conceptMd = readConcept(m.id);

    const steps = conceptMd ? extractAuthoritativeSteps(conceptMd) : [];
    const missing = steps.filter((s) => !stepCovered(s, lecture));
    summary.push({
      moduleId: m.id,
      moduleName: m.name,
      steps: steps.length,
      covered: steps.length - missing.length,
      missing,
      lectureChars: lecture.length,
    });

    gaps.push(...checkPrerequisite(m.id, m.name, lecture));
    if (conceptMd) {
      gaps.push(...checkBlindSpot(m.id, m.name, lecture, conceptMd));
    }
    gaps.push(...checkReachability(m.id, m.name, lecture));
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ gaps, summary }, null, 2));
    return;
  }

  console.log("=== 讲稿断层检测（纯规则，零模型调用）===\n");
  console.log(
    "module".padEnd(20) +
      "字数".padStart(6) +
      "关键步骤".padStart(9) +
      "已覆盖".padStart(7) +
      "覆盖率".padStart(7),
  );
  for (const s of summary) {
    const rate =
      s.steps === 0 ? "—" : `${Math.round((s.covered / s.steps) * 100)}%`;
    console.log(
      `${s.moduleId.padEnd(20)} ${String(s.lectureChars).padStart(6)} ` +
        `${String(s.steps).padStart(9)} ${String(s.covered).padStart(7)} ${rate.padStart(7)}`,
    );
    if (s.missing.length > 0) {
      console.log(`${"".padEnd(20)}   ⚠ 未覆盖：${s.missing.join("、")}`);
    }
  }

  console.log("\n=== 检出断层 ===");
  if (gaps.length === 0) {
    console.log("✅ 未检出断层");
  } else {
    const byDim: Record<string, Gap[]> = {};
    for (const g of gaps) {
      (byDim[g.dimension] ??= []).push(g);
    }
    for (const [dim, list] of Object.entries(byDim)) {
      console.log(`\n【${dim}】${list.length} 条`);
      for (const g of list) {
        console.log(
          `  [${g.severity}] ${g.moduleId} — ${g.detail}\n      证据：${g.evidence}`,
        );
      }
    }
  }
  console.log(`\n合计：${gaps.length} 条`);
}

await main();
