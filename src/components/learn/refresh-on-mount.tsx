"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 挂载时刷新页面数据。
 *
 * Next.js 客户端导航会复用已访问路由的缓存，导致学习中心与教学步骤页的
 * 服务器数据（模块列表、掌握度、演示代码等）不随导航更新。本组件在挂载时
 * 调用一次 router.refresh()，让服务端组件重新取数。
 */
export function RefreshOnMount() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    router.refresh();
  }, [router]);

  return null;
}