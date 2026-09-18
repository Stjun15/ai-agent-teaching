/**
 * 跨浏览器冒烟测试 —— 同一套断言在每个可用引擎里各跑一遍
 *
 * 与 `browser-acceptance.mjs` 的分工：那个脚本是**深**的（一轮真实 SSE 对话、
 * 流式增量、工具调用，只跑 Edge），本脚本是**宽**的（不调模型、零 token，把
 * 「页面能不能在这个引擎里活起来」在每个可用浏览器里各验一遍）。深的证明链路通，
 * 宽的证明换个引擎不崩 —— 两个都要有。
 *
 * 引擎覆盖是**算出来的**（见 `scripts/lib/browser-registry.mjs`），不是声明的：
 * 同引擎的多个二进制只算一个引擎，脚本会照实说「只有一个引擎被验证过」；
 * 装上 Firefox / WebKit 后覆盖数自动上升，断言一行都不用改。
 *
 * 用法：
 *   APP_URL=http://localhost:3000 node scripts/cross-browser-spec.mjs
 *   BROWSERS=edge node scripts/cross-browser-spec.mjs       # 点名即严格
 *   REQUIRE_ENGINES=2 node scripts/cross-browser-spec.mjs   # 覆盖不足即失败
 */

import { openBrowser, sleep } from "./lib/cdp-browser.mjs";
import { BROWSERS, isInstalled } from "./lib/browser-registry.mjs";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const THEME_KEY = "ai-teaching:theme";

/** 页面清单：路径 + 该页**必须出现**的关键文案（来自各页源码，非猜测）。 */
const PAGES = [
  { path: "/", expect: "理解 AI 行为模式" },
  { path: "/learn", expect: "学习中心" },
  { path: "/learn/llm-api", expect: "LLM API" },
  { path: "/learn/llm-api/explain", expect: "LLM API" },
  { path: "/playground", expect: "沙箱实验室" },
  { path: "/report", expect: "学习报告" },
  { path: "/settings", expect: "设置" },
];

/** 在一个浏览器里跑完整套断言。 */
async function runSuite(browser, port) {
  const checks = [];
  const record = (name, ok, detail = "") => checks.push({ name, ok, detail });

  let opened;
  try {
    opened = await openBrowser(browser, port, APP);
  } catch (error) {
    record("启动", false, String(error.message ?? error));
    return { browser, checks };
  }
  const { session, kill } = opened;

  try {
    for (const page of PAGES) {
      await session.send("Page.navigate", { url: `${APP}${page.path}` });
      let text = "";
      for (let i = 0; i < 40 && !text?.includes(page.expect); i++) {
        // ⚠ `document.body` 在导航刚发出的那一刻还是 null（新文档尚未创建）：
        // 直接读 `body.innerText` 会抛在 CDP 那一侧，整轮断言就此中断
        // （实测在 /learn/llm-api 这一页崩过）。读取必须容错。
        text = await session.evaluate(
          "return document.body ? document.body.innerText : ''",
        );
        if (!text?.includes(page.expect)) await sleep(250);
      }
      const hit = Boolean(text?.includes(page.expect));
      record(`${page.path} 渲染「${page.expect}」`, hit);
    }

    // 样式表真的生效（不只是 HTML 回来了）：Tailwind 工具类要能在计算样式里体现。
    const css = JSON.parse(
      (await session.evaluate(`return JSON.stringify((() => {
        const el = document.querySelector("[class~='flex']");
        return {
          sheets: document.styleSheets.length,
          flexDisplay: el ? getComputedStyle(el).display : null,
        };
      })());`)) ?? "{}",
    );
    record(
      "样式表加载且工具类生效",
      css.flexDisplay === "flex",
      JSON.stringify(css),
    );

    // 交互 + 水合 + 持久化：点「深色」→ <html class="dark"> → localStorage 落值。
    // ⚠ SSR 的 HTML 里按钮**本来就在**，还没水合时点了不触发任何 React 逻辑，
    // 所以不能「点到就 break」—— 必须点完验证结果，不满足就重试到水合完成。
    await session.send("Page.navigate", { url: `${APP}/settings` });
    let theme = {};
    let attempts = 0;
    for (let i = 0; i < 60; i++) {
      attempts = i + 1;
      await session.evaluate(`
        [...document.querySelectorAll("button,[role='radio'],[role='button']")]
          .find((el) => el.innerText.trim() === "深色")?.click();
        return true;`);
      await sleep(250);
      theme = JSON.parse(
        (await session.evaluate(`return JSON.stringify({
          dark: document.documentElement.classList.contains("dark"),
          stored: localStorage.getItem("${THEME_KEY}"),
        });`)) ?? "{}",
      );
      if (theme.dark === true && theme.stored === "dark") break;
    }
    const detail = `第 ${attempts} 次尝试，${JSON.stringify(theme)}`;
    record("主题交互生效（水合证据）", theme.dark === true, detail);
    record("主题选择已持久化", theme.stored === "dark", String(theme.stored));

    const errs = session.pageErrors;
    record("无页面级未捕获异常", errs.length === 0, errs[0] ?? "");
  } catch (error) {
    record("断言执行", false, String(error.message ?? error));
  } finally {
    session.close();
    kill();
  }

  return { browser, checks };
}

