/**
 * POST /api/wiki/ingest —— 把外部 Markdown 文件编译进 LLM Wiki
 *
 * 这是 `ingest()` 的第一个真实调用方。Phase 2 交付了 ingest/query/maintain
 * 三个操作，此前 query 部分（`listPages` / `readPageSync` / 搜索）与 maintain
 *（健康检查）已接线，ingest 是唯一还没通电的。
 *
 * 本端点的角色
 * -----------
 * 接收一个已成文的 Markdown 文件路径，把它规范化（补 last_updated、校验
 * frontmatter、对齐 SCHEMA 约束）后写入 wiki 目录，同步索引状态，追加日志。
 * 不负责「把散乱素材写成文章」——那是 Agent 的工作。
 *
 * 鉴权：内部端点，使用与 `/api/wiki/query` 相同的 `resolveStudent` 鉴权。
 * 未来可升级为 Admin-only（例如检查 `student.id === "admin"`）。
 */

import { resolveStudent } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { ingest } from "@/wiki";
import { WikiIngestSchema, type WikiIngestInput } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveStudent(request);
  if (!auth.ok) return auth.response;

  let body: WikiIngestInput;
  try {
    const parsed = WikiIngestSchema.safeParse(await request.json());
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
    await ingest(body.source, body.target, "SCHEMA.md");

    return Response.json({
      status: "ok",
      path: body.target,
      message: `已从 ${body.source} 编译至 ${body.target}`,
    });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
