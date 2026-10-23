/**
 * 学生动作执行器 —— 学生 Agent 的「手」
 *
 * 职责
 * ----
 * 接收学生决策模型的 `StudentAction` 输出，通过 Playwright 在浏览器里
 * 执行真实的 UI 操作。这是 See → Think → Act 循环的 Act 环节。
 *
 * 人类行为模拟
 * ----------
 * 每个动作都注入真实的时间噪声与犹豫模式：
 * - 点击前有 hover 延迟（不是直冲目标）
 * - 打字速度不均匀（常见短语快、长单词慢）
 * - 发送消息前有停顿（真实学生会再读一遍）
 * - 页面加载后有"发愣时间"
 *
 * 动作类型
 * -------
 * - click：点击按钮/链接（按 text/label 定位）
 * - type：模拟逐字打字（带节奏变化与回删修正）
 * - navigate：跳转到新页面
 * - wait：纯等待（阅读、思考、犹豫）
 * - ask：type 文本到输入框 → 点击发送 → 等待回复
 *
 * 定位策略
 * -------
 * 优先使用可访问性选择器（button、link 的 text），回退到 placeholder 与
 * textarea 定位。不求 CSS 选择器精确匹配——真实学生也是靠"看字"找按钮，
 * CSS 选择器断了正好模拟"学生没找到按钮"。
 */

import type { Page } from "playwright";
import type { StudentAction } from "./types";

/** 点击动作：找到包含 label 文本的按钮或链接并点击。 */
async function doClick(page: Page, target: string): Promise<boolean> {
  // 策略按优先级：按钮文字 → 链接文字 → aria-label → 模糊匹配
  const selectors = [
    page.getByRole("button", { name: new RegExp(escapeRegex(target)) }),
    page.getByRole("link", { name: new RegExp(escapeRegex(target)) }),
    page.locator(
      `button:visible:has-text("${escapeCSS(target)}"), a:visible:has-text("${escapeCSS(target)}")`,
    ),
  ];

  for (const locator of selectors) {
    try {
      const count = await locator.count();
      if (count > 0) {
        // 点击前 hover + 微小随机延迟
        await locator.first().hover();
        await humanDelay(120, 400);
        await locator.first().click();
        return true;
      }
    } catch {
      // 该策略失败，试下一种
    }
  }
  return false;
}

/** 打字动作：把文本逐字符输入到目标输入框中。 */
async function doType(
  page: Page,
  target: string,
  content: string,
): Promise<boolean> {
  // 定位输入框：优先按 placeholder，其次按周围的 label
  const inputLocators = [
    page.getByPlaceholder(new RegExp(escapeRegex(target.slice(0, 30)))),
    page.locator("textarea:visible").first(),
    page.locator('[contenteditable="true"]:visible').first(),
    page.locator('input:visible:not([type="hidden"])').first(),
    page.getByRole("textbox").first(),
  ];

  let inputBox: ReturnType<typeof page.locator> | null = null;

  for (const locator of inputLocators) {
    try {
      const count = await locator.count();
      if (count > 0) {
        inputBox = locator.first();
        break;
      }
    } catch {
      // try next
    }
  }

  if (!inputBox) return false;

  // 聚焦输入框 → 清空已有内容（真实学生会先全选再删）
  await inputBox.click();
  await humanDelay(100, 300);
  // 全选已有文本再删：Ctrl+A → Backspace
  await page.keyboard.press("Control+A");
  await humanDelay(50, 150);
  await page.keyboard.press("Backspace");
  await humanDelay(200, 600);

  // 逐字符输入，模拟真实打字节奏
  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    // 常见短词快速输入，长词或特殊字符放慢
    const isSlowChar = "{}[]()<>=+-*/\\|`~@#$%^&".includes(char);
    const isWordBoundary = char === " " || char === "\n";
    const delayMs = isSlowChar
      ? randomInt(150, 350)
      : isWordBoundary
        ? randomInt(100, 250)
        : randomInt(40, 150);

    await humanDelay(0, delayMs);

    // 5% 概率打错后回删（模拟真实打字）
    if (Math.random() < 0.05 && i < content.length - 1) {
      const wrongChar = getAdjacentKey(char);
      if (wrongChar !== char) {
        await page.keyboard.type(wrongChar);
        await humanDelay(300, 800); // 发现打错→犹豫
        await page.keyboard.press("Backspace");
        await humanDelay(100, 300);
      }
    }

    await page.keyboard.type(char);
  }

  return true;
}

