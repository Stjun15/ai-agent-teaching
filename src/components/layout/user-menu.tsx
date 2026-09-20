"use client";

/**
 * 顶栏右上角「个人信息」菜单（演示级）
 *
 * 读 `sso.currentUser`（`local-users.ts`）决定显示什么：
 *   有当前用户 → 下拉菜单（用户名 / 修改密码 / 切换用户 / 退出登录）；
 *   没有（种子/访客）→ 只给一个「登录」入口，跳 `/auth`。
 *
 * 与登录一样是**前端演示级**：账号在 `localStorage`，修改密码只做
 * `hashPassword` 摘要替换，不是真实安全方案。改动密码的弹窗与账号节点上
 * 都如实标注「演示级」，绝不把它描述成安全功能。
 *
 * SSR/hydration 安全
 * -----------------
 * `useSyncExternalStore` 读取当前会话（见下方 hook）：首帧服务端与客户端
 * 快照一致（均 null 或读不到 storage），从根上避免 effect+setState 的
 * `react-hooks/set-state-in-effect` 拦截与首帧 hydration 不一致。
 */
import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Repeat,
  User as UserIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearStudentId } from "@/lib/client-identity";
import {
  CURRENT_USER_STORAGE_KEY,
  changePassword,
  clearCurrentUser,
  getCurrentUser,
  type CurrentUser,
  type LocalUsersStorage,
} from "@/lib/local-users";
import { cn } from "@/lib/utils";

/** `localStorage` 同时满足账号与会话两种读写的形状（含删除）。不可用时返回 null。 */
function browserStorage(): LocalUsersStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// -- 用 useSyncExternalStore 读当前会话 -------------------------------
// 外部存储（localStorage）的正确 React 接入点是 useSyncExternalStore，
// 而不是 useEffect+setState（后者会被 react-hooks/set-state-in-effect 标记，
// 且依赖 then 调度容易在首帧误读）。getSnapshot 用缓存保持对象引用稳定，
// 避免「快照每次都是新引用」导致 React 无限重渲染。
let _cuCache: { raw: string | null; val: CurrentUser | null } | null = null;
function currentUserSnapshot(): CurrentUser | null {
  const storage = browserStorage();
  const raw = storage?.getItem(CURRENT_USER_STORAGE_KEY) ?? null;
  if (_cuCache !== null && _cuCache.raw === raw) return _cuCache.val;
  const val = getCurrentUser(storage);
  _cuCache = { raw, val };
  return val;
}
function subscribeCurrentUser(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  // 同一标签页里登录/退出会写 localStorage，但不会触发 storage 事件。
  // 用自定义事件补上，登出/切换后本组件能即时反映最新会话。
  window.addEventListener("sso:current-user", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("sso:current-user", onChange);
  };
}
/** 派发「当前用户已变化」，供顶栏菜单即时刷新。 */
export function notifyCurrentUserChanged(): void {
  window.dispatchEvent(new Event("sso:current-user"));
}

const inputClass = cn(
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring",
);

interface Props {
  className?: string;
}

export function UserMenu({ className }: Props) {
  const router = useRouter();

  // null = 未登录（种子/访客）；其余 = 当前用户。外部存储由
  // useSyncExternalStore 接管，登录/退出在任意标签页写 storage 都会即时反映。
  const user = useSyncExternalStore(
    subscribeCurrentUser,
    currentUserSnapshot,
    () => null,
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pwOpen, setPwOpen] = React.useState(false);
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // 点菜单外任意处关闭。
  React.useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown() {
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  function openChangePassword() {
    setPwError(null);
    setPwSuccess(false);
    setOldPassword("");
    setNewPassword("");
    setConfirm("");
    setPwOpen(true);
    setMenuOpen(false);
  }

  function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (newPassword !== confirm) {
      setPwError("两次输入的新密码不一致。");
      return;
    }
    setBusy(true);
    try {
      const result = changePassword(browserStorage(), {
        id: user.id,
        oldPassword,
        newPassword,
      });
      if (result.ok) {
        setPwSuccess(true);
        setPwOpen(false);
      } else {
        setPwError(result.message);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    clearStudentId(browserStorage());
    clearCurrentUser(browserStorage());
    notifyCurrentUserChanged();
    setMenuOpen(false);
    router.push("/");
  }

  const menuItem =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/60";

  // 未登录：只给登录入口。
  if (user === null) {
    return (
      <Link
        href="/auth"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
          className,
        )}
      >
        <UserIcon className="size-4" aria-hidden />
        登录
      </Link>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px]">
          {(user.preferredName ?? user.username).slice(0, 1)}
        </span>
        <span className="max-w-[8rem] truncate">
          {user.preferredName ?? user.username}
        </span>
        <ChevronDown className="size-3.5" aria-hidden />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-full right-0 z-50 mt-1 w-52 rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-md"
        >
          {pwSuccess ? (
            <p className="px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              密码已更新（演示级，仅本机生效）。
            </p>
          ) : null}

          <div className="flex flex-col border-b px-2.5 py-1.5">
            <span className="truncate text-sm font-medium">
              {user.preferredName ?? user.username}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.username}
            </span>
            <span className="mt-1">
              <Badge variant="muted">演示账号</Badge>
            </span>
          </div>

          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={openChangePassword}
              className={menuItem}
            >
              <KeyRound className="size-4" aria-hidden />
              修改密码
            </button>
            <Link
              href="/auth"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={menuItem}
            >
              <Repeat className="size-4" aria-hidden />
              切换用户
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className={cn(
                menuItem,
                "text-destructive hover:text-destructive",
              )}
            >
              <LogOut className="size-4" aria-hidden />
              退出登录
            </button>
          </div>

          <p className="border-t px-2.5 pt-1.5 text-[10px] text-muted-foreground">
            演示级身份：账号仅存本机 localStorage，非真实鉴权。
          </p>
        </div>
      ) : null}

      {/* 修改密码弹窗 */}
      {pwOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="修改密码"
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg">
            <h2 className="text-sm font-semibold">修改密码</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              演示级操作：仅在本机 localStorage 内改动密码摘要，非真实安全方案。
            </p>

            <form
              onSubmit={handleChangePassword}
              className="mt-4 flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="pw-old" className="text-xs font-medium">
                  旧密码
                </label>
                <input
                  id="pw-old"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="旧密码"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="pw-new" className="text-xs font-medium">
                  新密码
                </label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码（至少 6 个字符）"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="pw-confirm" className="text-xs font-medium">
                  确认新密码
                </label>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再次输入新密码"
                  className={inputClass}
                />
              </div>

              {pwError ? (
                <p role="alert" className="text-xs text-destructive">
                  {pwError}
                </p>
              ) : null}

              <div className="mt-1 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPwOpen(false)}
                  disabled={busy}
                >
                  取消
                </Button>
                <Button type="submit" disabled={busy}>
                  确认修改
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
