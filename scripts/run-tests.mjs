#!/usr/bin/env node
/**
 * 测试运行器 —— 保证「所有组都会跑」，并如实汇总
 *
 * 为什么不能继续用 `a && b && c`
 * ---------------------------
 * 两组真模型用例（点评 / 讲解）存在**固有的间歇失败**：模型是随机采样的，
 * 同一个用例这一轮过、下一轮可能红。用 `&&` 串联时后果很具体 ——
 * 前一组红了，后面几组**根本不会执行**，而输出看上去只是「有一条失败」，
 * 完全看不出「有三组没跑」。
 *
 * 实测踩到过两次：
 *   1. 点评组因为提示词与 schema 的符号矛盾间歇变红，把讲解组整个挡住；
 *   2. package.json 的 test 脚本被包管理器冲掉一组，只看有没有 FAIL
 *      完全发现不了 —— 少跑的那组永远不会红。
 *
 * 所以本脚本做三件事：
 *   1. **逐组跑完**，不因前一组失败而中断；
 *   2. 从 TAP 输出里解析每组的用例数，把「跑了几组、几组通过」摆在摘要里
 *      —— 少一组能一眼看见（数量本身就是断言）；
 *   3. 有任何一组失败就退出码非 0。
 *
 * 分组顺序：纯函数在前、真模型在后。纯函数是秒级的，先跑能把「代码坏了」
 * 和「模型心情不好」在阅读顺序上分开。
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 测试组。`model: true` 表示会真的调模型：慢、花钱、且有固有的间歇失败。
 * 标记出来是为了在摘要里区分「代码错了」与「模型这次没照做」。
 */
const SUITES = [
  { name: "Markdown 解析", file: "scripts/markdown-spec.ts", model: false },
  { name: "客户端身份", file: "scripts/client-identity-spec.ts", model: false },
  { name: "分数量纲", file: "scripts/scores-spec.ts", model: false },
  { name: "主题偏好", file: "scripts/theme-spec.ts", model: false },
  { name: "沙箱清单", file: "scripts/playground-spec.ts", model: false },
  { name: "可视化场景", file: "scripts/scene-spec.ts", model: false },
  { name: "项目模板", file: "scripts/project-templates-spec.ts", model: false },
  {
    name: "点评 Agent",
    file: "scripts/agent-regression-reviewer.ts",
    model: true,
  },
  {
    name: "讲解 Agent",
    file: "scripts/agent-regression-teacher.ts",
    model: true,
  },
];

/** 跑一组，返回 { failed, passed, ok, output }。 */
function runSuite(suite) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--import",
        "./scripts/ts-loader.mjs",
        suite.file,
      ],
      { cwd: root, env: { ...process.env, NODE_OPTIONS: "" } },
    );

    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));

    child.on("close", (code) => {
      // TAP 摘要行形如 `# pass 11` / `# fail 0`。解析不到就说明这组
      // 根本没跑到断言阶段（例如 import 就炸了），按 0 处理并在摘要里
      // 标出「无摘要」—— 静默当成通过是最坏的结果。
      const passed = Number(output.match(/^# pass (\d+)/m)?.[1] ?? -1);
      const failed = Number(output.match(/^# fail (\d+)/m)?.[1] ?? -1);
      resolve({ ...suite, passed, failed, ok: code === 0, output });
    });
  });
}

const results = [];
for (const suite of SUITES) {
  process.stdout.write(`▶ ${suite.name} … `);
  const result = await runSuite(suite);
  results.push(result);
  process.stdout.write(
    result.ok
      ? `通过（${result.passed} 例）\n`
      : `失败（通过 ${result.passed} / 失败 ${result.failed}）\n`,
  );
}

const failedSuites = results.filter((item) => !item.ok);
const summary = results
  .map(
    (item) =>
      `  ${item.ok ? "ok  " : "FAIL"} ${item.name.padEnd(12)}${
        item.passed < 0 ? "无摘要" : `${item.passed} 例`
      }${item.model ? "（真模型）" : ""}`,
  )
  .join("\n");

console.log(`\n跑完 ${results.length} 组：`);
console.log(summary);

if (failedSuites.length > 0) {
  for (const item of failedSuites) {
    console.log(`\n===== ${item.name} 输出 =====`);
    console.log(item.output.trimEnd());
  }
  console.log(
    `\n=== 测试失败：${failedSuites.length} / ${results.length} 组 ===`,
  );
  process.exit(1);
}

console.log(`\n=== 全部 ${results.length} 组通过 ===`);
