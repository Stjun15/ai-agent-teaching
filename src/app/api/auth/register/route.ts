/**
 * POST /api/auth/register —— 注册新账号
 *
 * 接收用户名 + 密码，创建学生并返回 JWT 令牌。
 * 密码用 scrypt 哈希存库，令牌有效期 7 天。
 */

import { z } from "zod";
import { jsonError } from "@/lib/api-error";
import { createToken, hashPassword } from "@/lib/auth";
import { studentDb } from "@/lib/db";
import { clientKeyFrom, enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const RegisterSchema = z.object({
  username: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(32, "用户名最多 32 个字符")
    .refine((v) => !/\s/.test(v), "用户名不能包含空格"),
  password: z.string().min(6, "密码至少 6 个字符"),
});

export async function POST(request: Request): Promise<Response> {
  const limited = enforceRateLimit(clientKeyFrom(request), "auth-register");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "INVALID_INPUT",
      parsed.error.issues.map((i) => i.message).join("；"),
    );
  }

  const { username, password } = parsed.data;
  const passwordHash = hashPassword(password);

  try {
    const student = await studentDb.createWithPassword(username, passwordHash);
    const token = createToken(student.id);
    return Response.json(
      { token, studentId: student.id, username },
      { status: 201 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("UNIQUE") || msg.includes("username")) {
      return jsonError("INVALID_INPUT", "该用户名已被注册。");
    }
    return jsonError("DB_ERROR", msg);
  }
}
