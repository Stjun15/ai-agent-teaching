/**
 * 报告页明细的浏览器内验收（R0–R4）
 *
 * 为什么单独一个脚本
 * ----------------
 * 报告页的明细（错题本 / Prompt 历史）是 2026-09-18 才接上的：两个端点
 * `GET /api/student/errors`、`GET /api/student/prompts` 建好了却**没有任何
 * 消费方**，报告页只有汇总数字。补上前端之后，需要证明的不只是「组件渲染了」，
 * 而是「页面上那一行就是库里那一行」—— 组件渲染出来但取数错、或字段名漂了
 * 显示成空白，`cross-browser-spec.mjs` 那种「页面含关键字」的断言抓不到。
 *
 * 怎么抓到
 * -------
 * 断言的文本不是写死在脚本里的常量，而是**当次从 SQLite 读出来的真实行**：
 * 取默认学生最新一条错题的 `concept_id` 与最新一条 Prompt 的 `score`，
 * 再要求页面 `innerText` 里出现它们。库里换一批数据，断言跟着换 ——
 * 页面显示占位数据或空列表时，这两条必挂。
 *
 * 这是第 4 级证明（AGENTS.md 第六节）：前三級（tsc / 单测 / HTTP 层）都验过
 * 「SSR 返回 200、HTML 齐全」但仍然白屏的事故，只有真浏览器能证伪。
 *
 * 用法：
 *   pnpm dev                                  # 另开，默认 3000
 *   node scripts/report-details-spec.mjs
 *   APP_URL=http://localhost:3311 node scripts/report-details-spec.mjs
 */

import { DatabaseSync } from "node:sqlite";

import { openBrowser, sleep } from "./lib/cdp-browser.mjs";
import { BROWSERS } from "./lib/browser-registry.mjs";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const DB_PATH = process.env.DB_PATH ?? "dev.db";
const PORT = 9345;

// AuthGate（v0.5.0 起）会拦无令牌的浏览器 —— 报告页是客户端取数，必须先有身份。
// 与 browser-acceptance.mjs 同一套路：内置评审账号换真 JWT，导航前种进 localStorage。
const AUTH_CREDENTIALS = { username: "test", password: "test1234" };
const APP_ORIGIN = new URL(APP).origin;

