/**
 * 限流 —— 按学生与端点计数的固定窗口
 *
 * 为什么需要
 * --------
 * 每个 Agent 调用都要真花钱（token 计费）。没有限流时，一个循环脚本或一次误触
 * 的自动重试就能在几分钟内把额度烧掉，而省赛演示环境里额度耗尽等于**演示中断**。
 * `module-specs.md` 模块 9 也把「限流」列为安全 Agent 防护方案的一项。
 *
 * 为什么是进程内内存而不是分布式
 * --------------------------
 * 诚实说明边界：本实现的状态在**单个 Node 进程的内存**里。
 *   - 多实例部署（如 EdgeOne 的多个边缘实例）时各自计数，实际额度是 N 倍；
 *   - 进程重启即清零。
 * 它对「挡住单个学生的误刷与脚本循环」够用（这正是本项目当前的风险面），
 * 但不构成对分布式攻击的防护。真要那个量级得上 Redis 或边缘平台的限流能力，
 * 那是部署侧的决策，不该由这一层假装做到。
 *
 * 窗口是固定窗口，不是滑动窗口：实现简单、行为可预测（「这一分钟内还能几次」
 * 是学生能理解的语义）。代价是边界处可能瞬时通过接近两倍的量 —— 对
 * 「防止烧光额度」的目标而言可以接受。
 */

import { jsonError } from "@/lib/api-error";

export interface RateLimitRule {
  /** 窗口内允许的次数。 */
  limit: number;
  /** 窗口长度（毫秒）。 */
  windowMs: number;
}

/**
 * 各端点的额度。
 *
 * 取值依据：一次正常教学步骤只产生一两次调用，人手点不出 20 次/分钟 ——
 * 所以这个额度对真实学习是「用不到的天花板」，对脚本循环是有效拦截。
 * `answer-grade` 给得更宽，因为客观题走规则判分、不消耗 token。
 */
export const RATE_LIMIT_RULES = {
  // 无身份端点（`/api/chat` 至今没有鉴权，见该路由文件头），只能按客户端 IP
  // 计数。额度放宽些：拿不到转发头时所有请求会落进同一个桶。
  chat: { limit: 30, windowMs: 60_000 },
  message: { limit: 20, windowMs: 60_000 },
  explain: { limit: 20, windowMs: 60_000 },
  "generate-question": { limit: 20, windowMs: 60_000 },
  validate: { limit: 20, windowMs: 60_000 },
  answer: { limit: 20, windowMs: 60_000 },
  "answer-grade": { limit: 40, windowMs: 60_000 },
  // 课程审计评估代理（/api/audit/evaluate，本地审计工具用）。
  audit: { limit: 20, windowMs: 60_000 },
  // 触发课程审计（/api/audit 的 POST）。额度刻意压得比 audit 低：
  // 一次审计要扫全 wiki + 全部讲稿缓存，是重活，不是轻量查询。
  "curriculum-audit": { limit: 5, windowMs: 120_000 },
  // 认证端点：按客户端 IP 计数，防口令爆破。登录 10 次/分钟对真人够宽，
  // 对脚本字典攻击足够慢；注册更紧（20 次/小时），挡住批量造号。
  "auth-login": { limit: 10, windowMs: 60_000 },
  "auth-register": { limit: 20, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof RATE_LIMIT_RULES;

export interface RateLimitDecision {
  allowed: boolean;
  /** 本窗口内还剩几次。 */
  remaining: number;
  /** 被拦下时还需等待的毫秒数；放行时为 0。 */
  retryAfterMs: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

/** 计数窗口。键是 `学生:端点`。 */
const windows = new Map<string, WindowState>();

/** 超过这个规模才顺带清理过期项，避免每次请求都遍历整张表。 */
const SWEEP_THRESHOLD = 500;

/** 清掉已过期的窗口，防止 Map 随「学生数 × 端点数」无限增长。 */
function sweep(now: number): void {
  for (const [key, state] of windows) {
    if (state.resetAt <= now) windows.delete(key);
  }
}

/**
 * 记一次请求并给出结论。纯状态操作、无 IO —— 可以直接断言（见 security-spec）。
 *
 * `now` 可注入是为了让「窗口过期」这件事能在测试里被确定地验证，
 * 而不必真的 sleep。
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitDecision {
  if (windows.size > SWEEP_THRESHOLD) sweep(now);

  const state = windows.get(key);

  if (state === undefined || state.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterMs: 0 };
  }

  if (state.count >= rule.limit) {
    return { allowed: false, remaining: 0, retryAfterMs: state.resetAt - now };
  }

  state.count += 1;
  return {
    allowed: true,
    remaining: rule.limit - state.count,
    retryAfterMs: 0,
  };
}

/**
 * 端点侧的一行接入：超限时返回可直接 `return` 的 429 响应，否则返回 `null`。
 *
 * 用 `429 RATE_LIMIT` 而不是自造错误码 —— 它在 `api-spec.md`「六、错误码」表里，
 * 且 `recoverable: true`（前端据此显示「稍后重试」而不是「出错了」）。
 *
 * 另外补一个 `Retry-After` 头。`jsonError` 管不到它，但这是 429 的标准语义：
 * 有了它，**任何**客户端（不只是我们自己的前端）都知道该等多久，
 * 而不是靠解析中文提示语。
 */
export function enforceRateLimit(
  studentId: string,
  scope: RateLimitScope,
): Response | null {
  const rule = RATE_LIMIT_RULES[scope];
  const decision = checkRateLimit(`${studentId}:${scope}`, rule);

  if (decision.allowed) return null;

  const seconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  const response = jsonError(
    "RATE_LIMIT",
    `请求过于频繁：${scope} 每分钟最多 ${rule.limit} 次。请 ${seconds} 秒后再试。`,
  );
  response.headers.set("Retry-After", String(seconds));
  return response;
}

/** 清空所有窗口。仅供测试使用 —— 生产代码不应调用。 */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * 无身份端点的限流键：取转发头里的客户端 IP，取不到就归入同一个桶。
 *
 * 「归入同一个桶」是刻意的降级：宁可让少数缺转发头的请求彼此影响，也不要因为
 * 取不到 IP 就**完全不限流** —— 那等于给脚本留了一条免检通道。
 */
export function clientKeyFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded.trim() !== "") {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown-client";
}
