/**
 * 日期工具
 *
 * SCHEMA.md 规定所有日期字段一律 `YYYY-MM-DD`。这里刻意不用
 * `new Date().toISOString().slice(0, 10)` —— 那取的是 UTC 日期，
 * 在东八区 08:00 之前会比本地日期少一天，会让刚写入的页面看起来「昨天更新」。
 */

/** 取本地时区的今天，格式 `YYYY-MM-DD`。 */
export function today(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** SCHEMA.md 里模板占位符的字面值。 */
export const DATE_PLACEHOLDER = "YYYY-MM-DD";