async function loginForToken() {
  const res = await fetch(`${APP_ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(AUTH_CREDENTIALS),
  });
  if (!res.ok) {
    throw new Error(
      `验收登录失败（HTTP ${res.status}）：请确认已跑 pnpm db:seed:auth 播种评审账号`,
    );
  }
  return await res.json();
}

function authSeedSource(auth) {
  return `
    if (location.origin === ${JSON.stringify(APP_ORIGIN)}) {
      localStorage.setItem('ai-teaching:authToken', ${JSON.stringify(auth.token)});
      localStorage.setItem('ai-teaching:studentId', ${JSON.stringify(auth.studentId)});
      localStorage.setItem('ai-teaching:currentUsername', ${JSON.stringify(auth.username)});
    }
  `;
}

/** 从库里读出「页面上应该出现的那一行」。读不到就退不出断言，直接失败。 */
function readExpectedRows(sid) {
  const db = new DatabaseSync(DB_PATH);
  const error = db
    .prepare(
      "SELECT concept_id FROM errors WHERE student_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(sid);
  const prompt = db
    .prepare(
      "SELECT score, module_id FROM prompt_history WHERE student_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(sid);

  // 维度名不写死在脚本里：从最近一次**含维度**的点评里取第一个。
  // 库里存在 dimensions 为空数组的行（早期数据），取第一条会取到空。
  let dimension = null;
  for (const row of db
    .prepare(
      "SELECT dimensions FROM prompt_history WHERE student_id = ? ORDER BY created_at DESC",
    )
    .all(sid)) {
    try {
      const parsed = JSON.parse(row.dimensions || "[]");
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.name) {
        dimension = String(parsed[0].name);
        break;
      }
    } catch {
      /* 脏 JSON，看下一条 */
    }
  }

  db.close();
  return { error, prompt, dimension };
}

/** 读页面可见文本。`body` 尚未创建时返回空串，而不是抛错。 */
async function readText(session) {
  const value = await session.evaluate(
    "return document.body ? document.body.innerText : ''",
  );
  return typeof value === "string" ? value : "";
}

async function main() {
  const auth = await loginForToken();
  const { error, prompt, dimension } = readExpectedRows(auth.studentId);
  const checks = [];
  const record = (name, ok, detail = "") => checks.push({ name, ok, detail });

  if (!error || !prompt) {
    console.error(
      "库里没有可断言的真实记录（errors / prompt_history 各需至少一行）。\n" +
        "先跑一次真实点评（交一份弱作业走 /api/agent/validate），再跑本脚本 ——\n" +
        "没有真实数据的报告页本就应该显示空态，那时断言明细条目是没有意义的。",
    );
    process.exit(1);
  }

  console.log(
    `期望出现：错题 concept=${error.concept_id}；Prompt score=${prompt.score} module=${prompt.module_id}`,
  );

  const browser =
    BROWSERS.find((b) => b.key === "edge" && !b.optional) ?? BROWSERS[0];
  let opened;
  try {
    opened = await openBrowser(browser, PORT, APP);
  } catch (cause) {
    console.error(`浏览器起不来：${cause.message ?? cause}`);
    console.error("先启动 pnpm dev，再跑本脚本。");
    process.exit(1);
  }
  const { session, kill } = opened;

  try {
    await session.send("Page.enable");
    // 身份要在应用脚本运行前就位：每个新文档加载前种 localStorage（与真人
    // 登录同一签发路径换来的真 JWT，不是绕过鉴权）。
    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: authSeedSource(auth),
    });
    await session.send("Page.navigate", { url: `${APP}/report` });

    // 报告页是客户端取数（身份在浏览器里），所以要等：等到「正在汇总…」消失。
    // ⚠ `document.body` 在导航刚发出的那一刻还是 null（新文档尚未创建），
    // 直接读 `body.innerText` 会抛在 CDP 那一侧并让整个脚本崩掉 —— 读取必须容错。
    let text = "";
    for (let i = 0; i < 60; i++) {
      text = await readText(session);
      if (!text.includes("正在汇总") && text.includes("学习报告")) break;
      await sleep(500);
    }

    // R0 报告主体有数据：出现空态说明这一路取数或身份有问题，明细也就无从谈起。
    record(
      "R0 报告主体有数据",
      !text.includes("还没有可汇总的学习数据"),
      text.slice(0, 80).replace(/\s+/g, " "),
    );

    // R1 / R2 两个区块的标题都在（aria-label 也写了，取标题文本即可）。
    record("R1 错题本区块存在", text.includes("错题本"));
    record("R2 Prompt 历史区块存在", text.includes("Prompt 历史"));

    // R3 条目内容 = 库里那一行。空态文案也算「区块存在」，只有这条能证明有内容。
    record(
      "R3 错题条目含库中 concept_id",
      text.includes(String(error.concept_id)),
      String(error.concept_id),
    );
    record(
      "R4 Prompt 条目含库中分数",
      text.includes(String(prompt.score)),
      `${prompt.score} / 100`,
    );

    // R5 量纲：点评分是 0~100，页面上必须带满分，否则会被读成掌握度的 0~5。
    record("R5 点评分标出满分", text.includes("/ 100"));

    // R7 评分维度区块显示的是**真实维度名**，不是写死在前端的六项能力。
    // 库里那条点评若无维度（早期数据 / 点评未产出），这条跳过而不是判失败 ——
    // 那时页面上本就应该显示「还没有点评记录」。
    if (dimension) {
      record("R7 评分维度含真实维度名", text.includes(dimension), dimension);
    } else {
      console.log("SKIP  R7 评分维度（库里没有含维度的点评记录）");
    }

    const errors = session.pageErrors;
    record(
      "R6 无页面级未捕获异常",
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
