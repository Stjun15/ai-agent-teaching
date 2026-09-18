/**
 * Schema 出口
 *
 * 与 `src/lib/db/index.ts`、`src/wiki/index.ts` 同构：上层只从这里取，
 * 不直接 import 子文件。这样将来拆分或合并 schema 文件时，调用方不用改。
 *
 * ⚠️ 本出口**只被 Route Handler 与前端组件**使用。Agent 内核（`src/lib/agent/`）
 * 不应 import 它 —— 内核的进出都是 SDK 类型，把 HTTP 契约塞进内核会让内核
 * 多一层无谓依赖。校验发生在边界（路由层），不在内层。
 */

export * from "./api";
export * from "./error";
export * from "./report";
export * from "./sse";
