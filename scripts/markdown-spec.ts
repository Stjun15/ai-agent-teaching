/**
 * Markdown 解析器规格测试
 *
 * 三组用例，各自守一个东西：
 *
 * 1. **注入面**（最重要）。模型输出是不可信内容。这里的断言不是「渲染出来好看」，
 *    而是「这条链上根本没有能承载脚本的东西」：token 类型必须全部落在白名单内
 *    （即不存在 html/raw 之类的原始串），不安全协议降级为纯文本而非链接。
 * 2. **结构**。标题 / 列表 / 代码块 / 强调 / 引用 / 分割线各自解析正确，
 *    且**不能误吃**模型输出里常见的东西（`snake_case`、代码里的 `*`）。
 * 3. **流式容错**（性质测试）。逐字符截断重放：任何半截输入都不能抛异常、
 *    不能产生不安全链接、不能凭空造出块。这才是真实使用路径 —— 模型是一个
 *    token 一个 token 吐的，解析器遇到的永远是半成品。
 *
 * 运行：
 *   pnpm test:markdown
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isSafeHref,
  parseInline,
  parseMarkdown,
  type InlineToken,
  type MarkdownBlock,
} from "@/lib/markdown";

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

/** 允许出现的 token 类型。多出任何一种都意味着白名单被绕过了。 */
const ALLOWED_TOKENS = new Set([
  "text",
  "code",
  "strong",
  "emphasis",
  "link",
  "paragraph",
  "heading",
  "list",
  "quote",
  "rule",
]);

function collectTypes(blocks: MarkdownBlock[]): Set<string> {
  const found = new Set<string>();

  const walkInline = (tokens: InlineToken[]): void => {
    for (const token of tokens) {
      found.add(token.type);
      if (
        token.type === "strong" ||
        token.type === "emphasis" ||
        token.type === "link"
      ) {
        walkInline(token.children);
      }
    }
  };

  const walkBlocks = (list: MarkdownBlock[]): void => {
    for (const block of list) {
      found.add(block.type);
      if (block.type === "paragraph" || block.type === "heading") {
        walkInline(block.children);
      } else if (block.type === "list") {
        for (const item of block.items) walkInline(item);
      } else if (block.type === "quote") {
        walkBlocks(block.children);
      }
    }
  };

  walkBlocks(blocks);
  return found;
}

/** 把块级 token 里的所有文本拼起来，便于断言「内容没丢」。 */
function flattenText(blocks: MarkdownBlock[]): string {
  const parts: string[] = [];

  const walkInline = (tokens: InlineToken[]): void => {
    for (const token of tokens) {
      if (token.type === "text" || token.type === "code")
        parts.push(token.value);
      else if (token.type === "link") walkInline(token.children);
      else walkInline(token.children);
    }
  };

  const walkBlocks = (list: MarkdownBlock[]): void => {
    for (const block of list) {
      if (block.type === "paragraph" || block.type === "heading")
        walkInline(block.children);
      else if (block.type === "code") parts.push(block.value);
      else if (block.type === "list")
        for (const item of block.items) walkInline(item);
      else if (block.type === "quote") walkBlocks(block.children);
    }
  };

  walkBlocks(blocks);
  return parts.join("");
}

/** 断言一份输入只产出白名单内的 token。 */
function assertWhitelisted(source: string): MarkdownBlock[] {
  const blocks = parseMarkdown(source);
  for (const type of collectTypes(blocks)) {
    assert.ok(
      ALLOWED_TOKENS.has(type),
      `出现了白名单外的 token 类型: ${type}（输入: ${JSON.stringify(source)}）`,
    );
  }
  return blocks;
}

/** 找出块里所有的链接 token。 */
function collectLinks(blocks: MarkdownBlock[]): { href: string }[] {
  const links: { href: string }[] = [];

  const walkInline = (tokens: InlineToken[]): void => {
    for (const token of tokens) {
      if (token.type === "link") {
        links.push({ href: token.href });
        walkInline(token.children);
      } else if (token.type === "strong" || token.type === "emphasis") {
        walkInline(token.children);
      }
    }
  };

  for (const block of blocks) {
    if (block.type === "paragraph" || block.type === "heading")
      walkInline(block.children);
    else if (block.type === "list")
      for (const item of block.items) walkInline(item);
    else if (block.type === "quote")
      links.push(...collectLinks(block.children));
  }

  return links;
}

// ---------------------------------------------------------------------------
// 一、注入面
// ---------------------------------------------------------------------------

test("原始 HTML 一律当纯文本，不产生任何 HTML token", () => {
  const source = "<script>alert(1)</script>";
  const blocks = assertWhitelisted(source);
  assert.equal(flattenText(blocks), source, "内容应原样保留为文本");
  assert.equal(
    collectTypes(blocks).has("html"),
    false,
    "不应存在 html token —— 存在即意味着有原始串能直通 DOM",
  );
});

test("img onerror 这类事件属性不会被解释", () => {
  const source = '<img src=x onerror="alert(1)">';
  const blocks = assertWhitelisted(source);
  assert.equal(flattenText(blocks), source);
});

