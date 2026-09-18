/**
 * POST /api/wiki/query —— 查询 LLM Wiki
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 18 条（认证列标「内部」）；八、WikiQuerySchema。
 *
 * 把 Wiki 的 `query` 检索包成 HTTP 接口，供前端/编排层取「最相关的一个页面」。
 *
 * 为什么响应是 { page, content, relatedPages } 而不是 { hits }
 * -------------------------------------------------------
 * api-spec 第八节把响应定成「单个页面 + 相关页」的形态（贴近「查一个概念」的
 * 前端场景），而 `query` 返回的是 `hits`（列表）。两者需要映射：
 *   - `page` = 最佳命中的 `path`；
 *   - `content` = 最佳命中的 `excerpt`（首段摘要，不是全文 —— 全文检索另走
 *     `getPage`，本端点不做二次读取，避免一次查询拉整页）；
 *   - `relatedPages` = 其余命中的 `path` 列表。
 * 若没有任何命中，`page` 为 null、`content` 为空串、`relatedPages` 为空数组，
 * 而不是 404 —— 这是「没查到」而非「请求错」。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { query } from "@/wiki";
import { WikiQuerySchema, type WikiQueryInput } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let body: WikiQueryInput;
  try {
    const parsed = WikiQuerySchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(
        "INVALID_INPUT",
        `请求体不合法：${parsed.error.issues
          .map((i) => `${i.path.join(".") || "<root>"} ${i.message}`)
          .join("；")}`,
      );
    }
    body = parsed.data;
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  try {
    const result = await query(body.query, {
      ...(body.options?.related ? { related: body.options.related } : {}),
      ...(body.options?.topK ? { topK: body.options.topK } : {}),
    });

    const [best, ...rest] = result.hits;
    return Response.json({
      page: best?.path ?? null,
      content: best?.excerpt ?? "",
      relatedPages: rest.map((hit) => hit.path),
    });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
