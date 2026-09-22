"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { currentAuthToken } from "@/lib/client-identity";

/**
 * 认证门禁：未登录时自动跳转到 /auth。
 *
 * 挂在整个应用的最外层，不认 cookie / header / middleware ——
 * 只认浏览器 localStorage 里的鉴权令牌，与 `client-identity.ts` 同源。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname.startsWith("/auth");

  // 用 useSyncExternalStore 判定是否已完成客户端水合，
  // 避免渲染期读 localStorage 触发 hydration 不匹配。
  const hydrated = useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false,
  );

  // 重定向逻辑：所有 hooks 必须在顶层调用，不能放在条件分支里。
  const shouldRedirect = !isAuthPage && hydrated && !currentAuthToken();
  React.useEffect(() => {
    if (shouldRedirect) router.replace("/auth");
  }, [shouldRedirect, router]);

  if (!hydrated) return children;
  if (isAuthPage) return children;
  if (currentAuthToken()) return children;
  return null;
}
