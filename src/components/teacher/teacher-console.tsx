"use client";

import * as React from "react";
import { Loader2, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, apiGet, apiPost } from "@/lib/client-api";
import type {
  SimulationRun,
  SimulationStopReason,
  SimulationTurn,
} from "@/lib/db/types";

/** 有运行在跑时的轮询间隔。一次运行最多 8 次模型调用，2 秒粒度足够看出进展。 */
const POLL_MS = 2000;

/**
 * 「疑似中断」阈值。
 *
 * 后台任务是进程内的（见 `/api/teacher/simulate` 的文件头）：服务重启会让记录
 * 永远停在 `running`。控制台不替它改状态（那是假数据），只在超时后提示一句
 * —— 教师点开就能看出这条是残留，而不是还在跑。
 */
const STALE_MS = 10 * 60 * 1000;

export interface TeacherConsoleProps {
  modules: readonly { id: string; name: string }[];
  personas: readonly { id: string; label: string; summary: string }[];
  steps: readonly { id: string; label: string }[];
}

interface DetailPayload {
  run: SimulationRun;
  turns: SimulationTurn[];
  scopeNote: string;
  /**
   * 取回这份明细的时间（毫秒）。由 `loadDetail` 在请求返回后写入，
   * 不在渲染期调 `Date.now()` —— 渲染必须是纯的（`react-hooks/purity`）；
   * 「这条运行是不是残留」的判定也就不随无关重渲染漂移。
   */
  receivedAt: number;
}

const STATUS_TEXT: Record<SimulationRun["status"], string> = {
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  aborted: "已取消",
};

const STATUS_VARIANT: Record<
  SimulationRun["status"],
  "secondary" | "levelLow" | "levelHigh" | "muted"
> = {
  running: "secondary",
  completed: "levelLow",
  failed: "levelHigh",
  aborted: "muted",
};