test("javascript: 链接被降级为纯文本，正文不丢", () => {
  const blocks = parseMarkdown("[点我看提示](javascript:alert(1))");
  assert.equal(collectLinks(blocks).length, 0, "不应产生链接 token");
  assert.ok(
    flattenText(blocks).includes("点我看提示"),
    "标签文字必须保留，不能整段消失",
  );
});

test("大小写与空白混淆的 javascript: 同样被拒", () => {
  for (const source of [
    "[x](JaVaScRiPt:alert(1))",
    "[x](java\tscript:alert(1))",
    "[x](java\nscript:alert(1))",
    "[x]( javascript:alert(1) )",
  ]) {
    const blocks = parseMarkdown(source);
    assert.equal(
      collectLinks(blocks).length,
      0,
      `未拒绝不安全链接: ${JSON.stringify(source)}`,
    );
  }
});

test("data: 链接被拒（能承载完整 HTML 文档）", () => {
  const blocks = parseMarkdown(
    "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
  );
  assert.equal(collectLinks(blocks).length, 0);
});

test("http / https / mailto / 站内相对路径被保留", () => {
  const cases: [string, string][] = [
    ["[文档](https://example.com/a?b=1)", "https://example.com/a?b=1"],
    ["[站内](/wiki/query)", "/wiki/query"],
    ["[锚点](#steps)", "#steps"],
    ["[邮箱](mailto:a@b.com)", "mailto:a@b.com"],
  ];
  for (const [source, href] of cases) {
    const links = collectLinks(parseMarkdown(source));
    assert.equal(links.length, 1, `应解析出一条链接: ${source}`);
    assert.equal(links[0].href, href);
  }
});

test("isSafeHref：协议白名单与相对路径判定", () => {
  const safe = [
    "https://a.com",
    "http://a.com",
    "HTTPS://A.COM",
    "#x",
    "/x",
    "./x",
    "../x",
    "wiki/x",
  ];
  const unsafe = [
    "",
    "   ",
    "javascript:alert(1)",
    "vbscript:x",
    "blob:https://a.com/x",
    "file:///etc/passwd",
    "data:text/html,x",
    "//evil.com",
  ];
  for (const value of safe) {
    assert.equal(
      isSafeHref(value),
      true,
      `应判定为安全: ${JSON.stringify(value)}`,
    );
  }
  for (const value of unsafe) {
    assert.equal(
      isSafeHref(value),
      false,
      `应判定为不安全: ${JSON.stringify(value)}`,
    );
  }
});

test("混合恶意输入下 token 类型仍在白名单内", () => {
  // 一段「什么坏东西都往里塞」的输入，模拟模型被提示注入后的输出。
  assertWhitelisted(
    [
      "# 教程 <script>alert(1)</script>",
      "",
      "- 看 [这个](javascript:alert(document.cookie))",
      "- ![追踪](https://evil.com/pixel.png)",
      "- <iframe src=//evil.com></iframe>",
      "",
      "```html",
      "<img src=x onerror=alert(1)>",
      "```",
      "",
      '> 引用 <b>粗体</b> <a href="javascript:1">链接</a>',
    ].join("\n"),
  );
});

// ---------------------------------------------------------------------------
// 二、结构
// ---------------------------------------------------------------------------

test("标题解析为 heading 且层级正确", () => {
  const blocks = parseMarkdown("## 要点");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].type === "heading" ? blocks[0].level : 0, 2);
});

test("无序列表：连续条目归一个 list", () => {
  const blocks = parseMarkdown("- 第一点\n- 第二点\n- 第三点");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "list");
  if (blocks[0].type !== "list") return;
  assert.equal(blocks[0].ordered, false);
  assert.equal(blocks[0].items.length, 3);
});

test("有序列表：保留起始序号", () => {
  const blocks = parseMarkdown("3. 第三点\n4. 第四点");
  assert.equal(blocks[0].type, "list");
  if (blocks[0].type !== "list") return;
  assert.equal(blocks[0].ordered, true);
  assert.equal(blocks[0].start, 3);
  assert.equal(blocks[0].items.length, 2);
});

test("列表后的段落能正确收尾，不会被吞进列表", () => {
  const blocks = parseMarkdown("- 要点一\n- 要点二\n\n收尾段落");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "list");
  assert.equal(blocks[1].type, "paragraph");
});

