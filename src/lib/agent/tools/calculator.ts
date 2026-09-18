/**
 * 计算器工具（calculate）
 *
 * 设计依据
 * --------
 * - `00-MASTER.md`：预设 5 个工具，第一个是计算器。
 * - `01-teaching-system.md`：预设工具第 1 项「计算器（calculator）」。
 * - `references/module-specs.md` 模块 4（tool-calling）给出教学用定义：
 *   `name: "calculate"`，参数 `expression: string`，描述「计算数学表达式，支持加减乘除」。
 *
 * 工具名为什么是 `calculate` 而不是 `calculator`
 * ---------------------------------------------
 * `references/rubrics.md` 与 `references/wiki-schema.md` 都规定工具命名必须是
 * 「动词+名词，如 getWeather」，并把 `weather` 这类名词式命名列为扣分项。
 * `calculator` 是名词，`calculate` 才是动词，且与 module-specs.md 的教学示例一致
 * （那个示例本身就是给学生抄的模板）。显示名用中文「计算器」。
 *
 * 为什么自己写解析器而不用 eval
 * ----------------------------
 * 教学模板里写的是 `execute: async ({ expression }) => eval(expression)`。
 * 作为**示例**它展示了「工具就三要素」这一点，但 `expression` 是模型生成的字符串，
 * 直接 eval 等于把任意代码执行权交给模型输出。本文件是产品代码而非教具，
 * 因此实现一个只认数字与运算符的递归下降解析器：输入域封闭，不含任何标识符、
 * 函数调用或属性访问。这也顺便让「错误处理」可判定 —— eval 只会抛原生 SyntaxError。
 *
 * 支持的语法（刻意保持封闭）
 * -------------------------
 *   expression := term (("+" | "-") term)*
 *   term       := power (("*" | "/" | "%") power)*
 *   power      := unary ("^" power)?          // 右结合，2^3^2 = 2^9
 *   unary      := ("+" | "-") unary | primary
 *   primary    := number | "(" expression ")"
 *   number     := 十进制 / 小数 / 科学计数法（1.5e3）
 *
 * 其中 `%` 与 JavaScript 的 `%` 同义（取余），`^` 为乘方。
 * 不支持函数调用、常量、变量 —— 出现即报错，且错误信息会指出具体位置，
 * 便于模型自我纠正后重试。
 */

import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

/** 表达式长度上限。防止模型把整段代码当表达式塞进来。 */
const MAX_EXPRESSION_LENGTH = 500;

/** 乘方结果上限，超过即视为溢出。避免 `9^9^9` 这类输入吃满 CPU 或产出 Infinity。 */
const MAX_ABSOLUTE_VALUE = 1e308;

/** 计算成功后返回给上层的结构化信息，便于前端可视化与 Trace 记录。 */
export interface CalculatorDetails {
  /** 去掉多余空白后的表达式 */
  expression: string;
  /** 计算结果 */
  result: number;
}

/** 解析或求值失败时抛出，错误信息面向模型可读。 */
export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculatorError";
  }
}

type Token =
  | { kind: "number"; value: number; position: number }
  | {
      kind: "operator";
      value: "+" | "-" | "*" | "/" | "%" | "^";
      position: number;
    }
  | { kind: "lparen"; position: number }
  | { kind: "rparen"; position: number };

/**
 * 词法分析。只认数字、五种运算符与圆括号，其它字符一律报错并给出行列位置。
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;

    // 空白只作分隔
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "lparen", position: index });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ kind: "rparen", position: index });
      index += 1;
      continue;
    }

    if (
      char === "+" ||
      char === "-" ||
      char === "*" ||
      char === "/" ||
      char === "%" ||
      char === "^"
    ) {
      tokens.push({ kind: "operator", value: char, position: index });
      index += 1;
      continue;
    }

    // 数字：整数部分可有可无（.5 合法），科学计数法指数部分可选
    if (/[0-9.]/.test(char)) {
      const rest = input.slice(index);
      const match = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
      if (!match) {
        throw new CalculatorError(
          `位置 ${index + 1} 处的数字写法无法识别：${JSON.stringify(rest.slice(0, 10))}`,
        );
      }
      const literal = match[0];
      const value = Number(literal);
      if (!Number.isFinite(value)) {
        throw new CalculatorError(
          `位置 ${index + 1} 处的数字超出可表示范围：${literal}`,
        );
      }
      tokens.push({ kind: "number", value, position: index });
      index += literal.length;
      continue;
    }

    throw new CalculatorError(
      `位置 ${index + 1} 处出现不支持的字符 ${JSON.stringify(char)}。` +
        `本工具只支持数字、+ - * / % ^ 与圆括号，不支持函数、变量与常量。`,
    );
  }

  return tokens;
}

/**
 * 递归下降求值。
 *
 * 之所以不用「先转逆波兰再求值」的两段式，是因为表达式长度有上限，
 * 单遍递归足够快，且出错位置可以直接对应到 token，错误信息更好读。
 */
