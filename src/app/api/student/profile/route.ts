/**
 * GET / PUT /api/student/profile —— 学生画像
 *
 * `api-spec.md` 一、路由清单第 1 条。画像会被 Agent 读进提示词
 * （讲解风格、提示偏好、节奏等），所以**取值必须是受控枚举** ——
 * 见 `UpdateProfileSchema` 的说明。
 *
 * GET 在画像尚不存在时返回 `null` 而不是 404
 * ------------------------------------
 * 「还没填画像」是正常的初始状态，不是错误。返回 404 会让前端把
 * 「引导填写画像」和「请求失败」混为一谈；返回 `null` 让它能明确区分。
 * 这与掌握度未测评显示「尚未测评」是同一个取舍（见 `MasteryCard`）。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { studentDb } from "@/lib/db";
import { UpdateProfileSchema } from "@/schemas";

// node:sqlite 不能跑在 Edge Runtime。
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const profile = await studentDb.getProfile(auth.student.id);
    return Response.json({ profile });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const parsed = UpdateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "INVALID_INPUT",
      `请求体不符合 UpdateProfileSchema：${parsed.error.issues
        .map((issue) =>
          issue.path.length > 0
            ? `${issue.path.map(String).join(".")}: ${issue.message}`
            : issue.message,
        )
        .join("; ")}`,
    );
  }

  try {
    await studentDb.updateProfile(auth.student.id, parsed.data);
    // 回写后再读一次：数据库有默认值与规范化，直接把入参回给前端会
    // 让它以为「没传的字段也被接受了」。
    const profile = await studentDb.getProfile(auth.student.id);
    return Response.json({ profile });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