// ---------- 主流程 ----------
const only = process.env.BROWSERS?.split(",").map((s) => s.trim());
const missing = BROWSERS.filter((b) => !isInstalled(b));
const candidates = BROWSERS.filter(
  (b) => (only ? only.includes(b.key) : true) && isInstalled(b),
);
const runnable = candidates.filter((b) => b.driver === "cdp");
const awaiting = candidates.filter((b) => b.driver !== "cdp");

if (missing.length > 0) {
  console.log(
    `（登记表里 ${missing.length} 项未安装，已跳过：${missing.map((b) => b.name).join("、")}）`,
  );
}
if (runnable.length === 0) {
  console.error(`没有可驱动的浏览器。APP_URL=${APP}`);
  process.exit(1);
}

const results = [];
const skipped = [];
let port = 9400;
for (const browser of runnable) {
  process.stdout.write(`▶ ${browser.name}（${browser.engine}）… `);
  const result = await runSuite(browser, port++);
  const failed = result.checks.filter((c) => !c.ok);
  // 「只有启动那一条失败」= 浏览器根本没起来，不是应用的问题。
  const onlyStartupFailed =
    result.checks.length === 1 &&
    failed.length === 1 &&
    failed[0].name === "启动";

  if (onlyStartupFailed && browser.optional && only == null) {
    skipped.push({ browser, reason: failed[0].detail });
    process.stdout.write(`跳过（${failed[0].detail}）\n`);
    continue;
  }

  results.push(result);
  process.stdout.write(
    failed.length === 0
      ? `通过（${result.checks.length} 项）\n`
      : `失败 ${failed.length} 项\n`,
  );
}
const engines = [...new Set(results.map((r) => r.browser.engine))];
console.log("\n=== 明细 ===");
for (const result of results) {
  console.log(`\n${result.browser.name}（${result.browser.engine}）`);
  for (const check of result.checks) {
    console.log(
      `  ${check.ok ? "ok  " : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`,
    );
  }
}

console.log(
  `\n=== 引擎覆盖：${engines.length} 个引擎（${engines.join("、") || "无"}）===`,
);
for (const item of skipped)
  console.log(
    `跳过（可选浏览器起不来，未计入覆盖）：${item.browser.name}：${item.reason}`,
  );
for (const b of awaiting)
  console.log(`未覆盖：${b.name}（${b.engine}，需 ${b.driver} 驱动）`);
if (engines.length < 2)
  console.log(
    "注意：只有一个引擎被验证过 —— 这不是「跨浏览器」，只是「跨二进制」。",
  );

const failed = results.filter((r) => r.checks.some((c) => !c.ok));
const required = Number(process.env.REQUIRE_ENGINES ?? 1);
if (failed.length > 0) {
  console.error(`\n=== ${failed.length} 个浏览器未通过 ===`);
  process.exit(1);
}
if (engines.length < required) {
  console.error(
    `\n=== 引擎覆盖不足：${engines.length} < 要求的 ${required} ===`,
  );
  process.exit(1);
}
console.log(
  `\n=== 全部通过（${results.length} 个浏览器，${engines.length} 个引擎）===`,
);
