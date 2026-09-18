/**
 * 多 Agent 场景的样本数据 —— 三个角色与它们之间传递的东西
 *
 * 为什么要单独一份而不是写在场景组件里
 * ----------------------------------
 * 「角色分工」这件事的全部证据，就是三段 System Prompt 之间的差别。它是纯数据，
 * 一旦写进 `.tsx` 就进不了回归测试（测试用 `node --experimental-strip-types` 跑，
 * 该模式不编译 JSX）。而「三个角色抄成了同一段 Prompt」这类错误在画面上完全看不
 * 出来：三张卡片都在、动画照跑、评审也照样通过，只是这个场景一个知识点都没讲。
 * 放在这里，测试可以直接断言三段互不相同、每一段都写明了「只做什么」。
 */

/** 用户的一句话需求。整个协作只有这一个输入，后面全靠 Agent 之间传递。 */
export const USER_REQUEST = "帮我写一个天气 Agent 项目";

/** 一个参与协作的 Agent。 */
export interface TeamAgent {
  id: string;
  name: string;
  /** 它在团队里负责什么（卡片上的第二行）。 */
  duty: string;
  /** 它的 System Prompt —— 分工就写在这一段里。 */
  systemPrompt: string;
  /**
   * 它交给下一棒的东西。
   *
   * 评审 Agent 没有这一项：它的产出是「结论」，取决于过还是不过，由
   * `reviewOf` 给，不在这里写死一份。
   */
  output?: string;
}

/**
 * 协作顺序就是数组顺序：需求 → 代码 → 评审。
 *
 * 三段 Prompt 都带一句「不要做什么」（不寒暄 / 不自行加功能 / 只指出问题）。
 * 这是刻意的：新手写多 Agent 最常犯的错是只写「你是什么」，不写边界，
 * 于是三个 Agent 各干各的、输出互相重复，协作反而比单 Agent 更差。
 */
export const TEAM: readonly TeamAgent[] = [
  {
    id: "requirement",
    name: "需求 Agent",
    duty: "把一句想法拆成功能点",
    systemPrompt:
      "你是需求分析师。把用户的一句话拆成具体功能点，每条一行。不要寒暄，不要写代码。",
    output: "1. 查指定城市的当前天气\n2. 返回温度与穿衣建议",
  },
  {
    id: "coder",
    name: "代码 Agent",
    duty: "按功能点写实现",
    systemPrompt:
      "你是程序员。只实现给到的功能点，不自行增加功能，不写多余注释。",
    output:
      "export async function getWeather(city: string) {\n  return await api.fetch(city);\n}",
  },
  {
    id: "reviewer",
    name: "评审 Agent",
    duty: "检查代码能不能收",
    systemPrompt:
      "你是代码评审员。只指出缺少的错误处理与边界问题，给出可执行的修改意见。",
  },
];

/** 按 id 取 Agent；找不到时退回第一位（参数是外部输入，不信任）。 */
export function findAgent(id: string): TeamAgent {
  return TEAM.find((agent) => agent.id === id) ?? TEAM[0];
}

/**
 * 评审 Agent 的输出：两种结论二选一。
 *
 * 「打回」那一支里写明了退回给谁 —— 多 Agent 里最容易漏的是**终止条件**：
 * 只说「不合格就打回」，不说「什么情况下算合格」，这个循环就不会停。
 */
export function reviewOf(passed: boolean): {
  verdict: string;
  reason: string;
} {
  return passed
    ? { verdict: "通过", reason: "错误处理与边界都补齐了，可以收。" }
    : {
        verdict: "打回",
        reason: "接口失败时没有兜底 —— 退回代码 Agent 重做。",
      };
}
