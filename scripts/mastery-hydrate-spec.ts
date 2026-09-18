/**
 * 掌握度卡的浏览器内验收（M0–M2）
 *
 * 为什么要有这个脚本
 * ------------------
 * `StudentStore.hydrate` 长期没有调用方，学习页的掌握度卡恒显示「尚未测评」——
 * 而库里这个学生**确实有**掌握度记录。这类缺口有个特点：`tsc` 绿、单测绿、
 * HTTP 接口也返回 200，只有把页面打开看一眼才发现卡是空的。
 * 所以这里只验证浏览器里那张卡实际显示什么。
 *
 * 断言的期望值怎么来
 * ---------------
 * 等级与百分比**不写死**：用 `src/lib/scores.ts` 的 `levelOfMastery` /
 * `masteryToPercent` 从库里当次读出的 `mastery.score` 算出来。阈值只有一处，
 * 改阈值时这里跟着变 —— 反之若把阈值抄一份到脚本里，阈值改了而脚本没改，
 * 断言就会「通过」在一个已经不成立的标准上。
 *
 * 用法（需要 dev server 在跑）：
 *   APP_URL=http://localhost:3311 node --experimental-strip-types \
 *     --import ./scripts/ts-loader.mjs scripts/mastery-hydrate-spec.ts
 */

import { DatabaseSync } from "node:sqlite";

import { levelOfMastery, masteryToPercent } from "@/lib/scores";
import { openBrowser, sleep } from "./lib/cdp-browser.mjs";
import { BROWSERS } from "./lib/browser-registry.mjs";
import demoStudent from "../src/lib/demo-student.json" with { type: "json" };

const APP = process.env.APP_URL ?? "http://localhost:3000";
const PORT = 9347;
const CONCEPT = process.env.CONCEPT ?? "llm-api";

/** 从库里读出该学生的掌握度，并换算成页面上应该出现的两个值。 */
function readExpected() {
  const db = new DatabaseSync(process.env.DB_PATH ?? "dev.db");
  const row = db
    .prepare(
      "SELECT score FROM mastery WHERE student_id = ? AND concept_id = ? LIMIT 1",
    )
    .get(demoStudent.studentId, CONCEPT) as { score: number } | undefined;
  db.close();
  if (!row) return null;
  return {
    score: row.score,
    percent: masteryToPercent(row.score),
    level: levelOfMastery(row.score),
  };
}

async function main() {
  const expected = readExpected();
  if (!expected) {
    console.error(
      `库里没有 ${CONCEPT} 的掌握度记录，无法断言「卡应该显示什么」。` +
        `先跑一次测评（或 pnpm db:seed:student）再跑本脚本。`,
    );
    process.exit(1);
  }
  console.log(
    `期望：${CONCEPT} score=${expected.score} → ${expected.percent}% / ${expected.level}`,
  );

  const browser =
    BROWSERS.find((item) => item.key === "edge" && !item.optional) ??
    BROWSERS[0];
  let opened;
  try {
    opened = await openBrowser(browser, PORT, APP);
  } catch (cause) {
    console.error(`浏览器起不来：${(cause as Error).message ?? cause}`);
    console.error("先启动 pnpm dev，再跑本脚本。");
    process.exit(1);
  }
  const { session, kill } = opened;

  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const record = (name: string, ok: boolean, detail = "") =>
    checks.push({ name, ok, detail });

  try {
    await session.send("Page.enable");
    await session.send("Page.navigate", { url: `${APP}/learn/${CONCEPT}` });

    // 客户端 hydrate 是异步的，要等。等到「尚未测评」消失为止 ——
    // 它消失就说明 store 里已经有这个概念的掌握度了。
    let text = "";
    for (let i = 0; i < 40; i++) {
      const value = await session.evaluate(
        "return document.body ? document.body.innerText : ''",
      );
      text = typeof value === "string" ? value : "";
      if (text.includes("学习中心") && !text.includes("尚未测评")) break;
      await sleep(500);
    }

    record(
      "M0 掌握度卡不再是空态",
      !text.includes("尚未测评"),
      text.includes("尚未测评") ? "仍显示「尚未测评」" : "",
    );
    record(
      "M1 显示真实百分比",
      text.includes(String(expected.percent)),
      String(expected.percent),
    );
    record("M2 显示真实等级", text.includes(expected.level), expected.level);

    const errors = session.pageErrors;
    record(
      "M3 无页面级未捕获异常",
      errors.length === 0,
      errors.length === 0 ? "" : errors.join(" | "),
    );
  } finally {
    kill();
  }

  let failed = 0;
  for (const check of checks) {
    if (!check.ok) failed += 1;
    console.log(
      `${check.ok ? "PASS" : "FAIL"}  ${check.name}${check.detail ? `  (${check.detail})` : ""}`,
    );
  }
  console.log(`\n${checks.length - failed}/${checks.length} 通过`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
