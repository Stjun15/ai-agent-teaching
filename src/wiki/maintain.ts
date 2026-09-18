/**
 * `maintain`：检查并修复 wiki 结构
 *
 * 对应 wiki-schema.md「六、LLM Wiki 操作接口」里的 `maintain`（原文描述是
 * 「自动更新交叉引用」）。签名不带参数，所以这里把「检查」与「能安全自动修的
 * 部分」都做掉，其余列进报告由人或 Agent 处置。
 *
 * **自动修**（确定性、无歧义）：`index.md` 各表格「状态」列的 已建/待建。
 * 判据就是目标文件/目录在不在磁盘上，不存在判断空间。
 *
 * **只报告不自动改**（需要人判断）：死链、frontmatter 关联字段指向不存在的页面、
 * 孤立页、缺必填字段、未登记进索引的页面。自动补这些要么是猜，要么会写坏内容。
 *
 * 刻意**不**更新 `last_updated`：状态列是派生字段，若每次维护都盖一次时间戳，
 * 每天跑一次就会产生一次无意义的 diff。`last_updated` 只反映内容变更。
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  formatMarkdownTable,
  isTableRow,
  parseMarkdownTable,
  splitTableRow,
} from "./markdown-table";
import {
  INDEX_FILE,
  SCHEMA_FILE,
  listPagePaths,
  resolvePagePath,
  resolveWikiRoot,
} from "./paths";
import {
  buildRefIndex,
  collectRelationRefs,
  extractWikiLinks,
  loadDefaultSchema,
  readPageSync,
  resolveRef,
} from "./page";
import { missingRequiredFields } from "./schema";
import type { MaintainReport, WikiIssue } from "./types";

/** `index.md` 状态列的取值。不是 SCHEMA.md 的规定，而是 index.md 自身的既定写法。 */
const STATUS_BUILT = "已建";
const STATUS_PLANNED = "待建";

export async function maintain(): Promise<MaintainReport> {
  const root = resolveWikiRoot();
  const schema = loadDefaultSchema(root);
  const pages = listPagePaths(root).map((pagePath) =>
    readPageSync(pagePath, { root, schema }),
  );
  const refIndex = buildRefIndex(pages);
  const knownTypes = new Set(schema.pageTypes.map((spec) => spec.type));

  const issues: WikiIssue[] = [];

  for (const page of pages) {
    if (!page.hasFrontmatter) {
      issues.push({
        kind: "missing-frontmatter",
        page: page.path,
        detail: `没有 frontmatter 块（${SCHEMA_FILE} 要求所有页面都有）`,
      });
      continue;
    }

    if (page.type === "" || !knownTypes.has(page.type)) {
      issues.push({
        kind: "unknown-page-type",
        page: page.path,
        detail: `frontmatter.type ${page.type === "" ? "为空" : `= "${page.type}"`}，不在 ${SCHEMA_FILE} 的页面类型表内`,
      });
    }

    const missing = missingRequiredFields(schema, page.frontmatter, page.type);
    if (missing.length > 0) {
      issues.push({
        kind: "missing-required-field",
        page: page.path,
        detail: `缺少必填字段：${missing.join("、")}`,
      });
    }

    for (const link of extractWikiLinks(page.body)) {
      if (resolveRef(refIndex, link).length === 0) {
        issues.push({
          kind: "dead-link",
          page: page.path,
          detail: `[[${link}]] 没有对应页面`,
        });
      }
    }

    for (const ref of collectRelationRefs(page)) {
      if (resolveRef(refIndex, ref).length === 0) {
        issues.push({
          kind: "broken-reference",
          page: page.path,
          detail: `frontmatter 关联字段里的 "${ref}" 没有对应页面`,
        });
      }
    }
  }

  // 孤立页：没有任何页面（含 frontmatter 关联）指向它
  const referenced = new Set<string>();
  for (const page of pages) {
    for (const link of extractWikiLinks(page.body)) {
      for (const target of resolveRef(refIndex, link)) referenced.add(target);
    }
    for (const ref of collectRelationRefs(page)) {
      for (const target of resolveRef(refIndex, ref)) referenced.add(target);
    }
  }
  // 只对概念页判定孤立。SCHEMA.md「交叉引用」的原话是「**概念之间**必须互相
  // 链接」；反模式、评分标准、学生页是叶子节点 —— 它们靠 index.md 被人找到，
  // 而不是被别的页面引用。对它们报孤立只会产出 22 条永不消失的噪声，
  // 把报告变成没人看的清单。
  for (const page of pages) {
    if (page.type !== "concept") continue;
    if (!referenced.has(page.path)) {
      issues.push({
        kind: "orphan-page",
        page: page.path,
        detail: "没有任何页面通过 [[wiki-link]] 或 frontmatter 关联字段指向它",
      });
    }
  }

  // 索引覆盖：index.md 没有条目的页面，等于学生按目录走不到
  const indexed = readIndexLinkTargets(root);
  for (const page of pages) {
    if (!indexed.has(page.path)) {
      issues.push({
        kind: "unindexed-page",
        page: page.path,
        detail: `${INDEX_FILE} 中没有指向它的条目`,
      });
    }
  }

  const fixed = await syncIndexStatuses(root);
  return { checked: pages.length, issues, fixed };
}

