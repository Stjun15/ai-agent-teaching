/**
 * audit-page-acceptance.mjs —— 课程审计页（/audit）的浏览器内验收
 *
 * 为什么单独一个脚本而不在 browser-acceptance.mjs 里加断言：那个脚本跑的是
 * 「浏览器里完成一次真实对话」（要调真模型、要几十秒），本脚本要验的是
 * 「一张静态报告页正确渲染」。两者的失败模式、成本、触发条件完全不同，
 * 混在一起会让「对话挂了」和「表格少一列」互相掩盖。
 *
 * 为什么一定要这一层（不是 curl 就够）
 * ----------------------------------
 * 审计页有三个只有真实 DOM 才能证的东西：
 *   ① 取数在 effect 里跑，curl 看到的 200 只是 SSR 外壳 —— 数据表格根本不在
 *      首屏 HTML 里，是客户端 fetch 之后才出现的；
 *   ② 「未检测」与「0 分」在视觉上必须不同（`ScoreCell` 的 null 分支）；
 *   ③ zustand/React 层面的崩溃会以 global-error 页的形式呈现，而 HTTP 状态
 *      码依然是 200 —— 这个坑本仓库踩过一次（见 browser-acceptance.mjs 头注）。
 *
 * 用法
 * ----
 *   npx next start -p 3987
 *   APP_URL=http://localhost:3987/audit AUDIT_USER=xxx AUDIT_PASS=xxx \
 *     node scripts/audit-page-acceptance.mjs
 *
 * 断言清单：
 *   U0  页面标题与口径说明都在（口径说明是刻意设计的，不能被后续改动删掉）
 *   U1  表格已渲染出逐讲行数（证明客户端取数成功，不是停在 loading）
 *   U2  「认知负荷」列全部显示「未检测」，且没有一处显示 0
 *   U3  缺陷明细的折叠块能展开，展开后能看到证据原文
 *   U4  没有「尚未审计」空态（说明确实读到了数据）
 *   U5  全程无页面级未捕获异常（抓 Runtime.exceptionThrown）
 */

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3987/audit";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9335);
const APP_ORIGIN = new URL(APP_URL).origin;
const AUTH_CREDENTIALS = {
  username: process.env.AUDIT_USER ?? "audit-verify-1007",
  password: process.env.AUDIT_PASS ?? "AuditVerify2026!",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
function check(name, ok, detail = "") {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`,
  );
  if (!ok) failures.push(name);
}

async function loginForToken() {
  const res = await fetch(`${APP_ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(AUTH_CREDENTIALS),
  });
  if (!res.ok) {
    throw new Error(
      `登录失败（HTTP ${res.status}）。审计页要真实身份才能取数 —— 请用已注册账号跑。`,
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

const profile = mkdtempSync(join(tmpdir(), "edge-audit-"));
const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--proxy-server=direct://",
    "--proxy-bypass-list=*",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${CDP_PORT}`,
    "--window-size=1440,1000",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function findTarget(match) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const hit = targets.find(match);
      if (hit) return hit;
    } catch {
      /* Edge 还没起来 */
    }
    await sleep(500);
  }
  return null;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const pageErrors = [];
  let nextId = 1;

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener(
      "error",
      (e) => reject(new Error(`WS 握手失败: ${e.message ?? e}`)),
      { once: true },
    );
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      pageErrors.push(
        msg.params.exceptionDetails?.exception?.description ?? "unknown",
      );
    }
  });

  async function send(method, params = {}) {
    await ready;
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(body) {
    const r = await send("Runtime.evaluate", {
      expression: `(async () => { ${body} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        r.exceptionDetails.exception?.description ?? "evaluate failed",
      );
    }
    // 见 browser-acceptance.mjs 的同名校验：awaitPromise 下代码体抛出的异常
    // 会变成 result.subtype === "error"，只查 exceptionDetails 会静默吞掉。
    if (r.result?.subtype === "error") {
      throw new Error(
        `evaluate 代码体抛出: ${r.result.description ?? "unknown"}`,
      );
    }
    return r.result.value;
  }

  return { ready, send, evaluate, pageErrors, close: () => ws.close() };
}

try {
  const auth = await loginForToken();
  console.log("验收身份就绪：", auth.username, "\n");

  const target = await findTarget((t) => t.type === "page");
  if (!target) throw new Error("没找到可附着的页面目标");
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;

  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: authSeedSource(auth),
  });
  await cdp.send("Page.navigate", { url: APP_URL });

  // 等首屏 + 等客户端取数完成（表格出现即视为取数结束）
  const snap = await cdp.evaluate(`
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const rows = document.querySelectorAll('table tbody tr');
      if (rows.length > 0) break;
      const alert = document.querySelector('[role="alert"]');
      if (alert) return { fail: alert.textContent };
      await new Promise(r => setTimeout(r, 300));
    }
    const text = document.body.innerText;
    const rows = [...document.querySelectorAll('table tbody tr')].map(tr =>
      [...tr.querySelectorAll('td')].map(td => td.innerText.trim()));
    const details = [...document.querySelectorAll('details')];
    return {
      title: document.title,
      heading: document.querySelector('h1')?.innerText ?? '',
      caliberText: text.includes('这一轮查了什么、没查什么'),
      disclaimer: text.includes('没查到 ≠ 没问题'),
      rowCount: rows.length,
      rows,
      detailsCount: details.length,
      hasEmptyState: text.includes('尚未审计'),
      loadingLeft: text.includes('正在读取审计结果'),
      globalError: text.includes("This page couldn't load"),
    };
  `);

  if (snap.fail) throw new Error(`页面报读取失败：${snap.fail}`);

  // U0 口径说明
  check("U0 口径说明块存在", snap.caliberText === true);
  check("U0 「没查到 ≠ 没问题」诚实边界在界面上", snap.disclaimer === true);
  check(
    "U0 页面标题含「课程审计」",
    (snap.heading + snap.title).includes("课程审计"),
    `heading=${snap.heading}`,
  );

  // U1 取数成功
  check("U1 已渲染逐讲表格行", snap.rowCount > 0, `共 ${snap.rowCount} 讲`);
  check("U1 未停在 loading", snap.loadingLeft === false);
  check("U1 不是「尚未审计」空态", snap.hasEmptyState === false);

  // U2 「未检测」而非 0
  const cognitiveCells = snap.rows.map((r) => r[5] ?? "");
  const allUntested =
    cognitiveCells.length > 0 && cognitiveCells.every((c) => c === "未检测");
  check(
    "U2 认知负荷列全部显示「未检测」",
    allUntested,
    `实测值：${JSON.stringify(cognitiveCells.slice(0, 3))}`,
  );

  // U2b 拿 API 真值逐格对账：null 必须显示「未检测」，有值必须显示该值。
  //
  // ⚠️ 别写成「没有任何一格显示 0 分」—— 我第一版就是这么写的，结果把
  // ai-safety 的**合法实测 0 分**（内容一致 4/4 项缺失）当成了渲染故障，
  // 白排查一轮。这个断言问错了问题：它想抓的是「NULL 被画成 0」，
  // 而 NULL 与真 0 在单元格文本里长得不一样（"未检测" vs "0 / 100"），
  // 只有拿 API 真值对账才能把两者分开。
  const api = await (
    await fetch(`${APP_ORIGIN}/api/audit`, {
      headers: { "x-auth-token": auth.token },
    })
  ).json();
  const COLS = [
    "reachability",
    "demoReadability",
    "terminologyGap",
    "consistency",
    "cognitiveLoad",
  ];
  const mismatch = [];
  for (const summary of api.summaries) {
    const row = snap.rows.find((r) => (r[0] ?? "").includes(summary.moduleId));
    if (!row) {
      mismatch.push(`${summary.moduleId} 表格里找不到对应行`);
      continue;
    }
    COLS.forEach((key, i) => {
      const truth = summary[key];
      const shown = (row[i + 1] ?? "").trim();
      if (truth === null) {
        if (shown !== "未检测")
          mismatch.push(
            `${summary.moduleId}.${key} 应显示「未检测」，实为 ${JSON.stringify(shown)}`,
          );
      } else {
        const expected = `${Math.round(truth * 100)} / 100`;
        if (shown !== expected)
          mismatch.push(
            `${summary.moduleId}.${key} 应显示 ${expected}，实为 ${JSON.stringify(shown)}`,
          );
      }
    });
  }
  check(
    "U2b 每格分数与 API 真值一致（null↔未检测，有值↔对应数值）",
    mismatch.length === 0,
    mismatch.length > 0
      ? mismatch.slice(0, 3).join("；")
      : `对账 ${api.summaries.length} 讲 × ${COLS.length} 列`,
  );

  // U3 缺陷明细可展开
  check(
    "U3 存在可展开的证据折叠块",
    snap.detailsCount > 0,
    `${snap.detailsCount} 个`,
  );
  if (snap.detailsCount > 0) {
    const evidence = await cdp.evaluate(`
      const d = document.querySelector('details');
      d.open = true;
      await new Promise(r => setTimeout(r, 200));
      const t = d.innerText;
      return {
        hasEvidence: t.includes('证据'),
        hasRecommend: t.includes('建议'),
        length: t.length,
      };
    `);
    check(
      "U3 展开后能看到证据原文与建议",
      evidence.hasEvidence && evidence.hasRecommend && evidence.length > 60,
      `展开文本 ${evidence.length} 字`,
    );
  }

  // U5 无未捕获异常
  check(
    "U5 全程无页面级未捕获异常",
    cdp.pageErrors.length === 0,
    cdp.pageErrors.slice(0, 2).join(" | "),
  );
  check("U5 未落到 Next 内置 global-error 页", snap.globalError === false);

  cdp.close();
  console.log(
    `\n${failures.length === 0 ? "验收通过" : `验收失败 ${failures.length} 项`}：${failures.join("、") || "全部断言通过"}`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
} catch (error) {
  console.error("验收脚本异常：", error.message);
  process.exit(2);
} finally {
  edge.kill();
}
