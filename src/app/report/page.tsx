import type { Metadata } from "next";

import { AnimatedSection } from "@/components/layout/animated-section";
import { ReportView } from "@/components/report/report-view";

export const metadata: Metadata = {
  title: "学习报告",
  description:
    "掌握度、六项子能力、趋势、薄弱点与建议 —— 全部数字来自真实学习记录。",
};

/**
 * 学习报告（`04-frontend.md`「路由」第 7 条）。
 *
 * 页面本身是服务端组件，只做元信息与外壳；取数在 `ReportView` 里 ——
 * 报告按学生身份聚合，而身份在浏览器里（`localStorage` / 种子身份），
 * 服务端渲染阶段拿不到。这一点在 `ReportView` 的文件头有说明。
 */
export default function ReportPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <AnimatedSection>
        <header className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">学习报告</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            这份报告不预测、不评估潜力，只汇总已经发生的事：掌握度、答题数、
            错题与 Prompt 得分。没有数据的地方会写「尚无记录」，而不是显示 0 —— 0
            分与还没测过是两件事。
          </p>
        </header>

        <div className="mt-8">
          <ReportView />
        </div>
      </AnimatedSection>
    </main>
  );
}