/**
 * 兜底策略 —— 模型彻底给不出合法输出时，交给学生的东西
 *
 * 为什么要有兜底
 * -----------
 * `02-agent-system.md` 异常处理表：「Agent 输出格式错误 → Zod 校验失败 →
 * 附带错误重试 → 兜底」。注意是「兜底」不是「报错」：学生在学习过程中
 * 看到的不能是一句「服务出错了」，那既中断学习也暴露实现细节。
 *
 * 兜底的两条原则
 * -----------
 * 1. **诚实**：兜底输出必须能被识别出来（`usedFallback` 标记 + 文案里说明
 *    「本次自动评分未生效」）。给一个看起来像正常评分的假分数，是最坏的一种兜底 ——
 *    学生会拿它当真，而它是编的。
 * 2. **不阻断**：兜底要让学生能继续（给方向、给提示），而不是停在原地。
 *
 * 为什么评分兜底给 0 分而不是「跳过」
 * -----------------------------
 * 0 分会把学生的掌握度拉低，这不对 —— 没评出来不等于学生不会。
 * 所以 `is_correct` 取 false 的同时 `next_action` 取 `"retry"`，
 * 并且 `level` 给「不及格」但 `progress_note` 明确写「本次未评分」。
 * 编排层看到 `usedFallback` 时**不应**据此更新掌握度（见 validation-loop）。
 */

import type {
  AssistantOutput,
  ExaminerOutput,
  ReviewerOutput,
  TeacherOutput,
} from "./outputs";

/** 兜底文案里统一使用的说明，让「这不是模型的真实判断」有据可查。 */
const FALLBACK_NOTE =
  "本次自动评分未生效（模型输出未通过校验），不计入掌握度。";

/**
 * 点评 Agent 的兜底输出。
 *
 * `total_score: 0` 看起来像「学生写得极差」，所以必须用 `progress_note`
 * 讲清楚：这个 0 分不代表评价结果，只是「没有分数」。
 */
export function reviewerFallback(reason: string): ReviewerOutput {
  return {
    total_score: 0,
    level: "不及格",
    is_correct: false,
    dimensions: [
      {
        name: "自动评分",
        score: 0,
        weight: 1,
        comment: `${FALLBACK_NOTE}原因：${reason}`,
      },
    ],
    issues: [],
    suggestions: [
      {
        priority: "中",
        action: "稍后再试一次，或把你的答案拆成更小的部分分别提交",
        example: "例如先只提交「角色定义」这一句，确认通过后再补充其余部分",
      },
    ],
    progress_note: FALLBACK_NOTE,
    next_action: "retry",
  };
}

/**
 * 讲解 Agent 的兜底输出。
 *
 * `content` 给方向而不是知识点：兜底时我们**不知道**学生卡在哪，
 * 编一段讲解等于胡说。宁可让学生换个问法。
 */
export function teacherFallback(conceptId: string): TeacherOutput {
  return {
    type: "question",
    content:
      "我这边没能组织好这段讲解。可以先告诉我你现在卡在哪一步吗？" +
      "例如「不知道从哪开始」还是「写了但不确定对不对」—— 我按你的情况重新讲。",
    concept_id: conceptId,
    next_action: "continue",
  };
}

/** 出题 Agent 的兜底输出：不给题。出题编错了会直接教错东西。 */
export function examinerFallback(): ExaminerOutput {
  return {
    questions: [],
    total_count: 0,
    estimated_time: "0min",
  };
}

/**
 * 答疑 Agent 的兜底输出。
 *
 * `should_log: true` + `log_category: "概念困惑"`：兜底本身就是一条信号，
 * 说明这个问法让模型没能给出结构化的回答，值得回看。
 */
export function assistantFallback(): AssistantOutput {
  return {
    type: "counter_question",
    content:
      "我没太跟上你的问题。能具体说一下是在哪一步卡住的吗？" +
      "把报错信息或你写的内容贴给我，会好定位得多。",
    related_concepts: [],
    hint_level: null,
    should_log: true,
    log_category: "概念困惑",
  };
}

/**
 * 降难度：连续失败后的教学策略。
 *
 * 对应 `02-agent-system.md`：「校验不通过 3 次 → 降低难度 + 换类比 + 记录 errors」。
 * 这里返回的是**给模型看的附加指令**，不是直接改输出 —— 改输出等于替模型说话，
 * 而降难度应该是让模型用更简单的方式重讲一遍。
 */
export function lowerDifficultyInstruction(attempts: number): string {
  if (attempts < 3) return "";
  return [
    "## 教学策略调整",
    "",
    `学生已经连续 ${attempts} 次没有通过。请：`,
    "1. 换一个更贴近日常的类比，不要用上一个。",
    "2. 把任务拆成更小的步骤，一次只讲一步。",
    "3. 先给一个几乎完整的示例，只留最关键的一处让学生补。",
  ].join("\n");
}
