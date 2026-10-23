/**
 * 复刻平台校验工具解析器规格测试
 *
 * 测试 `src/lib/replica-check-parser.ts` 的四种导出：
 *   1. `parseStandaloneScript` —— Phase 0/1 独立脚本 markdown
 *   2. `parseAgentTool` —— Phase 2+ Agent 工具 markdown
 *   3. `extractCodeBlockFromMarkdown` —— 提取代码块内容
 *   4. `isStandalonePhase` —— 模式判定边界
 *
 * 运行：pnpm test:replica-check
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  extractCodeBlockFromMarkdown,
  isStandalonePhase,
  parseAgentTool,
  parseStandaloneScript,
} from "../src/lib/replica-check-parser";

// ── 辅助：读取 skill 文件 ──
function readSkillFile(name: string): string {
  return readFileSync(
    new URL(`../skills/${name}.md`, import.meta.url),
    "utf8",
  );
}

// ═══════════════════════════════════════════════════════════════════
// parseStandaloneScript
// ═══════════════════════════════════════════════════════════════════

test("parseStandaloneScript 正确解析 Phase 0 启动台验收脚本", () => {
  const raw = readSkillFile("platform-replica-00-check");
  const result = parseStandaloneScript(raw);

  // intro——描述性文字，必须非空
  assert.ok(result.intro.length > 10, "intro 不应为空");

  // script——必须包含可执行的 TypeScript
  assert.ok(result.script.length > 200, "脚本内容过短");
  assert.match(result.script, /import.*execSync.*node:child_process/);
  assert.match(result.script, /import.*existsSync.*node:fs/);
  assert.match(result.script, /node --version/);
  assert.match(result.script, /git --version/);
  assert.match(result.script, /package\.json/);
  assert.match(result.script, /\.env\.local/);
  assert.match(result.script, /git log --oneline/);

  // runInstructions——包含运行命令
  assert.ok(result.runInstructions.length > 0, "运行说明不应为空");
  assert.match(result.runInstructions, /npx tsx/);
  assert.match(result.runInstructions, /check-startup\.ts/);

  // expectedOutput——包含预期输出示例
  assert.ok(result.expectedOutput.length > 0, "预期输出不应为空");
  assert.match(result.expectedOutput, /启动台验收/);
  assert.match(result.expectedOutput, /✓/);
});

test("parseStandaloneScript 正确解析 Phase 1 第一斧验收脚本", () => {
  const raw = readSkillFile("platform-replica-01-check");
  const result = parseStandaloneScript(raw);

  assert.ok(result.intro.length > 10);

  // script 检查点不同
  assert.match(result.script, /ReadableStream/);
  assert.match(result.script, /text\/event-stream/);
  assert.match(result.script, /chat-panel\.tsx/);
  assert.match(result.script, /DEEPSEEK_API_KEY/);

  assert.match(result.runInstructions, /npx tsx/);
  assert.match(result.runInstructions, /check-chat\.ts/);

  assert.match(result.expectedOutput, /第一斧验收/);
});

test("parseStandaloneScript 在缺少章节时不抛异常，返回空串", () => {
  const minimal = "# 标题\n\n只有标题和正文。\n\n---\n";
  const result = parseStandaloneScript(minimal);

  assert.equal(result.intro, "只有标题和正文。");
  assert.equal(result.script, "");
  assert.equal(result.runInstructions, "");
  assert.equal(result.expectedOutput, "");
});

test("parseStandaloneScript 正确处理编码——中文标题和内容", () => {
  const raw = readSkillFile("platform-replica-00-check");
  const result = parseStandaloneScript(raw);

  // 中文 content 必须完整保留
  assert.match(result.intro, /终端/);
  assert.match(result.intro, /Agent Loop/);
  assert.match(result.runInstructions, /teaching-platform/);
});

// ═══════════════════════════════════════════════════════════════════
// parseAgentTool
// ═══════════════════════════════════════════════════════════════════

test("parseAgentTool 正确解析 Phase 2 第二斧 Agent 工具", () => {
  const raw = readSkillFile("platform-replica-02-check");
  const result = parseAgentTool(raw);

  assert.ok(result.intro.length > 10);
  assert.equal(result.codeSections.length, 2, "必须有两个代码段：工具 Schema + 执行函数");

  // 工具 Schema
  const schema = result.codeSections[0];
  assert.equal(schema.title, "工具 Schema");
  assert.match(schema.code, /type.*"function"/);
  assert.match(schema.code, /check_agent_loop/);
  assert.match(schema.code, /description/);
  assert.match(schema.code, /parameters/);

  // 执行函数
  const execute = result.codeSections[1];
  assert.equal(execute.title, "执行函数");
  assert.match(execute.code, /async function/);
  assert.match(execute.code, /readFileSync|existsSync|execSync/);

  assert.ok(result.installSteps.length > 0, "必须有安装步骤");
  assert.ok(result.usage.length > 0, "必须有使用方法");
});

test("parseAgentTool 正确解析 Phase 3 第三斧 Agent 工具", () => {
  const raw = readSkillFile("platform-replica-03-check");
  const result = parseAgentTool(raw);

  assert.equal(result.codeSections.length, 2);

  const schema = result.codeSections[0];
  assert.match(schema.code, /check_knowledge/);

  const execute = result.codeSections[1];
  assert.match(execute.code, /async function/);
});

test("parseAgentTool 正确解析 Phase 4 龙骨 Agent 工具", () => {
  const raw = readSkillFile("platform-replica-04-check");
  const result = parseAgentTool(raw);

  assert.equal(result.codeSections.length, 2);

  const schema = result.codeSections[0];
  assert.match(schema.code, /check_pages/);

  // 执行函数必须扫四个页面
  const execute = result.codeSections[1];
  assert.match(execute.code, /page\.tsx/);
});

test("parseAgentTool 正确解析 Phase 5 最终验收 Agent 工具", () => {
  const raw = readSkillFile("platform-replica-05-check");
  const result = parseAgentTool(raw);

  assert.equal(result.codeSections.length, 2);

  const schema = result.codeSections[0];
  assert.match(schema.code, /check_final/);

  const execute = result.codeSections[1];
  // 最终验收脚本必须包含 Git 日志检查
  assert.match(execute.code, /git log/);

  // usage 里提到"最终验收"
  assert.match(result.usage, /最终验收|check_final/);
});

test("parseAgentTool 在缺少章节时不抛异常，返回空串", () => {
  const minimal = "# 标题\n\n只有标题和正文。\n\n---\n";
  const result = parseAgentTool(minimal);

  assert.equal(result.intro, "只有标题和正文。");
  assert.equal(result.codeSections.length, 0);
  assert.equal(result.installSteps, "");
  assert.equal(result.usage, "");
});

// ═══════════════════════════════════════════════════════════════════
// extractCodeBlockFromMarkdown
// ═══════════════════════════════════════════════════════════════════

test("extractCodeBlockFromMarkdown 提取 bash 代码块", () => {
  const md = `## 怎么运行\n\n\`\`\`bash
# 在 teaching-platform/ 目录下
npx tsx check-startup.ts
\`\`\``;

  const result = extractCodeBlockFromMarkdown(md);
  assert.match(result, /npx tsx check-startup\.ts/);
  assert.doesNotMatch(result, /```/);
  assert.doesNotMatch(result, /bash/);
});

test("extractCodeBlockFromMarkdown 提取无语言标签的代码块", () => {
  const md = "```\nhello world\n```";
  const result = extractCodeBlockFromMarkdown(md);
  assert.equal(result, "hello world");
});

test("extractCodeBlockFromMarkdown 无代码块时返回原文", () => {
  const md = "这是纯文本，没有代码块。";
  const result = extractCodeBlockFromMarkdown(md);
  assert.equal(result, "这是纯文本，没有代码块。");
});

test("extractCodeBlockFromMarkdown 空字符串不抛异常", () => {
  const result = extractCodeBlockFromMarkdown("");
  assert.equal(result, "");
});

// ═══════════════════════════════════════════════════════════════════
// isStandalonePhase
// ═══════════════════════════════════════════════════════════════════

test("isStandalonePhase 边界：Phase 0/1 返回 true", () => {
  assert.equal(isStandalonePhase(0), true);
  assert.equal(isStandalonePhase(1), true);
});

test("isStandalonePhase 边界：Phase 2+ 返回 false", () => {
  for (const idx of [2, 3, 4, 5, 6, 10]) {
    assert.equal(isStandalonePhase(idx), false, `phase ${idx} 应为 Agent 工具模式`);
  }
});

test("isStandalonePhase 边界：负数返回 true（防御性——不会出现在生产环境）", () => {
  assert.equal(isStandalonePhase(-1), true);
});

// ═══════════════════════════════════════════════════════════════════
// 跨模式——确保两种解析器不互相干扰
// ═══════════════════════════════════════════════════════════════════

test("独立脚本 markdown 喂给 parseAgentTool 不会崩", () => {
  const raw = readSkillFile("platform-replica-00-check");
  const result = parseAgentTool(raw);

  // 应该能解析，但 codeSections 为空（因为章节标题不匹配）
  assert.equal(result.codeSections.length, 0);
  assert.ok(result.intro.length > 0, "intro 至少能读到");
});

test("Agent 工具 markdown 喂给 parseStandaloneScript 不会崩", () => {
  const raw = readSkillFile("platform-replica-02-check");
  const result = parseStandaloneScript(raw);

  // script 应为空（没有「验收脚本」章节）
  assert.equal(result.script, "");
  assert.ok(result.intro.length > 0);
});

// ═══════════════════════════════════════════════════════════════════
// 真实文件完整性——确保 6 个 skill 文件格式不被破坏
// ═══════════════════════════════════════════════════════════════════

for (const { idx, name, mode } of [
  { idx: 0, name: "启动台", mode: "standalone" },
  { idx: 1, name: "第一斧", mode: "standalone" },
  { idx: 2, name: "第二斧", mode: "agent" },
  { idx: 3, name: "第三斧", mode: "agent" },
  { idx: 4, name: "龙骨", mode: "agent" },
  { idx: 5, name: "结算", mode: "agent" },
] as const) {
  test(`skill 文件 ${idx}（${name}）格式完整——${mode} 模式`, () => {
    const fileId = `platform-replica-${String(idx).padStart(2, "0")}-check`;
    const raw = readSkillFile(fileId);

    // 每个文件必须有标题和 intro 段落
    assert.match(raw, /^# .+\r?\n\r?\n[\s\S]+?\r?\n---\r?\n/m, `${name} 缺少标题 + --- 分隔线`);

    if (mode === "standalone") {
      const result = parseStandaloneScript(raw);
      assert.ok(result.intro.length > 10, `${name} intro 过短`);
      assert.ok(result.script.length > 100, `${name} 脚本内容过短`);
      assert.match(result.script, /import /, `${name} 脚本必须含 import 语句`);
      assert.ok(result.runInstructions.length > 0, `${name} 缺少「怎么运行」`);
      assert.ok(result.expectedOutput.length > 0, `${name} 缺少「你会看到什么」`);
    } else {
      const result = parseAgentTool(raw);
      assert.ok(result.intro.length > 10, `${name} intro 过短`);
      assert.equal(result.codeSections.length, 2, `${name} 必须有 2 个代码段`);
      assert.equal(result.codeSections[0].title, "工具 Schema");
      assert.match(result.codeSections[0].code, /type.*"function"/, `${name} Schema 缺少 type: "function"`);
      assert.equal(result.codeSections[1].title, "执行函数");
      assert.match(result.codeSections[1].code, /async function/, `${name} 执行函数缺少 async function`);
      assert.ok(result.installSteps.length > 0, `${name} 缺少安装步骤`);
      assert.ok(result.usage.length > 0, `${name} 缺少使用方法`);
    }
  });
}