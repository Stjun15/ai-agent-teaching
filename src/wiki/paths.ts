/**
 * wiki 路径解析
 *
 * 与 db 层「驱动名只出现在 sqlite.ts」的做法同源：**路径拼接只出现在本文件**，
 * 其余模块一律用相对 wiki 根的路径（如 `concepts/llm-api.md`）交流。这样将来
 * 把 wiki 从本地文件系统搬到对象存储或数据库时，改动范围限于这一个文件。
 *
 * 根目录默认取 `{cwd}/llm-wiki`。允许用环境变量 `WIKI_ROOT` 覆盖（**推断**：
 * wiki-schema.md 只写了目录结构，没写根目录如何配置；而测试与脚本需要把
 * 读写指向别处，否则只能污染真实 wiki）。接受相对 cwd 与绝对两种写法。
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { WikiError } from "./errors";

export const WIKI_DIR_NAME = "llm-wiki";
export const SCHEMA_FILE = "SCHEMA.md";
export const INDEX_FILE = "index.md";
export const LOG_FILE = "log.md";

/**
 * 元文件：不参与「内容页」的遍历与校验。
 *
 * SCHEMA.md 是规范本身（没有 frontmatter），index.md / log.md 的 `type`
 * （`index` / `log`）不在 SCHEMA.md 的 12 种页面类型内 —— 它们是 wiki 的
 * 骨架，不是内容页，混进校验只会制造噪声。
 */
export const META_FILES: readonly string[] = [
  SCHEMA_FILE,
  INDEX_FILE,
  LOG_FILE,
];

/** wiki 根目录的绝对路径。 */
export function resolveWikiRoot(): string {
  const override = process.env.WIKI_ROOT?.trim();
  if (override) {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), override);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), WIKI_DIR_NAME);
}

/**
 * 相对 wiki 根的路径 → 绝对路径。
 *
 * 两道防线：拒绝含 `..` 的路径，并断言结果仍在根目录内。wiki 的调用方包括
 * Agent，路径可能来自模型输出，不能默认它守规矩。
 */
export function resolvePagePath(
  pagePath: string,
  root = resolveWikiRoot(),
): string {
  const normalized = pagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.split("/").includes("..")) {
    throw new WikiError(`页面路径不允许包含 ".."：${pagePath}`);
  }

  // turbopackIgnore：pagePath 是运行期值（来自 Agent、脚本、索引文件），
  // 静态分析推不出目标。不加此注释时 Turbopack 会保守地把整个项目纳入产物追踪。
  const absolutePath = path.resolve(/*turbopackIgnore: true*/ root, normalized);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (absolutePath !== root && !absolutePath.startsWith(prefix)) {
    throw new WikiError(`页面路径越出 wiki 根目录：${pagePath}`);
  }
  return absolutePath;
}

/** 绝对路径 → 相对 wiki 根的路径（始终用 `/` 分隔）。 */
export function toWikiPath(
  absolutePath: string,
  root = resolveWikiRoot(),
): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

/** 是否为根目录下的元文件（SCHEMA.md / index.md / log.md）。 */
export function isMetaFile(wikiPath: string): boolean {
  return META_FILES.includes(wikiPath);
}

/**
 * 列出全部**内容页**的相对路径（已排除根目录下的元文件与非 `.md` 文件）。
 *
 * 根目录不存在时返回空数组而不是抛错 —— 「wiki 还没初始化」是一种正常状态。
 */
export function listPagePaths(root = resolveWikiRoot()): string[] {
  const found: string[] = [];
  walk(root, "", found);
  return found.sort();
}

function walk(directory: string, prefix: string, found: string[]): void {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const wikiPath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(path.join(directory, entry.name), wikiPath, found);
      continue;
    }
    if (!entry.name.endsWith(".md")) continue;
    if (prefix === "" && isMetaFile(wikiPath)) continue;
    found.push(wikiPath);
  }
}
