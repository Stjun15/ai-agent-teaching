/**
 * POST /api/session —— 创建会话
 *
 * `api-spec.md`「二、1」：请求 `{ studentId, moduleId }`，
 * 响应 `{ sessionId, currentStep: "explain", moduleInfo }`。
 * 错误：404 学生不存在、400 模块 ID 无效、403 前置模块未掌握。
 *
 * 两处偏离规格，都是刻意的
 * --------------------
 * 1. **`estimatedTime` 返回字符串（`"30min"`）而不是 number**。
 *    模块元数据来自 wiki frontmatter，原文就是这个格式。转成 `30` 等于
 *    悄悄定义单位（分钟？秒？），而这个单位没有任何一处文档约定。
 *    宁可返回原样并在类型里写清楚，也不要造一个看起来更「规范」的假数字。
 * 2. **身份以 `resolveStudent` 为准，body 里的 `studentId` 必须一致**。
 *    `CreateSessionSchema` 要求 body 带 `studentId`（规格如此），
 *    但与已认证身份不一致时返回 403 —— 否则任何人都能替别人开会话。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { masteryDb, sessionDb } from "@/lib/db";
import { findModule } from "@/lib/modules";
import { CreateSessionSchema } from "@/schemas";
import { PREREQUISITE_MIN_MASTERY } from "@/lib/agent/orchestrator/teaching-loop";

// node:sqlite 不能跑在 Edge Runtime。
export const runtime = "nodejs";

/** 把 Zod 的 issue 压成一行文本，避免把整个 issue 对象丢给前端。 */
function describe(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const parsed = CreateSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "INVALID_INPUT",
      `请求体不符合 CreateSessionSchema：${describe(parsed.error)}`,
    );
  }

  // 防止替别人开会话：body 里的 studentId 必须与已认证身份一致。
  if (parsed.data.studentId !== auth.student.id) {
    return jsonError(
      "FORBIDDEN",
      "请求体里的 studentId 与当前身份不一致，不能替他人创建会话。",
    );
  }

  const teachingModule = await findModule(parsed.data.moduleId);
  if (!teachingModule) {
    return jsonError("INVALID_INPUT", `模块 ${parsed.data.moduleId} 不存在。`);
  }

  // 前置模块掌握度检查。概念 id 与模块 id 在本项目同值（模块就是概念页），
  // 所以这里直接用 moduleId 查 mastery。
  for (const prerequisite of teachingModule.prerequisites) {
    const mastery = await masteryDb.getByConcept(auth.student.id, prerequisite);
    const score = mastery?.score ?? 0;
    if (score < PREREQUISITE_MIN_MASTERY) {
      return jsonError(
        "FORBIDDEN",
        `前置模块「${prerequisite}」掌握度为 ${score}，需达到 ${PREREQUISITE_MIN_MASTERY} 才能学习本模块。`,
      );
    }
  }

  try {
    const session = await sessionDb.create(auth.student.id, teachingModule.id);
    return Response.json({
      sessionId: session.id,
      currentStep: session.currentStep,
      moduleInfo: {
        id: teachingModule.id,
        name: teachingModule.name,
        difficulty: teachingModule.difficulty,
        // 见文件头「偏离规格 1」：原样返回 frontmatter 里的 "30min" 形式。
        estimatedTime: teachingModule.estimatedTime,
      },
    });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
