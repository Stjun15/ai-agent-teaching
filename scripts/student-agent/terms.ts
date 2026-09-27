/**
 * 术语提取器 —— 课程体检器（gap-audit）与学生 Agent 接地校验（run）
 * 共用的**单份口径**。
 *
 * 为什么抽出来
 * ----------------
 * 接地校验的逻辑是「学生提交物里出现的标识符/术语，必须也能在课程
 * 材料里找到」——如果体检器和模拟器各写一份提取，两份口径漂移后
 * 「体检说没断层、模拟说有断层」这种自相矛盾会出现且很难查。
 *
 * 提取口径
 * -------
 * - 反引号与粗体包裹的术语（作者主动标注的概念）；
 * - 英文标识符（≥3 字符，允许点号链）；
 * - 停用词表排除语言关键字与通用词（降低噪声）。
 * 中文术语无分词，靠反引号/粗体的显式标注兜底。
 *
 * 本文件是叶子：不 import 任何模块。
 */

/** 停用词：语言关键字、内置对象、通用英文词 —— 不作为断层证据。 */
export const STOPWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "import",
  "from",
  "export",
  "await",
  "async",
  "try",
  "catch",
  "throw",
  "new",
  "class",
  "this",
  "typeof",
  "instanceof",
  "true",
  "false",
  "null",
  "undefined",
  "console",
  "log",
  "json",
  "math",
  "object",
  "string",
  "number",
  "boolean",
  "promise",
  "asyncfunction",
  "print",
  "def",
  "int",
  "str",
  "list",
  "dict",
  "len",
  "range",
  "none",
  "and",
  "or",
  "not",
  "in",
  "is",
  "the",
  "that",
  "you",
  "your",
  "get",
  "post",
  "http",
  "https",
  "url",
  "com",
  "www",
  "org",
  "api",
  "llm",
  "ai",
  "gpt",
  "key",
  "id",
  "ok",
  "utf",
  "status",
  "code",
  "data",
  "text",
  "name",
  "type",
  "value",
  "index",
  "length",
  "result",
  "content",
  "title",
  "item",
]);

/** 从 markdown 文本提取「使用」的术语/标识符（小写化）。 */
export function extractTerms(text: string): Set<string> {
  const terms = new Set<string>();
  // 反引号与粗体术语
  for (const m of text.matchAll(/`([^`]+)`/g))
    terms.add(m[1].trim().toLowerCase());
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g))
    terms.add(m[1].trim().toLowerCase());
  // 英文标识符（≥3 字符，允许点号链）
  for (const m of text.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_.]{2,}\b/g)) {
    const token = m[0].toLowerCase().replace(/[.]+$/, "");
    if (!STOPWORDS.has(token) && !/^\d/.test(token)) terms.add(token);
  }
  // 中文/复合术语本身（反引号内可能带空格），逐词拆分太噪，保留整体
  return terms;
}
