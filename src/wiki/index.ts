/**
 * LLM Wiki 出口
 *
 * 上层（API 路由、Agent 工具、脚本）统一从这里取用，不要直接 import 里面的
 * 子模块 —— 与 `src/lib/db/index.ts` 同一套分层约定。理由也一样：路径拼接、
 * SCHEMA 解析、markdown 表格格式化都是**实现细节**，挡在出口后面，
 * 将来换存储（CloudBase / 对象存储）或换检索方式（向量库）时改动才可控。
 *
 * `wiki-schema.md`「六、LLM Wiki 操作接口」要求的 5 个函数在这里齐全：
 * `ingest` / `query` / `maintain` / `getPage` / `updatePage`。
 *
 * 本模块**只依赖 node: 内置模块**，不 import 任何 AI SDK —— 这样它既能被
 * 服务端路由与脚本直接使用，也不会把 SDK 拖进调用方的产物依赖图
 * （同类问题见 `ark-config.ts` 与健康检查路由的拆分）。
 */

export type * from "./types";
export type { WikiPageTypeSpec, WikiSchema } from "./schema";
export type { MarkdownTable, TableAlignment } from "./markdown-table";
export type { WikiQueryOptions } from "./query";
export type { WikiLogEntry } from "./log";

export {
  WikiError,
  WikiFrontmatterError,
  WikiPageNotFoundError,
  WikiSchemaViolationError,
} from "./errors";

export { DATE_PLACEHOLDER, today } from "./clock";

export {
  FENCE,
  composePage,
  orderFrontmatter,
  parseMarkdown,
  serializeFrontmatter,
} from "./frontmatter";

export {
  displayWidth,
  formatMarkdownTable,
  isTableRow,
  parseMarkdownTable,
  splitTableRow,
} from "./markdown-table";

export {
  inferPageType,
  loadWikiSchema,
  missingRequiredFields,
  parseWikiSchema,
  requiredFieldsFor,
} from "./schema";

export {
  INDEX_FILE,
  LOG_FILE,
  META_FILES,
  SCHEMA_FILE,
  WIKI_DIR_NAME,
  isMetaFile,
  listPagePaths,
  resolvePagePath,
  resolveWikiRoot,
  toWikiPath,
} from "./paths";

export {
  RELATION_FIELDS,
  buildRefIndex,
  collectRelationRefs,
  extractWikiLinks,
  getPage,
  listPages,
  loadDefaultSchema,
  pageAliases,
  pageRef,
  readPageSync,
  resolveRef,
  updatePage,
  writePageFile,
} from "./page";

export { appendWikiLog } from "./log";

export { DEFAULT_TOP_K, query, tokenize } from "./query";

export { ingest } from "./ingest";

export { maintain, syncIndexStatuses } from "./maintain";
