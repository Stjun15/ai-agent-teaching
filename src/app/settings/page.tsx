import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = {
  title: "设置",
  description: "主题、模型与服务端配置的现状。",
};

/**
 * 设置页（`04-frontend.md`「路由」第 9 条）。
 *
 * 页面是服务端组件，只做元信息与外壳；内容都在 `SettingsView` 里 ——
 * 它要读 `localStorage`（主题偏好、学生身份）和 `/api/health`，
 * 两者都只在浏览器侧成立。
 */
export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 py-12 sm:px-8 sm:py-16">
      <header className="max-w-2xl">
        <h1 className="text-[2rem] tracking-tight sm:text-[2.4rem]">设置</h1>
        <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
          只列出真实生效的设置项。还没接入的功能会明确标出来并说明原因 ——
          一个点了没反应的开关比没有这个开关更让人困惑。
        </p>
      </header>

      <div className="mt-10">
        <SettingsView />
      </div>
    </main>
  );
}
