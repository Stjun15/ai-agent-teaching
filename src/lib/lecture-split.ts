/**
 * 讲稿的渲染层拆分与按步过滤 —— 七步分屏（2026-09-19）配套的纯函数。
 *
 * 为什么拆分发生在渲染层
 * --------------------
 * 讲解稿由导师一次性输出，末节约定为作业/任务标题（提示词用
 * 「五、现在轮到你」，见 `agent/prompts/teaching-chat.ts`）；
 * 讲稿缓存守卫钉住口径。分屏后这一节属于「动手模仿」步：
 * 概念讲解页不该提前看到作业，模仿页则要把它作为任务卡展示。
 * 在提示词层拆成两次输出是更"正统"的做法，但那要动讲稿缓存与
 * 九条预生成讲稿；渲染层拆分零迁移成本，且拆分规则只有一组锚点，
 * 批量到全部模块不需要逐讲适配。
 *
 * 本文件是叶子：不 import 任何模块（消息用结构化类型，不引 store）。
 */

/**
 * 拆分锚点：小节标题含作用词即视为作业/任务的开始。
 *
 * 教学提示词约定产出结构末节为「五、现在轮到你」，但在多条讲稿缓存的
 * 实际产出中，模型偶有变体（行级差异 / 篇号缺失 / 措辞微调）。
 * 锚点放宽为匹配一组语义等价的中文作业节标题，避免因措辞差异
 * 误报「讲稿无任务节」——接地分析的完全组套判定就靠这一个锚点。
 */
const ASSIGNMENT_HEADING =
  /(^|\n)#{1,4}[^\n]*(现在轮到你|轮到你了|动手任务|实践任务|你的任务|自己试试|动手练习|给你一个练习)[^\n]*/;

export interface SplitLecture {
  /** 作业标题之前的讲解部分（概念、例子、坑）。 */
  teaching: string;
  /** 「现在轮到你」起的作业部分；讲稿没有该节时为 null。 */
  assignment: string | null;
}

/** 把一条讲稿拆成「讲解部分」与「作业部分」。 */
export function splitLecture(content: string): SplitLecture {
  const match = content.match(ASSIGNMENT_HEADING);
  if (!match || match.index === undefined) {
    return { teaching: content, assignment: null };
  }
  return {
    teaching: content.slice(0, match.index).trimEnd(),
    assignment: content.slice(match.index).trimStart(),
  };
}

/** 渲染层过滤所需的消息最小结构（与 store 的 ChatMessage 结构兼容）。 */
export interface SplitableMessage {
  role: string;
  content: string;
  step?: string;
}

/** 讲稿消息在本步的呈现方式。 */
export type LectureMode = "full" | "truncate" | "skip";

/**
 * 按步骤过滤消息，并按需处理该步的讲稿消息。
 *
 * - `full`：原样（分屏前各步的旧行为）；
 * - `truncate`：讲解稿只保留作业标题之前的部分（概念讲解页用）；
 * - `skip`：讲稿整条不显示（观察示范 / 动手模仿页用 —— 示范卡与
 *   任务卡是讲稿内容的主角，聊天里再渲染一遍就是重复）。
 *
 * 「该步的讲稿」= 过滤后列表里的第一条助手消息（每步开场由
 * LectureLauncher / seedLecture 播种，学生问答跟在其后）。
 */
export function selectStepMessages<T extends SplitableMessage>(
  messages: T[],
  step: string,
  lectureMode: LectureMode,
): T[] {
  const stepMessages = messages.filter((message) => message.step === step);
  if (lectureMode === "full") return stepMessages;

  // 「该步的讲稿」= 这一步对话的**第一条**消息（播种或静默流式生成，
  // 先于任何学生输入）。若学生先开口，第一条助手消息是对学生的回复，
  // 绝不能当讲稿吃掉 —— observe / imitate 页从不播种开场（2026-09-25
  // 起 observe 示范改为 wiki 直读，不走 LLM），旧逻辑却把「该步第一条
  // 助手消息」一律当讲稿：skip 模式因此把导师对提问的回复整条吞掉，
  // 学生看到「已读不回」且无任何报错（2026-10-07 审计 C1）。
  const lectureIndex = stepMessages[0]?.role === "assistant" ? 0 : -1;
  if (lectureIndex === -1) return stepMessages;

  return stepMessages
    .map((message, index) => {
      if (index !== lectureIndex) return message;
      if (lectureMode === "skip") return null;
      return { ...message, content: splitLecture(message.content).teaching };
    })
    .filter((message): message is T => message !== null);
}

/**
 * 取讲解稿的作业部分（「现在轮到你」整节）—— 动手模仿页任务卡的内容。
 * 没有讲解稿或讲稿未含作业节时返回 null（调用方不渲染任务卡）。
 */
export function getAssignmentFromMessages(
  messages: SplitableMessage[],
  explainStep: string,
): string | null {
  const lecture = messages.find(
    (message) => message.step === explainStep && message.role === "assistant",
  );
  if (!lecture) return null;
  return splitLecture(lecture.content).assignment;
}

/**
 * 检测实时对话消息是否包含任务标题（观察示范/动手模仿步）。
 *
 * 任务卡（assignment-card.tsx）已从 explain 讲稿缓存里取到权威任务，
 * 实时导师回复再带一个「五、现在轮到你」节就形成双任务冲突——
 * 学生看到两个不同的任务，不知道该做哪个。
 *
 * 本函数只检测不修改内容；调用方用它决定是否追加仲裁文案。
 */
export function hasTaskHeading(content: string): boolean {
  return ASSIGNMENT_HEADING.test(content);
}

/**
 * 实时对话中出现任务标题时的仲裁文案。
 *
 * 不直接删掉导师回复里的任务节（删了反而让学生困惑「为什么话说一半」），
 * 而是在任务节前面追加一行说明，引导学生以任务卡为准。
 */
export const LIVE_TASK_ARBITRATION_NOTE =
  "> ⚠️ 以上任务是导师在对话中给出的。**请以上方「现在轮到你」任务卡里的任务为准**——" +
  "那张卡是课程预置的正式任务，点评也会按它来评分。";

/**
 * 对实时对话消息做双任务仲裁：如果消息包含任务标题且已有缓存任务，
 * 在任务标题前插入仲裁说明。
 *
 * @param content 实时导师回复的完整正文
 * @param hasCachedTask 当前模块是否已有预置任务（assignment-card 已成功取到）
 * @returns 仲裁后的正文；不满足条件时返回原内容
 */
export function arbitrateDualTask(
  content: string,
  hasCachedTask: boolean,
): string {
  if (!hasCachedTask) return content;
  const match = content.match(ASSIGNMENT_HEADING);
  if (!match || match.index === undefined) return content;
  return (
    content.slice(0, match.index) +
    "\n\n" +
    LIVE_TASK_ARBITRATION_NOTE +
    "\n\n" +
    content.slice(match.index)
  );
}