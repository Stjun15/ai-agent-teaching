/**
 * 全课程接地分析 —— 学生 Agent 模拟报告的横向汇总。
 *
 * 回答一个问题：**哪些讲的教学材料，不足以支撑学生独立完成作业？**
 *
 * 数据来源
 * ----
 * - 每讲的学生提交物：`student-agent-output/simulation-<id>-diligent.md`
 *   里「提交的作业（原文）」围栏代码块（真实模型产出的作业）。
 * - 每讲的教学材料：讲稿缓存的任务节（「现在轮到你」）+ 示范代码
 *   —— 与驱动器喂给学生的材料完全同构。
 *
 * 判定
 * ----
 * 提交物中的英文标识符/术语（terms.ts 单份提取器），凡是**本讲材料里
 * 找不到用法的**，记为 ungrounded —— 对零基础学生，这就是「作业用到了
 * 没教的东西」，即材料缺口。缺口越多的讲，材料与作业的断层越大。
 *
 * 运行：pnpm analyze:grounding（需 pnpm start 在跑，读讲稿缓存 API）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readDemoCode } from "@/lib/teaching-script";
import { splitLecture } from "@/lib/lecture-split";
import { loadModules } from "@/lib/modules";
import { extractTerms } from "./terms";

const OUT_DIR = path.resolve("student-agent-output");
const BASE = "http://localhost:3000";

/** 从模拟报告里提取「提交的作业（原文）」的围栏代码块。 */
function extractSubmission(reportPath: string): string | null {
  if (!existsSync(reportPath)) return null;
  const report = readFileSync(reportPath, "utf8");
  const start = report.indexOf("## 提交的作业（原文）");
  if (start === -1) return null;
  const fenceStart = report.indexOf("```", start);
  if (fenceStart === -1) return null;
  const fenceEnd = report.indexOf("```", fenceStart + 3);
  if (fenceEnd === -1) return null;
  return (
    report
      .slice(fenceStart + 3, fenceEnd)
      .replace(/^\n/, "")
      .trimEnd() || null
  );
}

async function main(): Promise<void> {
  const modules = await loadModules();
  const rows: {
    moduleId: string;
    name: string;
    order: number;
    submissionBytes: number;
    ungrounded: string[];
    hasDemo: boolean;
    hasAssignment: boolean;
  }[] = [];

  for (const mod of modules) {
    const reportPath = path.join(OUT_DIR, `simulation-${mod.id}-diligent.md`);
    const submission = extractSubmission(reportPath);
    if (submission === null) {
      rows.push({
        moduleId: mod.id,
        name: mod.name,
        order: mod.order,
        submissionBytes: 0,
        ungrounded: [],
        hasDemo: false,
        hasAssignment: false,
      });
      continue;
    }

    // 教学材料 = 讲稿缓存的任务节 + 示范代码（与 run.ts 喂给学生的同构）
    const cacheRes = await fetch(
      `${BASE}/api/lecture-cache?moduleId=${mod.id}&step=explain`,
    );
    const cache = (await cacheRes.json().catch(() => null)) as {
      found?: boolean;
      content?: string;
    } | null;
    const lecture = cache?.found && cache.content ? cache.content : "";
    const material = `${splitLecture(lecture).assignment}\n\n${readDemoCode(mod.id)}`;

    const materialTerms = extractTerms(material);
    const used = [...extractTerms(submission)];
    const ungrounded = used
      .filter((term) => !materialTerms.has(term) && term.length >= 3)
      .slice(0, 15);

    rows.push({
      moduleId: mod.id,
      name: mod.name,
      order: mod.order,
      submissionBytes: submission.length,
      ungrounded,
      hasDemo: material.includes("示范代码") || readDemoCode(mod.id).length > 0,
      hasAssignment: splitLecture(lecture).assignment !== null,
    });
  }

  // 缺口最大的讲排前（ungrounded 数量降序）
  const ranked = [...rows].sort(
    (a, b) => b.ungrounded.length - a.ungrounded.length,
  );

  const lines: string[] = [
    "# 全课程接地分析汇总",
    "",
    `- 生成时间：${new Date().toISOString()}`,
    `- 覆盖：${rows.filter((r) => r.submissionBytes > 0).length}/${modules.length} 讲（学生 Agent diligent 模式的真实作业）`,
    "",
    "## 一、材料缺口排行（ungrounded 术语多 = 材料与作业断层大）",
    "",
    ...ranked.map(
      (r) =>
        `${r.order + 1}. **${r.name}**（${r.moduleId}）—— 作业 ${r.submissionBytes} 字，` +
        `材料外用法 ${r.ungrounded.length} 个` +
        (r.ungrounded.length > 0 ? `：${r.ungrounded.join("、")}` : ""),
    ),
    "",
    "## 二、结构性缺口（讲稿任务节 / 示范代码缺失）",
    "",
    ...ranked
      .filter((r) => !r.hasDemo || !r.hasAssignment)
      .map(
        (r) =>
          `- **${r.name}**：${r.hasAssignment ? "" : "讲稿无任务节；"}${r.hasDemo ? "" : "无示范代码"}（零基础学生写作业时没有可参照的用法示例）`,
      ),
    "",
    "## 三、口径说明",
    "",
    "- 基准 = 本讲讲稿任务节 + 示范代码（学生 Agent 实际拿到的材料）。",
    "- 提交物里材料没有的英文标识符/术语即 ungrounded；全部来自材料 = 该讲作业零基础可独立完成。",
    "- 提取器与体检器/驱动器共用（terms.ts），三处口径一致。",
  ];

  const outPath = path.join(OUT_DIR, "grounding-analysis.md");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`接地分析完成：${outPath}`);
  for (const r of ranked.slice(0, 5)) {
    console.log(
      `  ${r.name}: 材料外用法 ${r.ungrounded.length} 个${r.ungrounded.length > 0 ? `（${r.ungrounded.slice(0, 6).join("、")}）` : ""}`,
    );
  }
}

main().catch((error) => {
  console.error("接地分析失败：", error);
  process.exitCode = 1;
});
