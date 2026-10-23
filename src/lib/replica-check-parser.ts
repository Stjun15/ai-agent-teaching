/**
 * 复刻平台校验工具解析器
 *
 * 工具箱「Agent 自查」Tab 的内容来自 skills/ 下的 markdown 文件。
 * 这些文件有两种格式，取决于阶段：
 *   - 独立脚本模式（Phase 0/1）：一段可独立运行的 TypeScript 脚本
 *   - Agent 工具模式（Phase 2+）：工具 Schema + 执行函数，装进 agent-loop.ts
 *
 * 本模块提供两种格式的解析函数，以及一个通用辅助函数。
 *
 * 注：所有函数内部统一把 `\r\n` 转为 `\n`，以兼容 Windows 上的 Git autocrlf。
 */

// ── 内部：统一换行符 ——
function normalise(md: string): string {
  return md.replace(/\r\n/g, "\n");
}

// ── Agent 工具模式 ——
export interface CodeSection {
  title: string;
  code: string;
}

export interface AgentToolContent {
  intro: string;
  codeSections: CodeSection[];
  installSteps: string;
  usage: string;
}

export function parseAgentTool(markdown: string): AgentToolContent {
  const md = normalise(markdown);

  const introMatch = md.match(/^# .+\n\n([\s\S]*?)(?=\n---\n)/);
  const intro = introMatch?.[1]?.trim() ?? "";

  const codeSections: CodeSection[] = [];
  const codeBlockRegex =
    /## (工具 Schema|执行函数)\n\n[\s\S]*?```typescript\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(md)) !== null) {
    codeSections.push({ title: match[1], code: match[2].trim() });
  }

  const installMatch = md.match(
    /## 安装步骤\n\n([\s\S]*?)(?=\n## 使用方法)/,
  );
  const installSteps = installMatch?.[1]?.trim() ?? "";

  const usageMatch = md.match(/## 使用方法\n\n([\s\S]*?)$/);
  const usage = usageMatch?.[1]?.trim() ?? "";
  const cleanUsage = usage.replace(/\n---\n[\s\S]*$/, "").trim();

  return { intro, codeSections, installSteps, usage: cleanUsage };
}

// ── 独立脚本模式 ——
export interface StandaloneScriptContent {
  intro: string;
  script: string;
  runInstructions: string;
  expectedOutput: string;
}

export function parseStandaloneScript(
  markdown: string,
): StandaloneScriptContent {
  const md = normalise(markdown);

  const introMatch = md.match(/^# .+\n\n([\s\S]*?)(?=\n---\n)/);
  const intro = introMatch?.[1]?.trim() ?? "";

  const scriptMatch = md.match(
    /## 验收脚本\n\n```typescript\n([\s\S]*?)```/,
  );
  const script = scriptMatch?.[1]?.trim() ?? "";

  const runMatch = md.match(
    /## 怎么运行\n\n([\s\S]*?)(?=\n## 你会看到什么)/,
  );
  const runInstructions = runMatch?.[1]?.trim() ?? "";

  const outputMatch = md.match(/## 你会看到什么\n\n([\s\S]*?)$/);
  const expectedOutput = outputMatch?.[1]?.trim() ?? "";

  return { intro, script, runInstructions, expectedOutput };
}

// ── 通用工具 ——
export function extractCodeBlockFromMarkdown(md: string): string {
  const normalised = normalise(md);
  const match = normalised.match(/```[\s\S]*?\n([\s\S]*?)```/);
  return match?.[1]?.trim() ?? md;
}

// ── 模式判定 ——
export function isStandalonePhase(phaseIndex: number): boolean {
  return phaseIndex <= 1;
}