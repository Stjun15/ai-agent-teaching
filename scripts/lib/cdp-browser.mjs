/**
 * 用 CDP 驱动一个浏览器（启动 + 会话）
 *
 * 为什么不用 Playwright / Puppeteer
 * ------------------------------
 * 这台机器上装不上（Chromium 包下载超时），但所有 Chromium 系浏览器都支持
 * `--remote-debugging-port` + CDP over WebSocket，而 Node ≥ 22 自带全局
 * `WebSocket` —— 于是零依赖即可驱动真实浏览器。
 *
 * 本文件只管「怎么驱动」，不管「这台机器上有哪些浏览器」（见 `browser-registry.mjs`），
 * 也不管「断言什么」（见各自的 spec）。
 */

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 给任何可能永不落定的 Promise 加一道超时 —— 挂住的测试比失败的测试糟得多。 */
export function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ]);
}

/** 建立一条 CDP 会话：id 配对请求/响应，并收集页面级未捕获异常。 */
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

  const send = async (method, params = {}) => {
    await ready;
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  /** 在页面里执行 async 代码体。表达式里必须写 `return`，漏了会恒返回 undefined。 */
  const evaluate = async (body) => {
    const r = await send("Runtime.evaluate", {
      expression: `(async () => { ${body} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    // awaitPromise 下**代码体抛出的异常**会变成一个 error 结果而不是
    // exceptionDetails，只查后者的话会被静默当成「没返回东西」。
    if (r.exceptionDetails || r.result?.subtype === "error") {
      throw new Error(
        r.exceptionDetails?.exception?.description ?? r.result?.description,
      );
    }
    return r.result.value;
  };

  return { ready, send, evaluate, pageErrors, close: () => ws.close() };
}

/** 起一个浏览器并连上它的页面 target，返回 `{ session, kill }`。 */
export async function openBrowser(browser, port, appUrl) {
  const endpoint = `http://127.0.0.1:${port}`;
  const proc = spawn(
    browser.exe,
    [
      ...(browser.headlessShell ? [] : ["--headless=new"]),
      "--disable-gpu",
      "--no-first-run",
      // 宿主可能注入 HTTP_PROXY，会把 localhost 也代理出去（表现为 502）。
      "--proxy-server=direct://",
      "--proxy-bypass-list=*",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${port}`,
      "--window-size=1440,900",
      `--user-data-dir=${mkdtempSync(join(tmpdir(), `cdp-${browser.key}-`))}`,
      `${appUrl}/`,
    ],
    { stdio: "ignore" },
  );

  const kill = () => {
    try {
      proc.kill();
    } catch {
      /* 已退出 */
    }
    clearTimeout(watchdog);
  };
  const watchdog = setTimeout(kill, 60_000);

  // target 必须过滤 type === "page"：否则可能连到扩展的 background_page，
  // 表现为「握手失败」而 URL 明明是对的。可选浏览器等得短一些，别拖慢主流程。
  const tries = Math.ceil((browser.optional ? 6_000 : 20_000) / 500);
  let targets = [];
  for (let i = 0; i < tries && targets.length === 0; i++) {
    try {
      targets = (await (await fetch(`${endpoint}/json/list`)).json()).filter(
        (t) => t.type === "page",
      );
    } catch {
      /* 浏览器还没起来 */
    }
    if (targets.length === 0) await sleep(500);
  }
  if (targets.length === 0) {
    kill();
    throw new Error("CDP page target 未就绪");
  }

  // 可能有多个 page target（旧会话恢复的错误页 + 当前页），逐个试到能跑通 JS。
  // 每个都要有超时：有的二进制（headless shell）会接受连接却不完成握手，
  // 没有超时就会把整轮挂在这里。
  for (const target of targets) {
    const session = connect(target.webSocketDebuggerUrl);
    try {
      await withTimeout(session.ready, 10_000, "CDP 握手超时");
      await withTimeout(
        session.send("Runtime.enable"),
        10_000,
        "Runtime.enable 超时",
      );
      clearTimeout(watchdog);
      return { session, kill };
    } catch {
      session.close();
    }
  }
  kill();
  throw new Error("所有 page target 都连不上");
}
