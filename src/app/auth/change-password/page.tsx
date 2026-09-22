"use client";

/**
 * 修改密码（演示级独立页面）
 *
 * 挂在 `/auth/change-password`。与 `auth/page.tsx` 同一套「前端演示级」约束：
 * 账号只存本机 `localStorage`，改密仅做 `hashPassword` 摘要替换，页面上常驻
 * 「演示级、非真实安全」诚实标注 —— 绝不把它描述成安全方案。
 *
 * 当前身份 id 从 `currentStudentId()`（`client-identity.ts`）取 —— 它就是登录/
 * 注册写进 `student-id` 存储的那个学生 UUID（`currentStudentId()` 恒有值，没登录
 * 时退回种子 id）。但改密必须真的有「当前登录的用户」：若 `getCurrentUser` 读
 * 不到（种子/访客），就提示先回登录页，不假装能改 —— `getCurrentUser` 才是
 * 「当前是否登录」的判据，而 `currentStudentId` 只负责给出该身份 id。
 *
 * 为什么 currentUser 在 effect 回调里读、不在渲染期读
 * ---------------------------------------------------
 * 与 `auth/page.tsx` 同款：渲染期读 localStorage 会让服务端首帧与客户端不一致，
 * 触发 hydration 报错；放进 effect 里用异步回调读，则首帧两边都一致
 * （`react-hooks/set-state-in-effect` 也要求 setState 走异步回调）。
 */
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currentStudentId } from "@/lib/client-identity";
import {
  changePassword,
  getCurrentUser,
  type CurrentUser,
  type LocalUsersStorage,
} from "@/lib/local-users";
import { cn } from "@/lib/utils";

/** `localStorage` 满足改密用到的读写形状。不可用时返回 null。 */
function browserStorage(): LocalUsersStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 演示级输入框共享外观（与 `auth/page.tsx` 的 `inputClass` 一致）。 */
const inputClass = cn(
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring",
);

export default function ChangePasswordPage() {
  // undefined = 首帧读取中；null = 未登录（种子/访客）；其余 = 当前用户。
  const [currentUser, setCurrentUser] = React.useState<
    CurrentUser | null | undefined
  >(undefined);

  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) setCurrentUser(getCurrentUser(browserStorage()));
    });
    return () => {
      alive = false;
    };
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (currentUser === null || currentUser === undefined) return;
    setError(null);
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致。");
      return;
    }
    setBusy(true);
    try {
      const result = changePassword(browserStorage(), {
        id: currentStudentId(),
        oldPassword,
        newPassword,
      });
      if (result.ok) {
        setSuccess(true);
        setOldPassword("");
        setNewPassword("");
        setConfirm("");
      } else {
        setError(result.message);
      }
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
            <CardDescription>
              操作只对当前登录的本地账号生效，不会影响内置评审账号（test /
              eval）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentUser === undefined ? (
              <p className="text-sm text-muted-foreground">读取中…</p>
            ) : currentUser === null ? (
              /* 没有当前登录用户：不假装能改，引导先登录 */
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  当前还没有登录用户，暂时无法修改密码。请先登录一个本地账号
                  （例如注册新账号，或用内置评审账号 <code>test</code> /{" "}
                  <code>eval</code>）。
                </p>
                <Button asChild className="self-start">
                  <Link href="/auth">前往登录</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {success ? (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                    密码已更新（演示级，仅本机生效）。
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
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
