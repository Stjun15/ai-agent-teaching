/**
 * 页面读写与引用解析
 *
 * 对应 wiki-schema.md「六、LLM Wiki 操作接口」里的 `getPage` / `updatePage`，
 * 另加 `listPages` 与引用解析工具（`maintain` 校验死链、`query` 解析 `related`
 * 都要用，放在这里避免重复实现）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WikiPageNotFoundError, WikiSchemaViolationError } from "./errors";
import { composePage, orderFrontmatter, parseMarkdown } from "./frontmatter";
import {
  SCHEMA_FILE,
  listPagePaths,
  resolvePagePath,
  resolveWikiRoot,
} from "./paths";
import type { WikiSchema } from "./schema";
import { inferPageType, loadWikiSchema, missingRequiredFields } from "./schema";
import type { WikiPage } from "./types";

export interface ReadPageOptions {
  root?: string;
  /** 已加载的 schema。批量读取时由调用方复用，避免每页重读 SCHEMA.md。 */
  schema?: WikiSchema;
}

/** 读取 SCHEMA.md 作为默认校验依据。 */
export function loadDefaultSchema(root = resolveWikiRoot()): WikiSchema {
  return loadWikiSchema(path.join(root, SCHEMA_FILE), SCHEMA_FILE);
}

/** 同步读取单个页面。路径必须是相对 wiki 根的精确路径（含 `.md`）。 */
export function readPageSync(
  pagePath: string,
  options: ReadPageOptions = {},
): WikiPage {
  const root = options.root ?? resolveWikiRoot();
  const absolutePath = resolvePagePath(pagePath, root);
  if (!existsSync(absolutePath)) {
    throw new WikiPageNotFoundError(`页面不存在：${pagePath}`);
  }

  const parsed = parseMarkdown(readFileSync(absolutePath, "utf8"), pagePath);
  const declared =
    typeof parsed.frontmatter.type === "string" ? parsed.frontmatter.type : "";
  const schema = options.schema ?? loadDefaultSchema(root);

  return {
    path: pagePath,
    absolutePath,
    type: declared || inferPageType(schema, pagePath) || "",
    hasFrontmatter: parsed.hasFrontmatter,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
  };
}

/** 读取单个页面（`wiki-schema.md` 定义的 `getPage`）。 */
export async function getPage(pagePath: string): Promise<WikiPage> {
  return readPageSync(pagePath);
}

/** 列出全部内容页。 */
export async function listPages(): Promise<WikiPage[]> {
  const root = resolveWikiRoot();
  const schema = loadDefaultSchema(root);
  return listPagePaths(root).map((pagePath) =>
    readPageSync(pagePath, { root, schema }),
  );
}

/**
 * 写入页面（`wiki-schema.md` 定义的 `updatePage`）。
 *
 * 与「原样落盘」不同，这里会**规范化**后再写：
 * - frontmatter 按「type、last_updated 在前」重排并重新序列化；
 * - 正文去掉首尾多余空行。
 *
 * 理由是写回的文件必须能让 `prettier --check` 通过（Prettier 会改写 markdown
 * 的 frontmatter），把规范化收在这里，调用方就不必各自对齐格式。
 * 代价是调用方无法用它做「保留原文格式的写入」—— 那属于文本编辑，不属于本函数。
 */
export async function updatePage(
  pagePath: string,
  content: string,
): Promise<void> {
  const root = resolveWikiRoot();
  const schema = loadDefaultSchema(root);
  const parsed = parseMarkdown(content, pagePath);

  if (!parsed.hasFrontmatter) {
    throw new WikiSchemaViolationError(
      `${pagePath}: 拒绝写入 —— ${SCHEMA_FILE} 要求所有页面都带 frontmatter 块`,
    );
  }

  const declared =
    typeof parsed.frontmatter.type === "string" ? parsed.frontmatter.type : "";
  const type = declared || inferPageType(schema, pagePath) || "";
  if (type === "") {
    throw new WikiSchemaViolationError(
      `${pagePath}: frontmatter 缺少 type，且无法按 ${SCHEMA_FILE} 的目录映射推断`,
    );
  }

  const frontmatter = orderFrontmatter({ ...parsed.frontmatter, type });
  const missing = missingRequiredFields(schema, frontmatter, type);
  if (missing.length > 0) {
    throw new WikiSchemaViolationError(
      `${pagePath}: 缺少 ${type} 页面的必填字段：${missing.join("、")}（依据 ${SCHEMA_FILE}）`,
    );
  }

  writePageFile(pagePath, composePage(frontmatter, parsed.body), root);
}

