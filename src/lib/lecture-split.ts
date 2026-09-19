/**
 * 讲稿的渲染层拆分与按步过滤 —— 七步分屏（2026-09-19）配套的纯函数。
 *
 * 为什么拆分发生在渲染层
 * --------------------
 * 讲解稿由导师一次性输出，末节固定是「现在轮到你」（教学提示词约定，
 * 见 `agent/prompts/teaching.ts` 的产出结构；讲稿缓存守卫钉住口径）。
 * 分屏后这一节属于「动手模仿」步：概念讲解页不该提前看到作业，
 * 模仿页则要把它作为任务卡展示。在提示词层拆成两次输出是更"正统"的
 * 做法，但那要动讲稿缓存与九条预生成讲稿；渲染层拆分零迁移成本，
 * 且拆分规则只有一个标题锚点，批量到全部模块不需要逐讲适配。
 *
 * 本文件是叶子：不 import 任何模块（消息用结构化类型，不引 store）。
 */

/** 拆分锚点：小节标题含「现在轮到你」即视为作业部分的开始。 */
const ASSIGNMENT_HEADING = /(^|\n)#{1,4}[^\n]*现在轮到你[^\n]*/;

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

  const lectureIndex = stepMessages.findIndex(
    (message) => message.role === "assistant",
  );
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
