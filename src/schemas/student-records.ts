/**
 * `GET /api/student/errors` 与 `GET /api/student/prompts` 的响应形状
 *
 * 为什么这两个端点也要有 schema
 * --------------------------
 * 它们是两个**已被建好却没有任何消费方**的端点（2026-09-18 盘点）：路由返回
 * `{ errors }` / `{ history }` 两个裸对象字面量，报告页不认识它们，于是报告
 * 只有汇总数字、没有明细。补消费方时若让页面自己声明一份接口，就会出现
 * 「路由改了字段名、页面照旧编译通过、界面上一片空白」—— 与 `report.ts`
 * 文件头写的是同一个漂移问题，解法也相同：形状只写一份，两边共用。
 *
 * 为什么这里复用 `db/types` 的行类型而不另写字段
 * --------------------------------------
 * 两个路由返回的**就是** `errorDb` / `promptHistoryDb` 的行映射结果，
 * 没有裁剪也没有改名。再抄一份字段清单就成了第三份数据（AGENTS.md 第九节），
 * 而它们一旦不一致，tsc 还不会报错 —— 因为两边都是「自己声明自己」。
 * 所以这里直接 `import type`，把 HTTP 契约钉在数据层的行类型上：
 * 数据库加一列，契约跟着变。
 *
 * 为什么是 `import type` 而不是普通 import
 * ---------------------------------
 * 这两个类型会被客户端组件引用。普通 import 会把 `src/lib/db/` 整条依赖链
 * 拖进浏览器产物（那里面有 `node:sqlite`）；`import type` 在编译期被完全擦除，
 * 产物里一行不剩。
 */

import type { ErrorRecord, PromptHistory } from "@/lib/db/types";

/**
 * 行类型一并出口：消费方（报告页）只从 `@/schemas` 取类型，
 * 不必知道它们住在 `src/lib/db/`。这是 re-export，不是第二份声明。
 */
export type { ErrorRecord, PromptHistory };

/** `GET /api/student/errors` 的响应。 */
export interface StudentErrorsResponse {
  /** 按 `created_at` 倒序。`?uncorrected=1` 时只含未订正的。 */
  errors: ErrorRecord[];
  /** 满足当前筛选条件的错题总数（分页用）。 */
  total: number;
  /** 该学生所有错题的去重模块 id（错题本模块下拉选项）。 */
  moduleIds: string[];
}

/** `GET /api/student/prompts` 的响应。 */
export interface StudentPromptsResponse {
  /** 按 `created_at` 倒序。`?moduleId=` 时只含该模块的。 */
  history: PromptHistory[];
  /** 满足当前筛选条件的记录总数（分页用）。 */
  total: number;
  /** 该学生所有 Prompt 历史的去重模块 id（模块下拉选项）。 */
  moduleIds: string[];
}