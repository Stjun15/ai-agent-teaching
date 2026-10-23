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
  // 编程语言关键字：出现在示范代码里但永远不该算「未定义概念」
  // （2026-09-30 体检器 INFO 采样实测）。
  "await",
  "class",
  "import",
  "type",
  "const",
  "function",
]);

/** 从 markdown 文本提取「使用」的术语/标识符（小写化）。 */
export function extractTerms(text: string): Set<string> {
  const terms = new Set<string>();
  // 反引号配对前先剥掉代码围栏的定界符（```），保留围栏内容：围栏里嵌着
  // 模板字符串反引号（`Bearer ${apiKey}`），围栏自身的三连反引号会让顺序
  // 配对整体错位，把材料里本该命中的词误判成未接地（2026-09-30
  // platform-replica 模拟实测误报：材料与学生提交物完全接地仍报 ✗）。
  // 学生提交物是裸代码无围栏，剥定界符后两侧口径一致。
  const prose = text.replace(/```[a-zA-Z]*\n?/g, "\n");
  for (const m of prose.matchAll(/`([^`\n]+)`/g)) {
    const term = m[1].trim().toLowerCase();
    // 模板表达式（${...}）是代码结构不是人类概念，其中的标识符由下方
    // 英文标识符规则单独覆盖；留会把体检器 INFO 采样灌满代码噪音。
    if (!term.includes("${")) terms.add(term);
  }
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g))
    terms.add(m[1].trim().toLowerCase());
  // 英文标识符（≥3 字符，允许点号链）
  for (const m of text.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_.]{2,}\b/g)) {
    const token = m[0].toLowerCase().replace(/[.]+$/, "");
    terms.add(token);
  }
  // 中文/复合术语本身（反引号内可能带空格），逐词拆分太噪，保留整体。
  // 停用词在出口统一过滤：反引号/粗体环路提取的词同样可能是代码关键字
  // 或模板表达式，逐环路过滤会漏。
  for (const term of terms) {
    if (STOPWORDS.has(term) || term.includes("${") || /^\d/.test(term))
      terms.delete(term);
  }
  return terms;
}
