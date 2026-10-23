#!/usr/bin/env node
/**
 * 种子内置评审账号（真鉴权用）
 *
 * 用法：node scripts/seed-auth-accounts.mjs
 *
 * 把 test / eval 两个固定账号写进 students 表，附带 scrypt 密码哈希。
 * 登录时走 /api/auth/login，不需要从 localStorage 读账号数组。
 *
 * 幂等：重复执行只更新密码哈希与昵称，不会产生重复行。
 */

import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const ACCOUNTS = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    username: "test",
    nickname: "评审演示账号",
    password: "test1234",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000002",
    username: "eval",
    nickname: "评审演示账号",
    password: "eval1234",
  },
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function resolveDbPath() {
  const raw = process.env.DATABASE_URL?.trim();
  const withoutScheme = raw?.startsWith("file:")
    ? raw.slice("file:".length)
    : raw;
  const relative =
    withoutScheme && withoutScheme.length > 0 ? withoutScheme : "dev.db";
  return path.resolve(process.cwd(), relative);
}

function main() {
  const dbPath = resolveDbPath();
  console.log("种子目标:", dbPath);

  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    const upsert = db.prepare(
      `INSERT INTO students (id, nickname, username, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nickname = excluded.nickname,
         username = excluded.username,
         password_hash = excluded.password_hash,
         updated_at = excluded.updated_at`,
    );

    for (const account of ACCOUNTS) {
      const passwordHash = hashPassword(account.password);
      upsert.run(
        account.id,
        account.nickname,
        account.username,
        passwordHash,
        now,
        now,
      );
      console.log(`  已写入账号: ${account.username} (id=${account.id})`);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  console.log("内置评审账号已就绪。");
}

main();
