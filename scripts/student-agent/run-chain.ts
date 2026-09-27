/**
 * P3 全链路串行驱动器 —— 学生 Agent 按 教学拓扑顺序 走完全部模块。
 *
 * 与单模块 run.ts 的分工
 * --------------------
 * run.ts 负责「一个模块的七步」；本文件负责「课程」：按 loadModules 的
 * 拓扑顺序逐个 spawn run.ts 子进程（每个模块独立进程，互不残留状态），
 * 处理前置门槛（403 = 解锁链未通，记录后跳过），最后汇总一份课程级报告。
 *
 * 中断策略：连续两个模块因前置门槛被锁就停止 —— 门槛是按掌握度链
 * 传导的，后面大概率全锁；继续 spawn 只是白烧 token。
 *
 * 运行：pnpm simulate:chain -- --mode=diligent
 * 报告：student-agent-output/chain-<mode>.md（逐模块明细见 simulation-*.md）
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { loadModules } from "@/lib/modules";

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined =>
  args
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");

const mode = (getArg("mode") ?? "diligent") as "diligent" | "sloppy";

interface ModuleOutcome {
  moduleId: string;
  status: "passed" | "failed" | "locked";
  note: string;
}

async function main(): Promise<void> {
  const modules = await loadModules();
  const outcomes: ModuleOutcome[] = [];
  let consecutiveLocked = 0;

  for (const mod of modules) {
    console.log(
      `\n===== [${mod.order + 1}/${modules.length}] ${mod.name} =====`,
    );
    const result = spawnSync(
      "node",
      [
        "--experimental-strip-types",
        "--import",
        "./scripts/ts-loader.mjs",
        "scripts/student-agent/run.ts",
        `--module=${mod.id}`,
        `--mode=${mode}`,
      ],
      { encoding: "utf8", timeout: 10 * 60 * 1000 },
    );

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status === 0) {
      outcomes.push({ moduleId: mod.id, status: "passed", note: "七步全通" });
      consecutiveLocked = 0;
      continue;
    }

    const lockMatch = output.match(/前置模块「([^」]+)」掌握度为 (\d+)/);
    if (lockMatch) {
      consecutiveLocked += 1;
      outcomes.push({
        moduleId: mod.id,
        status: "locked",
        note: `前置未达标：${lockMatch[0]}`,
      });
      console.log(`  ⊘ 被前置门槛锁住，跳过`);
      if (consecutiveLocked >= 2) {
        console.log("连续两个模块被锁，剩余模块必然同样被锁——提前结束。");
        for (const rest of modules.slice(modules.indexOf(mod) + 1)) {
          outcomes.push({
            moduleId: rest.id,
            status: "locked",
            note: "未尝试（前面模块未解锁）",
          });
        }
        break;
      }
      continue;
    }

    consecutiveLocked = 0;
    const errLine =
      output
        .split("\n")
        .filter((l) => l.includes("失败") || l.includes("错误"))
        .pop() ?? "未知原因";
    outcomes.push({
      moduleId: mod.id,
      status: "failed",
      note: errLine.trim().slice(0, 200),
    });
  }

  // ---- 汇总报告 ----
  const passed = outcomes.filter((o) => o.status === "passed").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;
  const locked = outcomes.filter((o) => o.status === "locked").length;

  const report = [
    `# 学生 Agent 全链路报告`,
    "",
    `- 性格：${mode === "sloppy" ? "sloppy（易错学生）" : "diligent（认真学习）"}`,
    `- 生成时间：${new Date().toISOString()}`,
    `- 结论：通过 ${passed} / 失败 ${failed} / 被锁 ${locked}（共 ${modules.length} 讲）`,
    "",
    "## 逐模块结果",
    "",
    ...outcomes.map((o, i) => {
      const mark =
        o.status === "passed" ? "✅" : o.status === "failed" ? "❌" : "🔒";
      return `${i + 1}. ${mark} **${o.moduleId}** — ${o.status}：${o.note}`;
    }),
    "",
    "逐模块的完整七步明细见同目录 simulation-<module>-<mode>.md。",
    "",
  ].join("\n");

  const outPath = path.resolve("student-agent-output", `chain-${mode}.md`);
  writeFileSync(outPath, report, "utf8");
  console.log(`\n全链路报告：${outPath}`);
  console.log(`结论：通过 ${passed} / 失败 ${failed} / 被锁 ${locked}`);
}

main().catch((error) => {
  console.error("全链路模拟失败：", error);
  process.exitCode = 1;
});
