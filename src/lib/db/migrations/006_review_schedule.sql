-- 复习调度回填：为「有表无实现路径」期间写下的历史错题补排期
--
-- 背景（2026-10-24）：`errors.next_review_at` 自 001_init 建表起就存在，但
-- 一直没有任何写入方 —— 错题产生时按 NULL 落库，注释写的是「写假状态等于
-- 谎报」。本轮把第 1/3/7/14 天复习接上了（规则在 src/lib/review-schedule.ts），
-- 新错题由应用层排期；本迁移只负责把存量行补上一个诚实的起点。
--
-- 回填规则与 `nextReviewAt(createdAt, now)` **完全一致**：取「锚定创建时间的
-- 下一个未来档期」；四档都已经过（错题超过 14 天）就留 NULL = 退出复习队列。
-- 这与应用层的行为对齐 —— 一条 30 天前的错题即使今天复习一次，
-- `nextReviewAt` 也会返回 null，不该先在队列里冒充「逾期」再瞬间结课。
-- ⚠️ 四个天数（1/3/7/14）与 `REVIEW_INTERVALS_DAYS` 是同一份口径，
--    改排期节奏必须两边一起改（tests/review-schedule.test.ts 钉住了 TS 侧）。
--
-- 只回填**未订正**的行：已订正错题的历史起点不可考（不知道学生是在第几天
-- 订正的），补一个档期等于编造来历不明的进度。它们停在中立态（不进队列）。
-- 回填后仍然逾期的会如实显示为「已到期」—— 那是真的：这些错题一次都没复习过。

UPDATE errors
SET next_review_at = strftime(
  '%Y-%m-%dT%H:%M:%fZ',
  created_at,
  CASE
    WHEN created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day') THEN '+1 day'
    WHEN created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 day') THEN '+3 day'
    WHEN created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 day') THEN '+7 day'
    WHEN created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 day') THEN '+14 day'
  END
)
WHERE next_review_at IS NULL AND is_corrected = 0;