/**
 * 把 `index.md` 各表格「状态」列同步成磁盘实况，返回被改动的条目。
 *
 * 只重排**确实需要改动**的那一张表 —— 没变动的表原样输出，避免全文件重新
 * 格式化带来的无谓 diff。
 */
export async function syncIndexStatuses(
  root = resolveWikiRoot(),
): Promise<string[]> {
  const absolutePath = resolvePagePath(INDEX_FILE, root);
  if (!existsSync(absolutePath)) return [];

  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
  const fixed: string[] = [];
  const output: string[] = [];

  let cursor = 0;
  while (cursor < lines.length) {
    if (!isTableRow(lines[cursor])) {
      output.push(lines[cursor]);
      cursor += 1;
      continue;
    }

    let end = cursor;
    while (end < lines.length && isTableRow(lines[end])) end += 1;
    const block = lines.slice(cursor, end);
    const table = parseMarkdownTable(block);

    if (!table) {
      output.push(...block);
      cursor = end;
      continue;
    }

    let changed = false;
    for (const row of table.rows) {
      const target = extractLinkTarget(row[0] ?? "");
      if (!target) continue;
      const statusIndex = row.length - 1;
      const current = row[statusIndex];
      if (current !== STATUS_BUILT && current !== STATUS_PLANNED) continue;
      const expected = resolveIndexStatus(target, root);
      if (expected === current) continue;
      row[statusIndex] = expected;
      fixed.push(`${target}：${current} → ${expected}`);
      changed = true;
    }

    output.push(...(changed ? formatMarkdownTable(table) : block));
    cursor = end;
  }

  if (fixed.length > 0) {
    writeFileSync(absolutePath, output.join("\n"), "utf8");
  }
  return fixed;
}

/** 目录条目（以 `/` 结尾）看目录是否非空，文件条目看文件是否存在。 */
function resolveIndexStatus(target: string, root: string): string {
  const isDirectory = target.endsWith("/");
  const relative = target.replace(/^\.\//, "").replace(/\/+$/, "");
  const absolutePath = resolvePagePath(relative === "" ? "." : relative, root);

  if (!isDirectory) {
    return existsSync(absolutePath) ? STATUS_BUILT : STATUS_PLANNED;
  }
  try {
    return readdirSync(absolutePath).length > 0 ? STATUS_BUILT : STATUS_PLANNED;
  } catch {
    return STATUS_PLANNED;
  }
}

function readIndexLinkTargets(root: string): Set<string> {
  const absolutePath = resolvePagePath(INDEX_FILE, root);
  if (!existsSync(absolutePath)) return new Set();

  const targets = new Set<string>();
  for (const line of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
    if (!isTableRow(line)) continue;
    const target = extractLinkTarget(splitTableRow(line)[0] ?? "");
    if (!target || target.endsWith("/")) continue;
    targets.add(target.replace(/^\.\//, ""));
  }
  return targets;
}

function extractLinkTarget(cell: string): string | null {
  const match = /\[[^\]]*\]\(([^)]+)\)/.exec(cell);
  return match ? match[1].trim() : null;
}