/** 落盘（自动创建父目录），保证文件以单个换行结尾。 */
export function writePageFile(
  pagePath: string,
  content: string,
  root = resolveWikiRoot(),
): void {
  const absolutePath = resolvePagePath(pagePath, root);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(
    absolutePath,
    content.endsWith("\n") ? content : `${content}\n`,
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// 引用解析
//
// `[[wiki-link]]` 里的名字与 `prerequisites` / `related_concepts` 里的名字
// 都按「引用名」解析。SCHEMA.md 只规定了语法是 `[[wiki-link]]`，没有规定
// 名字的形态 —— 这里接受四种写法（**推断**）：frontmatter.id、文件名去扩展名、
// 相对路径、去扩展名的相对路径。之所以放宽，是因为页面里已经在用前两种
// （`[[system-prompt]]`、`[[missing-params]]`）。
// ---------------------------------------------------------------------------

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/**
 * 剥掉代码段：围栏代码块与行内代码里的 `[[...]]` 是语法示例或代码本体
 * （如 Python 的 `Callable[[...], ...]` 类型标注），不是交叉引用。
 *
 * 为什么在抽取层而不是 maintain 层剥：`extractWikiLinks` 的两个消费方
 * （maintain 的死链/孤立页扫描、query 的相关页图）对「什么是引用」的
 * 语义完全一致 —— 代码里的不是引用。2026-10-05 实测：不剥会产生 5 条
 * 永不消失的死链假阳性；差分探针确认全库仅 `concepts/llm-wiki.md` 有一条
 * 代码注释里的活引用（已转为正文链接，图拓扑不变）。
 */
function stripCodeSegments(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

/** 取出正文中全部 `[[wiki-link]]` 的目标（去重，保留出现顺序；代码段不算）。 */
export function extractWikiLinks(text: string): string[] {
  const links = new Set<string>();
  for (const match of stripCodeSegments(text).matchAll(WIKI_LINK_PATTERN)) {
    links.add(match[1].trim());
  }
  return [...links];
}

/** 页面的主引用名：优先 frontmatter.id，其次文件名去扩展名。 */
export function pageRef(page: WikiPage): string {
  const id = page.frontmatter.id;
  if (typeof id === "string" && id.length > 0) return id;
  return path.basename(page.path, ".md");
}

/** 一个页面可被引用的全部名字。 */
export function pageAliases(page: WikiPage): string[] {
  const stem = path.basename(page.path, ".md");
  return [...new Set([pageRef(page), stem, page.path, page.path.slice(0, -3)])];
}

/** 引用名 → 页面路径（可能命中多页，同名时由调用方报错或择一）。 */
export function buildRefIndex(pages: WikiPage[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const page of pages) {
    for (const alias of pageAliases(page)) {
      const existing = index.get(alias);
      if (existing) existing.push(page.path);
      else index.set(alias, [page.path]);
    }
  }
  return index;
}

/** 解析一个引用名，返回命中的页面路径列表（空数组表示死链）。 */
export function resolveRef(
  index: Map<string, string[]>,
  ref: string,
): string[] {
  return index.get(ref.trim()) ?? [];
}

/**
 * frontmatter 里承载「页面间关系」的字段。
 *
 * SCHEMA.md 只规定了要求（「概念之间必须互相链接」「反模式必须关联概念」等），
 * 没有规定字段名；这两个名字取自各页面模板（`prerequisites`、`related_concepts`）
 * —— **推断**。新增关系字段时改这里，`query` 的 `related` 范围与 `maintain`
 * 的死链检查会同时生效。
 */
export const RELATION_FIELDS: readonly string[] = [
  "prerequisites",
  "related_concepts",
];

/** 取出页面在 frontmatter 里声明的全部关联引用。 */
export function collectRelationRefs(page: WikiPage): string[] {
  const refs: string[] = [];
  for (const field of RELATION_FIELDS) {
    const value = page.frontmatter[field];
    if (!Array.isArray(value)) continue;
    refs.push(...value);
  }
  return refs;
}
