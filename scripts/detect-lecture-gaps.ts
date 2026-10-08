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
/**
 * 取概念页声明的关键步骤。
 *
 * ✅ 只认 A 型：`## 关键步骤…` 下的 `###` 子节（目前仅 platform-replica有）。
 *
 * ❌ **刻意不支持 B 型**（标题带「N 步」、步骤在正文列表/表格里）。
 * 实测各页写法差异极大：tool-calling 是 `**第一步：…**` 加粗行 +「好名字/坏名字」
 * 对照示例；agent-loop 是表格行；rag 是有序列表。硬做B 型会把「坏描述：天气」
 * 这类**对照示例当成步骤** → 产出假结论（实测 tool-calling 因此误报 4 条）。
 *
 * **宁可报「该讲无权威步骤基准」，也不误报** —— 误报会让整个检测失去可信度。
 * TODO：后续若要给其余 10 讲补基准，应先把概念页的步骤结构**统一成 A 型**
 * （`## 关键步骤` + 每步一个 `###`），再把B 型支持加回来。
 */
function extractAuthoritativeSteps(conceptMd: string): string[] {
  const steps: string[] = [];
  let inSteps = false;

  for (const line of conceptMd.split("\n")) {
    if (/^##\s/.test(line)) {
      inSteps = /关键步骤|详细步骤/.test(line);
      continue;
    }
    if (!inSteps) continue;
    const m = /^###\s+(.+)$/.exec(line);
    if (m) {
      const main = m[1]
        .trim()
        .replace(/[（(].*?[)）]/g, "")
        .trim();
      steps.push(main);
    }
  }
  return steps;
}

/**
 * 把步骤名拆成关键词，用于在讲稿里做覆盖判定。
 *
 * 为什么拆：讲稿用自己的话讲同一件事，措辞不会照抄概念页标题。
 * 例：概念页「角色一 ·system：给 AI 定人设」→ 关键词含「system」「定人设」，
 * 讲稿只要提到其中任一个即算覆盖。
 *
 * ⚠️ 别拆太碎（实测教训）：曾把中点当分隔符切开后，连「rag 的检索/增强/生成」
 * 这种本来 100% 覆盖的也变成 0% —— 关键词被切得单字化，反而不匹配。
 * 现在只按**明确的分隔符**切，且保留原始串作为兜底关键词。
 */
/**
 * 把步骤名拆成关键词，用于在讲稿里做覆盖判定。
 *
 * ⚠️⚠️ 这里的匹配逻辑反复失败过 6 次（今日第 2~6 次误报），教训固化如下：
 *
 * 讲稿用自己的话讲同一件事，措辞不照抄概念页标题，所以要拆关键词。
 * 但实测「拆得多细」与「准不准」**不成正比**：
 *  - 不拆 → 整串匹配不上（讲稿写「名字要动词+名词」≠ 标题「给工具起个名字」）→ 误报
 *  - 拆太碎 → 关键词单字化 → 匹配也失败（rag 从 100% 掉到 0%）
 *  - 门槛太严（只认≥3 字）→「检索」「过滤」这类 2 字术语全被判未覆盖 → 误报更多
 *
 * **最终形态：只做「最少加工」——剥掉序号前缀，按明确分隔符切，2 字即算。**
 * 剩余的措辞差异**通过置信度表达，而不是继续调参**：
 * 命中主干词 = high（可信）；只命中短词 = low（需人工确认，不下结论）。
 *
 * ⚠️ 排查时踩的一个假象（差点误判检测器有问题）：
 * 我用「讲稿里有没有『检索』这个词」来判断 rag 是否覆盖 → 查到 True，
 * 但那处「检索」其实在**标题「RAG 检索增强生成」**里，正文根本没讲检索动作。
 * **抽样核实必须看上下文（`content.slice(i-40, i+40)`），只查「词是否存在」会得出假结论。**
 *
 * ✅ 决定性补充（实测 tool-calling后放弃继续调参）：
 * 讲稿讲同一件事时**常用同义说法**：「给工具起个名字」→ 讲稿写「工具名」；
 * 「写一句描述」→ 讲稿写「什么时候用」。正则拆词无法覆盖这类语义等价。
 * **再加别名表只会陷入无穷调参**（今日已失败 6 次）。
 * →所以本函数保持**简单可预测**，判定不准时由置信度标记为「需人工确认」，
 *   真正的语义等价判断留给 LLM（尚未接入，见 plan-student-agent-v3）。
 */
function stepKeywords(step: string): string[] {
  // 剥序号前缀：支持「第一步 x」「第一斧 x」「维度一 · x」「招一 x」「模式二 · x」
  let s = step
    .replace(/^第\s*[一二三四五六七八九十\d]+\s*[斧步个道条]\s*/, "")
    .replace(/^[一二三四五六七八九十\d]+\s*(?=[^\d])/, "")
    .trim();
  // 去掉开头的「维度/ 模式 / 招 / 步骤 / 第一步」等序号词残留
  s = s.replace(
    /^(维度|模式|步骤|招|道)\s*[一二三四五六七八九十\d]*\s*[·・]?\s*/,
    "",
  );

  const parts: string[] = [];
  for (const p of s.split(/[\s、：:，,和与及（）()「」\-—·・]/)) {
    const t = p.trim();
    if (t.length >= 2) parts.push(t);
  }
  return parts.length > 0 ? parts : [s];
}

