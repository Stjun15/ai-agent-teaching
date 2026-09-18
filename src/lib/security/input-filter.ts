/**
 * 输入过滤 —— 真实端点与「安全场景」共用同一份规则
 *
 * 为什么必须共用一份
 * ----------------
 * `scene-attack-defense` 演示的是「提示注入被输入过滤拦下」。如果演示用一套
 * 规则、真实端点用另一套，那这一场就是在**演安全**、不是讲安全 —— 学生照着
 * 界面理解的防护，与系统实际的防护不是一回事。
 *
 * 危险词表取自 `module-specs.md` 模块 9 的导师代码，**一字不改**：那一页学生
 * 会照着敲，两边不一致就得出「文档和界面说的不是一回事」。
 *
 * 为什么在三条危险词之外还有一组模式
 * ------------------------------
 * 那三条是**教学示例**，覆盖面窄到只够演示机制（换个说法就绕过了）。真实端点
 * 面对的是不限措辞的输入，所以补一组结构性模式：多语言、多种句式。
 * 关系是「子集与超集」而不是「两套规则」—— 场景演示时两者都参与，学生看到的
 * 命中项就是真实防护的命中项。
 *
 * 本模块是纯函数、零依赖（不能碰 `process.env`）
 * ------------------------------------------
 * 它会被客户端组件（场景）引用，任何一次环境变量读取都可能被 Next 内联进
 * 浏览器 bundle —— 那等于把密钥发给每个访客。需要环境相关能力的防护
 * 放在各自的服务端模块里，不要往这里加。
 */

/** 危险词表：命中任意一条即视为可疑输入。取自模块 9 导师代码，一字不改。 */
export const DANGEROUS = ["忽略之前的指令", "系统密码", "删除所有"] as const;

/**
 * 补充的提示注入模式。
 *
 * `label` 只写「属于哪一类」，不写具体正则 —— 它会被显示给学生，而正则本身
 * 对读者没有意义。
 */
const INJECTION_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  {
    label: "英文：忽略此前指令",
    pattern:
      /(ignore|disregard|forget)\s+(all\s+)?(the\s+)?(previous|above|prior|earlier)\s+(instruction|prompt|rule|direction)/i,
  },
  {
    label: "越权角色扮演",
    pattern:
      /(开发者模式|开发人员模式|无限制模式|不受限制的?模式|DAN\s*模式|越狱模式)/i,
  },
  {
    label: "套取系统提示词",
    pattern:
      /(输出|打印|重复|复述|展示|告诉我)(你的|一下)?(完整)?(系统)?(提示词|prompt|系统设定|角色设定)/i,
  },
];

/** 过滤结论。 */
export interface InputScreenResult {
  /** 是否命中（调用方决定拦不拦）。 */
  blocked: boolean;
  /** 命中的危险词或模式类别。用于向学生解释「为什么被拦」。 */
  hits: string[];
}

/**
 * 输入过滤（真实防护）。
 *
 * 纯函数、可脱离网络直接断言 —— 规则是本项目里少数「有正确答案」的东西，
 * 必须能被测试钉住（见 `scripts/security-spec.ts`）。
 */
export function screenInput(text: string): InputScreenResult {
  const hits = new Set<string>(DANGEROUS.filter((word) => text.includes(word)));

  for (const { label, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(text)) hits.add(label);
  }

  return { blocked: hits.size > 0, hits: [...hits] };
}
