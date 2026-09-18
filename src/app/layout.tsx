import type { Metadata } from "next";
import { TopNav } from "@/components/layout/top-nav";
import { siteConfig } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

/**
 * 应用外壳。
 *
 * 只负责「页面之外的东西」：`<html>` 语义、站点元信息、顶栏、内容容器。
 * 具体页面各自决定内部布局 —— 模块页要三栏铺满、首页要居中留白，
 * 把这些差异收进 layout 会让两者互相牵制。
 *
 * 顶栏是唯一的例外：它是全站常驻的，必须在这里。
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={siteConfig.locale}>
      <body className="flex min-h-dvh flex-col antialiased">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
