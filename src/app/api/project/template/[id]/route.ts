/**
 * GET /api/project/template/[id] —— 项目模板
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 16 条（认证列标「否」）。
 *
 * ⚠️ 当前返回 404 —— 数据层尚未就绪（已知边界，需你裁定）
 * ----------------------------------------------
 * `data-models.md` 把 `project_template_id` 列为 `projects` 表的外键，但
 * 实际迁移（`001_init.sql`）**没有建立 `project_templates` 表**，dev.db 里也
 * 查不到这张表。也就是说「项目模板」在文档里被引用，却没有任何数据来源或
 * repository。强行编一份模板内容会制造假数据，与本项目「不伪造」的原则冲突。
 *
 * 因此这里只校验 id 形状并明确返回「尚未接入」，把「模板数据从哪来、长什么样」
 * 留给 Phase 6 的项目集成去定义 —— 届时替换本文件即可（路由与错误语义已就位）。
 */

import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return jsonError(
    "NOT_FOUND",
    `项目模板 ${id} 暂未接入：数据表 project_templates 尚未建立（属 Phase 6 项目集成）。`,
  );
}
