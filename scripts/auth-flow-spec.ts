/**
 * 鉴权流程纯函数测试
 *
 * 守的是**密码哈希 / JWT 令牌**这一层的正确性，不依赖数据库。
 * 改了 `hashPassword` / `verifyPassword` / `createToken` / `verifyToken`
 * 任一个，这里立刻会红。
 *
 * 运行：
 *   pnpm test:auth
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// 密码哈希
// ---------------------------------------------------------------------------

test("hashPassword 每次产出不同 salt，但 verifyPassword 都能通过", () => {
  const stored = hashPassword("my-secret-password");
  // 格式：<hex salt>:<hex derivedKey>
  const parts = stored.split(":");
  assert.equal(parts.length, 2, "存盘格式应为 salt:derivedKey");
  assert.ok(parts[0].length > 0, "salt 不应为空");
  assert.ok(parts[1].length > 0, "derivedKey 不应为空");

  assert.equal(verifyPassword("my-secret-password", stored), true);
});

test("verifyPassword：错误密码返回 false", () => {
  const stored = hashPassword("correct");
  assert.equal(verifyPassword("wrong", stored), false);
});

test("verifyPassword：空密码通过不了正常哈希值", () => {
  const stored = hashPassword("something");
  assert.equal(verifyPassword("", stored), false);
});

test("verifyPassword：损坏的存盘字符串返回 false 而非抛异常", () => {
  assert.equal(verifyPassword("any", "bad-format"), false);
  assert.equal(verifyPassword("any", ""), false);
  assert.equal(verifyPassword("any", ":only-colon"), false);
});

test("hashPassword：两次哈希同一密码产出不同的存盘值（salt 随机）", () => {
  const a = hashPassword("same");
  const b = hashPassword("same");
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------------
// 令牌
// ---------------------------------------------------------------------------

const TEST_STUDENT_ID = "11111111-2222-4333-8444-555555555555";

test("createToken → verifyToken 往返通过", () => {
  const token = createToken(TEST_STUDENT_ID);
  const result = verifyToken(token);
  assert.ok(result, "合法令牌应通过验证");
  assert.equal(result!.studentId, TEST_STUDENT_ID);
});

test("verifyToken：三段格式之外（少于或多余三段）返回 null", () => {
  assert.equal(verifyToken(""), null);
  assert.equal(verifyToken("one.two"), null);
  assert.equal(verifyToken("one.two.three.four"), null);
});

test("verifyToken：篡改负载返回 null", () => {
  const token = createToken(TEST_STUDENT_ID);
  const parts = token.split(".");
  // 改负载里的 studentId，签名应不匹配
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: "bad-id", exp: 9999999999, iat: 1 }),
  ).toString("base64url");
  const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  assert.equal(verifyToken(tampered), null);
});

test("verifyToken：篡改签名返回 null", () => {
  const token = createToken(TEST_STUDENT_ID);
  const parts = token.split(".");
  const badSig = `_${parts[2].slice(1)}`;
  const tampered = `${parts[0]}.${parts[1]}.${badSig}`;
  assert.equal(verifyToken(tampered), null);
});
