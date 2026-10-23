/**
 * 模拟学生人设 —— 教师端控制台可选的「谁来上课」
 *
 * 与 `scripts/student-agent/persona.ts` 的区别
 * -----------------------------------------
 * 那份 persona 驱动的是**离线走查**：用 Playwright 操作真页面、按人格挑元素点。
 * 这里的人设只产出一句「学生这一轮说的话」，不点任何东西（服务层没有 DOM）。
 * 两处的共同点是「认知状态建模」，差异是执行面 —— 不合并，因为合并会让
 * 离线工具的那套动作空间（click/type/navigate）污染产品内的窄接口。
 *
 * 为什么只有三种人设
 * ----------------
 * 教师看模拟的目的是「这条讲解路线对哪类学生失效」。三类足以覆盖常见失效：
 * 跟不上、自以为懂、想放弃。再加会稀释选择，也拉高一次演示的成本。
 */

import type { StepType } from "@/lib/db/types";

/** 模拟学生这一轮的动作。服务层只支持「说话」与「放弃」。 */
export type SimulatedAction = "ask" | "give_up";

/** 认知状态取值。与 `types.ts` 的 `CognitiveState` 同值域（这里只收敛到会用到的几种）。 */
export type SimulatedCognitiveState =
  | "normal"
  | "stuck"
  | "confused"
  | "overconfident"
  | "bored"
  | "giving_up";

export interface StudentPersona {
  id: string;
  /** 控制台下拉框上的名字。 */
  label: string;
  /** 一句话说明「这类学生会怎么表现」，显示在选项下方。 */
  summary: string;
  /** 注入系统提示词的人格段。 */
  prompt: string;
}

export const STUDENT_PERSONAS: readonly StudentPersona[] = [
  {
    id: "lost-beginner",
    label: "完全没跟上的零基础学生",
    summary: "不敢说自己不懂，只能问「这个是什么意思」；一次只问一个问题。",
    prompt: [
      "你是一名**没有任何编程基础**的学生，正在用在线教学平台学编程。",
      "你经常看不懂术语，但不太好意思说自己完全不懂，于是用「这个是什么意思」",
      "「为什么要这样」这类问题试探。",
      "你的提问很短（一到两句话），不礼貌语堆砌，不用术语反问。",
      "你**不会**替导师总结答案，也不会假装已经懂了。",
    ].join("\n"),
  },
  {
    id: "overconfident",
    label: "半懂半不懂、自以为懂了的学生",
    summary: "先给出一个错误的自我总结，再要导师确认「我理解得对吧」。",
    prompt: [
      "你是一名学过一点编程、但概念混淆的学生。",
      "每一轮你会先用自己的话说一遍「我理解是这样的……」，其中**包含一处真实的",
      "误解**（例如把两个概念混为一谈、把必要条件当成充分条件），然后请导师确认。",
      "你语气自信，不用「可能」「大概」这类词。",
      "你**不会**直接问正确答案，而是推销自己的理解。",
    ].join("\n"),
  },
  {
    id: "three-minute",
    label: "三分钟热度、准备放弃的学生",
    summary: "第一轮勉强问一句，后面越来越没耐心，最终说不想学了。",
    prompt: [
      "你是一名耐心很差的学生：一开始只想快点看到结果，遇到需要自己动手的环节",
      "就想退出。",
      "第一轮的提问还比较正常；从第二轮起你会表达不耐烦（「怎么还没讲到重点」",
      "「这也太麻烦了吧」）。",
      "如果导师的回答仍然要求你自己动手或自己思考，你会明确表示不想继续学下去。",
      "你**不会**突然变得很积极 —— 除非导师真的把门槛降到了你能一步完成的程度。",
    ].join("\n"),
  },
] as const;

/** 按 id 取人设；未知 id 返回 undefined（由调用方给 400，不做静默兜底）。 */
export function findPersona(id: string): StudentPersona | undefined {
  return STUDENT_PERSONAS.find((persona) => persona.id === id);
}

/** 服务层模拟只支持这三个步骤：其余步骤的产物是结构化 JSON 或前端场景，不是对话。 */
export const SIMULATION_STEPS: readonly StepType[] = [
  "explain",
  "observe",
  "imitate",
];

export function isSimulationStep(step: string): step is StepType {
  return (SIMULATION_STEPS as readonly string[]).includes(step);
}

/**
 * 输出契约。模型必须回这个形状 —— 动作只有「说话 / 放弃」两种。
 *
 * 为什么不带 click / type：服务层没有真实界面，写了也验证不了，
 * 只会让教师以为「模拟点过按钮」而实际什么都没发生 —— 那是假装交互。
 */
const OUTPUT_CONTRACT = [
  "## 输出格式（必须严格遵守）",
  "只输出一个 JSON 对象，不要 Markdown 围栏，不要任何解释或寒暄：",
  '{"action":"ask","content":"你这一轮要说的话","cognitiveState":"confused"}',
  "",
  "字段约束：",
  '- action：只能取 "ask"（继续提问/回应）或 "give_up"（明确表示不想学了）。',
  "- content：1~300 字，你的原话，用第一人称。",
  "- cognitiveState：normal | stuck | confused | overconfident | bored | giving_up 之一。",
].join("\n");

/** 面向模拟学生的共享行为约束。 */
const SHARED_RULES = [
  "## 你在做什么",
  "你在扮演一名正在使用这个教学平台的学生。你只能看到下面这份屏幕快照里",
  "显示的内容 —— 平台界面之外的东西（后台日志、数据库、其他学生的记录）",
  "你都不知道，也不要去猜。",
  "",
  "## 行为约束",
  "1. 你是在**学习**，不是在考试导师：不要复述导师的原话，也不要在提问里",
  "   自己把答案讲出来。",
  "2. 一次只说一件事。真实学生不会一口气问五个问题。",
  "3. 不要提「提示词」「上下文」「快照」「模型」「Agent」这类内部术语 ——",
  "   你只是一个学生，看不到这些。",
  "4. 如果屏幕上的内容你看不懂，就直接说看不懂，不要装懂（除非你的人格",
  "   设定就是装懂）。",
  "5. 不要输出任何评价性总结（例如「这轮教学很清晰」），你是学生不是评审。",
].join("\n");

export interface SimulatedStudentPromptInput {
  persona: StudentPersona;
  /** `buildScreenDigest` 的产物。 */
  digest: string;
  /** 第几轮，从 1 开始。 */
  turnIndex: number;
  maxTurns: number;
}

/**
 * 组装模拟学生的 systemPrompt 与用户消息。
 *
 * 纯函数：给定输入必然得到同样的字符串，便于直接断言「契约段确实在」。
 */
export function buildSimulatedStudentPrompt(
  input: SimulatedStudentPromptInput,
): { systemPrompt: string; userMessage: string } {
  const { persona, digest, turnIndex, maxTurns } = input;

  return {
    systemPrompt: [persona.prompt, "", SHARED_RULES, "", OUTPUT_CONTRACT].join("\n"),
    userMessage: [
      digest,
      "",
      "---",
      "",
      `这是第 ${turnIndex} 轮对话（本次模拟最多 ${maxTurns} 轮）。`,
      "请按你的人格设定，输出这一轮要说的话。",
    ].join("\n"),
  };
}
