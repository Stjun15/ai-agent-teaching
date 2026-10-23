import { z } from "zod";

import { resolveStudent } from "@/lib/api-auth";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { studentDb } from "@/lib/db";
import { jsonError } from "@/lib/api-error";

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "旧密码不能为空。"),
  newPassword: z.string().min(6, "新密码至少需要 6 个字符。"),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const parsed = ChangePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "INVALID_INPUT",
      parsed.error.issues.map((i) => i.message).join("；"),
    );
  }

  const { oldPassword, newPassword } = parsed.data;

  const stored = await studentDb.getPasswordHashById(auth.student.id);
  if (!stored || !verifyPassword(oldPassword, stored)) {
    return jsonError("UNAUTHORIZED", "旧密码不正确。");
  }

  await studentDb.updatePassword(auth.student.id, hashPassword(newPassword));

  return Response.json({ ok: true });
}