/**
 * 覆盖判定 + 置信度。
 *
 * - `high`：≥3 字的主干词命中 —— 可信，讲稿确实讲了这个步骤
 * - `low`：仅 2 字短词命中，或**子串命中**（见下）—— 需人工确认，不下结论
 * - `none`：没命中 —— 计入盲区
 *
 * 为什么加「子串命中」这层兜底（实测 rag 的教训）：
 * 概念页写「第一步 · 检索」，讲稿写「### 第一步 · 检索（Retrieval）」——
 * 整块关键词「检索」明明在讲稿里，却因为剥离序号时多带了一个「·」而匹配不上。
 * 故额外尝试：把关键词切成 2 字以上的**所有连续子串**，任一命中即算 low。
 * 这层宁可宽松（只给 low 不给 high），避免把真覆盖误报成盲区。
 */
function isCoveredWithConfidence(
  step: string,
  lecture: string,
): "high" | "low" | "none" {
  // 首查：步骤标题逐字命中 → high（2026-10-08 修复）。
  // 实测教训：stepKeywords 剥掉「维度一 ·」「第三道 ·」这类序号前缀后只剩
  // 2 字短词（角色/格式/限流/并行…），讲稿明明开了**同名小节**
  // （「### 维度一 · 角色」「### 第三道 · 限流」）却只能判 low，
  // 一轮误报 4 讲「需人工确认」——抽样核实后 4/4 全是真覆盖。
  // 完整标题逐字出现，几乎只可能是真在讲这个步骤，判 high 是安全的。
  // 规范化 = 去所有空白，容忍「维度一 · 角色」vs「维度一·角色」的空格差异。
  // ⚠️ 标题去空白后仍须 ≥4 字才走这条捷径：2~3 字的裸标题（如「检索」）
  // 逐字出现在别处标题里不足以定论（rag「检索」在页首标题的旧教训）。
  const title = step.replace(/\s+/g, "");
  if (title.length >= 4 && lecture.replace(/\s+/g, "").includes(title)) {
    return "high";
  }

  const kws = stepKeywords(step);
  if (kws.some((k) => k.length >= 3 && lecture.includes(k))) return "high";
  if (kws.some((k) => lecture.includes(k))) return "low";

  // 兜底：任意 ≥2 字连续子串命中 → low（宽松，只降级不升级）
  for (const kw of kws) {
    for (let len = kw.length - 1; len >= 2; len--) {
      for (let i = 0; i + len <= kw.length; i++) {
        if (lecture.includes(kw.slice(i, i + len))) return "low";
      }
    }
  }
  return "none";
}

/** 讲稿里是否讲到了这个步骤（宽松：任一关键词出现即算覆盖）。 */
function stepCovered(step: string, lecture: string): boolean {
  return isCoveredWithConfidence(step, lecture) === "high";
}

function checkBlindSpot(
  moduleId: string,
  moduleName: string,
  lecture: string,
  conceptMd: string,
): Gap[] {
  const steps = extractAuthoritativeSteps(conceptMd);
  if (steps.length === 0) return [];

  // 逐步骤判定，只有「未覆盖」才计入盲区；「不确定」单独标记（见 isCoveredWithConfidence）
  const uncovered: string[] = [];
  const uncertain: string[] = [];
  for (const s of steps) {
    const c = isCoveredWithConfidence(s, lecture);
    if (c === "none") uncovered.push(s);
    else if (c === "low") uncertain.push(s);
  }
  if (uncovered.length === 0) {
    return uncertain.length > 0
      ? [
          {
            moduleId,
            moduleName,
            severity: "low" as const,
            dimension: "blindSpot",
            detail:
              `${uncertain.length}/${steps.length} 个步骤**只能弱匹配**（讲稿措辞与概念页标题差异大，` +
              `自动判定不可靠，需人工确认）`,
            evidence: `待确认：${uncertain.join("、")}`,
          },
        ]
      : [];
  }

  return [
    {
      moduleId,
      moduleName,
      severity: uncovered.length / steps.length >= 0.4 ? "high" : "medium",
      dimension: "blindSpot",
      detail:
        `概念页声明 ${steps.length} 个关键步骤，讲稿未覆盖 ${uncovered.length} 个` +
        `（覆盖率 ${Math.round(((steps.length - uncovered.length) / steps.length) * 100)}%）`,
      evidence:
        `未覆盖：${uncovered.join("、")}` +
        (uncertain.length > 0 ? `；另有 ${uncertain.length} 个待人工确认` : ""),
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

  const noBaseline = summary.filter((s) => s.steps === 0);
  if (noBaseline.length > 0) {
    console.log(
      `\n⚠️ 另有 ${noBaseline.length} 讲**无法判定 blindSpot**（概念页没有统一的「关键步骤」结构，` +
        `检测器刻意不猜测以免误报）：${noBaseline.map((s) => s.moduleId).join("、")}`,
    );
    console.log(
      "   → 「未检出断层」对这些讲**不成立**。要覆盖它们，需先把概念页步骤结构统一成 A 型。",
    );
  }
  console.log(`\n合计：${gaps.length} 条`);
}

await main();
