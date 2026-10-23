/**
 * 分数量纲的口径 —— 全站唯一一处
 *
 * 为什么必须集中一处
 * ----------------
 * 本项目里「分数」有两种量纲，而**类型都是 `number`**：
 *
 * | 分数 | 量纲 | 权威来源 |
 * |---|---|---|
 * | 掌握度 `mastery.score` | **0~5** | `001_init.sql` 的 `CHECK (score >= 0 AND score <= 5)`；`data-models.md` 第 275 行 |
 * | 点评分 `prompt_history.score` | **0~100** | 点评 Agent 的 `total_score`（`ReviewerOutputSchema` `min(0).max(100)`） |
 *
 * 两者都是 `number`，编译器一个字都不会说。所以口径一旦不集中，就会出现
 * 「掌握度 4（满分 5，已经是 mastered）」被显示成「4 / 100」并判为「不及格」——
 * 这不是假想的：本文件建立之前，`MasteryIndicator` 收 0~100、
 * `levelOfScore` 的门槛是 60/75/90，而它们的数据源是 0~5 的 `mastery.score`。
 * 那个错当时是**潜伏**的（`StudentStore.hydrate` 还没有调用方，卡片一直显示
 * 「尚未测评」），但接线的第一步就会让它变成看得见的错。
 *
 * 本文件不 import 任何模块，是叶子：服务端、客户端、Node 脚本都能引用。
 */

/** 掌握度满分。改这个数之前先改建表约束 —— 它是权威，这里跟着它。 */
export const MASTERY_MAX_SCORE = 5;

/** 点评分满分。 */
export const PROMPT_SCORE_MAX = 100;

/** 掌握度达标线（`completedModules` 与 `PREREQUISITE_MIN_MASTERY` 都用 3 这一档）。 */
export const MASTERY_PASS_SCORE = 3;

/**
 * 掌握度 0~5 → 百分比 0~100。
 *
 * 显示成百分比而不是「4 / 5」是因为 `Progress` 这类组件、以及模块页既有的
 * 「x / 100」写法都是百分比 —— 改显示单位会让同一个概念在两个页面上长得不一样。
 * 转换只此一处，消费方不要再写 `score * 20`。
 */
export function masteryToPercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const bounded = Math.min(Math.max(score, 0), MASTERY_MAX_SCORE);
  return Math.round((bounded / MASTERY_MAX_SCORE) * 100);
}

/**
 * 掌握度分数（0~5）→ `rubrics.md` 的四档。
 *
 * 档位口径与 `Mastery.status`（`not_started` / `in_progress` / `needs_review` /
 * `mastered`）不同：那是**学习状态**，这是**分数等级**。两者都要显示，
 * 不能互相推导，所以这里只做分数到等级这一件事。
 *
 * 门槛是**推断**：`rubrics.md` 给了四档名称但没有分界值。取值依据是库里
 * 已有的两个事实 —— `PREREQUISITE_MIN_MASTERY = 3`（到 3 才算能往下学，
 * 对应「良好」）与种子学生 `llm-api=4` 标成 `mastered`（对应「优秀」）。
 * 集中在这里一处，将来定了只改这个函数。
 */
export function levelOfMastery(
  score: number,
): "优秀" | "良好" | "及格" | "不及格" {
  if (score >= 4) return "优秀";
  if (score >= MASTERY_PASS_SCORE) return "良好";
  if (score >= 2) return "及格";
  return "不及格";
}

/**
 * 点评分（0~100）→ 掌握度分（0~5）。
 *
 * 掌握式学习的运行时闭环（点评 → 掌握度 → 解锁下一讲）必须做这次量纲
 * 换算，而换算公式若散在两个路由里，必然出现一边 `/ 20` 一边 `/ 25`。
 * 取整用四舍五入：通过线 75 分落在 3.75 → 4（良好+），保证「过点评线
 * 必过掌握线（3）」，两条门槛不打架；50 分 → 3 边界与掌握判定线一致。
 * 越界输入夹到 [0, 5]，防模型给出超纲分数时把数据库 CHECK 约束炸掉。
 */
export function masteryScoreFromPromptScore(promptScore: number): number {
  if (!Number.isFinite(promptScore)) return 0;
  const step = PROMPT_SCORE_MAX / MASTERY_MAX_SCORE;
  const converted = Math.round(promptScore / step);
  return Math.min(Math.max(converted, 0), MASTERY_MAX_SCORE);
}
