#!/usr/bin/env node
/**
 * wiki 骨架初始化 / 自检
 *
 * 用法：pnpm wiki:seed
 *
 * 与 db-migrate.mjs 同样刻意写成**不依赖任何项目模块**的纯 Node 脚本：
 * 骨架初始化是「建目录」这种最底层操作，不应该被 TS 编译或依赖安装的状态牵连。
 * 代价是 SCHEMA.md 的「页面类型 → 目录」解析规则与 src/wiki/schema.ts 重复了
 * 一份，两处必须保持一致（改动时请同步）。
 *
 * 做三件事：
 * 1. 校验 llm-wiki/ 三个骨架文件是否在位（SCHEMA.md / index.md / log.md）；
 * 2. 按 SCHEMA.md 的页面类型表补齐缺失的目录（空目录放 .gitkeep 让 Git 收得住）；
 * 3. 打印各目录的页面数。
 *
 * 幂等：重复执行不改变任何已就位的东西。
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const WIKI_ROOT = path.resolve(process.cwd(), "llm-wiki");
const SCHEMA_PATH = path.join(WIKI_ROOT, "SCHEMA.md");
const SKELETON_FILES = ["SCHEMA.md", "index.md", "log.md"];
const GITKEEP = ".gitkeep";

/** 与 src/wiki/schema.ts#parsePageTypeTable 保持一致。 */
function parsePageTypeTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s*页面类型\s*$/.test(line));
  if (start === -1) {
    throw new Error("SCHEMA.md 里找不到「## 页面类型」小节");
  }

  const specs = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trimStart().startsWith("|")) {
      if (specs.length > 0) break;
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim().replace(/`/g, ""));
    if (cells.length < 3) continue;
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (cells[0] === "类型") continue;
    specs.push({ type: cells[0], dir: cells[1] });
  }

  if (specs.length === 0) {
    throw new Error("SCHEMA.md 的「## 页面类型」表格没有解析出任何一行");
  }
  return specs;
}

/** `concepts/` → `concepts`；`students/{id}/profile.md` → `students`。 */
function topLevelDir(declared) {
  const firstSegment = declared.replace(/\/+$/, "").split("/")[0];
  return firstSegment.replace(/\{.*$/, "");
}

function countMarkdownFiles(directory) {
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory())
      count += countMarkdownFiles(path.join(directory, entry.name));
    else if (entry.name.endsWith(".md")) count += 1;
  }
  return count;
}

function main() {
  console.log(`wiki 根目录：${WIKI_ROOT}`);

  if (!existsSync(WIKI_ROOT)) {
    console.error(`缺少 wiki 根目录，请先在仓库根目录创建 ${WIKI_ROOT}`);
    process.exitCode = 1;
    return;
  }

  const missingSkeleton = SKELETON_FILES.filter(
    (name) => !existsSync(path.join(WIKI_ROOT, name)),
  );
  if (missingSkeleton.length > 0) {
    console.error(`缺少骨架文件：${missingSkeleton.join("、")}`);
    console.error("这些文件带内容，不能由本脚本生成，请从版本库恢复。");
    process.exitCode = 1;
    return;
  }
  console.log(`骨架文件齐备：${SKELETON_FILES.join("、")}`);

  const specs = parsePageTypeTable(readFileSync(SCHEMA_PATH, "utf8"));
  const declaredDirs = [...new Set(specs.map((spec) => topLevelDir(spec.dir)))];

  console.log(
    `\nSCHEMA.md 声明 ${specs.length} 种页面类型，落在 ${declaredDirs.length} 个目录：`,
  );

  const created = [];
  for (const dir of declaredDirs) {
    const absolute = path.join(WIKI_ROOT, dir);
    if (existsSync(absolute)) continue;
    mkdirSync(absolute, { recursive: true });
    writeFileSync(
      path.join(absolute, GITKEEP),
      `# 由 pnpm wiki:seed 创建：SCHEMA.md 声明了 ${dir}/ 但目录不存在。\n`,
      "utf8",
    );
    created.push(dir);
  }

  for (const dir of declaredDirs) {
    const absolute = path.join(WIKI_ROOT, dir);
    const pages = countMarkdownFiles(absolute);
    const types = specs
      .filter((spec) => topLevelDir(spec.dir) === dir)
      .map((spec) => spec.type)
      .join("、");
    console.log(
      `  ${dir.padEnd(16)} 页面 ${String(pages).padStart(3)} 个    ${types}`,
    );
  }

  console.log("");
  if (created.length === 0) {
    console.log("所有声明目录均已存在，无需创建。");
  } else {
    console.log(`已创建缺失目录：${created.join("、")}`);
  }

  // 漂移检测：index.md 里链到了、但 SCHEMA.md 的页面类型表没有声明的目录。
  // 只在报告里点名，不自动创建 —— 目录该不该存在由 SCHEMA.md 说了算，
  // 脚本替它做决定只会把文档的不一致固化下来。
  const undeclared = findUndeclaredDirs(declaredDirs);
  if (undeclared.length > 0) {
    console.log("");
    console.log(
      `注意：index.md 引用了 ${undeclared.join("、")}，但 SCHEMA.md 的页面类型表里没有对应类型。`,
    );
    console.log("这是文档间的不一致：要么补 SCHEMA.md，要么改 index.md。");
  }

  const total = countMarkdownFiles(WIKI_ROOT);
  console.log(`llm-wiki/ 下共 ${total} 个 markdown 文件（含骨架文件）。`);
}

function findUndeclaredDirs(declaredDirs) {
  const indexPath = path.join(WIKI_ROOT, "index.md");
  if (!existsSync(indexPath)) return [];

  const referenced = new Set();
  const pattern = /\]\(\.\/([^)/]+)\/[^)]*\)/g;
  for (const match of readFileSync(indexPath, "utf8").matchAll(pattern)) {
    referenced.add(match[1]);
  }

  return [...referenced].filter((dir) => !declaredDirs.includes(dir)).sort();
}

main();
