import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 className：
 * clsx 负责条件拼接，tailwind-merge 负责消解冲突的 Tailwind 工具类
 * （例如同时传入 "p-2" 与 "p-4" 时保留后者）。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
