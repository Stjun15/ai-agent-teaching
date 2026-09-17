/**
 * GET /api/health —— 健康检查
 *
 * 依据
 * ----
 * - `06-execution-plan.md` Phase 1 验收标准：`/api/health` 返回 200；
 *   提交点 `feat(api): add health check endpoint`。
 * - `references/api-spec.md`「十一、部署检查清单」：健康检查接口 `/api/health`，
 *   并要求「所有 API 密钥走环境变量」「日志脱敏（不含密钥、用户隐私）」。
 *
 * 检查什么、不检查什么
 * -------------------
 * 检查：进程存活、数据库可用（表数量与迁移记录）、模型配置是否齐备。
 * **不调用模型接口**：一次健康探测不该产生 token 费用，也不该把外部依赖的
 * 抖动变成自家健康状态的抖动。模型可用性由真实调用暴露（见 loop.ts 的 error 事件）。
 *
 * 状态码怎么定（文档未规定失败行为，此处是设计决定）
 * -----------------------------------------------
 * - `200`：数据库可用。数据库是本应用的硬依赖（所有功能都要读它），
 *   它坏了整个应用就是不可用。这也是 Phase 1 要求的「返回 200」。
 * - `503`：数据库不可用。
 * - 缺少 `ARK_API_KEY` **不**影响状态码，只体现在 body 的 `status: "degraded"`。
 *   理由：密钥是调用期才需要的，进程与静态资源仍可正常服务；把它算作不可用会导致
 *   一个还没配密钥的部署永远健康检查失败。
 *
 * 脱敏
 * ----
 * 只回禀密钥「是否已配置」这一个布尔值，绝不回显密钥内容；数据库只回文件名
 * （basename），不回显本机绝对路径。
 */

import { checkDatabaseHealth, EXPECTED_BUSINESS_TABLES } from "@/lib/db";
import { ARK_API_KEY_ENV, readArkSettings } from "@/lib/agent/ark";

// node:sqlite 是 Node 专有模块，不能跑在 Edge Runtime。
export const runtime = "nodejs";

// 健康检查必须每次真实执行，不能被静态化或缓存。
export const dynamic = "force-dynamic";

interface ConfigHealth {
  ok: boolean;
  /** 只报告「配没配」，不报告内容 */
  arkApiKeyConfigured: boolean;
  /** 缺哪个环境变量时给出可操作提示 */
  hint?: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
}

function checkConfig(): ConfigHealth {
  const { baseUrl, textModel, visionModel } = readArkSettings();
  const arkApiKeyConfigured = Boolean(process.env[ARK_API_KEY_ENV]?.trim());

  return {
    ok: arkApiKeyConfigured,
    arkApiKeyConfigured,
    hint: arkApiKeyConfigured
      ? undefined
      : `缺少环境变量 ${ARK_API_KEY_ENV}，涉及模型的接口会失败。请在 .env.local（已被 .gitignore 排除）或系统环境变量中设置。`,
    baseUrl,
    textModel,
    visionModel,
  };
}

export function GET(): Response {
  const database = checkDatabaseHealth();
  const config = checkConfig();

  const body = {
    status: database.ok && config.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    checks: {
      database: {
        ...database,
        expectedBusinessTables: EXPECTED_BUSINESS_TABLES,
      },
      config,
    },
  };

  return Response.json(body, {
    status: database.ok ? 200 : 503,
    headers: {
      // 健康检查结果不该被任何中间层缓存
      "Cache-Control": "no-store",
    },
  });
}
