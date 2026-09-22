"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currentAuthToken, AUTH_TOKEN_HEADER } from "@/lib/client-identity";
import { cn } from "@/lib/utils";

const inputClass = cn(
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring",
);

export default function ChangePasswordPage() {
  const router = useRouter();

  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!currentAuthToken()) router.replace("/auth");
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致。");
      return;
    }
    setBusy(true);

    const token = currentAuthToken();
    if (!token) {
      setError("登录已过期，请重新登录。");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_TOKEN_HEADER]: token,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };

      if (res.ok && payload.ok) {
        setSuccess(true);
        setOldPassword("");
        setNewPassword("");
        setConfirm("");
      } else {
        setError(payload.error?.message ?? "修改失败，请稍后重试。");
      }
    } catch {
      setError("网络错误，请检查连接后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
            <CardDescription>请输入旧密码并设置一个新的密码。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {success ? (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                  密码已更新。
                </p>
              ) : null}

              <div className="flex flex-col gap-1">
                <label htmlFor="cp-old" className="text-xs font-medium">
                  旧密码
                </label>
                <input
                  id="cp-old"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="旧密码"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cp-new" className="text-xs font-medium">
                  新密码
                </label>
                <input
                  id="cp-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码（至少 6 个字符）"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cp-confirm" className="text-xs font-medium">
                  确认新密码
                </label>
                <input
                  id="cp-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再次输入新密码"
                  className={inputClass}
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="text-xs leading-relaxed text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-1 flex justify-end gap-2">
                <Button asChild variant="outline">
                  <Link href="/">返回首页</Link>
                </Button>
                <Button type="submit" disabled={busy || success}>
                  确认修改
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
