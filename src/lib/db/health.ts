/**
 * 数据层健康检查
 *
 * 为什么放在 db 目录里、而不是直接在路由里查：
 * `sqlite.ts` 的文件头定了一条分层约束 ——「驱动名只允许出现在本文件，上层一律通过
 * repository 接口访问数据，不直接 import 这里」。健康检查因此由数据层内部实现，
 * 再经 `./index` 出口暴露；路由拿到的是一份**与驱动无关**的报告。SQLite 专有的
 * `sqlite_master` 与连接管理都留在 `sqlite.ts`，本文件只负责健康语义
 * （阈值、判定、面向运维的措辞）。
 *
 * 只读，不创建：`getDb()` 会隐式创建库文件，这对健康检查是坏行为 —— 一次探测就把
 * 「没初始化」变成「看起来有库」。因此先判文件存在，再决定是否打开连接。
 */

import { existsSync } from "node:fs";
import path from "node:path";

import {
  listAppliedMigrationIds,
  listUserTableNames,
  MIGRATION_TABLE,
  resolveSqlitePath,
} from "./sqlite";

/**
 * 业务表数量的期望下限。
 *
 * 取自 `06-execution-plan.md` Phase 1 验收标准「15 张表全部创建」。用 `>=` 而非 `===`：
 * 后续 Phase 会增加表，健康检查不该因为「表变多了」报红灯，但**变少**必须报。
 */
export const EXPECTED_BUSINESS_TABLES = 15;

export interface DatabaseHealth {
  /** 库可用且业务表数量达标 */
  ok: boolean;
  /** 库文件是否已存在（本检查不会创建它） */
  initialized: boolean;
  /** 库文件名。只给 basename，不回显本机绝对路径 */
  file: string;
  /** 业务表数量（不含 schema_migrations） */
  businessTables: number;
  /** 已应用的迁移 id */
  migrations: string[];
  /** 不可用时的原因，面向运维可读 */
  error?: string;
}

/**
 * 检查开发期数据库。
 *
 * 刻意不抛错 —— 健康检查的职责是把问题**报告出来**，而不是让调用方再去处理异常。
 * 失败原因放在 `error` 字段里。
 */
export function checkDatabaseHealth(): DatabaseHealth {
  const absolutePath = resolveSqlitePath();
  const file = path.basename(absolutePath);

  if (!existsSync(absolutePath)) {
    return {
      ok: false,
      initialized: false,
      file,
      businessTables: 0,
      migrations: [],
      error: `库文件 ${file} 不存在，请先执行 pnpm db:migrate`,
    };
  }

  try {
    const businessTables = listUserTableNames().filter(
      (name) => name !== MIGRATION_TABLE,
    ).length;
    const migrations = listAppliedMigrationIds();
    const ok =
      businessTables >= EXPECTED_BUSINESS_TABLES && migrations.length > 0;

    return {
      ok,
      initialized: true,
      file,
      businessTables,
      migrations,
      error: ok
        ? undefined
        : `业务表 ${businessTables} 张（期望 ≥ ${EXPECTED_BUSINESS_TABLES}）、已应用迁移 ${migrations.length} 条，请检查是否漏跑 pnpm db:migrate`,
    };
  } catch (error) {
    return {
      ok: false,
      initialized: true,
      file,
      businessTables: 0,
      migrations: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
