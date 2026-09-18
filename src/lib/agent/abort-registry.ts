/**
 * 进行中的流注册表 —— 让 `POST /api/session/[id]/abort` 能中止另一条请求的流
 *
 * 为什么需要它
 * -----------
 * SSE 响应的生命周期属于**那一条 HTTP 请求**：客户端断开时 `req.signal` 会触发，
 * 内核随之 `abort()`。这是主路径，也是最可靠的路径。
 * 但 `/api/session/[id]/abort` 是**另一条请求**，它拿不到前一条请求的 signal，
 * 必须有个跨请求的把手 —— 就是这个注册表。
 *
 * ⚠️ 只在同一进程内有效
 * -----------------
 * `Map` 在进程内存里。多实例部署（EdgeOne Pages 的 Serverless 会按并发起多个
 * 实例）时，中止请求可能被路由到另一个实例，找不到这条流。
 * 到那时需要外部存储（Redis 的 pub/sub 或直接标记数据库字段由流式请求轮询）。
 * **这不是缺陷而是范围**：单实例下它是对的，多实例下它失效但不会出错 ——
 * 客户端断开这条主路径始终有效，注册表只是额外给的一个「主动停止」按钮。
 *
 * 为什么按 sessionId 而不是按请求 id
 * -----------------------------
 * `api-spec.md` 的路由就是 `/api/session/[id]/abort`，前端只知道 sessionId。
 * 一个会话同时跑两条流没有意义（学生会看到两段交错的输出），所以按会话粒度
 * 取「一条」是符合产品语义的：新流开始即替换旧的。
 */

/** 会话 id → 该会话当前流的中断控制器。 */
const controllers = new Map<string, AbortController>();

/** 注册一条流，返回它的 signal。同会话已有流时先中止旧的。 */
export function registerStream(sessionId: string): AbortSignal {
  abortStream(sessionId);
  const controller = new AbortController();
  controllers.set(sessionId, controller);
  return controller.signal;
}

/**
 * 中止某会话当前正在跑的流。
 *
 * @returns 是否真的中止了一条流。`false` 表示这个会话当前没有在跑 ——
 *   前端可以据此提示「已经停了」，而不是假装成功。
 */
export function abortStream(sessionId: string): boolean {
  const controller = controllers.get(sessionId);
  if (!controller) return false;
  controllers.delete(sessionId);
  controller.abort();
  return true;
}

/** 流结束后主动注销，避免 Map 无限增长。 */
export function unregisterStream(sessionId: string): void {
  controllers.delete(sessionId);
}

/** 当前登记的流数量。仅用于测试与诊断。 */
export function activeStreamCount(): number {
  return controllers.size;
}
