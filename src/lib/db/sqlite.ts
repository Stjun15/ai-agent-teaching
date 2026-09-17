/**
 * SQLite 连接层（开发期数据库）
 *
 * 为什么用 Node 内置的 `node:sqlite` 而不是 better-sqlite3：
 * - 零依赖，不需要原生模块编译，避开工具链与供应链风险；
 * - API 同步、写法与 better-sqlite3 接近，repository 层无需为此改设计。
 * 代价：要求 Node ≥ 22.5（见 package.json 的 engines），且目前会打印实验性警告。
 *
 * 部署期会切换到 CloudBase PostgreSQL。驱动名只允许出现在本文件，
 * 上层一律通过 repository 接口访问数据，不直接 import 这里。
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";

/** 未配置 DATABASE_URL 时使用的默认库文件（已被 .gitignore 排除） */
export const DEFAULT_SQLITE_FILE = "dev.db";

/**
 * 从 DATABASE_URL 解析出 SQLite 文件路径。
 * 接受 `file:./dev.db`、`file:/abs/path.db` 与纯路径三种写法。
 */
export function resolveSqlitePath(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const raw = databaseUrl?.trim();
  const withoutScheme = raw?.startsWith("file:")
    ? raw.slice("file:".length)
    : raw;
  const relative =
    withoutScheme && withoutScheme.length > 0
      ? withoutScheme
      : DEFAULT_SQLITE_FILE;
  return path.resolve(process.cwd(), relative);
}

const globalForDb = globalThis as unknown as { __aiTeachingDb?: DatabaseSync };

/**
 * 取当前进程的 SQLite 连接（惰性创建、进程内复用）。
 *
 * 开发模式下 Next.js 会反复重建模块，若每次都新建连接，
 * 热更新后会出现多个连接争抢写锁。因此实例同时挂在 globalThis 上。
 */
export function getDb(): DatabaseSync {
  if (globalForDb.__aiTeachingDb) return globalForDb.__aiTeachingDb;

  const db = new DatabaseSync(resolveSqlitePath());
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");

  globalForDb.__aiTeachingDb = db;
  return db;
}

/** 关闭连接（脚本收尾与测试用）。 */
export function closeDb(): void {
  globalForDb.__aiTeachingDb?.close();
  delete globalForDb.__aiTeachingDb;
}
