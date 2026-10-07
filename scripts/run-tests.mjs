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
  { name: "教学循环 DB", file: "scripts/teaching-loop-spec.ts", model: false },
  {
    name: "教学结果表 DB",
    file: "scripts/teaching-results-spec.ts",
    model: false,
  },
  {
    name: "教学闭环 DB",
    file: "scripts/teaching-grade-spec.ts",
    model: false,
  },
  { name: "Trace 接线 DB", file: "scripts/trace-spec.ts", model: false },
  {
    name: "提示词预算",
    file: "scripts/prompt-budget-spec.ts",
    model: false,
  },
  { name: "安全过滤", file: "scripts/security-spec.ts", model: false },
  { name: "限流", file: "scripts/rate-limit-spec.ts", model: false },
  {
    name: "混合检索",
    file: "scripts/rag-hybrid-spec.ts",
    model: false,
  },
  {
    name: "学生记录写入",
    file: "scripts/student-records-spec.ts",
    model: false,
  },
  {
    name: "评分维度汇总",
    file: "scripts/report-dimensions-spec.ts",
    model: false,
  },
  {
    name: "提交点评接线",
    file: "scripts/validate-wiring-spec.ts",
    model: false,
  },
  {
    name: "讲解步骤身份层",
    file: "scripts/teaching-step-spec.ts",
    model: false,
  },
  {
    name: "讲稿缓存",
    file: "scripts/lecture-cache-spec.ts",
    model: false,
  },
  {
    name: "练习判定接线",
    file: "scripts/practice-mastery-spec.ts",
    model: false,
  },
  {
    name: "编辑器焦点",
    file: "scripts/editor-focus-spec.ts",
    model: false,
  },
  {
    name: "鉴权流程",
    file: "scripts/auth-flow-spec.ts",
    model: false,
  },
  {
    name: "数据隔离",
    file: "scripts/data-isolation-spec.ts",
    model: false,
  },
  {
    name: "SSE 协议",
    file: "scripts/sse-protocol-spec.ts",
    model: false,
  },
  {
    name: "分屏消息过滤",
    file: "scripts/lecture-split-spec.ts",
    model: false,
  },
  {
    name: "思维链归属",
    file: "scripts/thinking-attribution-spec.ts",
    model: false,
  },
  {
    name: "冷启动 + 模块内容",
    file: "scripts/explain-cold-start-spec.ts",
    model: false,
  },
  {
    name: "冷启动组件渲染",
    file: "scripts/explain-cold-start-component-spec.ts",
    model: false,
    jsdom: true,
  },
  {
    name: "概念页注入链路",
    file: "scripts/concept-injection-spec.ts",
    model: false,
  },
  {
    name: "Composer 发送链路",
    file: "scripts/composer-module-id-spec.ts",
    model: false,
    jsdom: true,
  },
  {
    name: "ChatRequestSchema 安全",
    file: "scripts/chat-schema-spec.ts",
    model: false,
  },
  {
    name: "ChatStream 静默与历史",
    file: "scripts/chat-stream-spec.ts",
    model: false,
    jsdom: true,
  },
  {
    name: "模块会话隔离",
    file: "scripts/module-switch-spec.ts",
    model: false,
  },
  {
    name: "SSE dispatch 翻译",
    file: "scripts/sse-dispatch-spec.ts",
    model: false,
  },
  {
    name: "ChatPanel 渲染",
    file: "scripts/chat-render-spec.ts",
    model: false,
    jsdom: true,
  },
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
  {
    name: "出题 Agent",
    file: "scripts/agent-regression-examiner.ts",
    model: true,
  },
];

/** 跑一组，返回 { failed, passed, ok, output }。 */
function runSuite(suite) {
  return new Promise((resolve) => {
    const args = [
      "--experimental-strip-types",
      "--import",
      "./scripts/ts-loader.mjs",
    ];

    // 组件测试需要 JSDOM 环境（React / testing-library 依赖浏览器 API）
    if (suite.jsdom) {
      args.push("--import", "./scripts/jsdom-setup.mjs");
    }

    args.push(suite.file);

    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: "" },
    });

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
