/**
 * POST /api/teacher/simulate —— 发起一次「模拟学生上课」
 *
 * 为什么是 202 + 后台执行，而不是把整个模拟跑完再返回
 * -------------------------------------------------
 * 一次运行最多 4 轮 × 2 次模型调用，最坏要几十秒。同步接口会先撞上反向代理/
 * 浏览器的超时，再让教师看到「失败了但不知道失败在哪」。所以这里只做三件快事
 * （鉴权 → 预算判定 → 落一条 `running` 记录），把执行放进进程内后台任务，
 * 控制台轮询 `/api/teacher/simulations` 看进展。
 *
 * ⚠️ 已知边界：后台任务是**进程内**的。服务重启会中断正在跑的模拟，记录会停在
 * `running`（控制台按 `startedAt` 显示「疑似中断」）。没有外部队列是本项目的
 * 部署形态决定的 —— 不为它伪造一个「恢复」能力。
 *
 * 身份与额度
 * ---------
 * - 只有 `role='teacher'` 能进（`requireTeacher`，403 FORBIDDEN）；
 * - 两道额度：内存窗口挡瞬时连点（`rate-limit.ts` 的 `simulation`），
 *   数据库计数挡 24 小时总量（`checkRunBudget`）。前者重启即失效，后者不会。
 */

import { requireTeacher } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { executeSimulation, SIMULATED_SCOPE_NOTE } from "@/lib/agent/student/simulator";
import { checkRunBudget, SIMULATION_LIMITS } from "@/lib/agent/student/limits";
import { findPersona } from "@/lib/agent/student/personas";
import { simulationDb } from "@/lib/db";
import type { SimulationRun } from "@/lib/db/types";
import { findModule } from "@/lib/modules";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { SimulateRequestSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 每日额度的窗口：滚动 24 小时（不是自然日 —— 跨零点不清零，行为更可预期）。 */
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 把 Zod 的 issue 列表压成一行可读文本。 */
function describeIssues(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireTeacher(req);
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(auth.student.id, "simulation");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("INVALID_INPUT", "请求体不是合法 JSON。");
  }

  const parsed = SimulateRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "INVALID_INPUT",
      `请求体不符合 SimulateRequestSchema：${describeIssues(parsed.error)}`,
    );
  }

  const persona = findPersona(parsed.data.persona);
  if (!persona) {
    return jsonError(
      "INVALID_INPUT",
      `未知学生人设：${parsed.data.persona}。可用人设见教师控制台的下拉框。`,
    );
  }

  const moduleMeta = await findModule(parsed.data.moduleId);
  if (!moduleMeta) {
    return jsonError("NOT_FOUND", `模块 ${parsed.data.moduleId} 不存在。`);
  }

  const runsToday = await simulationDb.countByTeacherSince(
    auth.student.id,
    new Date(Date.now() - DAILY_WINDOW_MS).toISOString(),
  );
  const budget = checkRunBudget({ runsToday, requestedTurns: parsed.data.maxTurns });
  if (!budget.allowed) {
    return jsonError("RATE_LIMIT", budget.message);
  }

  const run: SimulationRun = {
    id: crypto.randomUUID(),
    teacherId: auth.student.id,
    moduleId: moduleMeta.id,
    step: parsed.data.step,
    persona: persona.id,
    status: "running",
    maxTurns: budget.maxTurns,
    turnsUsed: 0,
    tokensInput: 0,
    tokensOutput: 0,
    durationMs: 0,
    stopReason: null,
    error: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  await simulationDb.create(run);

  // 后台跑，不等它。catch 兜的是「落库失败」这类 executeSimulation 自己
  // 没法收尾的异常 —— 如果不补这一手，记录会永远停在 running 且没有错误原因。
  void executeSimulation(run).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await simulationDb.finish(run.id, {
        status: "failed",
        turnsUsed: 0,
        tokensInput: 0,
        tokensOutput: 0,
        durationMs: Date.now() - Date.parse(run.startedAt),
        stopReason: null,
        error: `运行异常：${message}`,
      });
    } catch {
      // 连收尾都写不进去（数据库不可用）：只能打日志，不吞掉原始错误。
      console.error("[teacher/simulate] 收尾写入失败，run=", run.id, message);
    }
  });

  return Response.json(
    {
      run,
      scopeNote: SIMULATED_SCOPE_NOTE,
      limits: SIMULATION_LIMITS,
      remainingRunsToday: Math.max(
        0,
        SIMULATION_LIMITS.maxTeacherRunsPerDay - runsToday - 1,
      ),
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
