"use client";

/**
 * 学情指纹卡（报告页底部）
 *
 * 报告的全部数字由服务端规范化后算一个 SHA-256 指纹（算法见
 * `src/lib/credential.ts`）。「校验」= 请求再算一遍，比对两个值是否一致：
 * 一致说明自这张卡生成以来，这条学情记录没有任何一处变化。
 *
 * 措辞边界：这是完整性自检，不是对外公示的证明 —— 所以文案写「发现不一致」，
 * 不写「不可篡改」。
 */

import * as React from "react";
import { Copy, Fingerprint, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/client-api";
import type { ReportCredential, ReportResponse } from "@/schemas";

type VerifyState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "match" }
  | { status: "mismatch" }
  | { status: "error"; message: string };

export function CredentialCard({ credential }: { credential: ReportCredential }) {
  const [state, setState] = React.useState<VerifyState>({ status: "idle" });
  const [copied, setCopied] = React.useState(false);

  const verify = React.useCallback(async (): Promise<void> => {
    setState({ status: "checking" });
    try {
      const fresh = await apiGet<ReportResponse>(
        `/api/report?verify=${credential.fingerprint}`,
      );
      setState({
        status: fresh.credential.verified === true ? "match" : "mismatch",
      });
    } catch (cause) {
      setState({
        status: "error",
        message: cause instanceof Error ? cause.message : "网络异常，请重试。",
      });
    }
  }, [credential.fingerprint]);

  const copy = React.useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(credential.fingerprint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 非安全上下文里剪贴板可能不可用：不提示「已复制」，也不弹错误。
      setCopied(false);
    }
  }, [credential.fingerprint]);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <Fingerprint className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium">学情指纹</h2>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        上面这些数字由服务端规范化后算出一个 SHA-256 指纹。任何一处记录变化，
        指纹都会跟着变；「校验」就是再算一遍、比对是否还是同一个。
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
          {credential.shortHash}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copy()}
          disabled={copied}
        >
          <Copy className="size-3.5" />
          {copied ? "已复制" : "复制完整指纹"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void verify()}
          disabled={state.status === "checking"}
        >
          校验
        </Button>
      </div>

      <p className="mt-2 font-mono text-[11px] leading-relaxed break-all text-muted-foreground">
        {credential.fingerprint}
      </p>

      {state.status === "checking" ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          重新计算中…
        </p>
      ) : null}

      {state.status === "match" ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-3.5" aria-hidden />
          一致：这条学情记录自生成以来没有变化。
        </p>
      ) : null}

      {state.status === "mismatch" ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <ShieldAlert className="size-3.5" aria-hidden />
          不一致：记录已经变了，指纹随之更新。刷新页面可以看到新的指纹。
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-3 text-xs text-muted-foreground" role="alert">
          这次没校验成：{state.message}
        </p>
      ) : null}
    </section>
  );
}
