/**
 * GET /api/skill —— 读取 skill 自查清单文件
 *
 * 用于平台复刻工具箱面板：学生点击 "Skill 自查"
 * 即可获取对应板斧的检查清单内容，一键复制喂给 AI 导师。
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SKILL_ID_RE = /^[a-z0-9-]+$/;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const skillId = params.get("skillId")?.trim() ?? "";

  if (skillId === "" || !SKILL_ID_RE.test(skillId)) {
    return jsonError("INVALID_INPUT", "skillId 格式不合法。");
  }

  try {
    const filePath = join(process.cwd(), "skills", `${skillId}.md`);
    const raw = await readFile(filePath, "utf-8");
    return Response.json({ content: raw.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      return jsonError("NOT_FOUND", `skill「${skillId}」不存在。`);
    }
    return jsonError("DB_ERROR", message);
  }
}