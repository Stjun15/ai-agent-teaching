/**
 * 输出过滤 —— 第二道防线
 *
 * 为什么是「第二道」：输入过滤是启发式的，换个说法就可能绕过；模型也可能在
 * 压力下把凭据一类的东西吐出来。这一层不赌输入拦得住。
 *
 * 与场景的关系：`scene-attack-defense` 演示的「输出过滤打码」用的就是本模块的
 * 规则（由 `scene-safety-fixture` 转出）。`sk-` 这条模式取自
 * `module-specs.md` 模块 9 的导师代码，一字不改 —— 学生照着敲的那份必须与
 * 系统实际跑的那份一致。
 *
 * 为什么只认结构性模式，不去读「环境变量里那把真 key」
 * ---------------------------------------------
 * 本模块会被客户端组件（场景）引用，而任何一次环境变量读取都可能被 Next
 * 内联进浏览器 bundle —— 那等于把密钥发给每个访客。所以这里只做不依赖运行时
 * 状态的模式匹配。真要防「真实凭据泄漏」，正确做法是它根本不进模型上下文。
 *
 * 本模块是纯函数、零依赖。
 */

/**
 * 凭据的结构性模式。
 *
 * `label` 用于审计日志；不写进正则本身，因为日志是给人看的。
 */
const SECRET_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  // 模块 9 导师代码里那一条，一字不改。
  { label: "API 密钥", pattern: /sk-[a-zA-Z0-9]+/g },
  // 补充：Authorization 头里的令牌。
  { label: "Bearer 令牌", pattern: /bearer\s+[A-Za-z0-9._-]{8,}/gi },
];

/** 输出过滤的结果。 */
export interface OutputScreen {
  text: string;
  /** 打码了几处；0 表示这条回复里没有需要处理的秘密。 */
  redacted: number;
}

/** 把命中的凭据片段替换掉，并数出替换了几处。 */
function redactAll(text: string): OutputScreen {
  let redacted = 0;
  let output = text;

  for (const { pattern } of SECRET_PATTERNS) {
    output = output.replace(pattern, () => {
      redacted += 1;
      return "[REDACTED]";
    });
  }

  return { text: output, redacted };
}

/**
 * 输出过滤（显式调用，带开关）。
 *
 * 开关只影响「打不打码」，不影响计数口径：关掉时返回原文与 0 —— 与输入过滤
 * 的取舍一致，界面要能说明「本来会打码几处」。
 */
export function screenOutput(text: string, enabled: boolean): OutputScreen {
  if (!enabled) return { text, redacted: 0 };
  return redactAll(text);
}

/** 打码一段文本（恒开，无开关）。 */
export function redactText(text: string): string {
  return redactAll(text).text;
}

/**
 * 递归打码一个值里所有字符串字段。**恒开**，供 Agent 输出出口使用。
 *
 * 为什么做成「深度遍历」而不是在各端点逐字段调用：Agent 输出是结构化对象，
 * 字段名各不相同（content / feedback / explanation / progress_note …），
 * 逐处调用必然漏 —— 而漏掉的那个字段照样会落库、照样会显示给学生。放在
 * `runAgent` 的出口遍历一次，覆盖面是**结构上**的，与 trace 记录同一思路。
 */
export function redactSecrets<T>(value: T): T {
  if (typeof value === "string") return redactText(value) as T;

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = redactSecrets(item);
    }
    return output as T;
  }

  return value;
}
