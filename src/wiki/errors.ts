/**
 * LLM Wiki 错误
 *
 * 全部继承 WikiError，调用方可以一次 catch。刻意区分「页面不存在」与
 * 「不符合 SCHEMA」：前者是调用方传错了路径，后者是内容质量问题，
 * 二者的处置方式不同（前者该改调用代码，后者该改内容）。
 */

export class WikiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikiError";
  }
}

/** 页面路径指向的文件不存在。 */
export class WikiPageNotFoundError extends WikiError {
  constructor(message: string) {
    super(message);
    this.name = "WikiPageNotFoundError";
  }
}

/** frontmatter 缺失、写法不受支持或无法解析。 */
export class WikiFrontmatterError extends WikiError {
  constructor(message: string) {
    super(message);
    this.name = "WikiFrontmatterError";
  }
}

/** 内容不符合 SCHEMA.md 的必填字段要求。 */
export class WikiSchemaViolationError extends WikiError {
  constructor(message: string) {
    super(message);
    this.name = "WikiSchemaViolationError";
  }
}
