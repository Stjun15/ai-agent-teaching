/**
 * browser-acceptance.mjs —— 用系统 Edge 的 CDP 协议做「浏览器内真实对话」验收
 *
 * 为什么不用 Playwright / agent-browser：Chromium 下载两次超时（本机网络）。
 * Edge 已装在机器上，Node 22 自带 WebSocket —— 走原生 CDP，零新增依赖。
 *
 * 用法
 * ----
 *   # 1) 起生产服务（必须是生产构建；dev server 的噪声会干扰判定）
 *   CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build && npx next start -p 3311
 *   # 2a) 脚本自己拉起 headless Edge（干净实例，推荐）
 *   node scripts/browser-acceptance.mjs
 *   # 2b) 附加到已有 Edge 实例（需带 --remote-debugging-port=9333）
 *   ATTACH=1 node scripts/browser-acceptance.mjs
 *
 * 断言清单（对应 Phase 3 验收标准「浏览器可完成一次真实对话」）：
 *   A0 页面结构（四个面板标题齐全 + 输入框存在）
 *   A1 学生消息上屏
 *   A2 助手流式输出可见（内容长度多次增长 —— 增量性证据）
 *   A3 对话结束回到可发送状态（data-status="done" + aria-busy=false）
 *   A4 Token 计数更新（累计值随轮次增长）
 *   A5 Agent 时间线出现条目（思考 / 工具调用）
 *   A6 掌握度卡显示「尚未测评」（诚实空态，不显示伪造的 0%）
 *   A7 全程无页面级未捕获异常
 *   A8 工具调用结果正确（断言模型算出的乘积 —— 证明工具链真的通了）
 *   AX1 Markdown 结构渲染：标题 / 列表 / 行内代码 / 粗体都生成了对应元素
 *   AX2 可见文本里没有未解析的 `**`（这就是要修的「满屏星号」现象本身）
 *   AX3 模型输出里的原始 HTML 没被当标签解释（消息内不存在 script/img/iframe）
 *
 * 为什么要加 AX 这三条
 * ------------------
 * Markdown 渲染是**前端行为**，脚本与单测都够不到：解析器的单测能证明
 * 「解析成什么 token」，证明不了「浏览器里长成什么样」。而这次要修的恰恰是
 * 呈现结果，所以必须在真实浏览器里断言真实 DOM。
 *
 * 为什么必须有这一层
 * ----------------
 * curl 只能证明端点，证明不了客户端。本脚本第一次跑就抓到了 curl 永远
 * 发现不了的真 bug：zustand v5 下不稳定快照导致 React #185 无限重渲染，
 * 整棵树被卸载、落到 Next 内置 global-error 页 —— 而 SSR 的 HTTP 状态码
 * 依然是 200，页面 HTML 里输入框也照样存在。
 *
 * ⚠️ 一个被证伪的结论（保留在此以免重犯）
 * ------------------------------
 * 调试过程中页面一度显示「This page couldn't load」，据此怀疑过
 * 「Edge 顶层导航到本地地址被拦」，并试过 --no-proxy-server / direct:// /
 * --host-resolver-rules / iframe 等一堆绕法，全都是**误诊**。
 * 用 CDP 抓 Runtime.exceptionThrown 才拿到真因：React #185（无限重渲染），
 * 整棵树被卸载后落到 Next 内置的 global-error 页 ——
 * 那个文案正是 `next/dist/client/components/builtin/global-error.js` 的。
 * 修掉 #185 后，headless 顶层导航也正常了。
 * 教训：**先抓客户端异常，再怀疑浏览器/网络**。iframe 后备路径因此保留
 * 但基本用不上。
 */

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
// 默认打在 3311；用 APP_URL 可指向别的实例（例如 dev server 占着 3311 时，
// 把生产构建起在 3312 上跑验收，不必先去关别人的服务）。
const APP_URL =
  process.env.APP_URL ?? "http://localhost:3311/learn/llm-api";
const CDP_PORT = 9333;
// 要求长输出：短答案几百毫秒就吐完，400ms 的采样抓不到中间态，
// 会把「流式渲染」误判成「一次性出现」。同时保留工具调用（断言乘积）。
// 末尾显式要求 Markdown 结构：AX 系列断言的是渲染结果，不能靠「期望模型碰巧
// 用了粗体」，得明确要求标题 / 列表 / 行内代码 / 粗体各出现一次。
const QUESTION =
  "请先用工具计算 1234 * 5678 的结果，然后分五行说明：结果是多少、两个乘数各是多少、" +
  "你是怎么算出来的、这个数量级大致相当于什么、如果换成 1234 * 5679 会相差多少。" +
  "请用 Markdown 排版：一个二级标题、一个至少三点的无序列表、一处行内代码、一处加粗。";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Edge 启动（ATTACH=1 时不启动，附加已有实例） ----------
