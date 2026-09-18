/**
 * GET /api/visualization/[sceneId] —— 获取可视化场景
 *
 * 依据
 * ----
 * `api-spec.md` 一、路由清单第 15 条（认证列标「否」）；九、可视化场景响应。
 *
 * 校验场景 ID 是否合法（`scene-ids.ts` 的权威联合），合法则返回场景名。
 *
 * steps 为什么是空数组（已知边界，非 bug）
 * -------------------------------------
 * api-spec 第九节给的响应里 `steps` 是「动画的步骤序列」，但**步骤内容属于
 * Phase 6 的可视化实现** —— `src/lib/modules.ts` 的注释明确写了
 * 「场景的实现在 Phase 6，本阶段只把 id 带进数据」。所以这里只返回场景骨架
 * （id + 真实的中文名），`steps` 留空待 Phase 6 填充。前端拿到空数组应渲染
 * 「该场景即将上线」，而不是白屏或报错。
 */

import { jsonError } from "@/lib/api-error";
import { isSceneId, SCENE_LABELS, type SceneId } from "@/lib/agent/scene-ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sceneId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sceneId } = await context.params;

  if (!isSceneId(sceneId)) {
    return jsonError("NOT_FOUND", `可视化场景 ${sceneId} 不存在。`);
  }

  return Response.json({
    sceneId: sceneId as SceneId,
    name: SCENE_LABELS[sceneId],
    steps: [],
  });
}