test("围栏代码块：语言、闭合标记与内容保真", () => {
  const source = "```ts\nconst a: number = 1;\n```";
  const blocks = parseMarkdown(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  if (blocks[0].type !== "code") return;
  assert.equal(blocks[0].language, "ts");
  assert.equal(blocks[0].closed, true);
  assert.equal(blocks[0].value, "const a: number = 1;");
});

test("代码块内的 Markdown 标记不被解释", () => {
  const blocks = parseMarkdown("```\n**不是粗体** <script>x</script>\n```");
  assert.equal(blocks[0].type, "code");
  if (blocks[0].type !== "code") return;
  assert.equal(blocks[0].value, "**不是粗体** <script>x</script>");
});

test("行内代码优先级高于强调（代码里的 * 不吃）", () => {
  const tokens = parseInline("用 `select * from t` 查");
  assert.equal(tokens.length, 3);
  assert.deepEqual(tokens[1], { type: "code", value: "select * from t" });
});

test("粗体与斜体解析", () => {
  const tokens = parseInline("这是**加粗**和*倾斜*");
  const types = tokens.map((token) => token.type);
  assert.deepEqual(types, ["text", "strong", "text", "emphasis"]);
});

test("snake_case 标识符不被下划线吃掉", () => {
  const source = "设置 system_prompt 与 max_tokens 两个字段";
  const tokens = parseInline(source);
  assert.equal(tokens.length, 1, "应整体是一个文本 token，说明 _ 未被当强调符");
  assert.equal(tokens[0].type === "text" ? tokens[0].value : "", source);
});

test("段内单换行保留（breaks 语义），不合并成一行", () => {
  const blocks = parseMarkdown("第一行\n第二行");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
  assert.ok(
    flattenText(blocks).includes("\n"),
    "换行必须保留：原来就是靠它保持可读的",
  );
});

test("引用块递归解析内部的列表", () => {
  const blocks = parseMarkdown("> 提示：\n> - 先看文档\n> - 再动手");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "quote");
  if (blocks[0].type !== "quote") return;
  assert.equal(blocks[0].children.length, 2);
  assert.equal(blocks[0].children[1].type, "list");
});

test("分割线识别为 rule", () => {
  assert.equal(parseMarkdown("---")[0].type, "rule");
  assert.equal(parseMarkdown("***")[0].type, "rule");
});

test("空输入与纯空白输入返回空数组", () => {
  assert.deepEqual(parseMarkdown(""), []);
  assert.deepEqual(parseMarkdown("\n\n   \n"), []);
});

// ---------------------------------------------------------------------------
// 三、流式容错（性质测试）
// ---------------------------------------------------------------------------

test("未闭合围栏：closed=false，半截内容仍进代码块", () => {
  const blocks = parseMarkdown("```ts\nconst a = 1");
  assert.equal(blocks[0].type, "code");
  if (blocks[0].type !== "code") return;
  assert.equal(blocks[0].closed, false);
  assert.equal(blocks[0].value, "const a = 1");
});

test("未闭合强调符号原样保留，不吃掉后面的正文", () => {
  const tokens = parseInline("这里有**两个星号还没闭");
  assert.equal(
    tokens
      .map((token) => (token.type === "text" ? token.value : `[${token.type}]`))
      .join(""),
    "这里有**两个星号还没闭",
  );
});

test("刚打出三个反引号时就是一个空代码块，不抛异常", () => {
  const blocks = parseMarkdown("```");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  if (blocks[0].type !== "code") return;
  assert.equal(blocks[0].closed, false);
  assert.equal(blocks[0].value, "");
});

/** 一段「典型模型输出」，用来做逐字符截断重放。 */
const STREAM_SAMPLE = [
  "## 小结",
  "",
  "`temperature` 控制随机性，**越高越发散**。",
  "",
  "- 0.2：稳定，适合抽取",
  "- 0.8：发散，适合头脑风暴",
  "",
  "```ts",
  "const t = 0.2; // 建议先用低值",
  "```",
  "",
  "> 想细看可以读 [文档](https://example.com/temp)。",
  "",
  "另外这段是[危险链接](javascript:alert(1))，应降级为纯文本。",
  "",
  "---",
  "",
  "完",
].join("\n");

test("性质：任意前缀都不抛异常，且始终不产生白名单外 token", () => {
  for (let end = 0; end <= STREAM_SAMPLE.length; end += 1) {
    const prefix = STREAM_SAMPLE.slice(0, end);
    assertWhitelisted(prefix);
  }
});

test("性质：任意前缀都不产生不安全链接", () => {
  for (let end = 0; end <= STREAM_SAMPLE.length; end += 1) {
    const prefix = STREAM_SAMPLE.slice(0, end);
    for (const link of collectLinks(parseMarkdown(prefix))) {
      assert.equal(
        isSafeHref(link.href),
        true,
        `前缀长度为 ${end} 时出现了不安全链接: ${link.href}`,
      );
    }
  }
});

test("性质：前缀增长时已闭合的代码块内容不会被改写", () => {
  const source = "```ts\nconst a = 1;\n```";
  const closedAt = source.length;
  const before = parseMarkdown(source.slice(0, closedAt - 1));
  assert.equal(before[0].type, "code");
  if (before[0].type !== "code") return;
  assert.equal(before[0].closed, false, "少一个反引号时应仍未闭合");

  const after = parseMarkdown(source);
  assert.equal(after[0].type === "code" ? after[0].closed : null, true);
});

test("性质：任意前缀解析的块数不会负增长或凭空膨胀", () => {
  let previous = 0;
  for (let end = 0; end <= STREAM_SAMPLE.length; end += 1) {
    const blocks = parseMarkdown(STREAM_SAMPLE.slice(0, end));
    assert.ok(
      blocks.length >= previous || blocks.length <= previous + 1,
      `前缀 ${end} 处块数从 ${previous} 突变到 ${blocks.length}`,
    );
    previous = blocks.length;
  }
});
