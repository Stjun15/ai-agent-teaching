"use client";

/**
 * 顶栏右上角「个人信息」菜单
 *
 * 判别逻辑：
 *   - 有 JWT 令牌 → 视为已登录 → 显示用户名、修改密码、退出登录
 *   - 无 JWT 令牌 → 显示「登录」按钮
 *
 * 与 client-identity.ts 的 token 体系对接，不再依赖 localStorage 账号数组。
 */

import * as React from "react";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut, User as UserIcon } from "lucide-react";

import {
  clearAuthToken as clearToken,
  clearStudentId,
  currentAuthToken as getToken,
} from "@/lib/client-identity";
import { useSessionStore } from "@/stores/session";
import { cn } from "@/lib/utils";

const USERNAME_STORAGE_KEY = "ai-teaching:currentUsername";

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readUsername(): string | null {
  const storage = browserStorage();
  if (!storage) return null;
  const raw = storage.getItem(USERNAME_STORAGE_KEY);
  return raw && raw.length > 0 ? raw : null;
}

// useSyncExternalStore 读当前登录状态
let _tokenCache: { val: boolean } | null = null;
function tokenSnapshot(): boolean {
  const v = getToken() !== null;
  if (_tokenCache !== null && _tokenCache.val === v) return _tokenCache.val;
  _tokenCache = { val: v };
  return v;
}
function subscribeToken(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("auth:changed", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("auth:changed", onChange);
  };
}

/** 派发鉴权状态变化事件，供顶栏菜单即时刷新。 */
export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event("auth:changed"));
}

interface Props {
  className?: string;
}

export function UserMenu({ className }: Props) {
  const router = useRouter();

  const loggedIn = useSyncExternalStore(
    subscribeToken,
    tokenSnapshot,
    () => false,
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [username, setUsername] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) setUsername(readUsername());
    });
    return () => {
      alive = false;
    };
  }, [loggedIn]);

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (
        wrapperRef.current !== null &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [menuOpen]);

  function handleLogout() {
    clearStudentId(browserStorage());
    clearToken(browserStorage());
    browserStorage()?.removeItem?.(USERNAME_STORAGE_KEY);
    // 清空对话缓存，退出后不再显示前一个身份的对话
    useSessionStore.getState().reset();
    setMenuOpen(false);
    notifyAuthChanged();
    router.push("/auth");
  }

  const menuItem =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/60";

  if (!loggedIn || !username) {
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
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px]">
          {username.slice(0, 1)}
        </span>
        <span className="max-w-[8rem] truncate">{username}</span>
        <ChevronDown className="size-3.5" aria-hidden />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full right-0 z-50 mt-1 w-52 rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-md"
        >
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
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
              onMouseDown={(e) => e.preventDefault()}
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
        </div>
      ) : null}
    </div>
  );
}
