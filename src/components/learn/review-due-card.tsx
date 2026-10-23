"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck } from "lucide-react";

import { apiGet } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import type { StudentErrorsResponse } from "@/schemas";

/**
 * 学习页的「今日复习」入口。
 *
 * 错题本藏在报告页最下面，学生不会每天翻到那里 —— 「第 1/3/7/14 天复习」
 * 只有入口出现在必经之路上才可能真的发生，所以入口放在学习中心。
 *
 * 只显示条数，不在这里展开复习：复习要写答案、要排版面，照搬一份等于把
 * 错题本复制成两份。点进来落到报告页的待复习视图（`?review=1`）。
 *
 * 取不到数据时**不显示**，不显示「0 条」：把「没取到」画成 0 与把 null
 * 分数画成 0 同罪（见 AGENTS.md「不要为看起来完整造兜底」）。
 */
export function ReviewDueCard() {
  const [dueCount, setDueCount] = useState<number | null>(null);

  useEffect(() => {
    if (currentStudentId() === "") return;
    let cancelled = false;
    apiGet<StudentErrorsResponse>("/api/student/errors?due=1&limit=1")
      .then((res) => {
        if (!cancelled) setDueCount(res.dueCount);
      })
      .catch(() => {
        // 静默：取不到就不占版面，也不冒充 0。
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!dueCount) return null;

  return (
    <Link
      href="/report?review=1"
      className="group mt-8 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm transition-colors hover:border-primary/60 hover:bg-primary/10"
    >
      <CalendarCheck className="size-4 shrink-0 text-primary" />
      <span className="flex-1">
        有 <strong className="tabular-nums">{dueCount}</strong>{" "}
        条错题到了复习档期
        <span className="text-muted-foreground">
          （按第 1 / 3 / 7 / 14 天排期）
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-medium text-primary">
        去复习
        <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
