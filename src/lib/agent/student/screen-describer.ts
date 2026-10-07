/**
 * 屏幕状态描述器 —— 学生 Agent 的「眼睛」
 *
 * 职责
 * ----
 * 用 Playwright 打开教学平台页面，截取当前视口，解析 DOM 语义区域，
 * 产出结构化的 `ScreenState`，供学生 persona 引擎消费。
 *
 * 两层提取策略
 * ----------
 * 1. DOM 文本提取（轻量、零 token 消耗）：直接从元素提取可见文本——
 *    chat 消息、导航标签、按钮文案等。
 * 2. VLM 视觉分析（仅在需要时调用）：代码编辑器里的文本若 DOM 提取
 *    不完整（如 Monaco 的虚拟滚动），或页面包含图表/示意图时，把截图
 *    发给视觉模型获取更精确的描述。
 *
 * 区域识别
 * -------
 * 教学平台的 DOM 结构约定（与 `module-workspace.tsx` 等组件对应）：
 * - 导师/学生消息：`[data-role="assistant"]`、`[data-role="user"]`
 * - 代码编辑器：`.monaco-editor .view-lines` 或 `[data-slot="code-editor"]`
 * - 输入框：`[data-slot="composer"] textarea`
 * - 步骤导航：`[data-slot="step-nav"]`
 * - 侧栏：`[data-slot="sidebar"]`
 *
 * 输出协议
 * -------
 * `describe()` 返回 `ScreenState`。任何区域提取失败都不抛异常——
 * 学生 persona 收到不完整的屏幕描述本身就是一种模拟（学生也可能
 * 没注意到某些 UI 元素）。
 */

import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import type {
  Bounds,
  Interactable,
  ScreenDescriberOptions,
  ScreenRegion,
  ScreenState,
} from "./types";

const VLM_TIMEOUT_MS = 90000;

/**
 * 用视觉模型分析无法从 DOM 直接提取的区域（代码编辑器、图表等）。
 * 复用 `/api/chat` 下 `vision-review.ts` 的 VLM 调用模式——
 * OpenAI 兼容协议，返回分析文本。
 */
