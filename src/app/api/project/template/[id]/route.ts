/**
 * GET /api/project/template/[id] —— 项目模板
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 16 条（认证列标「否」）。
 *
 * 数据来源：LLM Wiki 的 `llm-wiki/projects/[id].md`（见 `src/lib/project-templates.ts`）。
 * 模板本质是知识层内容，与 `concepts/` 现读同源，不再依赖一张无主的数据表，
 * 因此「项目模板未接入」的占位期已结束 —— 这一版直接返回真实模板。
 *
 * 校验与错误语义
 * --------------
 * - id 必须对应一个存在的模板（`projects/` 下已落地的页面），否则返回 NOT_FOUND（404）。
 * 错误文案不泄露路径或内部细节，只列出合法的 id 区间。
 */

import { jsonError } from "@/lib/api-error";
import { findProjectTemplate } from "@/lib/project-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  const template = await findProjectTemplate(id);

  if (!template) {
    return jsonError(
      "NOT_FOUND",
      `项目模板 ${id} 不存在：合法 id 为 01-chatbot … 09-safe-agent（对应 9 个教学模块的实践起步工程）`,
    );
  }

  return Response.json(
    { template },
    { headers: { "Cache-Control": "no-store" } },
  );
}
