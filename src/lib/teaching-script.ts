/**
 * 教学脚本构建器 —— 从 Wiki 引擎读取概念页，按教学步骤裁剪段落。
 *
 * 为什么不用 `route.ts` 里的 `readFileSync` 裸读
 * ---------------------------------------------
 * 1. Wiki 引擎 (`readPageSync`) 自带 schema 校验：frontmatter 缺字段、页面类型
 *    未知等错误在注入脚本之前就暴露，不会让导师带着残缺脚本上课。
 * 2. `modules.ts` / `citations.ts` / `api/wiki/query` 都走 `@/wiki`——
 *    同一套数据层多一条裸读路径就是多一个漂移点。
 * 3. 分段裁剪省 token：讲解阶段不需要看到动手任务，练习阶段不需要看到定义段。
 *    全文注入等于每次对话都把整本教科书重读一遍。
 *
 * 步骤 → 段落映射（`explain` / `observe` / `imitate`）
 * ---------------------------------------------------
 * 只有这三个步骤走聊天管道。`validate` / `practice` / `mastery` 走结构化端点
 *（`/api/agent/validate` / `/api/agent/generate-question`），
 * `visualize` 走前端组件订阅 —— 这些不经过 `buildTeachingScript`；
 * 但 validate 路由会用 `readPracticeTask` 从这里取「动手任务」节作点评题面。
 */

import { readPageSync } from "@/wiki";
import type { WikiPage } from "@/wiki";
import type { StepType } from "@/lib/db/types";

/** 概念页小节标题的标准化名称。 */
export const SECTION_NAMES = {
  definition: "定义",
  keyPoints: "关键点",
  keySteps: "关键步骤",
  coreOps: "核心操作",
  why: "为什么需要",
  misconceptions: "常见误解",
  commonProblems: "常见问题",
  comparison: "和普通",
  practice: "动手任务",
  related: "相关概念",
} as const;

/** 哪些小节标题属于同一语义类（不同概念页用词不同）。 */
export const SECTION_ALIASES: Record<string, string[]> = {
  definition: [SECTION_NAMES.definition],
  keyPoints: [
    SECTION_NAMES.keyPoints,
    SECTION_NAMES.keySteps,
    SECTION_NAMES.coreOps,
  ],
  why: [SECTION_NAMES.why],
  misconceptions: [SECTION_NAMES.misconceptions, SECTION_NAMES.commonProblems],
  comparison: [SECTION_NAMES.comparison],
  practice: [SECTION_NAMES.practice, "实践任务", "现在轮到你", "自己动手"],
  related: [SECTION_NAMES.related],
  demoCode: ["示范代码"],
};

/**
 * 教学步骤 → 应注入的段落类型。
 *
 * explain：讲概念 —— 定义 + 关键点 + 对比。不塞动手任务：学生还没听懂就做题会
 *   只答"不知道"。
 * observe：看示范 —— 示范代码 + 关键点 + 实践任务 + 防踩坑。
 *   学生看完示范后最容易踩的坑提前预警。
 * imitate：自己动手 —— 动手任务 + 常见误解。定义段已经讲过了，不用重复。
 */
export const STEP_SECTION_MAP: Record<
  string,
  (keyof typeof SECTION_ALIASES)[]
> = {
  explain: ["definition", "keyPoints", "why", "comparison"],
  observe: ["keyPoints", "demoCode", "practice", "misconceptions"],
  imitate: ["practice", "misconceptions", "demoCode", "related"],
};

/** 解析 body 为 `{ heading: string; content: string }[]` 的段落列表。 */
export function parseSections(
  body: string,
): { heading: string; content: string }[] {
  const lines = body.split(/\r?\n/);
  const sections: { heading: string; content: string }[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = /^## (.+)/.exec(line);
    if (h2Match) {
      if (currentLines.length > 0 || currentHeading) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim(),
        });
      }
      currentHeading = h2Match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0 || currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    });
  }
  return sections;
}

