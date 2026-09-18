#!/usr/bin/env node
/**
 * 种子测试学生
 *
 * 用法：node scripts/seed-test-student.mjs
 *
 * 为什么需要它
 * -----------
 * `dev.db` 在 .gitignore 里（第 35 行 `*.db`），所以每次全新克隆拿到的是
 * **空库** —— 六个学生端点、会话端点、SSE 全部会返回 404/空数组，
 * 看上去像「接口坏了」，实际是没数据。本脚本把「有一个学生、有画像、
 * 有两条掌握度」这个最小可测状态固化下来，让接口能被真实地打一遍。
 *
 * 为什么 id 必须是 UUID
 * -------------------
 * `CreateSessionSchema` / `ValidateSchema` 等一律要求 `studentId` 是
 * `z.string().uuid()`（出处 `api-spec.md` 第八节）。手搓的 `stu_test`
 * 会被 400 挡掉 —— 用它测出来的「接口不工作」是假故障。
 * 线上 id 由 `src/lib/db/helpers.ts#newId` 的 `crypto.randomUUID()` 生成，
 * 同样是 UUID，所以种子数据用固定 UUID 与生产保持同形。
 *
 * 幂等：重复执行不会产生重复行，只会把画像与掌握度刷成同一状态。
 *
 * 学生 id 从哪来
 * ------------
 * 从 `src/lib/demo-student.json` 读，不在这里写第二份。浏览器侧
 * （`src/lib/client-identity.ts`）在没有登录/引导流程之前也要用同一个 id
 * 发请求 —— 两处各写一份固定 UUID，改一处忘另一处，现象是「接口全报
 * 学生不存在」，而两边代码看上去都对。
 */

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

/** 与浏览器侧共用的种子学生身份。 */
const DEMO_STUDENT = JSON.parse(
  readFileSync(
    new URL("../src/lib/demo-student.json", import.meta.url),
    "utf8",
  ),
);

/** 固定 UUID，方便在 curl / 浏览器里手写。npm script 名见文件尾。 */
export const TEST_STUDENT_ID = DEMO_STUDENT.studentId;

function resolveDbPath() {
  const raw = process.env.DATABASE_URL?.trim();
  const withoutScheme = raw?.startsWith("file:")
    ? raw.slice("file:".length)
    : raw;
  const relative =
    withoutScheme && withoutScheme.length > 0 ? withoutScheme : "dev.db";
  return path.resolve(process.cwd(), relative);
}

function main() {
  const dbPath = resolveDbPath();
  console.log("种子目标:", dbPath);

  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO students (id, nickname, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname,
                                     updated_at = excluded.updated_at`,
    ).run(TEST_STUDENT_ID, "种子学生", "seed@example.com", now, now);

    db.prepare(
      `INSERT INTO student_profiles (
         student_id, programming_background, learning_goal,
         preferred_language, pace, explanation_style,
         hint_preference, feedback_preference, visual_preference, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id) DO UPDATE SET
         programming_background = excluded.programming_background,
         learning_goal          = excluded.learning_goal,
         updated_at             = excluded.updated_at`,
    ).run(
      TEST_STUDENT_ID,
      "beginner",
      "做出一个能跑的 AI Agent",
      "typescript",
      "normal",
      "analogy",
      "try_first",
      "encouraging",
      "animation",
      now,
    );

    // 第一条概念掌握度 4 分：够当 llm-api 之后模块的前置（阈值见
    // PREREQUISITE_MIN_MASTERY）。第二条 1 分：用来验证「前置未掌握 → 403」。
    const masteryRows = [
      ["llm-api", 4, 0, "mastered"],
      ["system-prompt", 1, 2, "needs_review"],
    ];
    const upsertMastery = db.prepare(
      `INSERT INTO mastery (student_id, concept_id, score, error_count, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, concept_id) DO UPDATE SET
         score = excluded.score,
         error_count = excluded.error_count,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    );
    for (const [conceptId, score, errorCount, status] of masteryRows) {
      upsertMastery.run(
        TEST_STUDENT_ID,
        conceptId,
        score,
        errorCount,
        status,
        now,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  console.log("已写入测试学生:", TEST_STUDENT_ID);
  console.log("  mastery: llm-api=4/mastered, system-prompt=1/needs_review");
}

main();
