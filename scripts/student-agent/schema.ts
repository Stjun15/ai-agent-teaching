/**
 * 学生报告的结构契约 —— 驱动器私有（不进 src/schemas：这是体检工具的
 * 内部产物，不是 HTTP 契约）。
 */

import { z } from "zod";

export const StudentReportSchema = z.object({
  /** 两三句话：学生现在的理解。 */
  understanding: z.string().min(1),
  /** 还没搞懂的点；认真学习的学生也可能有（那就是讲稿的问题）。 */
  confusions: z.array(z.string()),
  /** 本步要求提交的内容原文（代码 / Prompt / 答案）。 */
  submission: z.string().min(1),
});

export type StudentReport = z.infer<typeof StudentReportSchema>;

export type StudentMode = "diligent" | "sloppy";