function evaluateTokens(tokens: Token[], source: string): number {
  let cursor = 0;

  function peek(): Token | undefined {
    return tokens[cursor];
  }

  function ensureFinite(value: number, position: number): number {
    if (!Number.isFinite(value)) {
      throw new CalculatorError(
        `位置 ${position + 1} 处的运算结果溢出或无效。`,
      );
    }
    if (Math.abs(value) > MAX_ABSOLUTE_VALUE) {
      throw new CalculatorError(
        `位置 ${position + 1} 处的运算结果过大，超出本工具的处理范围。`,
      );
    }
    return value;
  }

  function parseExpression(): number {
    let left = parseTerm();
    for (;;) {
      const token = peek();
      if (
        token?.kind === "operator" &&
        (token.value === "+" || token.value === "-")
      ) {
        cursor += 1;
        const right = parseTerm();
        left =
          token.value === "+"
            ? ensureFinite(left + right, token.position)
            : ensureFinite(left - right, token.position);
        continue;
      }
      return left;
    }
  }

  function parseTerm(): number {
    let left = parsePower();
    for (;;) {
      const token = peek();
      if (
        token?.kind === "operator" &&
        (token.value === "*" || token.value === "/" || token.value === "%")
      ) {
        cursor += 1;
        const right = parsePower();
        if (token.value === "*") {
          left = ensureFinite(left * right, token.position);
        } else if (token.value === "/") {
          if (right === 0) {
            throw new CalculatorError(
              `位置 ${token.position + 1} 处除以零，结果无定义。`,
            );
          }
          left = ensureFinite(left / right, token.position);
        } else {
          if (right === 0) {
            throw new CalculatorError(
              `位置 ${token.position + 1} 处对零取余，结果无定义。`,
            );
          }
          left = ensureFinite(left % right, token.position);
        }
        continue;
      }
      return left;
    }
  }

  function parsePower(): number {
    const base = parseUnary();
    const token = peek();
    if (token?.kind === "operator" && token.value === "^") {
      cursor += 1;
      // 右结合：递归到 parsePower 而不是 parseUnary
      const exponent = parsePower();
      return ensureFinite(Math.pow(base, exponent), token.position);
    }
    return base;
  }

  function parseUnary(): number {
    const token = peek();
    if (
      token?.kind === "operator" &&
      (token.value === "+" || token.value === "-")
    ) {
      cursor += 1;
      const operand = parseUnary();
      return token.value === "-" ? -operand : operand;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = peek();
    if (!token) {
      throw new CalculatorError(
        "表达式在此处意外结束，可能缺少操作数或右括号。",
      );
    }
    if (token.kind === "number") {
      cursor += 1;
      return token.value;
    }
    if (token.kind === "lparen") {
      cursor += 1;
      const inner = parseExpression();
      const closing = peek();
      if (closing?.kind !== "rparen") {
        throw new CalculatorError(
          `位置 ${token.position + 1} 处的左括号没有对应的右括号。`,
        );
      }
      cursor += 1;
      return inner;
    }
    if (token.kind === "rparen") {
      // 走到这里说明运算符后面直接跟了右括号，如 `1+)`，缺的是操作数而非左括号。
      // 报成「右括号没有对应的左括号」会把模型引去数括号，所以分开措辞。
      throw new CalculatorError(
        `位置 ${token.position + 1} 处的右括号前面缺少操作数。`,
      );
    }
    throw new CalculatorError(`位置 ${token.position + 1} 处缺少操作数。`);
  }

  const result = parseExpression();
  const trailing = peek();
  if (trailing) {
    // 表达式已完整解析却仍有剩余 token。若剩余的是右括号，说明左右括号数量不等，
    // 报「多余内容」不如直接点明括号不配对 —— 这是模型最常见的输入错误之一。
    if (trailing.kind === "rparen") {
      throw new CalculatorError(
        `位置 ${trailing.position + 1} 处的右括号没有对应的左括号。`,
      );
    }
    throw new CalculatorError(
      `位置 ${trailing.position + 1} 处存在多余内容：${JSON.stringify(source.slice(trailing.position))}`,
    );
  }
  return result;
}

/**
 * 求值入口（纯函数，不依赖 SDK，便于单独测试）。
 *
 * @throws {CalculatorError} 表达式为空、含非法字符、括号不配对、除以零或结果溢出
 */
export function evaluateExpression(expression: string): number {
  const normalized = expression.trim();

  if (normalized.length === 0) {
    throw new CalculatorError("表达式为空，请提供如 (1+2)*3 的数学表达式。");
  }
  if (normalized.length > MAX_EXPRESSION_LENGTH) {
    throw new CalculatorError(
      `表达式长度 ${normalized.length} 超过上限 ${MAX_EXPRESSION_LENGTH}，请拆成多步计算。`,
    );
  }

  const tokens = tokenize(normalized);
  if (tokens.length === 0) {
    throw new CalculatorError("表达式中没有可计算的内容。");
  }

  return evaluateTokens(tokens, normalized);
}

/**
 * 计算器工具定义。
 *
 * 直接传给 `createAgentSession({ customTools: [calculatorTool] })`。
 * 描述里写清支持范围与示例 —— 工具描述是模型判断「该不该调用、怎么填参数」的唯一依据。
 */
export const calculatorTool = defineTool({
  name: "calculate",
  label: "计算器",
  description:
    "计算一个数学表达式的数值结果。支持 + - * /（四则运算）、% 取余、" +
    "^ 乘方、圆括号与正负号，例如 (1+2)*3、2^10、17%5。只接受数字与运算符，" +
    "不支持函数、变量与常量。涉及多步算术时，请把完整表达式一次传入，" +
    "不要自己心算。",
  parameters: Type.Object({
    expression: Type.String({
      description: "要计算的数学表达式，例如 (1+2)*3。用英文半角运算符。",
    }),
  }),
  execute: async (
    _toolCallId,
    params,
  ): Promise<{
    content: { type: "text"; text: string }[];
    details: CalculatorDetails;
  }> => {
    // 表达式非法时抛错而不返回：SDK 会把抛出的错误标记为 isError 并回传给模型，
    // 模型因此有机会改正后重试；返回普通文本则不带错误标记，模型可能误以为算对了。
    const result = evaluateExpression(params.expression);
    const expression = params.expression.trim();

    return {
      content: [{ type: "text", text: `${expression} = ${result}` }],
      details: { expression, result },
    };
  },
});
