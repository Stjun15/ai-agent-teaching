import type { Metadata } from "next";

import { AuditView } from "@/components/report/audit-view";

export const metadata: Metadata = {
  title: "课程审计",
  description:
    "对我们自己的课程做的结构检查 —— 任务节可达性、示范代码可读性、术语断层、内容一致性，每条结论附可复核的证据。",
};

/**
 * 课程审计页
 *
 * 为什么单独一页而不是塞进 `/report`
 * --------------------------------
 * 两份报告的主体不同：`/report` 是**学生**的学习报告（掌握度、错题、
 * Prompt 得分），这里是我们对**课程内容**的审计（哪一讲有结构缺陷、
 * 证据在哪）。混在一页会让评审看不懂「这些数字在说谁」。
 *
 * 页面是服务端组件只出外壳，取数在 `AuditView` 里 —— 身份在浏览器里
 * （localStorage），服务端渲染阶段拿不到。
 */
export default function AuditPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <section className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <header className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">课程审计</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            这是我们对课程本身的检查，不是学生的成绩单。每一项都是能被机器
            重复判定的结构缺陷，每条结论都附原文证据 —— 说得清「在哪一行、
            是什么字」的问题才配出现在这里。
          </p>
        </header>

        <div className="mt-8">
          <AuditView />
        </div>
      </section>
    </main>
  );
}