async function describeRegionWithVLM(
  regionLabel: string,
  screenshotBase64: string,
  options: ScreenDescriberOptions,
): Promise<string> {
  try {
    // 优先走代理端点（无需 API Key）
    if (options.proxyUrl) {
      const response = await Promise.race([
        fetch(options.proxyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "vision" as const,
            systemPrompt: [
              "你是教学平台的学生视觉助手。你的任务是描述截图中的",
              "代码或图表内容，让一名零基础学生能够「看到」屏幕上的信息。",
              "",
              "规则：",
              "- 代码区域：逐行列出可见的代码，不要解释。",
              "- 图表/示意图：用口语描述「图上画了什么」，不要说「截图显示」。",
              "- 错误标记：如果代码有红色波浪线或错误提示，务必指出。",
              "- 总长度不超过 300 字。",
            ].join("\n"),
            userContent: `请描述截图中的「${regionLabel}」区域内容。只描述你看到的内容，不要评价。`,
            imageBase64: screenshotBase64,
            model: options.visionModel,
          }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("VLM_TIMEOUT")), VLM_TIMEOUT_MS),
        ),
      ]);

      if (!response.ok) return "";
      const body = (await response.json()) as { content?: string };
      return body.content?.trim() ?? "";
    }

    // 回退：直连 Ark API
    const response = await Promise.race([
      fetch(`${options.visionBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.visionApiKey}`,
        },
        body: JSON.stringify({
          model: options.visionModel,
          messages: [
            {
              role: "system",
              content: [
                "你是教学平台的学生视觉助手。你的任务是描述截图中的",
                "代码或图表内容，让一名零基础学生能够「看到」屏幕上的信息。",
                "",
                "规则：",
                "- 代码区域：逐行列出可见的代码，不要解释。",
                "- 图表/示意图：用口语描述「图上画了什么」，不要说「截图显示」。",
                "- 错误标记：如果代码有红色波浪线或错误提示，务必指出。",
                "- 总长度不超过 300 字。",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `请描述截图中的「${regionLabel}」区域内容。只描述你看到的内容，不要评价。`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${screenshotBase64}`,
                    detail: "auto",
                  },
                },
              ],
            },
          ],
          max_tokens: 512,
          temperature: 0.1,
        }),
      }),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("VLM_TIMEOUT")), VLM_TIMEOUT_MS),
      ),
    ]);

    if (!response.ok) {
      return "";
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

/** 获取元素的视口边界。 */
async function getBounds(
  locator: ReturnType<Page["locator"]>,
): Promise<Bounds> {
  try {
    const box = await locator.boundingBox();
    if (box) {
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    }
  } catch {
    // boundingBox 可能因元素不可见而失败
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}

/** 从页面提取交互元素列表。 */
async function extractInteractables(page: Page): Promise<Interactable[]> {
  const result: Interactable[] = [];

  const selectors = [
    { selector: "button:visible", kind: "button" as const },
    { selector: 'a:visible[href]:not([href="#"])', kind: "link" as const },
    { selector: 'input:visible:not([type="hidden"])', kind: "input" as const },
    { selector: "textarea:visible", kind: "input" as const },
    { selector: 'select:visible, [role="tab"]', kind: "tab" as const },
    { selector: '[role="combobox"]:visible', kind: "select" as const },
  ];

  for (const { selector, kind } of selectors) {
    const elements = page.locator(selector);
    const count = await elements.count();
    for (let i = 0; i < Math.min(count, 20); i++) {
      const el = elements.nth(i);
      try {
        const label =
          (await el.textContent())?.trim().slice(0, 60) ??
          (await el.getAttribute("aria-label")) ??
          "";
        if (!label) continue;
        const disabled =
          (await el.getAttribute("disabled")) !== null ||
          (await el.getAttribute("aria-disabled")) === "true";
        const bounds = await getBounds(el);
        result.push({ kind, label, disabled, bounds });
      } catch {
        // 元素可能在提取中间被销毁
      }
    }
  }

  return result;
}

/** 提取聊天消息文本。 */
async function extractChatRegion(page: Page): Promise<ScreenRegion | null> {
  const messages = page.locator(
    '[data-role="assistant"]:visible, [data-role="user"]:visible, [data-message-role]:visible',
  );
  const count = await messages.count();
  if (count === 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < Math.min(count, 20); i++) {
    const msg = messages.nth(i);
    try {
      const role = (await msg.getAttribute("data-role")) ?? "unknown";
      const text = (await msg.textContent())?.trim() ?? "";
      if (text) {
        parts.push(`[${role}]: ${text}`);
      }
    } catch {
      // skip
    }
  }

  if (parts.length === 0) return null;

  const bounds = await getBounds(messages.first());

  return {
    type: "chat-messages",
    label: "导师消息区",
    content: parts.join("\n\n"),
    bounds,
    interactables: [],
  };
}

/** 提取代码编辑器区域的文本。 */
async function extractCodeRegion(
  page: Page,
  screenshotBase64: string,
  options: ScreenDescriberOptions,
): Promise<ScreenRegion | null> {
  // 策略 1：DOM 提取（Monaco 的 .view-lines node）
  const lines = page.locator(
    ".monaco-editor .view-lines .view-line, [data-slot='code-editor'] .view-line, .cm-line",
  );
  const lineCount = await lines.count();

  let content = "";
  if (lineCount > 0) {
    const lineTexts: string[] = [];
    for (let i = 0; i < Math.min(lineCount, 80); i++) {
      try {
        const text = (await lines.nth(i).textContent()) ?? "";
        lineTexts.push(text);
      } catch {
        lineTexts.push("");
      }
    }
    content = lineTexts.join("\n").trim();
    if (lineCount > 80) {
      content += `\n…（共 ${lineCount} 行，省略后续）`;
    }
  }

  // 策略 2：如果 DOM 提取不到内容，用 VLM 分析截图中的代码区域
  if (content === "" && screenshotBase64) {
    const editorBounds = await getBounds(
      page.locator(".monaco-editor, [data-slot='code-editor'], .cm-editor"),
    );
    if (editorBounds.width > 0) {
      content = await describeRegionWithVLM(
        "代码编辑器",
        screenshotBase64,
        options,
      );
    }
  }

  if (content === "") return null;

  // 检测代码中的错误标记
  const errorLines = page.locator(
    ".monaco-editor .squiggly-error, .monaco-editor .squiggly-warning, .cm-diagnostic",
  );
  const errorCount = await errorLines.count();
  const errorNote =
    errorCount > 0 ? `（代码中有 ${errorCount} 个错误/警告标记）` : "";

  const bounds = await getBounds(
    page.locator(".monaco-editor, [data-slot='code-editor'], .cm-editor"),
  );

  return {
    type: "code-editor",
    label: "代码编辑器",
    content: errorNote ? `${errorNote}\n\n${content}` : content,
    bounds,
    interactables: [],
  };
}

/** 提取输入框区域的信息。 */
async function extractComposerRegion(page: Page): Promise<ScreenRegion | null> {
  const composer = page.locator(
    'textarea, [data-slot="composer"] textarea, [contenteditable="true"]',
  );
  const count = await composer.count();
  if (count === 0) return null;

  const el = composer.first();
  try {
    const placeholder =
      (await el.getAttribute("placeholder")) ?? "可以输入消息";
    const currentText = (await el.inputValue().catch(() => "")) ?? "";
    const bounds = await getBounds(el);

    const content = currentText
      ? `输入框中已有文字：\n"${currentText.slice(0, 200)}"`
      : `输入框为空（placeholder: "${placeholder}"）`;

    return {
      type: "composer",
      label: "输入框",
      content,
      bounds,
      interactables: [
        {
          kind: "input",
          label: "消息输入框",
          disabled: false,
          bounds,
        },
      ],
    };
  } catch {
    return null;
  }
}

/** 提取步骤导航区域的信息。 */
async function extractStepNavRegion(page: Page): Promise<ScreenRegion | null> {
  const nav = page.locator(
    '[data-slot="step-nav"], nav[aria-label*="步骤"], .step-navigation',
  );
  const count = await nav.count();
  if (count === 0) return null;

  try {
    const text = (await nav.first().textContent())?.trim() ?? "";
    if (!text) return null;

    const bounds = await getBounds(nav.first());
    return {
      type: "step-nav",
      label: "步骤导航",
      content: text.slice(0, 300),
      bounds,
      interactables: [],
    };
  } catch {
    return null;
  }
}

/** 提取弹窗/Toast 信息。 */
async function extractToastRegion(page: Page): Promise<ScreenRegion | null> {
  const toast = page.locator('[role="alert"], .toast, [data-slot="toast"]');
  const count = await toast.count();
  if (count === 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < Math.min(count, 3); i++) {
    try {
      const text = (await toast.nth(i).textContent())?.trim();
      if (text) parts.push(text);
    } catch {
      // skip
    }
  }

  if (parts.length === 0) return null;

  const bounds = await getBounds(toast.first());
  return {
    type: "toast",
    label: "弹出提示",
    content: parts.join(" | "),
    bounds,
    interactables: [],
  };
}

/** 提取侧边栏信息。 */
async function extractSidebarRegion(page: Page): Promise<ScreenRegion | null> {
  const sidebar = page.locator('[data-slot="sidebar"], aside:visible');
  const count = await sidebar.count();
  if (count === 0) return null;

  try {
    const text = (await sidebar.first().textContent())?.trim()?.slice(0, 300);
    if (!text) return null;

    const bounds = await getBounds(sidebar.first());
    return {
      type: "sidebar",
      label: "侧边栏",
      content: text,
      bounds,
      interactables: [],
    };
  } catch {
    return null;
  }
}

// ---- 公开 API ----

let browser: Browser | null = null;

/** 启动浏览器（懒加载，单例）。 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

/** 关闭浏览器。 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * 描述当前页面状态。
 *
 * @param page - Playwright 的 Page 对象（调用方负责导航到目标页面）。
 * @param options - 视觉模型配置。
 * @returns 结构化的屏幕状态描述。
 */
export async function describePage(
  page: Page,
  options: ScreenDescriberOptions,
): Promise<ScreenState> {
  const url = page.url();
  const title = await page.title();
  const step = extractStepFromUrl(url);

  let screenshotBase64 = "";
  try {
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    screenshotBase64 = screenshot.toString("base64");
  } catch {
    // 截图失败不阻塞后续提取
  }

  const regions: ScreenRegion[] = [];
  const collect = (region: ScreenRegion | null) => {
    if (region) regions.push(region);
  };

  // 并行提取各区域（提取失败各自静默吞掉，不影响其他区域）
  const results = await Promise.allSettled([
    extractChatRegion(page),
    extractCodeRegion(page, screenshotBase64, options),
    extractComposerRegion(page),
    extractStepNavRegion(page),
    extractToastRegion(page),
    extractSidebarRegion(page),
  ]);

  for (const result of results) {
    if (result.status === "fulfilled") collect(result.value);
  }

  // 交互元素
  const interactables = await extractInteractables(page).catch(() => []);
  if (interactables.length > 0 && regions.length > 0) {
    // 把交互元素注入到最近的区域
    regions[regions.length - 1].interactables = [
      ...regions[regions.length - 1].interactables,
      ...interactables,
    ];
  }

  return {
    url,
    title,
    step,
    regions,
    screenshotBase64: screenshotBase64 || undefined,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * 创建一个新页面并导航到教学平台的指定路径。
 */
export async function openTeachingPage(
  path: string,
  options: ScreenDescriberOptions,
): Promise<{ page: Page; state: ScreenState }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // 注入学生身份 Cookie / Header
  await page.setExtraHTTPHeaders({
    "x-student-id": options.studentId,
  });

  const url = `${options.baseUrl}${path}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

  // 等待教学页面核心元素渲染
  await page
    .waitForSelector(
      '[data-role="assistant"], .monaco-editor, [data-slot="composer"], [data-slot="step-nav"]',
      { timeout: 8000 },
    )
    .catch(() => {
      // 页面可能还没加载完教学组件，先继续
    });

  const state = await describePage(page, options);
  return { page, state };
}

/** 从 URL 提取当前步骤 id（如 /learn/ts-basics/explain → explain）。 */
function extractStepFromUrl(url: string): string | null {
  const match = url.match(/\/learn\/[^/]+\/([^/?]+)/);
  return match ? match[1] : null;
}
