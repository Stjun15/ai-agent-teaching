"use client";

/**
 * 全站常驻的学生数据引导组件（渲染 `null`）
 *
 * 与 `ThemeBootstrap` 同构：它挂在 `layout.tsx` 上、每一页都在、不占布局。
 * 放在这里而不是某个页面里的理由是**掌握度卡不止一处**：学习中心的模块网格、
 * 模块页侧栏、对话面板各有一张，挂在页面里意味着每加一处就要记得补一次
 * 取数 —— 那种漏法不会报错，只会表现为「新加的那张卡永远显示尚未测评」。
 *
 * 为什么不放在 `layout.tsx` 里直接调 hook
 * ---------------------------------
 * layout 是服务端组件（它要导出 `metadata`），不能有 `useEffect`。
 */

import { useStudentHydrate } from "@/hooks/use-student-hydrate";

export function StudentBootstrap() {
  useStudentHydrate();
  return null;
}
