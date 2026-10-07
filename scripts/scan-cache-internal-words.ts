/**
 * 方案 A —— 对 lecture_cache 里已落库的开场讲稿做内部词扫描（确定性、可回归）。
 *
 * 注意：只能查「界面输出」（缓存表只有 content 字段），查不了 thinking
 * （thinking 不进缓存）。真正的 thinking 泄漏验证见 verify-thinking-leak.ts（方案 B）。
 * 本脚本是日常回归门禁：改完讲解提示词后重跑缓存，可用它确认「输出」层面没有
 * 把门禁 / 掌握度 / 编排层等内部词写进学生能看到的讲稿。
 *
 * 用法：
 *   node --experimental-strip-types --import ./scripts/ts-loader.mjs \
 *     scripts/scan-cache-internal-words.ts
 */
import { lectureCacheDb } from "@/lib/db";
import { loadModules } from "@/lib/modules";
import { AUTO_LECTURE_STEPS } from "@/lib/lecture-openers";

const INTERNAL_WORDS = [
  "铁律",
  "掌握度",
  "门禁",
  "前置模块",
  "编排层",
  "评分标准",
  "内部机制",
  "系统内部",
];

async function main(): Promise<void> {
  const modules = await loadModules();
  let hits = 0;
  for (const m of modules) {
    for (const step of AUTO_LECTURE_STEPS) {
      const row = await lectureCacheDb.get(m.id, step);
      if (!row) {
        console.log(`${m.id}:${step} 无缓存，跳过`);
        continue;
      }
      const found = INTERNAL_WORDS.filter((w) => row.content.includes(w));
      if (found.length > 0) {
        hits += 1;
        console.log(`❌ ${m.id}:${step} 输出含内部词: ${found.join(", ")}`);
      } else {
        console.log(`✅ ${m.id}:${step} 输出干净`);
      }
    }
  }
  console.log(
    hits === 0 ? "\n✅ 缓存讲稿输出无内部词" : `\n❌ ${hits} 处输出含内部词`,
  );
  if (hits > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
