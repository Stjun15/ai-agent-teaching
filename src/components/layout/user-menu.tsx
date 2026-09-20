"use client";

/**
 * 顶栏右上角「个人信息」菜单（演示级）
 *
 * 读 `sso.currentUser`（`local-users.ts`）决定显示什么：
 *   有当前用户 → 下拉菜单（用户名 / 修改密码 / 切换用户 / 退出登录）；
 *   没有（种子/访客）→ 只给一个「登录」入口，跳 `/auth`。
 *
 * 与登录一样是**前端演示级**：账号在 `localStorage`，修改密码只做
 * `hashPassword` 摘要替换，不是真实安全方案。修改密码与切换用户都走真实
 * 路由跳转（`/auth/change-password` 与 `/auth`），退出登录则清会话后跳
 * `/auth`；账号节点上如实标注「演示级」，绝不把它描述成安全功能。
 *
 * SSR/hydration 安全
 * -----------------
 * `useSyncExternalStore` 读取当前会话（见下方 hook）：首帧服务端与客户端
 * 快照一致（均 null 或读不到 storage），从根上避免 effect+setState 的
 * `react-hooks/set-state-in-effect` 拦截与首帧 hydration 不一致。
 */
import * as React from "react";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Repeat,
  User as UserIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { clearStudentId } from "@/lib/client-identity";
import {
  CURRENT_USER_STORAGE_KEY,
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

  // 点菜单外任意处关闭。
  React.useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown() {
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  function handleLogout() {
    clearStudentId(browserStorage());
    clearCurrentUser(browserStorage());
    notifyCurrentUserChanged();
    setMenuOpen(false);
    router.push("/auth");
  }

  const menuItem =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/60";

  // 未登录：只给登录入口。
  if (user === null) {
    return (
      <button
        type="button"
        onClick={() => router.push("/auth")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
          className,
        )}
      >
        <UserIcon className="size-4" aria-hidden />
        登录
      </button>
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
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push("/settings");
            }}
            className="flex w-full flex-col rounded-md border-b px-2.5 py-1.5 text-left hover:bg-accent/60"
          >
            <span className="truncate text-sm font-medium">
              {user.preferredName ?? user.username}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.username}
            </span>
            <span className="mt-1">
              <Badge variant="muted">个人信息</Badge>
            </span>
          </button>

          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                router.push("/auth/change-password");
              }}
              className={menuItem}
            >
              <KeyRound className="size-4" aria-hidden />
              修改密码
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                router.push("/auth");
              }}
              className={menuItem}
            >
              <Repeat className="size-4" aria-hidden />
              切换用户
            </button>
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
    </div>
  );
}
