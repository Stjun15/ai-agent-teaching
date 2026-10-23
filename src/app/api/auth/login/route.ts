/**
 * POST /api/auth/login —— 登录
 *
 * 按用户名查库，scrypt 验证密码，返回 JWT 令牌。
 */

import { z } from "zod";
import { jsonError } from "@/lib/api-error";
import { createToken, verifyPassword } from "@/lib/auth";
import { studentDb } from "@/lib/db";
import { clientKeyFrom, enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const LoginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(request: Request): Promise<Response> {
  // 先限流再解析请求体：解析不消耗数据库资源，但统一放在最前面才能让
  // 「爆破脚本连请求体都不改」也计入窗口。
  const limited = enforceRateLimit(clientKeyFrom(request), "auth-login");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("INVALID_INPUT", "用户名或密码格式不正确。");
  }

  const { username, password } = parsed.data;

  let stored: { id: string; passwordHash: string } | null;
  try {
    stored = await studentDb.getPasswordHash(username.trim());
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!stored || !verifyPassword(password, stored.passwordHash)) {
    return jsonError("UNAUTHORIZED", "用户名或密码不正确。");
  }

  const token = createToken(stored.id);
  return Response.json({
    token,
    studentId: stored.id,
    username: username.trim(),
  });
}
