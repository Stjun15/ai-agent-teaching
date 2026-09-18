/**
 * LLM Wiki 运行时的数据类型
 *
 * 与 src/lib/db/types.ts 同层：只描述数据形状，不做 I/O、不解析、不校验，
 * 供 schema / page / query / ingest / maintain 共用。
 *
 * 关于「文档未定义的形状」：references/wiki-schema.md「六、LLM Wiki 操作接口」
 * 只给出了 5 个函数的签名，没有给出 WikiPage / WikiQueryResult / MaintainReport
 * 的字段。下面这几个接口是按函数语义补的（**推断**），字段名一律取自
 * wiki-schema.md 与 SCHEMA.md 已有的词汇，没有引入新概念。
 */

/** frontmatter 的值类型。SCHEMA.md 的模板只用到这四种形式。 */
export type WikiFrontmatterValue = string | number | boolean | string[];

/** 解析后的 frontmatter；键序与原文一致。 */
export interface WikiFrontmatter {
  [key: string]: WikiFrontmatterValue;
}

/** 一个 Wiki 页面。 */
export interface WikiPage {
  /** 相对 wiki 根的路径，始终用 `/` 分隔，如 `concepts/llm-api.md` */
  path: string;
  /** 磁盘绝对路径 */
  absolutePath: string;
  /**
   * 页面类型。取 frontmatter 的 `type`；缺失时按 SCHEMA.md 的页面类型表推断，
   * 仍推不出则为空串（由 maintain 记为 unknown-page-type）。
   */
  type: string;
  /** 是否带 frontmatter 块。SCHEMA.md「Frontmatter 必填字段」要求所有页面都有。 */
  hasFrontmatter: boolean;
  frontmatter: WikiFrontmatter;
  /** frontmatter 之后的正文，不含两侧的 `---` */
  body: string;
}

/** 一条检索命中。 */
export interface WikiHit {
  path: string;
  /** frontmatter.id，缺失则为 null */
  id: string | null;
  /** frontmatter.name，缺失则为 null */
  name: string | null;
  type: string;
  score: number;
  /** 正文中得分最高的连续片段 */
  excerpt: string;
  /** 片段起始行号（相对正文首行，1-based；不含 frontmatter） */
  line: number;
}

/** `query()` 的返回值。 */
export interface WikiQueryResult {
  question: string;
  /** `related` 生效时的检索范围（页面路径列表）；未限定时为 null */
  scope: string[] | null;
  /** 实际参与打分的页面数 */
  scanned: number;
  hits: WikiHit[];
}

/** `maintain()` 发现的问题分类。 */
export type WikiIssueKind =
  | "missing-frontmatter"
  | "unknown-page-type"
  | "missing-required-field"
  | "dead-link"
  | "broken-reference"
  | "orphan-page"
  | "unindexed-page";

export interface WikiIssue {
  kind: WikiIssueKind;
  /** 出问题的页面路径；索引级问题为 `index.md` */
  page: string;
  detail: string;
}

/** `maintain()` 的返回值。 */
export interface MaintainReport {
  /** 参与校验的内容页数量（不含 SCHEMA.md / index.md / log.md） */
  checked: number;
  issues: WikiIssue[];
  /** 本次自动修正的动作，人可读 */
  fixed: string[];
}
