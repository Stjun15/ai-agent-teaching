/**
 * SCHEMA.md 解析
 *
 * 「页面类型」与「必填字段」不写死在代码里，而是每次从 `llm-wiki/SCHEMA.md`
 * 现读 —— 这是 `ingest(source, target, schema)` 里那个 `schema` 参数存在的意义：
 * 校验依据必须可替换、可演进，改 SCHEMA.md 就立刻生效。
 *
 * SCHEMA.md 里能稳定解析的只有两块：
 * - `## 页面类型` 的 markdown 表格（类型 / 目录 / 用途）
 * - `## Frontmatter 必填字段` 下各 `###` 小节里的 ```yaml 字段清单
 *
 * SCHEMA.md **没有**声明「哪一组额外字段约束哪些页面类型」—— 这个对应关系
 * 由本文件的 EXTRA_FIELD_GROUP_TARGETS 补上（**推断**）。新增了未登记的组会
 * 直接抛错提示同步，而不是静默忽略。
 */

import { readFileSync } from "node:fs";
import { WikiSchemaViolationError } from "./errors";
import type { WikiFrontmatter } from "./types";

export interface WikiPageTypeSpec {
  /** SCHEMA.md 里声明的类型名，如 `concept` */
  type: string;
  /** 声明的目录，形如 `concepts/` 或 `students/{id}/profile.md` */
  dir: string;
  /** 声明的用途说明 */
  purpose: string;
}

export interface WikiSchema {
  /** 来源文件路径，只用于错误信息 */
  source: string;
  pageTypes: WikiPageTypeSpec[];
  /** 「### 所有页面」声明的必填字段 —— 对所有页面生效 */
  commonRequiredFields: string[];
  /** 额外字段组：组名（SCHEMA.md 的 `###` 标题）→ 字段名清单 */
  extraFieldGroups: Record<string, string[]>;
}

const PAGE_TYPE_SECTION = /^##\s*页面类型\s*$/;
const REQUIRED_FIELD_SECTION = /^##\s*Frontmatter\s*必填字段\s*$/;
const COMMON_GROUP_KEYWORD = "所有页面";

/**
 * 额外字段组 → 适用的页面类型。
 * 键必须与 SCHEMA.md 的 `###` 标题逐字一致，否则加载时报错。
 */
const EXTRA_FIELD_GROUP_TARGETS: Record<string, (type: string) => boolean> = {
  概念页面额外: (type) => type === "concept",
  学生页面额外: (type) => type.startsWith("student-"),
};

/** 解析 SCHEMA.md 全文。`source` 只用于错误信息。 */
export function parseWikiSchema(markdown: string, source: string): WikiSchema {
  const lines = markdown.split(/\r?\n/);

  const pageTypes = parsePageTypeTable(lines, source);
  if (pageTypes.length === 0) {
    throw new WikiSchemaViolationError(
      `${source}: 没有解析出任何页面类型，请检查「## 页面类型」下的表格`,
    );
  }

  const { commonRequiredFields, extraFieldGroups } = parseRequiredFields(
    lines,
    source,
  );

  for (const group of Object.keys(extraFieldGroups)) {
    if (!Object.hasOwn(EXTRA_FIELD_GROUP_TARGETS, group)) {
      throw new WikiSchemaViolationError(
        `${source}: 出现未登记生效范围的必填字段组「${group}」，请同步 schema.ts 的 EXTRA_FIELD_GROUP_TARGETS`,
      );
    }
  }

  return { source, pageTypes, commonRequiredFields, extraFieldGroups };
}

/** 从磁盘读取并解析 SCHEMA.md。 */
export function loadWikiSchema(
  absolutePath: string,
  source = absolutePath,
): WikiSchema {
  return parseWikiSchema(readFileSync(absolutePath, "utf8"), source);
}

