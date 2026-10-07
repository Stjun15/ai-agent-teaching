"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/client-identity";
import { isAbortError } from "@/lib/sse";

import { AuditFindingList } from "./audit-finding-list";
import { AuditSummaryTable } from "./audit-summary-table";
import type { AuditResponse } from "./audit-types";

/**
 * 课程审计报告视图
 *
 * 这个组件回答的不是「学生学得怎么样」，而是**「我们对自己的课程做过什么
 * 质量检查、检查出了什么」**。两者别混：前者是学习报告（`/report`），
 * 这里是我们对内容本身的审计。
 *
 * 两条不能省的诚实边界（都写在界面文案里，不是藏在注释里）
 * ---------------------------------------------------
 * ① **没有发现 ≠ 没问题**。这一轮跑的是五项确定性检查（任务节可达性 /
 *    示范代码可读性 / 术语断层 / 内容一致性等）。「讲稿讲得好不好」是判断题，
 *    确定性检查判不了。所以每讲显示「本轮未发现结构缺陷」，不写「质量优秀」。
 * ② **分数为 null 显示「未检测」，不显示 0**。认知负荷要模型判，这一轮没调
 *    模型 —— 画成 0 分就是编数据（与报告页「尚未测评 ≠ 0 分」同一条规矩）。
 *
 * 身份在浏览器里（localStorage），所以取数只能在客户端做 —— 页面本身是
 * 服务端组件，只出外壳。
 *
 * 拆成四个文件不是为了好看，是为了让两条边界各有唯一的守护点：
 * 取数与口径在 `audit-view.tsx`，分数的 null 分支在 `audit-score-cell.tsx`，
 * 表格与缺陷列表各自独立。改分数语义时只会碰一个文件。
 */

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: AuditResponse }
  | { status: "failed"; error: string };

export function AuditView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // 「读取失败」与「审计失败」是两件事（前者是进页面就失败，后者是点按钮
  // 失败），分开存才不会在审计失败时把已取到的数据也一起抹掉。
  const [auditError, setAuditError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  /**
   * 拉审计结果。**不在同步路径上 `setState`** ——
   * 在 effect 里同步 setState 会触发级联渲染（`react-hooks/set-state-in-effect`
   * 会拦，而且这条规则是有道理的）。所以初始状态直接就是 `loading`，
   * 状态只由 promise 的回调改写。形态与 `ReportView.run` 保持一致：
   * 用 `.then(onOk, onErr)` 而不是 `async/await` —— 后者会被规则判定为
   * 「可能在第一个 `await` 之前就 setState」，即使实际不成立。
   */
  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      fetch("/api/audit", { headers: authHeaders(), signal }).then(
        async (res) => {
          if (!res.ok) {
            setState({
              status: "failed",
              error: `读取失败（HTTP ${res.status}）`,
            });
            return;
          }
          setState({
            status: "ready",
            data: (await res.json()) as AuditResponse,
          });
        },
        (cause: unknown) => {
          // 组件卸载后 abort 触发的 AbortError 不该弹错误 —— 那是预期路径。
          if (isAbortError(cause)) return;
          setState({ status: "failed", error: "读取失败：网络错误" });
        },
      ),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        setAuditError(`审计失败（HTTP ${res.status}）`);
        return;
      }
      await load();
    } catch {
      setAuditError("审计失败：网络错误");
    } finally {
      setRunning(false);
    }
  }, [load]);

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在读取审计结果…
      </p>
    );
  }

  if (state.status === "failed") {
    return (
      <p role="alert" className="text-xs text-destructive">
        {state.error}
      </p>
    );
  }

  const { data } = state;
  const blocking = data.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  const usedModel = data.summaries.some((s) => s.usedModel);

  return (
    <div className="flex flex-col gap-8">
      {/* 口径说明 —— 这段不能删 */}
      <section className="rounded-lg border bg-muted/30 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4" />
          这一轮查了什么、没查什么
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          检查项是五类**可确定性判定**的结构缺陷：讲稿是否缺任务节（缺了任务卡
          就不渲染）、示范代码有没有面向学生的说明、任务是否要求讲稿没教过的语法、
          术语是否用了没定义、概念页承诺的机制结构在讲稿里是否缺失。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">没查到 ≠ 没问题。</span>
          「讲稿讲得好不好」「这节课吸引力如何」是判断题，不在这五项里 ——
          那部分靠开发期的人工走查（学生视角 + 独立裁判），不在这张表里。
          {usedModel ? "" : " 本轮未调用模型，全部结论来自确定性检查。"}
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => void runAudit()}
          disabled={running}
          size="sm"
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {running ? "审计中…" : "重新审计全部课程"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {data.summaries.length === 0
            ? "尚未审计过 —— 点上面的按钮跑第一次。"
            : `已审计 ${data.summaries.length} 讲，发现 ${data.findings.length} 个问题（其中阻断/严重 ${blocking.length} 个）。`}
        </p>
      </section>

      {auditError !== null ? (
        <p role="alert" className="text-xs text-destructive">
          {auditError}
        </p>
      ) : null}

      {data.summaries.length > 0 ? (
        <AuditSummaryTable summaries={data.summaries} />
      ) : null}

      {data.summaries.length === 0 && data.findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚未审计。</p>
      ) : (
        <AuditFindingList findings={data.findings} />
      )}
    </div>
  );
}
