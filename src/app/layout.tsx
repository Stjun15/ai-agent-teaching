import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/auth-gate";
import { SiteFooter } from "@/components/layout/site-footer";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBootstrap } from "@/components/student/student-bootstrap";
import { ThemeBootstrap } from "@/components/settings/theme-choice";
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
 * 三个例外，都是「全站常驻、与当前页面无关」的东西：
 * - `<TopNav>`：导航；
 * - `<ThemeBootstrap>`：把已保存的主题应用到 `<html>`。它必须挂在全站每一页上，
 *   否则「设置里选了深色、进别的页面又变浅色」。它渲染 `null`，不占布局。
 * - `<StudentBootstrap>`：把画像 / 掌握度 / 学习路径灌进 `StudentStore`。
 *   同理必须全站在 —— 掌握度卡出现在学习中心、模块页、对话面板多处，
 *   挂在某一个页面里，别处的卡就会永远显示「尚未测评」。也渲染 `null`。
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={siteConfig.locale}>
      <body className="flex min-h-dvh flex-col antialiased">
        <ThemeBootstrap />
        <AuthGate>
          <StudentBootstrap />
          <TopNav />
          {children}
          <SiteFooter />
        </AuthGate>
      </body>
    </html>
  );
}
