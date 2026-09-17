import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Native 编程教学助手",
  description: "用 Agent 教 Agent —— 训练 AI 协作能力的编程教学平台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
