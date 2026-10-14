"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { currentAuthToken } from "@/lib/client-identity";

/**
 * 认证门禁（React 兜底）。
 *
 * 主重定向由 layout.tsx 里的原生 JS <script> 在 HTML 解析后立刻完成，
 * 不依赖 React 生命周期。此组件作二次保险。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/auth")) return;
    if (currentAuthToken()) return;
    const dest =
      pathname === "/"
        ? "/auth"
        : `/auth?redirect=${encodeURIComponent(pathname)}`;
    window.location.replace(dest);
  }, [pathname]);

  return children;
}