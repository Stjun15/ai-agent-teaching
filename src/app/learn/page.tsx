import type { Metadata } from "next";

import { ModuleCard } from "@/components/learn/module-card";
import { loadModules } from "@/lib/modules";

export const metadata: Metadata = {
  title: "学习中心",
  description: "9 个教学模块，按依赖关系顺序学习 AI Agent 的核心概念。",
};

/**
 * 学习中心。
 *
 * 服务端组件，模块列表来自 LLM Wiki 的概念页 frontmatter —— 与首页同一份数据源。
 * 新增一个概念页，这里自动多一张卡片，不需要改代码。
 *
 * 前置依赖的显示：`prerequisites` 里存的是模块 id，直接把 id 印在卡片上很难读，
 * 所以先在服务端建一张 id → 名称的表传下去。在客户端组件里现算这张表也可以，
 * 但那会把整个模块列表打进客户端包 —— 这是不必要的水。
 */
export default async function LearnPage() {
  const modules = await loadModules();
  const prerequisites = new Map(modules.map((m) => [m.id, m.name]));
  const totalMinutes = modules.reduce((total, teachingModule) => {
    const minutes = Number.parseInt(teachingModule.estimatedTime, 10);
    return total + (Number.isNaN(minutes) ? 0 : minutes);
  }, 0);

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">学习中心</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {modules.length} 个模块依依赖关系排定顺序，共约 {totalMinutes} 分钟。
          每个模块走完「概念讲解 → 动手实践 → 校验点评 → 可视化 →
          变式练习」五步， 掌握度达标后再进入下一个 ——
          这是掌握式学习的顺序，不建议跳讲。
        </p>
      </header>

      {modules.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          没有读到任何概念页。请确认 `llm-wiki/concepts/` 下存在概念页面。
        </p>
      ) : (
        <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((teachingModule) => (
            <li key={teachingModule.id}>
              <ModuleCard
                teachingModule={teachingModule}
                prerequisites={prerequisites}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
