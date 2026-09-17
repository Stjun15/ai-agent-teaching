import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModuleWorkspace } from "@/components/learn/module-workspace";
import { LEARNING_STEPS, stepIndex } from "@/lib/learning-steps";
import { findModule, loadModules } from "@/lib/modules";

interface ModuleStepPageProps {
  params: Promise<{ moduleId: string; step: string }>;
}

/**
 * 模块子步骤页（`/learn/[moduleId]/[step]`）。
 *
 * 与 `/learn/[moduleId]` 渲染同一个工作区，区别只在于左栏高亮哪一步。
 * 抽成两条路由而不是「一条路由 + 前端切状态」，是因为步骤要能被直接分享与
 * 收藏 —— 学生问「我卡在第三步」时，链接能直接指向那一步。
 *
 * 非法的 step 一律 404，不做「静默回退到第一步」：URL 写错却看起来正常，
 * 会让人以为自己的操作生效了。`LEARNING_STEPS` 是 step 取值的唯一定义处。
 */

export async function generateStaticParams() {
  const modules = await loadModules();
  return modules.flatMap((teachingModule) =>
    LEARNING_STEPS.map((step) => ({
      moduleId: teachingModule.id,
      step: step.id,
    })),
  );
}

export async function generateMetadata({
  params,
}: ModuleStepPageProps): Promise<Metadata> {
  const { moduleId, step } = await params;
  const teachingModule = await findModule(moduleId);
  const matched = LEARNING_STEPS[stepIndex(step)];
  if (!teachingModule || !matched) return { title: "模块不存在" };
  return {
    title: `${teachingModule.name} · ${matched.label}`,
    description: matched.detail,
  };
}

export default async function ModuleStepPage({ params }: ModuleStepPageProps) {
  const { moduleId, step } = await params;
  const [teachingModule, allModules] = await Promise.all([
    findModule(moduleId),
    loadModules(),
  ]);

  if (!teachingModule || stepIndex(step) === -1) notFound();

  return (
    <ModuleWorkspace
      teachingModule={teachingModule}
      allModules={allModules}
      currentStepId={step}
    />
  );
}
