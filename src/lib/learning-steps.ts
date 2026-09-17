/**
 * 模块内的学习步骤
 *
 * 依据
 * ----
 * `00-MASTER.md`「教学流程」把一次学习固定为 5 步：
 * 导师展示预设代码 → 学生完成场景 → AI 校验并点评 → 可视化展示 → 出题变式练习。
 * 该流程对**每个模块**都适用，与模块内容无关，所以它是常量而不是每个概念页
 * 各写一份的数据。
 *
 * ⚠️ 这里有一处**推断**，需要确认
 * ----------------------------
 * 设计文档没有直接说「`/learn/[moduleId]/[step]` 里的 step 就是教学流程这 5 步」，
 * 也没给出别的步骤定义。本文件按上述理解实现，理由有两条：
 * 1. `04-frontend.md` 的三栏布局要求左栏有「步骤导航」，而步骤的总数在文档里
 *    唯一可能的出处就是这个 5 步流程；
 * 2. 5 步的语义（讲解 → 动手 → 校验 → 可视化 → 练习）恰好是一条完整的学习闭环，
 *    作为模块内的进度骨架是自洽的。
 * 若后续确认步骤应改为「概念页的各个小节」，只需替换本文件 ——
 * 步骤的消费方（`StepNav`、模块页）都从这里取，不存在第二处定义。
 */

/**
 * 步骤 id 会进 URL（`/learn/[moduleId]/[step]`），所以用英文短横线形式，
 * 不用中文，也不随文案变化而变化 —— 文案改了不该让旧链接失效。
 */
export const LEARNING_STEPS = [
  {
    id: "explain",
    label: "概念讲解",
    /** 对应 `00-MASTER.md` 教学流程的哪一步，便于对照文档核验。 */
    fromFlowStep: 1,
    detail: "导师 Agent 讲清这一讲的核心概念，并展示预设示例",
  },
  {
    id: "practice",
    label: "动手实践",
    fromFlowStep: 2,
    detail: "自己写 Prompt、工具定义或核心逻辑，AI 不代写",
  },
  {
    id: "validate",
    label: "校验点评",
    fromFlowStep: 3,
    detail: "点评 Agent 按评分标准给出分项得分与扣分理由",
  },
  {
    id: "visualize",
    label: "可视化",
    fromFlowStep: 4,
    detail: "把刚写的代码放进可视化场景，看它逐步运转",
  },
  {
    id: "quiz",
    label: "变式练习",
    fromFlowStep: 5,
    detail: "出题 Agent 换一个条件再问一次，确认真的掌握",
  },
] as const;

export type LearningStepId = (typeof LEARNING_STEPS)[number]["id"];

/** 全部步骤 id，供路由参数校验与穷举检查使用。 */
export const LEARNING_STEP_IDS: readonly string[] = LEARNING_STEPS.map(
  (step) => step.id,
);

/** 步骤 id → 它在列表中的序号（从 0 开始）；未知 id 返回 -1。 */
export function stepIndex(stepId: string): number {
  return LEARNING_STEPS.findIndex((step) => step.id === stepId);
}
