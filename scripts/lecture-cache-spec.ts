/**
 * 讲稿缓存（lecture_cache）守卫
 *
 * 钉什么（2026-09-19「点开即有」改造）
 * --------------------------------
 * 1. **DB 闭环**：upsert → get 读回一致、覆盖更新生效、step CHECK 拒绝非
 *    缓存步骤（这是迁移里的约束，repo 层不做重复校验，约束被绕过时它拦）。
 * 2. **缓存优先接线**：LectureLauncher 必须先查 /api/lecture-cache 并
 *    seedLecture，实时 send 只能是回退分支 —— 顺序颠倒了「点开即有」就名存实亡。
 * 3. **注入消息的 agent 标识**必须与实时路径同源（TEACHING_AGENT_ID），
 *    否则同一份讲稿两种来源在界面上长得不一样。
 * 4. **步骤标签贯穿**：beginTurn 收 step、助手消息经 turnStep 继承 ——
 *    没有它，「这一步开过场没有」无从判断。
 * 5. **迁移已应用**：002_lecture_cache.sql 必须在 schema_migrations 里
 *    （DB 用例顺带验证表真实存在）。
 *
 * 全组不调模型（见 AGENTS.md 第四节分级）。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { lectureCacheDb } from "@/lib/db";
// 迁移记录的读取在驱动层文件里（健康检查同款用法），测试直接取用。
import { listAppliedMigrationIds } from "@/lib/db/sqlite";

test("讲稿缓存 DB 闭环：写入读回、覆盖更新、count", async () => {
  const before = await lectureCacheDb.count();

  await lectureCacheDb.upsert({
    moduleId: "spec-lecture-cache-probe",
    step: "explain",
    content: "第一版讲稿",
    model: "spec-model",
    inputTokens: 10,
    outputTokens: 20,
  });

  const first = await lectureCacheDb.get("spec-lecture-cache-probe", "explain");
  assert.ok(first !== null, "upsert 后必须能读到");
  assert.equal(first.content, "第一版讲稿");
  assert.equal(first.model, "spec-model");
  assert.equal(first.inputTokens, 10);
  assert.equal(first.outputTokens, 20);
  assert.ok(first.createdAt.length > 0, "created_at 应由数据库默认值填充");

  // 覆盖更新：同键再写一遍必须替换内容而不是报错或堆第二行。
  await lectureCacheDb.upsert({
    moduleId: "spec-lecture-cache-probe",
    step: "explain",
    content: "第二版讲稿",
    model: "spec-model-2",
    inputTokens: 11,
    outputTokens: 22,
  });
  const second = await lectureCacheDb.get(
    "spec-lecture-cache-probe",
    "explain",
  );
  assert.ok(second !== null);
  assert.equal(second.content, "第二版讲稿");
  assert.equal(second.model, "spec-model-2");

  // 缓存未命中返回 null —— 前端据此回退实时生成，不能抛错。
  assert.equal(
    await lectureCacheDb.get("spec-lecture-cache-probe", "observe"),
    null,
  );
  assert.equal(await lectureCacheDb.get("no-such-module", "explain"), null);

  // 清理探针行，count 回到起点。
  const { getDb } = await import("@/lib/db/sqlite");
  getDb()
    .prepare("DELETE FROM lecture_cache WHERE module_id = ?")
    .run("spec-lecture-cache-probe");
  assert.equal(await lectureCacheDb.count(), before, "探针行必须清干净");
});

test("lecture_cache 表的 step CHECK 拦截非缓存步骤", async () => {
  const { getDb } = await import("@/lib/db/sqlite");
  // repo 的类型只允许 explain/observe，故意绕过类型直写 SQL，验证数据库约束真的在。
  assert.throws(
    () =>
      getDb()
        .prepare(
          "INSERT INTO lecture_cache (module_id, step, content, model) VALUES (?, ?, ?, ?)",
        )
        .run("spec-probe", "imitate", "不该被写入", "spec-model"),
    "step = 'imitate' 必须被 CHECK 拒绝 —— 其它步骤没有预生成讲稿的设计",
  );
});

test("002 迁移已应用（讲稿缓存表真实存在）", () => {
  const applied = listAppliedMigrationIds();
  assert.ok(
    applied.includes("002_lecture_cache.sql"),
    `schema_migrations 里应有 002_lecture_cache.sql，实际：${applied.join("、")}`,
  );
});

test("LectureLauncher 缓存优先，实时生成只是回退（文本守卫）", () => {
  const launcher = readFileSync(
    new URL("../src/components/chat/lecture-launcher.tsx", import.meta.url),
    "utf8",
  );

  const fetchAt = launcher.indexOf("/api/lecture-cache");
  const seedAt = launcher.indexOf("seedLecture");
  const sendAt = launcher.indexOf("await send(");
  assert.ok(fetchAt !== -1, "必须先查讲稿缓存端点");
  assert.ok(seedAt !== -1, "命中后必须用 seedLecture 注入讲稿");
  assert.ok(
    sendAt !== -1,
    "缓存未命中要回退实时生成（新部署还没跑脚本时可用）",
  );
  assert.ok(
    fetchAt < seedAt && seedAt < sendAt,
    "顺序必须是 查缓存 → 注入 → （回退）实时生成 —— 顺序颠倒「点开即有」就名存实亡",
  );
  assert.match(
    launcher,
    /status\.seedLecture|state\.seedLecture/,
    "注入必须走 store 的 seedLecture，不能自己拼消息数组",
  );
});

test("注入讲稿的 agent 标识与实时路径同源（文本守卫）", () => {
  const store = readFileSync(
    new URL("../src/stores/session.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    store,
    /agent:\s*TEACHING_AGENT_ID/,
    "seedLecture 的消息 agent 必须用 TEACHING_AGENT_ID —— 两种来源显示要一致",
  );
  assert.match(
    store,
    /turnStep/,
    "助手消息要经 turnStep 继承本轮步骤标签（appendToken 懒创建时打上）",
  );
});

test("缓存端点校验 step 取值（文本守卫）", () => {
  const route = readFileSync(
    new URL("../src/app/api/lecture-cache/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    route,
    /CACHED_STEPS\.has\(step\)/,
    "GET /api/lecture-cache 必须校验 step 只能是 explain / observe",
  );
  assert.match(
    route,
    /found:\s*false/,
    "未命中要返回 found:false（正常分支）而不是 404（异常）",
  );
});

test("预生成脚本与工作区共用开场词（文本守卫）", () => {
  const openers = readFileSync(
    new URL("../src/lib/lecture-openers.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    openers,
    /export function lectureOpenerPrompt/,
    "开场词必须收敛到共享模块 —— 它是缓存键的一部分，两处各写一份必然漂移",
  );

  const workspace = readFileSync(
    new URL("../src/components/learn/module-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    workspace,
    /lectureOpenerPrompt\(\s*currentStepId/,
    "工作区必须用共享开场词，不许回退内联字符串",
  );

  const script = readFileSync(
    new URL("./generate-lecture-cache.ts", import.meta.url),
    "utf8",
  );
  assert.match(script, /lectureOpenerPrompt\(/, "预生成脚本必须用同一份开场词");
  assert.match(
    script,
    /resolveStepAgent\(/,
    "预生成脚本必须走与运行时相同的身份层映射（否则缓存的口径与现场不一致）",
  );
});
