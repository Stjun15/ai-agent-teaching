/**
 * POST /api/auth/login —— 登录
 *
 * 按用户名查库，scrypt 验证密码，返回 JWT 令牌。
 */

import { z } from "zod";
import { jsonError } from "@/lib/api-error";
import { createToken, verifyPassword } from "@/lib/auth";
import { studentDb } from "@/lib/db";

export const runtime = "nodejs";

const LoginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(request: Request): Promise<Response> {
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
