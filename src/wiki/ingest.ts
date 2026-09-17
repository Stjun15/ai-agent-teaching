/**
 * `ingest`：把资料编译成 Wiki 页面
 *
 * 对应 wiki-schema.md「六、LLM Wiki 操作接口」里的 `ingest`。
 *
 * **职责边界（推断）**：签名是 `(source, target, schema)` —— 一个源文件、一个
 * 目标路径、一份 SCHEMA。这说明它拿到的是**已经成文的页面内容**，只负责
 * 「规范化 + 落位 + 登记」，不负责把散乱素材写成散文。语义层的改写是 Agent 的
 * 工作（用 `@zosmaai` 那个包也没有这条路：它只能作为 pi 扩展/MCP 接入，
 * 没有可 import 的入口，见 Phase 2 提交点 15 的取证结论）。
 *
 * 因此本函数做四件事：
 * 1. 按传入的 `schema` 校验源文件的 frontmatter；
 * 2. 校验「目标路径所属类型」与「源文件声明的 type」一致 —— 防止把评分标准
 *    写进 `concepts/`；
 * 3. 补齐 `last_updated` 后规范化落盘（经 `updatePage`）；
 * 4. 同步 `index.md` 状态列并追加 `log.md`。
 *
 * **不做**的事：不在 `index.md` 里自动新增条目。索引是人工规划的建设进度表，
 * 新增一行要填「名称」「难度/严重程度」这些需要人判断的列；未登记的页面由
 * `maintain` 报为 `unindexed-page`，由人或 Agent 决定怎么登记。
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DATE_PLACEHOLDER, today } from "./clock";
import { WikiPageNotFoundError, WikiSchemaViolationError } from "./errors";
import { composePage, orderFrontmatter, parseMarkdown } from "./frontmatter";
import { appendWikiLog } from "./log";
import { syncIndexStatuses } from "./maintain";
import { resolvePagePath, resolveWikiRoot } from "./paths";
import { updatePage } from "./page";
import { inferPageType, loadWikiSchema, missingRequiredFields } from "./schema";

export async function ingest(
  source: string,
  target: string,
  schema: string,
): Promise<void> {
  const root = resolveWikiRoot();
  const schemaPath = resolveSchemaArgument(schema, root);
  const wikiSchema = loadWikiSchema(schemaPath, schema);

  const sourcePath = resolveSourceArgument(source);
  if (!existsSync(sourcePath)) {
    throw new WikiPageNotFoundError(`源资料不存在：${source}`);
  }

  const targetPath = normalizeTargetPath(target);
  const parsed = parseMarkdown(readFileSync(sourcePath, "utf8"), source);
  const declared =
    typeof parsed.frontmatter.type === "string" ? parsed.frontmatter.type : "";
  const inferred = inferPageType(wikiSchema, targetPath);

  if (inferred && declared && inferred !== declared) {
    throw new WikiSchemaViolationError(
      `目标路径 ${targetPath} 在 ${schema} 中属于类型 "${inferred}"，但源文件声明 type: ${declared}`,
    );
  }

  const type = declared || inferred || "";
  if (type === "") {
    throw new WikiSchemaViolationError(
      `无法确定 ${targetPath} 的页面类型：源文件没有 type，且路径不在 ${schema} 的目录映射内`,
    );
  }

  const frontmatter = orderFrontmatter({ ...parsed.frontmatter, type });
  if (
    !Object.hasOwn(frontmatter, "last_updated") ||
    frontmatter.last_updated === DATE_PLACEHOLDER
  ) {
    frontmatter.last_updated = today();
  }

  const missing = missingRequiredFields(wikiSchema, frontmatter, type);
  if (missing.length > 0) {
    throw new WikiSchemaViolationError(
      `${targetPath}: 源文件的 frontmatter 缺少 ${type} 页面的必填字段：${missing.join("、")}（依据 ${schema}）`,
    );
  }

  const existed = existsSync(resolvePagePath(targetPath, root));
  await updatePage(targetPath, composePage(frontmatter, parsed.body));

  const fixed = await syncIndexStatuses(root);
  await appendWikiLog({
    operation: existed ? "update" : "add",
    scope: targetPath,
    summary: `ingest 自 ${source}（类型 ${type}${fixed.length > 0 ? `；同步索引状态 ${fixed.length} 处` : ""}）。`,
  });
}

/**
 * `schema` 参数解析：相对路径先按 wiki 根找（`SCHEMA.md` 就在根下，
 * `ingest(src, target, "SCHEMA.md")` 是预期写法），找不到再按 cwd 找。
 */
function resolveSchemaArgument(value: string, root: string): string {
  const candidates = path.isAbsolute(value)
    ? [value]
    : [path.join(root, value), path.resolve(process.cwd(), value)];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new WikiPageNotFoundError(
      `找不到 schema 文件：${value}（已尝试：${candidates.join("、")}）`,
    );
  }
  return found;
}

/** `source` 参数按 cwd 解析 —— 源资料通常在 wiki 之外的目录。 */
function resolveSourceArgument(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function normalizeTargetPath(target: string): string {
  const normalized = target
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
  if (!normalized.endsWith(".md")) {
    throw new WikiSchemaViolationError(
      `target 必须是相对 wiki 根的 .md 路径，收到：${target}`,
    );
  }
  return normalized;
}