const profile = mkdtempSync(join(tmpdir(), "edge-cdp-"));
let edge = null;
if (!process.env.ATTACH) {
  edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--proxy-server=direct://",
      "--proxy-bypass-list=*",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${CDP_PORT}`,
      "--window-size=1440,900",
      `--user-data-dir=${profile}`,
      APP_URL,
    ],
    { stdio: "ignore" },
  );
}

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

/** 建立一条 CDP 会话。 */
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

  /** 在页面里执行一段 async 代码体，返回其 return 值。 */
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
    // ⚠️ 这里踩过一个坑：`awaitPromise` 下**代码体内抛出的异常**不会出现在
    // `exceptionDetails`，CDP 把它当成一个 rejected promise 的结果返回 ——
    // 也就是 `result` 是一个 error 对象，而 `returnByValue` 对它取不到 value，
    // 于是返回 `undefined`。只检查 exceptionDetails 的话，代码体里的异常会被
    // 静默变成「没返回东西」，表现为「采样 90 秒全空、所有断言 undefined」。
    // 所以必须显式把 error 结果识别成异常抛出去。
    if (r.result?.subtype === "error") {
      throw new Error(`evaluate 代码体抛出: ${r.result.description ?? "unknown"}`);
    }
    return r.result.value;
  }

  return {
    ready,
    send,
    evaluate,
    pageErrors,
    close: () => {
      try {
        ws.close();
      } catch {
        /* 已关 */
      }
    },
  };
}

// ---------- 验收流程 ----------
try {
  // ⚠️ 可能有多个 page target（旧会话恢复的错误页 + 当前正常页），
  // 必须逐个试，选第一个已水合的 —— 只取第一个会抓到错误页。
  const pageTargets = [];
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      pageTargets.push(...targets.filter((t) => t.type === "page"));
      if (pageTargets.length > 0) break;
    } catch {
      await sleep(500);
    }
  }
  if (pageTargets.length === 0) throw new Error("Edge CDP page target 未就绪");

  const checkReady = (session) =>
    session
      .evaluate(
        `return !!document.querySelector('textarea[placeholder^="说说你的思路"]');`,
      )
      .then((v) => v === true)
      .catch(() => false);

  let app = null;
  for (const target of pageTargets) {
    const candidate = connect(target.webSocketDebuggerUrl);
    try {
      await candidate.ready;
      await candidate.send("Runtime.enable");
    } catch {
      continue;
    }
    // 水合要给足时间：脚本新拉起的 Edge（冷启动 + 首次编译产物加载）比
    // 附加到已有实例慢得多，只等 2s 会误判成「没水合」而走 iframe 后备路径。
    for (let i = 0; i < 40; i++) {
      if (await checkReady(candidate)) {
        app = candidate;
        break;
      }
      await sleep(500);
    }
    if (app) break;
    candidate.close();
  }

  if (!app) {
    // 全部 page 都未水合：在第一个上注入 iframe 后备路径
    const fallback = connect(pageTargets[0].webSocketDebuggerUrl);
    await fallback.ready;
    await fallback.send("Runtime.enable");
    await fallback.evaluate(`
      (() => {
        const old = document.getElementById('app-frame');
        if (old) old.remove();
        const f = document.createElement('iframe');
        f.id = 'app-frame';
        f.src = ${JSON.stringify(APP_URL)};
        f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:9999';
        document.body.appendChild(f);
      })()
      'injected'
    `);
    console.log("iframe 已注入，等待应用 target…");
    let appWs = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const t = await findTarget(
        (x) =>
          x.type !== "page" &&
          x.url.startsWith(new URL(APP_URL).origin) &&
          x.webSocketDebuggerUrl,
      );
      if (t) {
        appWs = t.webSocketDebuggerUrl;
        break;
      }
    }
    if (!appWs) throw new Error("60s 内未见应用 iframe target");
    app = connect(appWs);
    await app.ready;
    await app.send("Runtime.enable");
  } else {
    console.log("已附加到已水合的页面");
  }

  // 每轮验收从干净状态开始：否则上一轮的消息会混进断言
  // （「最后一条助手消息」可能还是上一轮的）。
  // Page.reload 只能用于顶层 target：走 iframe 后备路径时会报 -32000，
  // 那种情况下 iframe 本来就是刚注入的干净页面，跳过即可。
  try {
    await app.send("Page.reload");
    await sleep(2500);
    for (let i = 0; i < 20; i++) {
      if (await checkReady(app)) break;
      await sleep(500);
    }
    console.log("页面已重新加载");
  } catch {
    console.log("跳过 reload（非顶层 target，页面本就是干净的）");
  }

  // A0 页面结构
  for (let i = 0; i < 20; i++) {
    const ok = await app
      .evaluate(`!!document.querySelector('textarea')`)
      .catch(() => false);
    if (ok) break;
    await sleep(500);
  }
  const sanity = JSON.parse(
    await app.evaluate(`
    return JSON.stringify({
      title: document.querySelector('h1')?.textContent,
      hasComposer: !!document.querySelector('textarea[placeholder^="说说你的思路"]'),
      notAssessed: document.body.innerText.includes('尚未测评'),
      panels: ['Agent 时间线','引用来源','Token 计数','可视化'].map((t) => document.body.innerText.includes(t)),
    });
  `),
  );
  console.log("A0 页面结构:", JSON.stringify(sanity));

  // 填入问题（React 受控组件需要原生 setter + input 事件）
  await app.evaluate(`
    const ta = document.querySelector('textarea[placeholder^="说说你的思路"]');
    if (!ta) throw new Error('找不到输入框');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(QUESTION)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return 'filled';
  `);

  // 点击发送，随即开始采样
  await app.evaluate(`
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('发送') && !b.disabled);
    if (!btn) throw new Error('找不到发送按钮');
    btn.click();
    return 'clicked';
  `);

  // 每 200ms 采样：助手消息长度 + 状态，直到 done 或超时（90s）
  const samples = [];
  const startedAt = Date.now();
  let done = false;
  let finalState = null;
  /** 第一次采样失败的原因，只报一次（避免 450 次刷屏）。 */
  let sampleFailure = null;
  for (let i = 0; i < 450; i++) {
    const raw = await app
      .evaluate(
        `
      return JSON.stringify((() => {
        const articles = [...document.querySelectorAll('article[data-role]')];
        const assistant = articles.filter((a) => a.dataset.role === 'assistant');
        const last = assistant[assistant.length - 1];
        const busy = document.querySelector('[aria-busy="true"]') !== null;
        return {
          studentCount: articles.filter((a) => a.dataset.role === 'student').length,
          assistantCount: assistant.length,
          len: last ? last.innerText.length : 0,
          lastStatus: last ? last.dataset.status : null,
          busy,
          timelineDetails: document.querySelectorAll('details').length,
          toolRows: document.body.innerText.includes('参数'),
          // 数字与「tokens」分处两个 flex 项，innerText 会在中间插换行
          tokenText: (document.body.innerText.match(/(\\d+)\\s*tokens\\s*·\\s*(\\d+)\\s*轮/) ?? []).slice(1).map(Number),
          // 模型可能写成 7,006,652：先去掉千分位与空白再匹配
          answered: (assistant[assistant.length - 1]?.innerText ?? '').replace(/[,\\s]/g, '').includes('7006652'),
          answer: (assistant[assistant.length - 1]?.innerText ?? '').slice(0, 200),
          // AX1：Markdown 结构是否真的变成了元素（不是留在文本里的符号）
          markdown: (() => {
            const el = assistant[assistant.length - 1];
            if (!el) return null;
            return {
              headings: el.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
              listItems: el.querySelectorAll('li').length,
              codes: el.querySelectorAll('code').length,
              strongs: el.querySelectorAll('strong').length,
              // AX2：数正文里未解析的星号。遍历文本节点、跳过代码块与脚本 ——
              // 代码里的星号是正当内容。
              // 不用 innerText：脱离文档的克隆节点上它的语义不可靠，实测会返回
              // 与字符串长度自相矛盾的匹配数（94 个字符里数出 95 处），
              // 而 innerText 又会把 script 的文字算进去。
              // ⚠️ 这段注释里不能出现反引号：整块处在一个模板字符串里，
              // 一个反引号就会提前闭合它（见文件末尾的踩坑记录）。
              rawStars: (() => {
                let text = '';
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                let node = walker.nextNode();
                while (node !== null) {
                  const parent = node.parentElement;
                  if (!(parent && parent.closest('code,pre,script,style'))) {
                    text += node.nodeValue;
                  }
                  node = walker.nextNode();
                }
                const hits = text.match(/\\*\\*/g);
                return hits ? hits.length : 0;
              })(),
              // AX3：模型输出里的原始 HTML 若被当标签解释，这里就会出现元素。
              injectedTags: el.querySelectorAll('script,iframe,img,style,object,embed').length,
            };
          })(),
        };
      })());
    `,
      )
      // 采样期间页面可能正在导航（reload / 跳转），单次失败是正常的，
      // 所以吞掉异常继续采样。但**必须报一次**：否则一旦表达式本身有错，
      // 表现就是「采样 90 秒全空、所有断言 undefined」，完全看不出原因。
      .catch((error) => {
        if (!sampleFailure) {
          sampleFailure = `evaluate 抛异常: ${error.message}`;
          console.log("⚠️", sampleFailure);
        }
        return null;
      });
    const state = raw ? JSON.parse(raw) : null;
    if (!state) {
      if (!sampleFailure) {
        sampleFailure = `evaluate 返回空值: ${JSON.stringify(raw)}`;
        console.log("⚠️", sampleFailure);
      }
      await sleep(200);
      continue;
    }
    finalState = state;
    if (samples.length === 0 || state.len !== samples[samples.length - 1].len) {
      samples.push({ t: Date.now() - startedAt, len: state.len });
    }
    if (state.lastStatus === "done" && !state.busy) {
      done = true;
      break;
    }
    await sleep(200);
  }

  const growthValues = samples.map((s) => s.len);
  console.log(
    "A1 学生消息上屏:",
    finalState?.studentCount >= 1 ? "PASS" : "FAIL",
    `(${finalState?.studentCount})`,
  );
  console.log(
    "A2 流式增量证据: 长度变化次数 =",
    samples.length - 1,
    "长度序列 =",
    growthValues.join(" → "),
  );
  console.log(
    "A3 对话完成:",
    done ? "PASS" : "FAIL",
    "总采样时长 =",
    Date.now() - startedAt,
    "ms",
  );
  console.log(
    "A5 时间线条目(details):",
    finalState?.timelineDetails,
    "工具参数行:",
    finalState?.toolRows ? "有" : "无",
  );
  console.log("A4 token 计数:", JSON.stringify(finalState?.tokenText));
  console.log(
    "A6 掌握度空态:",
    sanity.notAssessed ? "PASS（尚未测评）" : "FAIL",
  );
  console.log(
    "A7 页面异常:",
    app.pageErrors.length === 0 ? "无" : app.pageErrors,
  );
  console.log(
    "A8 工具调用结果正确(7006652):",
    finalState?.answered ? "PASS" : "FAIL",
  );
  console.log("   答案原文:", JSON.stringify(finalState?.answer));

  const md = finalState?.markdown;
  console.log(
    "AX1 Markdown 结构渲染:",
    `标题=${md?.headings} 列表项=${md?.listItems} 行内代码=${md?.codes} 粗体=${md?.strongs}`,
  );
  console.log(
    "AX2 正文裸星号(应为 0):",
    md?.rawStars,
    md?.rawStars === 0 ? "PASS" : "FAIL",
  );
  console.log(
    "AX3 被解释的原始 HTML 元素(应为 0):",
    md?.injectedTags,
    md?.injectedTags === 0 ? "PASS" : "FAIL",
  );

  const ok =
    done &&
    samples.length >= 3 && // 内容长度至少增长两次 → 增量渲染
    finalState?.studentCount >= 1 &&
    finalState?.timelineDetails > 0 &&
    finalState?.tokenText?.[0] > 0 &&
    finalState?.answered === true &&
    app.pageErrors.length === 0 &&
    // AX：Markdown 真的渲染成了元素，且没有残留的未解析星号与原始 HTML
    md?.headings > 0 &&
    md?.listItems >= 3 &&
    md?.codes > 0 &&
    md?.strongs > 0 &&
    md?.rawStars === 0 &&
    md?.injectedTags === 0;
  console.log(ok ? "\n=== 浏览器验收 PASS ===" : "\n=== 浏览器验收 FAIL ===");

  app.close();
} finally {
  edge?.kill();
}

/* ---------------------------------------------------------------------------
 * 踩坑记录（改这个脚本前请先看，两条都会让失败表现为「静默 + 全 undefined」）
 * ---------------------------------------------------------------------------
 *
 * 1) 模板字符串里的反引号
 *    采样表达式整块处在一个模板字符串里。若在它内部的注释里写反引号
 *    （比如想举例 markdown 的粗体标记），那个反引号会**提前闭合模板字符串**。
 *    更坏的是：剩下的文本常常仍是**合法 JS**，于是脚本不报错、node --check
 *    也放行 —— 实测被解析成「字符串 ** 模板字符串 ** 模板字符串」（字符串
 *    幂运算，求值为 NaN），浏览器收到的代码体就是 `NaN` 这个合法表达式，
 *    没有 return，promise 解析成 undefined。
 *    症状：采样 90 秒全空、所有断言 undefined、A1 打印 (undefined)。
 *    对策：这段表达式里的注释不要出现反引号。
 *
 * 2) CDP 的 error 结果
 *    代码体里抛出的异常，在 awaitPromise 下不一定出现在 exceptionDetails，
 *    CDP 会把它当成 rejected promise 的结果返回 —— 即 result 是一个 error
 *    对象，returnByValue 取不到 value，于是变成 undefined。
 *    所以 evaluate() 里必须同时检查 exceptionDetails 与 result.subtype。
 * ------------------------------------------------------------------------- */