const STOP_REASON_TEXT: Record<SimulationStopReason, string> = {
  "max-turns": "跑满轮次",
  "student-gave-up": "学生主动放弃",
  "token-budget": "触发成本上限",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

/** 把异常压成一句可读文案；403 单独给一句「换账号」。 */
function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "当前账号不是教师账号。请用教师账号登录（种子脚本 teacher）。";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function TeacherConsole({ modules, personas, steps }: TeacherConsoleProps) {
  const [runs, setRuns] = React.useState<SimulationRun[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<DetailPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const [form, setForm] = React.useState({
    moduleId: modules[0]?.id ?? "",
    step: steps[0]?.id ?? "explain",
    persona: personas[0]?.id ?? "",
    maxTurns: 2,
  });

  const activePersona = personas.find((item) => item.id === form.persona);
  const hasRunning = runs.some((run) => run.status === "running");
  // 只取布尔量进 effect 依赖：依赖整个 `detail` 对象会让每次轮询都重建定时器。
  const selectedRunning = detail?.run.status === "running";

  const loadRuns = React.useCallback(async (signal?: AbortSignal) => {
    const data = await apiGet<{ runs: SimulationRun[] }>(
      "/api/teacher/simulations?limit=20",
      signal,
    );
    setRuns(data.runs);
  }, []);

  const loadDetail = React.useCallback(async (runId: string, signal?: AbortSignal) => {
    const data = await apiGet<Omit<DetailPayload, "receivedAt">>(
      `/api/teacher/simulations/${encodeURIComponent(runId)}`,
      signal,
    );
    setDetail({ ...data, receivedAt: Date.now() });
  }, []);

  // 首屏取列表。abort 是为了离开页面时不再挂着一个请求。
  // 一次性订阅远程数据，不产生级联渲染 —— 本仓库同类写法的先例见
  // module-workspace.tsx 的三栏宽度初始化。
  React.useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRuns(controller.signal)
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [loadRuns]);

  // 有运行在跑（或被选中那条还在跑）时轮询。
  React.useEffect(() => {
    if (!hasRunning && !selectedRunning) {
      return;
    }
    const controller = new AbortController();
    const timer = setInterval(() => {
      loadRuns(controller.signal).catch(() => {
        // 轮询失败不打断界面：下一拍会重试，错误由手动操作路径显示。
      });
      if (selectedId !== null) {
        loadDetail(selectedId, controller.signal).catch(() => {});
      }
    }, POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [hasRunning, selectedRunning, selectedId, loadRuns, loadDetail]);

  async function handleSelect(runId: string): Promise<void> {
    setSelectedId(runId);
    setDetail(null);
    try {
      await loadDetail(runId);
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function handleStart(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiPost<{
        run: SimulationRun;
        remainingRunsToday: number;
      }>("/api/teacher/simulate", form);
      setNotice(
        `已启动运行 ${data.run.id.slice(0, 8)}…（今日剩余 ${data.remainingRunsToday} 次额度）`,
      );
      await loadRuns();
      await handleSelect(data.run.id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setStarting(false);
    }
  }

  if (modules.length === 0 || personas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>控制台暂不可用</CardTitle>
          <CardDescription>
            没有读到可模拟的模块或学生人设。请先执行 `pnpm wiki:seed` 生成知识库，再刷新本页。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>发起一次模拟</CardTitle>
            <CardDescription>
              模拟学生会读「屏幕上的内容」并提问，导师按当前步骤的教学口径回答。
              成本只按轮次与 token 计量，不折算金额。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleStart}>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">教学模块</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={form.moduleId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, moduleId: event.target.value }))
                  }
                >
                  {modules.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}（{item.id}）
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">学习步骤</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={form.step}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, step: event.target.value }))
                  }
                >
                  {steps.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">学生人设</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={form.persona}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, persona: event.target.value }))
                  }
                >
                  {personas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {activePersona ? (
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {activePersona.summary}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">最多几轮</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={form.maxTurns}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      maxTurns: Number(event.target.value),
                    }))
                  }
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} 轮
                    </option>
                  ))}
                </select>
              </label>

              <Button type="submit" disabled={starting}>
                {starting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                启动模拟
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                边界：每次最多 4 轮、单次 20000 token、每日 10 次。
                超出时运行会明确停止并写明原因，不会静默截断。
              </p>
            </form>

            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-4 rounded-md border bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {notice}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近运行</CardTitle>
            <CardDescription>只显示当前教师发起的运行，按开始时间倒序。</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">读取中…</p>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有运行记录。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelect(run.id)}
                      className={`flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent ${
                        selectedId === run.id ? "bg-accent" : "bg-background"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Badge variant={STATUS_VARIANT[run.status]}>
                          {STATUS_TEXT[run.status]}
                        </Badge>
                        <span className="font-medium">{run.moduleId}</span>
                        <span className="text-muted-foreground">{run.step}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(run.startedAt)} · {run.turnsUsed}/{run.maxTurns} 轮 ·{" "}
                        {(run.tokensInput + run.tokensOutput).toLocaleString()} token
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        {detail === null ? (
          <Card>
            <CardHeader>
              <CardTitle>运行详情</CardTitle>
              <CardDescription>
                选择左侧一条运行查看逐轮对话、学生这一轮「看到的屏幕」，以及 token 用量。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <RunDetail detail={detail} />
        )}
      </div>
    </div>
  );
}

function RunDetail({ detail }: { detail: DetailPayload }) {
  const { run, turns, scopeNote, receivedAt } = detail;
  const stale =
    run.status === "running" && receivedAt - Date.parse(run.startedAt) > STALE_MS;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>
              {run.moduleId} · {run.step} · {run.persona}
            </CardTitle>
            <Badge variant={STATUS_VARIANT[run.status]}>
              {STATUS_TEXT[run.status]}
            </Badge>
            {run.stopReason ? (
              <Badge variant="outline">{STOP_REASON_TEXT[run.stopReason]}</Badge>
            ) : null}
          </div>
          <CardDescription>
            {formatTime(run.startedAt)}
            {run.endedAt ? ` → ${formatTime(run.endedAt)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">轮次</dt>
              <dd className="font-medium">
                {run.turnsUsed} / {run.maxTurns}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">输入 token</dt>
              <dd className="font-medium">{run.tokensInput.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">输出 token</dt>
              <dd className="font-medium">{run.tokensOutput.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">耗时</dt>
              <dd className="font-medium">
                {run.durationMs > 0 ? `${(run.durationMs / 1000).toFixed(1)} 秒` : "—"}
              </dd>
            </div>
          </dl>

          {run.error ? (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
              {run.error}
            </p>
          ) : null}

          {stale ? (
            <p className="mt-4 rounded-md border bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              这条运行已超过 10 分钟仍是「运行中」。后台任务在服务进程内执行，
              服务重启会中断它 —— 这条记录可能是残留，不会自行恢复。
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{scopeNote}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>逐轮对话</CardTitle>
          <CardDescription>
            每轮两条：模拟学生说的话，与导师按当前步骤口径给出的回答。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {turns.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有产生对话。</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {turns.map((turn) => (
                <li key={turn.id} className="rounded-md border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={turn.speaker === "student" ? "secondary" : "outline"}>
                      {turn.speaker === "student" ? "模拟学生" : "导师"}
                    </Badge>
                    <span>第 {turn.turnIndex} 轮</span>
                    {turn.cognitiveState ? <span>认知状态：{turn.cognitiveState}</span> : null}
                    {turn.actionType === "unparsed" ? (
                      <span className="text-destructive">输出不符合契约（原文已保留）</span>
                    ) : null}
                    <span>
                      {turn.tokensInput + turn.tokensOutput} token ·{" "}
                      {(turn.durationMs / 1000).toFixed(1)} 秒
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {turn.content}
                  </p>
                  {turn.screenDigest ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        查看这一轮「看到的屏幕」
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap">
                        {turn.screenDigest}
                      </pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}
