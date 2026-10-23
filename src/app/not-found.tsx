import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * 全局 404。
 *
 * Next.js 默认的 404 页只有一句英文 —— 对一个面向零基础中文学生的教学
 * 应用，等于把人丢在陌生街道上还不给路标。这里给一句中文说明和两个
 * 去处：回学习中心继续学，或回首页重新认识这个产品。
 *
 * 页面只做静态结构，不读学生身份（404 时身份可能还没初始化过）。
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6">
      <p className="text-5xl font-semibold tracking-tight text-muted-foreground">
        404
      </p>
      <h1 className="text-xl font-semibold tracking-tight">这一页不存在</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        可能是链接过期了，或者地址打错了。学习内容都在学习中心里，从那里继续。
      </p>
      <div className="mt-2 flex gap-3">
        <Button asChild>
          <Link href="/learn">返回学习中心</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">回到首页</Link>
        </Button>
      </div>
    </main>
  );
}
