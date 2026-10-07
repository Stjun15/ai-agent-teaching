/**
 * GET /api/module-content —— 读取模块概念页正文
 *
 * 为什么需要
 * ---------
 * platform-replica / ts-basics 的 explain 步不走
 * AI 讲课 —— 它们的讲稿是给人读的（路径选择 / 三板斧 / 结算），
 * 不走 TEACHING_EXPLAIN_PROMPT 的通关模式。本端点让前端能直接拿
 * 到概念页正文渲染交互卡片，再由学生决定要不要启动 AI 对聊。
 *
 * 安全性
 * -----
 * moduleId 限制为字母、数字、连字符，防止路径穿越。不鉴权：
 * 概念页是全体学生共用的固定教材，不含个人信息。
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_ID_RE = /^[a-z0-9-]+$/;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const moduleId = params.get("moduleId")?.trim() ?? "";

  if (moduleId === "" || !MODULE_ID_RE.test(moduleId)) {
    return jsonError("INVALID_INPUT", "moduleId 格式不合法。");
  }

  try {
    const filePath = join(
      process.cwd(),
      "llm-wiki",
      "concepts",
      `${moduleId}.md`,
    );
    const raw = await readFile(filePath, "utf-8");

    // 切掉 frontmatter（--- 包裹的 YAML），只留正文
    const body = raw.startsWith("---")
      ? raw.replace(/^---[\s\S]*?---\n*/, "")
      : raw;

    return Response.json({ content: body.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // ENOENT = 模块还不存在，返回 404 让前端显示友好提示
    if (message.includes("ENOENT")) {
      return jsonError("NOT_FOUND", `模块「${moduleId}」的概念页不存在。`);
    }
    return jsonError("DB_ERROR", message);
  }
}
