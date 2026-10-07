/**
 * 讲稿预生成脚本 —— 把 9 模块 × 概念讲解 / 观察示范的开场讲稿提前生成好入库
 *
 * 为什么有这个脚本（2026-09-19）
 * ---------------------------
 * 学生反馈：「概念讲解不是提前准备好的吗？为什么点开要等模型响应？」
 * 此前进入这两步都由 LectureLauncher 现场发起真实模型调用（35~42 秒），
 * 且学习页对话不落库、刷新即重来 —— 同一份讲稿被反复生成、反复烧 token。
 * 本脚本把每讲固定的开场讲稿提前生成好写进 `lecture_cache` 表，
 * 运行期学生点开即有（缓存未命中时前端才回退实时生成）。
 *
 * 与现场生成同口径的保证
 * -------------------
 * - 提示词：与学习页同走 `resolveStepAgent` → `TEACHING_CHAT_SYSTEM_PROMPT`；
 * - 开场词：与工作区同走 `lectureOpenerPrompt`（两个消费方一份定义）；
 * - 模型：与运行时同走 `readArkSettings` 的 text 模型。
 * 任何一处改了而没重跑本脚本，缓存内容就会与现场口径脱节 —— 所以模型 /
 * 提示词升级后必须 `--force` 重跑整表（见 lecture-cache.ts 文件头）。
 *
 * 用法
 * ----
 *   node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/generate-lecture-cache.ts
 *   # 只重做某一讲某一步：
 *   #   ... scripts/generate-lecture-cache.ts --only=llm-api:explain
 *   # 覆盖已有缓存（默认跳过已存在的）：
 *   #   ... scripts/generate-lecture-cache.ts --force
 *
 * 成本与时长：18 篇 × 每篇 30~60 秒真实模型调用，全程约 10~20 分钟、
 * 数万 token。只在维护者显式运行时花钱，构建与运行期都不碰模型。
 */

import { lectureCacheDb } from "@/lib/db";
import { readArkSettings, assertArkApiKey } from "@/lib/agent/ark-config";
import { runAgentLoop } from "@/lib/agent/loop";
import { resolveStepAgent } from "@/lib/agent/step-prompt";
import {
  AUTO_LECTURE_STEPS,
  lectureOpenerPrompt,
  type AutoLectureStep,
} from "@/lib/lecture-openers";
import { splitLecture } from "@/lib/lecture-split";
import { loadModules } from "@/lib/modules";

// --- 参数解析 ---------------------------------------------------------------

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyArg = args.find((arg) => arg.startsWith("--only="));
const only = onlyArg === undefined ? null : onlyArg.slice("--only=".length);

/** --only=<module>:<step> 的过滤谓词；未传时全量。 */
function wanted(moduleId: string, step: string): boolean {
  if (only === null) return true;
  return `${moduleId}:${step}` === only;
}

// --- 主流程 -----------------------------------------------------------------

async function main(): Promise<void> {
  // 缺密钥在这里就报清楚，而不是让 18 次调用逐个失败。
  assertArkApiKey();
  const { textModel } = readArkSettings();

  const modules = await loadModules();
  const jobs: { moduleId: string; name: string; step: AutoLectureStep }[] = [];
  for (const teachingModule of modules) {
    for (const step of AUTO_LECTURE_STEPS) {
      if (wanted(teachingModule.id, step)) {
        jobs.push({
          moduleId: teachingModule.id,
          name: teachingModule.name,
          step,
        });
      }
    }
  }

  // 默认增量：已有缓存的跳过，便于中断后续跑。
  const pending: typeof jobs = [];
  for (const job of jobs) {
    if (FORCE) {
      pending.push(job);
      continue;
    }
    const existing = await lectureCacheDb.get(job.moduleId, job.step);
    if (existing === null) pending.push(job);
  }

  console.log(
    `共 ${jobs.length} 个任务，本次执行 ${pending.length} 个` +
      (FORCE ? "（--force 全部重做）" : "") +
      `，模型 ${textModel}`,
  );

  let ok = 0;
  let failed = 0;
  for (const [index, job] of pending.entries()) {
    const label = `[${index + 1}/${pending.length}] ${job.moduleId}:${job.step}`;
    const stepAgent = resolveStepAgent(job.step);
    if (!stepAgent.teaching) {
      // 防漂移闸门：步骤白名单若与 step-prompt 的教学口径脱节，这里立刻停。
      throw new Error(
        `${label} 不在讲解导师的接管范围内，请检查 lecture-openers.ts`,
      );
    }

    process.stdout.write(`${label} 生成中…\n`);
    const startedAt = Date.now();
    const loop = runAgentLoop({
      prompt: lectureOpenerPrompt(job.step, job.name),
      agent: stepAgent.id,
      systemPrompt: stepAgent.systemPrompt,
    });
    // SSE 响应无人消费；cancel 掉读端，避免队列无意义滞留。
    void loop.response.body?.cancel().catch(() => {});
    const summary = await loop.completed;

    if (!summary.ok || summary.text.trim() === "") {
      failed += 1;
      console.error(`${label} 失败：${summary.error ?? "模型输出为空"}`);
      continue;
    }

    // 截断守卫（实测教训）：模型输出 token 有 8192 上限，思考吃得太多时
    // **正文会被拦腰砍断**（实测 multi-agent:observe 只剩 76 字、半句收尾；
    // llm-wiki:observe 死在半行列表项上）。残稿绝不能进缓存 —— 学生会看到
    // 「导师话说一半」。两个信号：output 顶到上限、正文短得反常。
    if (summary.tokens.output >= 8000 || summary.text.length < 800) {
      failed += 1;
      console.error(
        `${label} 疑似截断（output ${summary.tokens.output} tok / ${summary.text.length} 字），不写入缓存。重跑：--only=${job.moduleId}:${job.step} --force`,
      );
      continue;
    }

    // 结构守卫（2026-10-07 审计 C2）：讲稿必须含「五、现在轮到你」任务节
    // —— 动手模仿页任务卡从这一节抽题面，缺节 = 任务卡全站消失。缺节多半
    // 不是模型偷懒，是提示词的结构声明被「停在这里」类互动约束压过（实测
    // 11/11 模块缓存截断在测验），修提示词而不是重试。
    if (splitLecture(summary.text).assignment === null) {
      failed += 1;
      console.error(
        `${label} 缺少「五、现在轮到你」任务节，不写入缓存。检查 teaching-chat.ts 的结构声明后重跑：--only=${job.moduleId}:${job.step} --force`,
      );
      continue;
    }

    await lectureCacheDb.upsert({
      moduleId: job.moduleId,
      step: job.step,
      content: summary.text,
      model: textModel,
      inputTokens: summary.tokens.input,
      outputTokens: summary.tokens.output,
    });
    ok += 1;
    console.log(
      `${label} 完成：${summary.text.length} 字 / ${Math.round((Date.now() - startedAt) / 1000)}s / out ${summary.tokens.output} tok`,
    );
  }

  const total = await lectureCacheDb.count();
  console.log(`\n完成：成功 ${ok}、失败 ${failed}，缓存现有 ${total} 份讲稿。`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
