import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModuleWorkspace } from "@/components/learn/module-workspace";
import { LEARNING_STEPS } from "@/lib/learning-steps";
import { findModule, loadModules } from "@/lib/modules";

interface ModulePageProps {
  params: Promise<{ moduleId: string }>;
}

/**
 * 模块学习页（默认停在第一步）。
 *
 * 只做三件事：取模块 → 取全量模块（用于把前置依赖显示成名称）→ 交给工作区渲染。
 * 布局与分栏职责在 `ModuleWorkspace`，与 `/learn/[moduleId]/[step]` 共用一份。
 *
 * 预渲染全部模块页：内容来自仓库里的 markdown，构建期就确定，
 * 没有理由让每次访问都去读一遍磁盘。
 */

export async function generateStaticParams() {
  const modules = await loadModules();
  return modules.map((teachingModule) => ({ moduleId: teachingModule.id }));
}

export async function generateMetadata({
  params,
}: ModulePageProps): Promise<Metadata> {
  const { moduleId } = await params;
  const teachingModule = await findModule(moduleId);
  if (!teachingModule) return { title: "模块不存在" };
  return { title: teachingModule.name, description: teachingModule.summary };
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { moduleId } = await params;
  const [teachingModule, allModules] = await Promise.all([
    findModule(moduleId),
    loadModules(),
  ]);

  if (!teachingModule) notFound();

  return (
    <ModuleWorkspace
      teachingModule={teachingModule}
      allModules={allModules}
      currentStepId={LEARNING_STEPS[0].id}
    />
  );
}
