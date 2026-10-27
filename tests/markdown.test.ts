import { describe, expect, it } from "vitest";

import {
  isSafeHref,
  parseInline,
  parseMarkdown,
  segmentByCode,
  type InlineToken,
} from "@/lib/markdown";

/** 把行内 token 树拍平成可断言的形状（保留类型，丢掉嵌套细节）。 */
function flat(tokens: InlineToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === "text" || token.type === "code") return token.value;
      if (token.type === "link") return `link(${token.href})[${flat(token.children)}]`;
      return `${token.type}[${flat(token.children)}]`;
    })
    .join("");
}

describe("isSafeHref", () => {
  it("放行 http / https / mailto 与站内相对路径", () => {
    for (const href of [
      "https://example.com/a",
      "http://localhost:3000/x",
      "mailto:a@b.com",
      "#phase-1",
      "/learn/rag",
      "./wiki/query",
      "../up",
      "wiki/query",
    ]) {
      expect(isSafeHref(href), href).toBe(true);
    }
  });

  it("拒绝可执行协议", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox",
      "file:///etc/passwd",
    ]) {
      expect(isSafeHref(href), href).toBe(false);
    }
  });

  // 浏览器解析 URL 时会忽略控制字符，`java\tscript:` 仍可执行 —— 必须剥掉再判断。
  it("剥掉控制字符与空白后再判断协议", () => {
    expect(isSafeHref("java\tscript:alert(1)")).toBe(false);
    expect(isSafeHref("java\nscript:alert(1)")).toBe(false);
    expect(isSafeHref("  javascript:alert(1)  ")).toBe(false);
    expect(isSafeHref("  https://example.com  ")).toBe(true);
  });

  it("协议相对链接 //evil.com 视为外部并拒绝", () => {
    expect(isSafeHref("//evil.com/x")).toBe(false);
  });

  it("空目标拒绝", () => {
    expect(isSafeHref("")).toBe(false);
    expect(isSafeHref("   ")).toBe(false);
  });
});

describe("parseInline", () => {
  it("行内代码优先，反引号里的星号不变粗体", () => {
    expect(flat(parseInline("`**not bold**`"))).toBe("**not bold**");
  });

  it("识别粗体、斜体与链接", () => {
    expect(flat(parseInline("**粗** 与 *斜*"))).toBe("strong[粗] 与 emphasis[斜]");
    expect(flat(parseInline("[文档](https://example.com)"))).toBe(
      "link(https://example.com)[文档]",
    );
  });

  // 半成品一律降级为字面量：这是流式输出下的核心容错约定。
  it("未闭合的强调符与反引号按字面保留", () => {
    expect(flat(parseInline("**未闭合"))).toBe("**未闭合");
    expect(flat(parseInline("`半截"))).toBe("`半截");
    expect(flat(parseInline("[只有标签"))).toBe("[只有标签");
  });

  it("空内容或两端带空白的星号不构成强调", () => {
    expect(flat(parseInline("2 * 3 * 4"))).toBe("2 * 3 * 4");
    expect(flat(parseInline("****"))).toBe("****");
  });

  // 不安全链接不丢弃内容，只降级成纯文本 —— 否则学生看到「话说到一半没了」。
  it("不安全链接降级成标签文本，URL 不进入 token", () => {
    expect(flat(parseInline("[点我](javascript:alert)"))).toBe("点我");
    // 目标里再嵌一层括号时，`)` 之后的部分按字面量留在文本里 —— 重点是
    // 整条链接没有被当成可点击 token 产出。
    expect(flat(parseInline("[点我](javascript:alert(1))"))).toBe("点我)");
    const tokens = parseInline("[点我](javascript:alert(1))");
    expect(tokens.some((token) => token.type === "link")).toBe(false);
  });
});

describe("parseMarkdown", () => {
  it("标题层级", () => {
    const blocks = parseMarkdown("## 第二阶段");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
  });

  it("闭合围栏输出 closed=true 与语言", () => {
    const blocks = parseMarkdown("```ts\nconst a = 1;\n```");
    expect(blocks[0]).toEqual({
      type: "code",
      language: "ts",
      value: "const a = 1;",
      closed: true,
    });
  });

  // 流式输出到一半：围栏还没收，closed 必须为 false 让渲染层显示「还在写」。
  it("未闭合围栏 closed=false，内容照常保留", () => {
    const blocks = parseMarkdown("```py\nprint(1)");
    expect(blocks[0]).toEqual({
      type: "code",
      language: "py",
      value: "print(1)",
      closed: false,
    });
  });

  it("三种字符的围栏不能互相闭合", () => {
    const blocks = parseMarkdown("```\nbody\n~~~");
    expect(blocks[0]).toMatchObject({ type: "code", closed: false });
    expect(blocks[0]?.type === "code" && blocks[0].value).toBe("body\n~~~");
  });

  it("分割线优先于列表（*** 不解析成列表）", () => {
    expect(parseMarkdown("***")).toEqual([{ type: "rule" }]);
  });

  it("无序列表与有序列表起始序号", () => {
    expect(parseMarkdown("- 一\n- 二")[0]).toMatchObject({
      type: "list",
      ordered: false,
      items: [[{ type: "text", value: "一" }], [{ type: "text", value: "二" }]],
    });
    expect(parseMarkdown("3. 三\n4. 四")[0]).toMatchObject({
      type: "list",
      ordered: true,
      start: 3,
    });
  });

  it("列表续行并入当前条目", () => {
    const blocks = parseMarkdown("- 第一行\n  第二行");
    expect(flat((blocks[0] as { items: InlineToken[][] }).items[0])).toBe(
      "第一行\n第二行",
    );
  });

  it("引用块递归解析内部块", () => {
    const blocks = parseMarkdown("> ## 标题\n> 正文");
    expect(blocks[0]).toMatchObject({ type: "quote" });
    const children = (blocks[0] as { children: typeof blocks }).children;
    expect(children.map((b) => b.type)).toEqual(["heading", "paragraph"]);
  });

  it("段落遇到空行或下一个块级开头就收尾", () => {
    const blocks = parseMarkdown("第一段\n\n## 标题\n第二段");
    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "paragraph",
    ]);
  });

  it("CRLF 与裸 CR 都归一成 LF", () => {
    const blocks = parseMarkdown("第一段\r\n\r\n第二段\r");
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
  });

  it("原始 HTML 当纯文本，不产生任何 html token", () => {
    const blocks = parseMarkdown("<script>alert(1)</script>");
    expect(blocks[0]?.type).toBe("paragraph");
    expect(flat((blocks[0] as { children: InlineToken[] }).children)).toBe(
      "<script>alert(1)</script>",
    );
  });
});

describe("segmentByCode", () => {
  it("散文按原文保留，代码段带递增序号", () => {
    const segments = segmentByCode("说明一\n\n```ts\nA\n```\n\n说明二");
    expect(segments).toEqual([
      { kind: "prose", source: "说明一" },
      { kind: "code", language: "ts", value: "A", ordinal: 1 },
      { kind: "prose", source: "说明二" },
    ]);
  });

  it("只有空白散文时不产出空段", () => {
    const segments = segmentByCode("   \n```\nA\n```\n  ");
    expect(segments).toEqual([
      { kind: "code", language: null, value: "A", ordinal: 1 },
    ]);
  });

  it("未闭合围栏也切成代码段（流式半成品）", () => {
    const segments = segmentByCode("前文\n```ts\n半截");
    expect(segments).toEqual([
      { kind: "prose", source: "前文" },
      { kind: "code", language: "ts", value: "半截", ordinal: 1 },
    ]);
  });
});