/** 导航到新页面。 */
async function doNavigate(
  page: Page,
  path: string,
  baseUrl: string,
): Promise<boolean> {
  try {
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    // 页面加载后的"发愣"时间
    await humanDelay(500, 2000);
    return true;
  } catch {
    return false;
  }
}

/** 发送消息：先找到发送按钮并点击。 */
async function doSend(page: Page): Promise<boolean> {
  const sendSelectors = [
    page.getByRole("button", { name: /send|发送|提交/i }),
    page.locator('button[title*="发送"], button[title*="Send"]'),
    page.locator(
      "button:has(svg.lucide-send), button:has(svg.lucide-arrow-up)",
    ),
    page.locator("button:visible").filter({ hasText: /^$/ }).first(), // fallback
  ];

  for (const locator of sendSelectors) {
    try {
      const count = await locator.count();
      if (count > 0) {
        await locator.first().click();
        return true;
      }
    } catch {
      // try next
    }
  }

  // 最后兜底：按 Enter 键
  await page.keyboard.press("Enter");
  return true;
}

/** 提问：type 文本 → 发送 → 等回复。 */
async function doAsk(page: Page, question: string): Promise<boolean> {
  if (!question) return false;

  const typed = await doType(page, "输入框", question);
  if (!typed) {
    // 输入失败，尝试在新页面提问（有些步骤需要先导航）
    return false;
  }

  // 发之前犹豫——学生会再读一遍自己打的字
  const readBackMs = Math.max(500, question.length * 50);
  await humanDelay(readBackMs, readBackMs + 2000);

  return await doSend(page);
}

// ---- 工具函数 ----

/** 人类级别的随机延迟（毫秒）。 */
async function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = randomInt(minMs, maxMs);
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 转义正则特殊字符。 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 最小化 CSS 字符串注入风险：只保留字母数字与空格。 */
function escapeCSS(text: string): string {
  return text.replace(/[^a-zA-Z0-9\u4e00-\u9fff .,!?()，。！？（）\n-]/g, "");
}

/** 获取按键相邻字符（用于模拟打错字）。 */
function getAdjacentKey(char: string): string {
  const adjacents: Record<string, string> = {
    a: "s",
    b: "n",
    c: "x",
    d: "f",
    e: "r",
    f: "d",
    g: "h",
    h: "g",
    i: "o",
    j: "k",
    k: "j",
    l: "k",
    m: "n",
    n: "m",
    o: "i",
    p: "o",
    q: "w",
    r: "t",
    s: "a",
    t: "r",
    u: "i",
    v: "c",
    w: "e",
    x: "c",
    y: "u",
    z: "x",
    "1": "2",
    "2": "1",
    "3": "4",
    "4": "3",
    "5": "6",
    "6": "5",
    "7": "8",
    "8": "7",
    "9": "0",
    "0": "9",
  };
  const lower = char.toLowerCase();
  const adjacent = adjacents[lower];
  if (!adjacent) return char;
  return char === lower ? adjacent : adjacent.toUpperCase();
}

// ---- 公开 API ----

/** 执行一个学生动作，返回是否成功。 */
export async function executeAction(
  page: Page,
  action: StudentAction,
  baseUrl: string,
): Promise<{ ok: boolean; description: string }> {
  // 动作前犹豫（认知处理时间）
  await humanDelay(action.hesitationMs, action.hesitationMs + 1500);

  switch (action.type) {
    case "click": {
      const ok = await doClick(page, action.target);
      return {
        ok,
        description: ok
          ? `点击了"${action.target}"`
          : `未找到可点击的"${action.target}"`,
      };
    }

    case "type": {
      const ok = await doType(page, action.target, action.content ?? "");
      return {
        ok,
        description: ok
          ? `在"${action.target}"中输入了 ${(action.content ?? "").length} 个字符`
          : `未找到输入区域"${action.target}"`,
      };
    }

    case "navigate": {
      const ok = await doNavigate(page, action.target, baseUrl);
      return {
        ok,
        description: ok
          ? `导航到 ${action.target}`
          : `导航失败：${action.target}`,
      };
    }

    case "wait": {
      const ms = parseInt(action.target, 10) || 2000;
      await humanDelay(ms, ms + 1000);
      return { ok: true, description: `等待了 ${ms}ms` };
    }

    case "ask": {
      const ok = await doAsk(page, action.question ?? "");
      return {
        ok,
        description: ok
          ? `发送了提问："${(action.question ?? "").slice(0, 60)}"`
          : "发送提问失败",
      };
    }

    case "give_up": {
      return { ok: true, description: "学生放弃了当前任务" };
    }

    default:
      return {
        ok: false,
        description: `未知动作类型：${(action as { type: string }).type}`,
      };
  }
}
