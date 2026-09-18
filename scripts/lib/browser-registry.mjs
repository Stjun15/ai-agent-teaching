/**
 * 本机可用浏览器的登记表
 *
 * 为什么单独成文件
 * --------------
 * 这是**配置知识**（这台机器上装了哪些浏览器、路径在哪、能不能被驱动），
 * 与「怎么用 CDP 驱动一个浏览器」（`cdp-browser.mjs`）是两件事。
 * 装完新浏览器要改的就是本文件 —— 一个文件、一张表。
 *
 * 「覆盖了几个引擎」是**算出来的**，不是声明的：同一引擎的多个二进制
 * （Edge 与 Playwright 缓存的 Chromium）只算一个引擎。
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PW_CACHE = join(process.env.LOCALAPPDATA ?? "", "ms-playwright");

/** 在 Playwright 的浏览器缓存里找最新一版的可执行文件。 */
function cachedBin(prefix, ...rest) {
  if (!existsSync(PW_CACHE)) return null;
  const builds = readdirSync(PW_CACHE)
    .filter((d) => d.startsWith(`${prefix}-`))
    .sort(
      (a, b) => Number(b.split("-")[1] ?? 0) - Number(a.split("-")[1] ?? 0),
    );
  for (const build of builds) {
    const exe = join(PW_CACHE, build, ...rest);
    if (existsSync(exe)) return exe;
  }
  return null;
}

/**
 * 登记表。
 *
 * `driver: "cdp"` 是目前唯一实现了的驱动。Gecko 与 WebKit 不认 CDP，需要各自的
 * 协议（WebDriver BiDi 等），登记为 `unsupported` —— 装上它们之后引擎覆盖数会自动
 * 上升，断言一行都不用改。
 *
 * `optional: true` 表示自动发现、尽力而为：起不来只记原因跳过，不算失败
 * （同引擎的第二个二进制不值得把门禁挂红；显式用 `BROWSERS=` 点名时仍算失败）。
 */
export const BROWSERS = [
  {
    key: "edge",
    name: "Microsoft Edge",
    engine: "Blink",
    driver: "cdp",
    exe: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  },
  {
    key: "chrome",
    name: "Google Chrome",
    engine: "Blink",
    driver: "cdp",
    exe: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  {
    key: "chromium-pw",
    name: "Playwright Chromium",
    engine: "Blink",
    driver: "cdp",
    optional: true,
    exe: cachedBin("chromium", "chrome-win64", "chrome.exe"),
  },
  {
    key: "headless-shell",
    name: "Chromium headless shell",
    engine: "Blink",
    driver: "cdp",
    optional: true,
    // headless shell 本身就是无头形态，收到 `--headless=new` 会当成未知开关。
    headlessShell: true,
    exe: cachedBin(
      "chromium_headless_shell",
      "chrome-headless-shell-win64",
      "chrome-headless-shell.exe",
    ),
  },
  // 扩展点。
  {
    key: "firefox",
    name: "Firefox",
    engine: "Gecko",
    driver: "unsupported",
    exe: "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
  },
  {
    key: "webkit-pw",
    name: "Playwright WebKit",
    engine: "WebKit",
    driver: "unsupported",
    exe: cachedBin("webkit", "pw_run.sh"),
  },
];

/** 可执行文件是否存在。没有 `exe`（没找到缓存）也算未安装。 */
export const isInstalled = (browser) =>
  Boolean(browser.exe) && existsSync(browser.exe);
