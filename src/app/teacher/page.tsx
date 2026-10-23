import type { Metadata } from "next";

import { TeacherConsole } from "@/components/teacher/teacher-console";
import { SIMULATION_STEPS, STUDENT_PERSONAS } from "@/lib/agent/student/personas";
import { STEP_LABELS } from "@/lib/agent/student/screen-digest";
import { loadModules } from "@/lib/modules";

export const metadata: Metadata = {
  title: "教师控制台",
  description:
    "让模拟学生把一讲讲一遍：看它卡在哪、导师怎么答、花了多少 token。",
};

/**
 * 教师控制台（`/teacher`）。
 *
 * 页面是服务端组件：模块清单与人设清单在服务端就是现成的（wiki + 常量），
 * 没必要让浏览器再请求一次接口。取运行记录才走 API —— 那些是数据库里的
 * 可变数据，且必须经过 `requireTeacher` 判权。
 *
 * `dynamic = "force-dynamic"`：模块清单读的是 `llm-wiki/` 文件，构建期预渲染
 * 会把当时的清单焊进产物；改了讲稿或新增模块后控制台会缺项。
 */
export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const modules = await loadModules();

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">教师控制台</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          让一个模拟学生把这一讲讲一遍：它只读「屏幕上的内容」，然后按自己的人格
          提问或放弃；导师按当前步骤的教学口径回答。每一轮都记录学生看到什么、
          双方各说了什么、花了多少 token —— 成本只计量，不折算金额。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          只对教师账号开放。模拟结果反映的是内容层面的问题（讲不通、答不对），
          界面交互缺陷不在这里覆盖。
        </p>
      </header>

      <TeacherConsole
        modules={modules.map((module) => ({ id: module.id, name: module.name }))}
        personas={STUDENT_PERSONAS.map((persona) => ({
          id: persona.id,
          label: persona.label,
          summary: persona.summary,
        }))}
        steps={SIMULATION_STEPS.map((step) => ({
          id: step,
          label: STEP_LABELS[step],
        }))}
      />
    </main>
  );
}