/** 判断一个段落标题是否匹配指定的语义类。 */
function sectionMatches(heading: string, kind: string): boolean {
  const aliases = SECTION_ALIASES[kind];
  if (!aliases) return false;
  const lower = heading.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

/**
 * 从概念页正文中选出指定类型的段落。
 * 返回的是 Markdown 片段（含 `## 标题`），顺序保持原页顺序。
 */
export function selectSections(
  body: string,
  kinds: (keyof typeof SECTION_ALIASES)[],
): string[] {
  const sections = parseSections(body);
  return sections
    .filter((section) =>
      kinds.some((kind) => sectionMatches(section.heading, kind)),
    )
    .map((section) => `## ${section.heading}\n\n${section.content}`)
    .filter((text) => text.trim().length > 0);
}

/** 教学脚本的引导词。告诉导师这是脚本、怎么用。 */
const SCRIPT_PREAMBLE = [
  "## 教学脚本（来自概念页）",
  "下面这篇概念页是你的教学脚本。请用对话的方式把内容教给学生。",
  "脚本里如果出现「偷懒版」和「完整版」两个教学路径，",
  "你需要先让学生选择，再按学生选择的路径只讲对应段落——不要两个都讲。",
  "",
].join("\n");

/**
 * 从概念页读取「## 示范代码」小节，供 ObservePanel 直接渲染。
 *
 * 为什么单独成函数而不是复用 buildTeachingScript / STEP_SECTION_MAP
 * ------------------------------------------------------------
 * 示范代码是预先写好的、给人看的代码片段，不是给 LLM 当参考资料的。
 * 它不需要「按步骤裁段」—— 观察示范步只取这一个固定小节，Parser 复用
 * `parseSections` 保证提取逻辑与脚本构建器同口径。
 *
 * 返回空串 = 该模块概念页不存在或没有「## 示范代码」小节。
 * 调用方可据此降级：展示「示范代码准备中」的占位文案。
 */
export function readDemoCode(moduleId: string): string {
  try {
    const page = readPageSync(`concepts/${moduleId}.md`);
    const sections = parseSections(page.body);
    const demo = sections.find((s) => s.heading === "示范代码");
    return demo?.content.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * 读取概念页「动手任务」小节全文（含验收清单），作为点评的题面。
 *
 * 为什么单独成函数而不是复用 buildTeachingScript
 * --------------------------------------------
 * 教学脚本按步骤裁段，而点评题面永远是完整的小节（动手任务的验收清单、
 * 交付要求一个都不能少——少一条，点评 Agent 就少评一条）。取节口径用
 * `sectionMatches` 的语义类别而非精确标题，与 STEP_SECTION_MAP 同源：
 * 概念页用「实践任务」作标题的页也能命中。
 *
 * 返回空串 = 页面不存在或没有动手任务节。调用方（`/api/agent/validate`）
 * 据此降级为不带题面的通用 rubric 点评 —— 点评 Agent 的追加段里有对应的
 * 诚实条款（注明「未取得验收清单」），不会装作评过。
 */
export function readPracticeTask(moduleId: string): string {
  try {
    const page = readPageSync(`concepts/${moduleId}.md`);
    const sections = parseSections(page.body);
    const tasks = sections.filter((s) => sectionMatches(s.heading, "practice"));
    if (tasks.length === 0) return "";
    return tasks
      .map((t) => `## ${t.heading}\n\n${t.content}`)
      .join("\n\n")
      .trim();
  } catch {
    return "";
  }
}

/**
 * 从概念页"示范代码"节读取 demo 内容。
 *
 * 用途：code / tool 类任务的点评 Agent 需要参考答案做对照评分。
 * demo 来自观察示范步（observe）展示过的代码/工具定义，
 * 点评时注入为 `demo_content`，让 reviewer 有东西可对照。
 *
 * QA 类不调此函数（"用自己的话"的教学目标会被逐字比对破坏），
 * prompt 类暂不调（有多个正确写法，一份 demo 不够）。
 *
 * 返回空串 = 页面不存在或没有示范代码节。
 * 调用方据此不给 demo_content，reviewer 回退为仅按 rubric 盲评。
 */
export function readDemoContent(moduleId: string): string {
  try {
    const page = readPageSync(`concepts/${moduleId}.md`);
    const sections = parseSections(page.body);
    const demo = sections.find((s) => sectionMatches(s.heading, "demoCode"));
    if (!demo) return "";
    return `## ${demo.heading}\n\n${demo.content}`.trim();
  } catch {
    return "";
  }
}
export interface TeachingScriptResult {
  /** 拼接好的脚本文本。空串表示页面不存在或该步骤没有匹配段落。 */
  script: string;
  /** 命中的段落数。0 可能是页面结构异常，调用方可据此降级为全文注入。 */
  sectionCount: number;
}

/**
 * 按模块 ID 和教学步骤构建教学脚本。
 *
 * 失败策略：
 * - 页面不存在 → 返回空脚本（`{ script: "", sectionCount: 0 }`），调用方静默降级
 * - 页面存在但无匹配段落 → 降级为全文注入（保留原文的 `SCRIPT_PREAMBLE` + 全文）
 * - wiki 引擎的 schema 校验错误会直接抛出（让上层兜底或日志记录）
 */
export function buildTeachingScript(
  moduleId: string,
  step: StepType,
): TeachingScriptResult {
  const kinds = STEP_SECTION_MAP[step];
  if (!kinds) {
    return { script: "", sectionCount: 0 };
  }

  let page: WikiPage;
  try {
    page = readPageSync(`concepts/${moduleId}.md`);
  } catch {
    return { script: "", sectionCount: 0 };
  }

  const selected = selectSections(page.body, kinds);

  if (selected.length === 0) {
    // 降级：页面存在但无匹配段落，回退到全文注入。
    if (page.body.trim().length > 0) {
      return {
        script: `${SCRIPT_PREAMBLE}\n\n${page.body}`,
        sectionCount: 0,
      };
    }
    return { script: "", sectionCount: 0 };
  }

  return {
    script: `${SCRIPT_PREAMBLE}\n\n${selected.join("\n\n")}`,
    sectionCount: selected.length,
  };
}