/**
 * 思维链内部口径泄漏验证（方案 B）—— 唯一能验证 thinking 的路径。
 *
 * 讲稿缓存不含 thinking 字段（generate-lecture-cache.ts 在收完正文后直接
 * `loop.response.body?.cancel()` 把 SSE 正文丢弃），所以确定性检查查不了
 * thinking，只能实时跑教学 Agent、抓取 thinking 流、扫描内部词来核验。
 *
 * 用法：
 *   node --experimental-strip-types --import ./scripts/ts-loader.mjs \
 *     scripts/verify-thinking-leak.ts [--modules=system-prompt,mcp,platform-replica,llm-api]
 *
 * 判定：任一模块的 thinking 文本里出现内部词即 FAIL（说明铁律5延伸到 thinking
 * 后模型仍在思维链里复述系统内部词）。
 */
import { runAgentLoop } from "@/lib/agent/loop";
import { resolveStepAgent } from "@/lib/agent/step-prompt";
import {
  lectureOpenerPrompt,
  type AutoLectureStep,
} from "@/lib/lecture-openers";
import { loadModules } from "@/lib/modules";

const INTERNAL_WORDS = [
  "铁律",
  "掌握度",
  "门禁",
  "前置模块",
  "编排层",
  "评分标准",
  "内部机制",
  "系统内部",
  "根据铁律",
];

type SSEFrame = { type?: string; data?: { content?: string } };

async function collectThinking(
  body: ReadableStream<Uint8Array> | null,
): Promise<{ thinking: string; errors: string[] }> {
  if (!body) return { thinking: "", errors: [] };
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const errors: string[] = [];
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const evt = JSON.parse(dataLine.slice("data: ".length)) as SSEFrame & {
          data?: { message?: string; code?: string };
        };
        if (evt.type === "thinking" && evt.data?.content) {
          chunks.push(evt.data.content);
        } else if (evt.type === "error") {
          errors.push(`${evt.data?.code ?? "?"}: ${evt.data?.message ?? ""}`);
        }
      } catch {
        // 非 JSON 帧（如注释行）忽略
      }
    }
  }
  return { thinking: chunks.join(""), errors };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const modulesArg = args.find((a) => a.startsWith("--modules="));
  const requested = modulesArg?.slice("--modules=".length).split(",");

  const modules = await loadModules();
  const targets =
    requested && requested.length > 0
      ? modules.filter((m) => requested.includes(m.id))
      : modules.slice(0, 4);

  const step: AutoLectureStep = "explain";
  const stepAgent = resolveStepAgent(step);
  if (!stepAgent.teaching) {
    throw new Error(`${step} 不在教学 Agent 接管范围内`);
  }

  let failed = 0;
  for (const m of targets) {
    const loop = runAgentLoop({
      prompt: lectureOpenerPrompt(step, m.name),
      agent: stepAgent.id,
      systemPrompt: stepAgent.systemPrompt,
    });
    const { thinking, errors } = await collectThinking(loop.response.body);
    const summary = await loop.completed;
    const hits = INTERNAL_WORDS.filter((w) => thinking.includes(w));
    const clean = summary.ok && hits.length === 0 && errors.length === 0;
    if (!clean) failed += 1;
    console.log(
      `[${m.id}:${step}] ok=${summary.ok} thinkingChars=${thinking.length} ` +
        `internalHits=${hits.length} errors=${errors.length} ${hits.join(",")}`,
    );
    if (summary.error) console.log(`   summary.error=${summary.error}`);
    for (const e of errors) console.log(`   sse.error=${e}`);
    for (const w of hits) {
      const i = thinking.indexOf(w);
      console.log(
        `   …${thinking.slice(Math.max(0, i - 30), i + w.length + 30)}…`,
      );
    }
  }
  console.log(
    failed === 0
      ? "\n✅ 思维链无内部口径泄漏"
      : `\n❌ ${failed} 个模块思维链仍泄漏内部词`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
