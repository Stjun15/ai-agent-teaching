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
 * - 缺少 `DASHSCOPE_API_KEY` **不**影响状态码，只体现在 body 的 `status: "degraded"`。
 *   理由：密钥是调用期才需要的，进程与静态资源仍可正常服务；把它算作不可用会导致
 *   一个还没配密钥的部署永远健康检查失败。
 *
 * 脱敏
 * ----
 * 只回禀密钥「是否已配置」这一个布尔值，绝不回显密钥内容；数据库只回文件名
 * （basename），不回显本机绝对路径。
 *
 * ⚠️ 为什么 import `@/lib/agent/ark-config` 而不是 `@/lib/agent/ark`
 * -----------------------------------------------------------------
 * `ark.ts` 为注册 provider 必须 import pi-coding-agent SDK。若本路由从那里取
 * `readArkSettings`，构建产物会把整个 SDK 一起追踪进来。`ark-config.ts`
 * 是纯逻辑、不 import SDK，故本路由只依赖它。
 */

import { checkDatabaseHealth, EXPECTED_BUSINESS_TABLES } from "@/lib/db";
import {
  ARK_API_KEY_ENV,
  isArkApiKeyConfigured,
  readArkSettings,
} from "@/lib/agent/ark-config";
import { maintain } from "@/wiki";

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

interface WikiHealth {
  ok: boolean;
  /** 总页面数 */
  pageCount: number;
  /** 死链数 */
  deadLinks: number;
  /** 孤立页数 */
  orphans: number;
  /** Schema 校验问题数 */
  schemaIssues: number;
  /** 可被自动修复的 index.md 状态列差值 */
  indexAutoFixed: number;
}

async function checkWikiHealth(): Promise<WikiHealth> {
  try {
    // maintain 现在是 async（wiki/maintain.ts 的签名演进），这里 await 铺平。（返回 Promise）：health 是诊断端点，
    // 用同步等待把报告铺平（Route Handler 本身就是 async 语境，此处
    // 作为独立函数保持同步签名，调用端再 await）。
    const report = await maintain();
    // WikiIssue 的判别字段是 kind（不是 category——那是对旧结构的记忆）。
    const issues = report.issues;
    const deadLinks = issues.filter((i) => i.kind === "dead-link").length;
    const orphans = issues.filter((i) => i.kind === "orphan-page").length;
    const schemaIssues = issues.filter(
      (i) =>
        i.kind === "missing-frontmatter" ||
        i.kind === "missing-required-field" ||
        i.kind === "unknown-page-type",
    ).length;

    return {
      ok: deadLinks === 0 && schemaIssues === 0,
      pageCount: report.checked,
      deadLinks,
      orphans,
      schemaIssues,
      indexAutoFixed: report.fixed.length,
    };
  } catch {
    return {
      ok: false,
      pageCount: 0,
      deadLinks: -1,
      orphans: -1,
      schemaIssues: -1,
      indexAutoFixed: 0,
    };
  }
}

function checkConfig(): ConfigHealth {
  const { baseUrl, textModel, visionModel } = readArkSettings();
  const arkApiKeyConfigured = isArkApiKeyConfigured();

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

export async function GET(): Promise<Response> {
  const database = checkDatabaseHealth();
  const config = checkConfig();
  const wiki = await checkWikiHealth();

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
      wiki,
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