function parsePageTypeTable(
  lines: string[],
  source: string,
): WikiPageTypeSpec[] {
  const start = lines.findIndex((line) => PAGE_TYPE_SECTION.test(line));
  if (start === -1) {
    throw new WikiSchemaViolationError(`${source}: 找不到「## 页面类型」小节`);
  }

  const specs: WikiPageTypeSpec[] = [];
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
    specs.push({ type: cells[0], dir: cells[1], purpose: cells[2] });
  }

  return specs;
}

function parseRequiredFields(
  lines: string[],
  source: string,
): {
  commonRequiredFields: string[];
  extraFieldGroups: Record<string, string[]>;
} {
  const start = lines.findIndex((line) => REQUIRED_FIELD_SECTION.test(line));
  if (start === -1) {
    throw new WikiSchemaViolationError(
      `${source}: 找不到「## Frontmatter 必填字段」小节`,
    );
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const blocks: Array<{ heading: string; fields: string[] }> = [];
  let heading: string | null = null;
  let insideYaml = false;
  let fields: string[] = [];

  for (const line of lines.slice(start + 1, end)) {
    const sub = /^###\s+(.+?)\s*$/.exec(line);
    if (sub && !insideYaml) {
      heading = sub[1];
      fields = [];
      continue;
    }
    if (line.trim().startsWith("```")) {
      if (insideYaml) {
        if (heading) blocks.push({ heading, fields });
      } else {
        fields = [];
      }
      insideYaml = !insideYaml;
      continue;
    }
    if (insideYaml) {
      const field = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
      if (field) fields.push(field[1]);
    }
  }

  const common = blocks.find((block) =>
    block.heading.includes(COMMON_GROUP_KEYWORD),
  );
  if (!common || common.fields.length === 0) {
    throw new WikiSchemaViolationError(
      `${source}: 没有解析出「所有页面」的必填字段，请检查「## Frontmatter 必填字段」下的小节`,
    );
  }

  const extraFieldGroups: Record<string, string[]> = {};
  for (const block of blocks) {
    if (block.heading.includes(COMMON_GROUP_KEYWORD)) continue;
    extraFieldGroups[block.heading] = block.fields;
  }

  return { commonRequiredFields: common.fields, extraFieldGroups };
}

/** 某个页面类型适用的全部必填字段（通用 + 该类额外）。 */
export function requiredFieldsFor(schema: WikiSchema, type: string): string[] {
  const fields = [...schema.commonRequiredFields];
  for (const [group, groupFields] of Object.entries(schema.extraFieldGroups)) {
    const applies = EXTRA_FIELD_GROUP_TARGETS[group];
    if (applies?.(type)) fields.push(...groupFields);
  }
  return fields;
}

/** 按 SCHEMA.md 判断 frontmatter 缺了哪些必填字段。 */
export function missingRequiredFields(
  schema: WikiSchema,
  frontmatter: WikiFrontmatter,
  type: string,
): string[] {
  return requiredFieldsFor(schema, type).filter(
    (field) => !Object.hasOwn(frontmatter, field),
  );
}

/**
 * 按 SCHEMA.md 的目录映射，从页面路径推断页面类型。
 *
 * 目录型声明（以 `/` 结尾）按前缀匹配，文件型声明（如
 * `students/{id}/profile.md`）按精确匹配，其中 `{...}` 视作「任意一段」。
 */
export function inferPageType(
  schema: WikiSchema,
  pagePath: string,
): string | null {
  const normalized = pagePath.replace(/\\/g, "/");
  for (const spec of schema.pageTypes) {
    if (dirPatternToRegExp(spec.dir).test(normalized)) return spec.type;
  }
  return null;
}

function dirPatternToRegExp(dir: string): RegExp {
  const pattern = dir
    .split("/")
    .map((segment) =>
      /^\{[^}]+\}$/.test(segment) ? "[^/]+" : escapeRegExp(segment),
    )
    .join("/");
  const suffix = dir.endsWith("/") ? ".*" : "";
  return new RegExp(`^${pattern}${suffix}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
