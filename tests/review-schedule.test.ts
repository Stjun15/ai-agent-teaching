import { describe, expect, it } from "vitest";

import {
  REVIEW_INTERVALS_DAYS,
  isReviewDue,
  nextReviewAt,
  reviewStageOf,
} from "@/lib/review-schedule";

const CREATED = "2026-10-01T00:00:00.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;

function atDay(days: number): Date {
  return new Date(new Date(CREATED).getTime() + days * DAY_MS);
}

describe("review-schedule：第 1 / 3 / 7 / 14 天排期", () => {
  it("档期表就是教学承诺的那四个节点，改动需要同步文档与界面文案", () => {
    expect([...REVIEW_INTERVALS_DAYS]).toEqual([1, 3, 7, 14]);
  });

  it("刚创建的错题，下一次复习排在第 1 天", () => {
    expect(nextReviewAt(CREATED, atDay(0))).toBe("2026-10-02T00:00:00.000Z");
  });

  it("拖到第 2 天才来订正：不补练第 1 天，直接排第 3 天", () => {
    expect(nextReviewAt(CREATED, atDay(2))).toBe("2026-10-04T00:00:00.000Z");
  });

  it("恰好踩在档期边界上（第 3 天整）算这一档已过，排下一档", () => {
    expect(nextReviewAt(CREATED, atDay(3))).toBe("2026-10-08T00:00:00.000Z");
  });

  it("第 14 天之后四档走完，返回 null 退出复习队列", () => {
    expect(nextReviewAt(CREATED, atDay(14))).toBeNull();
    expect(nextReviewAt(CREATED, atDay(400))).toBeNull();
  });

  it("createdAt 是脏数据时返回 null，不编一个假日期", () => {
    expect(nextReviewAt("not-a-date", atDay(1))).toBeNull();
  });
});

describe("review-schedule：到期判断", () => {
  const due = "2026-10-02T00:00:00.000Z";

  it("未到期、正好到期、已逾期三种边界", () => {
    expect(isReviewDue(due, new Date("2026-10-01T23:59:59.999Z"))).toBe(false);
    expect(isReviewDue(due, new Date(due))).toBe(true);
    expect(isReviewDue(due, new Date("2026-10-20T00:00:00.000Z"))).toBe(true);
  });

  it("null 表示不在复习队列，永远不算到期", () => {
    expect(isReviewDue(null, atDay(30))).toBe(false);
  });

  it("排期字段脏了就当作不到期，不让一条坏数据把待复习列表刷成红色", () => {
    expect(isReviewDue("garbage", atDay(30))).toBe(false);
  });
});

describe("review-schedule：档期序号（界面措辞用）", () => {
  it("四个档期分别对应第 1~4 次复习", () => {
    expect(reviewStageOf(CREATED, nextReviewAt(CREATED, atDay(0)))).toBe(1);
    expect(reviewStageOf(CREATED, nextReviewAt(CREATED, atDay(2)))).toBe(2);
    expect(reviewStageOf(CREATED, nextReviewAt(CREATED, atDay(5)))).toBe(3);
    expect(reviewStageOf(CREATED, nextReviewAt(CREATED, atDay(10)))).toBe(4);
  });

  it("排期不在任何档期上（历史数据）返回 null，界面退回「下次复习」而不瞎编号", () => {
    expect(reviewStageOf(CREATED, "2026-10-02T12:00:00.000Z")).toBeNull();
    expect(reviewStageOf(CREATED, null)).toBeNull();
  });
});
