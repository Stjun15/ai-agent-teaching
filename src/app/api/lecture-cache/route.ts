/**
 * GET /api/lecture-cache —— 取某讲某步的预生成讲稿
 *
 * 为什么要有这个端点（2026-09-19）
 * ---------------------------
 * 学生反馈「概念讲解不是提前准备好的吗？为什么点开要等模型响应？」——
 * 讲稿现在由 `scripts/generate-lecture-cache.mjs` 预生成进 `lecture_cache`
 * 表，本端点是运行期读它的唯一入口。缓存命中时前端直接把讲稿显示成
 * 导师开场，学生点开即有；未命中返回 `{ found: false }`，前端回退为
 * 原有的实时生成（现场等模型）。
 *
 * 为什么不做鉴权与限流
 * -----------------
 * - 讲稿是**全体学生共用**的固定教材（不是任何学生的私有数据），读到它
 *   不泄露任何个人上下文；
 * - 本端点**零模型调用**，一次本地 SQLite 读，与静态资源同级别的成本，
 *   限流只会挡住正常翻页。
 * （对比 /api/chat 按 IP 限流的理由是「每请求一整轮模型调用」，两边的
 * 成本模型完全不同。）
 *
 * `step` 只接受 explain：observe 的示范已改为从 wiki 页面直读示范代码，
 * 不再走 LLM（2026-09-25），observe 缓存行也已清空；其余步骤没有
 * 「预先准备的讲稿」（validate / practice 是结构化输出，走 /api/agent/*，
 * 见 step-prompt.ts），返回 400 而不是 404 —— 参数本身就非法，
 * 不是「这份讲稿不存在」。
 */

import { jsonError } from "@/lib/api-error";
import { lectureCacheDb } from "@/lib/db";

export const runtime = "nodejs";

// 学习页是静态预渲染的（generateStaticParams），讲稿在运行期才可能被
// （重）生成，所以响应不能进任何缓存。
export const dynamic = "force-dynamic";

const CACHED_STEPS = new Set(["explain"]);

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const moduleId = params.get("moduleId")?.trim() ?? "";
  const step = params.get("step")?.trim() ?? "";

  if (moduleId === "") {
    return jsonError("INVALID_INPUT", "缺少 moduleId 参数。");
  }
  if (!CACHED_STEPS.has(step)) {
    return jsonError(
      "INVALID_INPUT",
      `step 只支持 explain（收到：${step || "空"}）。`,
    );
  }

  try {
    const entry = await lectureCacheDb.get(moduleId, step as "explain");
    if (entry === null) {
      // 200 + found:false 而不是 404：对前端来说「没有缓存」是正常分支
      // （回退实时生成），不是需要全局错误处理的异常。
      return Response.json({ found: false });
    }
    return Response.json({
      found: true,
      content: entry.content,
      createdAt: entry.createdAt,
    });
  } catch (error) {
    return jsonError(
      "DB_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
}
