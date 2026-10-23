/**
 * 错题复习调度 —— 「第 1 / 3 / 7 / 14 天复习」的排期计算
 *
 * 为什么是一个纯函数模块
 * --------------------
 * 排期只有一条规则，但它同时被三处消费：写入错题时定首次到期（`errorDb.create`）、
 * 提交订正/复习时推进档期（`errorDb.markCorrected`）、列表与计数判断「是否到期」
 * （`/api/student/errors?due=1`）。三处各写一份 `+1 day` / `+3 day`，早晚会漂移成
 * 三套口径 —— 与 `paths.ts` 只许一处拼路径是同一条理由：**规则只写一份**。
 *
 * 档期怎么锚定
 * ------------
 * 全部锚定在**错题创建时间**，不是「上次复习时间」。这样学生拖了两天才来订正，
 * 进度不会整体后移 —— 第 7 天复习仍然是错题出生后的第 7 天。
 *
 * 到期之后什么时候算「下一次」
 * --------------------------
 * `nextReviewAt(createdAt, now)` 返回**第一个还没到的档期**：
 * - 刚创建（0 天）：下一次 = 第 1 天；
 * - 第 2 天提交订正：下一次 = 第 3 天（第 1 天那档已经错过，不补练两次）；
 * - 第 15 天之后：返回 `null` —— 四档走完，该错题退出复习队列。
 *
 * 「订正」与「复习」在数据层是同一个动作
 * ----------------------------------
 * 平台不自动判定订正答案的对错（那是点评 Agent 的活儿，走 `/api/agent/validate`），
 * 所以「这次复习算不算过」只能由学生自报。既然没法区分，就别造两套状态：
 * 提交一次答案 = 完成一次复习 = 推进一档。这一点在 `errors.ts` 写入裁定里也写了。
 */

/** 复习档期（天）。顺序即推进顺序；改这里就能改教学节奏。 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 下一次复习时间（ISO 8601 UTC 字符串，与 `helpers.nowIso()` 同格式）。
 *
 * 返回 `null` 表示两件事之一：四档已走完（该错题退出队列），或 `createdAt`
 * 无法解析（脏数据 —— 宁可让这条错题不进队列，也不编一个假日期让它冒出来）。
 */
export function nextReviewAt(
  createdAt: string,
  now: Date = new Date(),
): string | null {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(now.getTime())) return null;

  const elapsed = now.getTime() - created;
  const upcoming = REVIEW_INTERVALS_DAYS.find(
    (days) => elapsed < days * DAY_MS,
  );
  if (upcoming === undefined) return null;

  return new Date(created + upcoming * DAY_MS).toISOString();
}

/** 该错题此刻是否已到期（`nextReviewAt` 为空 = 不在队列里，永远不算到期）。 */
export function isReviewDue(
  nextReviewAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!nextReviewAt) return false;
  const due = new Date(nextReviewAt).getTime();
  if (Number.isNaN(due)) return false;
  return due <= now.getTime();
}

/**
 * 排期落在第几档（1~4）；不在任何档期返回 `null`。
 *
 * 界面用它把日期说人话（「第 2 次复习」而不是光甩一个日期），
 * 也让 `REVIEW_INTERVALS_DAYS` 的语义在 UI 上可核对。
 */
export function reviewStageOf(
  createdAt: string,
  nextReviewAt: string | null,
): number | null {
  if (!nextReviewAt) return null;
  const created = new Date(createdAt).getTime();
  const due = new Date(nextReviewAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(due)) return null;

  const index = REVIEW_INTERVALS_DAYS.findIndex(
    (days) => created + days * DAY_MS === due,
  );
  return index === -1 ? null : index + 1;
}
