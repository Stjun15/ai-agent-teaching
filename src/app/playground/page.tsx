import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";

import { PlaygroundLab } from "@/components/playground/playground-lab";
import { loadModules } from "@/lib/modules";

export const metadata: Metadata = {
  title: "沙箱实验室",
  description:
    "直接调用四个 Agent 与 LLM Wiki，填参数、看实际发出的请求体与服务端返回的原始 JSON。",
};

/**
 * 沙箱实验室（`04-frontend.md`「路由」第 6 条）。
 *
 * 边界说明：设计文档只给了这一条路由，没有写页面内容。这里的做法是把它定义成
 * **接口观察台** —— 学生在模块页点的是按钮，看不到背后发了什么；沙箱把这层
 * 摊开，让学生自己改参数、自己踩 `INVALID_INPUT`，从而看懂「接口契约」这件事。
 * 这与「本阶段要交付的能力」是一致的（六个子能力里的「理解 AI 行为模式」
 * 与「质量判断」都需要看得到原始输入输出）。**这一层定位是我的判断，不是
 * 文档的原话**，在此标明。
 *
 * 页面是服务端组件：模块列表要现读 wiki（`loadModules` 读文件系统，客户端拿不到）。
 * 但只把 `id` / `name` 两项传给客户端组件 —— 整个模块对象（含摘要、标签、
 * 前置依赖）打进客户端包是不必要的水。
 */
export default async function PlaygroundPage() {
  const modules = await loadModules();

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">沙箱实验室</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          这里没有教学流程，也没有评分。选一个能力，填上参数，点运行 ——
          屏幕上会同时给出
          <strong className="font-medium">实际发出的请求体</strong>和
          <strong className="font-medium">服务端返回的原始 JSON</strong>。
          故意填错也值得试一次：报错的原文会告诉你哪个字段不合规。
        </p>
      </header>

      <div className="mt-8">
        <PlaygroundLab
          modules={modules.map((teachingModule) => ({
            id: teachingModule.id,
            name: teachingModule.name,
          }))}
        />
      </div>
    </main>
  );
}
