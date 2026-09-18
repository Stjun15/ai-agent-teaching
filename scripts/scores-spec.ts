/**
 * 分数量纲规格测试
 *
 * 守的是一件事：**代码里的掌握度满分，必须等于数据库建表约束里的满分**。
 *
 * 为什么这条值得单独测
 * ------------------
 * 掌握度是 `number`，两种量纲（0~5 与 0~100）在类型上完全一样，编译器一个字
 * 都不会说。而本项目已经因此埋了一个错：`levelOfScore` 的门槛按 0~100 写成
 * 90/75/60，数据源却是 0~5 —— 种子数据里 `llm-api = 4`（已是 `mastered`）
 * 会被判成「不及格」。它当时是潜伏的（`hydrate` 无调用方，卡片恒显示
 * 「尚未测评」），所以没有任何现象提示。
 *
 * 所以这里做两件事：
 *   1. **跨源比对**：从 `001_init.sql` 里把 `CHECK (score <= N)` 的 N 抠出来，
 *      断言它与 `MASTERY_MAX_SCORE` 相同。改了一边忘另一边，这条会报红；
 *   2. **钉住具体值**：0~5 各档的档位与百分比，包括种子数据里的两个真实取值
 *      （4 必须是「优秀」，1 必须是「不及格」）。
 *
 * 运行：
 *   pnpm test:scores
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MASTERY_MAX_SCORE,
  MASTERY_PASS_SCORE,
  masteryToPercent,
  levelOfMastery,
} from "@/lib/scores";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = readFileSync(
  path.join(root, "src/lib/db/migrations/001_init.sql"),
  "utf8",
);

test("代码里的掌握度满分与建表 CHECK 约束一致", () => {
  // 从 mastery 表的定义里抠出上界。不改写成「硬编码 5」的原因就是这条用例
  // 的全部意义：两边必须真的对上，而不是我以为它们对上了。
  const table = MIGRATION.match(/CREATE TABLE mastery \(([\s\S]*?)\);/);
  assert.ok(table, "没有在迁移文件里找到 mastery 表的建表语句");

  const bound = table[1].match(
    /CHECK\s*\(\s*score\s*>=\s*0\s+AND\s+score\s*<=\s*(\d+)\s*\)/,
  );
  assert.ok(
    bound,
    "mastery.score 上没有找到 CHECK (score >= 0 AND score <= N) 约束",
  );

  assert.equal(
    Number(bound[1]),
    MASTERY_MAX_SCORE,
    `建表约束的上界是 ${bound[1]}，而 MASTERY_MAX_SCORE 是 ${MASTERY_MAX_SCORE}`,
  );
});

test("masteryToPercent：把 0~5 换算成百分比", () => {
  assert.equal(masteryToPercent(0), 0);
  assert.equal(masteryToPercent(MASTERY_MAX_SCORE), 100);
  assert.equal(masteryToPercent(4), 80);
  assert.equal(masteryToPercent(3), 60);
  // 越界与非法值都夹回范围内：数据库不会给出这些值，但界面上不该出现
  // 「120 / 100」或「NaN / 100」这种更糟的显示。
  assert.equal(masteryToPercent(7), 100);
  assert.equal(masteryToPercent(-1), 0);
  assert.equal(masteryToPercent(Number.NaN), 0);
});

test("levelOfMastery：档位按 0~5 分档，不是按 0~100", () => {
  assert.equal(levelOfMastery(5), "优秀");
  assert.equal(levelOfMastery(4), "优秀");
  assert.equal(levelOfMastery(MASTERY_PASS_SCORE), "良好");
  assert.equal(levelOfMastery(2), "及格");
  assert.equal(levelOfMastery(1), "不及格");
  assert.equal(levelOfMastery(0), "不及格");
});

test("种子数据里的两个真实取值分档正确", () => {
  // `scripts/seed-test-student.mjs` 建的是 llm-api=4/mastered、
  // system-prompt=1/needs_review。这两个值就是当初暴露量纲错位的样本：
  // 按 0~100 的门槛，4 会被判成「不及格」——与库里的 status 直接矛盾。
  assert.equal(levelOfMastery(4), "优秀");
  assert.equal(levelOfMastery(1), "不及格");
});

test("百分制换算后 4 分不再是「不及格」", () => {
  // 端到端地把这条错钉死：显示层拿到的是百分比，4 分换算过去是 80，
  // 必须落在「优秀」而不是「不及格」。旧写法（直接拿 4 当百分制）会失败。
  assert.ok(masteryToPercent(4) >= 75, "4 分换算后应当达到良好以上");
  assert.equal(masteryToPercent(4), 80);
});
