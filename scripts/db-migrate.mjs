#!/usr/bin/env node
/**
 * 迁移执行器
 *
 * 用法：pnpm db:migrate
 *
 * 刻意写成不依赖任何项目模块的纯 Node 脚本：
 * 迁移是「建库」这种最底层操作，不应该被 TS 编译、打包器或依赖安装的
 * 状态牵连 —— 哪怕 node_modules 是坏的，这个脚本也必须能跑。
 *
 * 代价是 DATABASE_URL 的解析规则与 src/lib/db/sqlite.ts 重复了一份，
 * 两处必须保持一致（改动时请同步）。
 */

import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(
  process.cwd(),
  "src",
  "lib",
  "db",
  "migrations",
);

/**
 * 与 src/lib/db/sqlite.ts#resolveSqlitePath 保持一致的解析规则。
 * 接受 `file:./dev.db`、`file:/abs/path.db` 与纯路径三种写法。
 */
function resolveDbPath(databaseUrl = process.env.DATABASE_URL) {
  const raw = databaseUrl?.trim();
  const withoutScheme = raw?.startsWith("file:")
    ? raw.slice("file:".length)
    : raw;
  const relative =
    withoutScheme && withoutScheme.length > 0 ? withoutScheme : "dev.db";
  return path.resolve(process.cwd(), relative);
}

function main() {
  const dbPath = resolveDbPath();
  console.log("迁移目标:", dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("没有找到任何迁移文件。");
  }

  const applied = new Set(
    db
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((row) => row.id),
  );
  const pending = files.filter((name) => !applied.has(name));

  if (pending.length === 0) {
    console.log("没有待执行的迁移（已是最新）。");
  }

  for (const name of pending) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
    // SQLite 支持事务性 DDL：迁移中途失败可整体回滚，不会留下半张表
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(name);
      db.exec("COMMIT");
      console.log("已应用:", name);
    } catch (error) {
      db.exec("ROLLBACK");
      console.error("迁移失败并已回滚:", name);
      throw error;
    }
  }

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name`,
    )
    .all()
    .map((row) => row.name);
  const indexes = db
    .prepare(
      `SELECT name FROM sqlite_master
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name`,
    )
    .all()
    .map((row) => row.name);

  console.log("");
  console.log(
    `业务表 ${tables.filter((t) => t !== "schema_migrations").length} 张:`,
  );
  console.log("  " + tables.join(", "));
  console.log(`索引 ${indexes.length} 个:`);
  console.log("  " + indexes.join(", "));

  db.close();
}

main();
