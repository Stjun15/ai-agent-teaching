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

import {
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

