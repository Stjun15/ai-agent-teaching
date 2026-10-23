/**
 * 服务端鉴权基础设施：密码哈希 + JWT 令牌
 *
 * 只用 Node.js 内置 `node:crypto` —— 零依赖。
 * 密码：scrypt（98 字节存盘格式 `salt:derivedKey`）+ 恒定时间比对。
 * 令牌：JWT 紧凑序列化（HMAC-SHA256），有效期 7 天。
 */

import crypto from "node:crypto";

import type { StudentRole } from "@/lib/db/types";

const AUTH_SECRET = Buffer.from(
  process.env.AUTH_SECRET ?? "ai-teaching-dev-secret-change-in-production",
  "utf8",
);

const TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600;

// ---------------------------------------------------------------------------
// 密码
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(
    Buffer.from(derivedKey.toString("hex"), "utf8"),
    Buffer.from(hash, "utf8"),
  );
}

// ---------------------------------------------------------------------------
// 令牌（JWT 紧凑序列化）
// ---------------------------------------------------------------------------

interface TokenPayload {
  sub: string; // studentId
  /**
   * 角色。旧令牌（本字段上线前签发的）没有这一项 —— 验证时按 `student` 兜底，
   * 因此**已在线的教师需要重新登录**才能拿到带 `teacher` 的令牌。
   * 兜底方向必须是降权（student 而非 teacher），宁可让教师重登一次。
   */
  role?: StudentRole;
  exp: number;
  iat: number;
}

export function createToken(studentId: string, role: StudentRole = "student"): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: studentId,
    role,
    exp: now + TOKEN_EXPIRY_SECONDS,
    iat: now,
  };
  const headerB64 = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
    "utf8",
  ).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyToken(
  token: string,
): { studentId: string; role: StudentRole } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // timingSafeEqual 在 Buffer 长度不等时会直接抛异常而非返回 false。
  // 恶意/损坏的令牌签名段可能任意长，先量长度。
  const expectedSig = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (signatureB64.length !== expectedSig.length) return null;

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signatureB64, "utf8"),
      Buffer.from(expectedSig, "utf8"),
    )
  ) {
    return null;
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.sub !== "string") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return {
    studentId: payload.sub,
    // 旧令牌缺 role 时按最低权限处理（见 TokenPayload.role 注释）。
    role: payload.role === "teacher" ? "teacher" : "student",
  };
}
