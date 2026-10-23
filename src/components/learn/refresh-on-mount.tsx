"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 挂载时刷新页面数据。
 *
 * Next.js 客户端导航会复用已访问路由的缓存，导致学习中心与教学步骤页的
 * 服务器数据（模块列表、掌握度、演示代码等）不随导航更新。
 *
 * 刷新策略
 * -------
 * - 不传 `moduleId`（学习中心等列表页）：挂载时刷新一次（向后兼容）。
 * - 传了 `moduleId`（教学步骤页）：挂载时刷新一次 + 模块切换时刷新，
 *   同模块内切步骤不刷新。
 */
export function RefreshOnMount({ moduleId }: { moduleId?: string }) {
  const router = useRouter();
  const ran = useRef(false);
  const prevModuleId = useRef(moduleId);

  useEffect(() => {
    // 模块跟踪模式：跨模块时刷新，同模块切步骤不动
    if (moduleId !== undefined) {
      const isModuleChange = prevModuleId.current !== moduleId;
      prevModuleId.current = moduleId;
      if (!ran.current || isModuleChange) {
        ran.current = true;
        router.refresh();
      }
      return;
    }

    // 无模块跟踪：挂载时刷新一次（学习中心等）
    if (ran.current) return;
    ran.current = true;
    router.refresh();
  }, [router, moduleId]);

  return null;
}