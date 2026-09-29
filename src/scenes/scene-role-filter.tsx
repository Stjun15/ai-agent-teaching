"use client";

/**
 * 场景：角色滤镜对比（模块 2 `system-prompt`）
 *
 * 动画步骤照 `module-specs.md` 模块 2 的「3. 可视化」逐条实现：左边给答案 →
 * 右边提问 → 中间出现滤镜 → 滤镜滑过去、左边变成右边 → 高亮 System Prompt。
 *
 * 「滤镜」这个类比要立住，靠的是两处对照
 * ----------------------------------
 * 1. **左边／右边同一句问题，回答方式不同**：同一个模型、同一个问题，差别只在
 *    有没有那段 system 消息。这正是模块 2 的核心问题「你怎么让 AI 变成你想要
 *    的角色」的答案：不是换模型，是加一层滤镜。
 * 2. **滤镜本身是可见的**：第 5 步把 System Prompt 原文高亮出来 —— 滤镜不是
 *    玄学，就是那四行规则。学生要能指着它说「这就是我加的东西」。
 *
 * 回复内容是**从规则推出来的**，不是编的
 * ---------------------------------
 * 右边那句「先别急着改……」逐条对应示例里的四条规则（不给完整答案、先问你觉得
 * 哪里有问题、给方向级提示、语气鼓励）。所以本场景只在两种状态间切换：
 * 有规则 → 按规则答；没规则 → 按最常见的方式直接给答案。**没有第三种**——
 * 界面上不该出现「编一个看起来像 AI 的回复」，学生一旦发现回复是假的，
 * 这一场要讲的「滤镜改变回答方式」就整段失去说服力。
 *
 * 关掉滤镜时两边会变成一样 —— 那不是 bug，是这一场最该被看见的一次对比。
 */

import { Filter } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneColumn, SceneFrame } from "./scene-canvas";
import { ParamText, ParamToggle, SceneControls } from "./scene-controls";
import { MonoBlock } from "./scene-parts";
import { paramBool, paramString } from "./scene-params";
import type { SceneProps } from "./scene-types";

const QUESTION = "帮我看看这段代码为什么报错？";
/** 取自 `module-specs.md` 模块 2「5. 导师展示代码」的 system 消息原文。 */
const DEFAULT_SYSTEM = `你是一个代码评审员。
规则：
1. 不直接给完整答案
2. 先问学生"你觉得哪里可能有问题"
3. 给分级提示：方向 → 具体 → 伪代码
4. 语气鼓励，不打击信心`;
const DIRECT_REPLY =
  '你的代码第 3 行少了一个右括号：print("你好" 应该是 print("你好")。改完就不报错了。';
const SOCRATIC_REPLY =
  "先别急着改 —— 看一眼报错指向的那一行，它结尾的括号和你心里的写法对得上吗？先说说你的判断，我再顺着往下给提示。";

export function SceneRoleFilter({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const system = paramString(params, "system", DEFAULT_SYSTEM);
  const filterOn = paramBool(params, "filterOn", true);
  const reached = (n: number) => stepIndex >= n;

  /**
   * 滤镜是否已经滑到位。
   *
   * 第 4 步之前，左边是「无 system」的那一栏；第 4 步之后滤镜滑过来，左边也被
   * 过滤了一遍。参数 `filterOn` 决定的是**结果**：关掉它，连右边也退回直接给
   * 答案 —— 那时两栏一模一样，学生一眼就明白差别全在那段规则里。
   */
  const applied = reached(3) && filterOn;

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="角色滤镜对比" caption={caption}>
        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="text-sm text-muted-foreground">同一个问题</p>
          <p className="mt-0.5 text-sm">{QUESTION}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
          <ReplyPanel
            title="无 System Prompt"
            note={
              applied
                ? "滤镜已滑过来，这一栏也被过滤了"
                : reached(3)
                  ? "滤镜关掉了，两边一样"
                  : "模型按最常见的方式回答"
            }
            reply={applied ? SOCRATIC_REPLY : DIRECT_REPLY}
            tone={applied ? "done" : "idle"}
          />

          {/* 中缝：滤镜本体。第 3 步出现，第 4 步滑到位。 */}
          <div className="flex items-center justify-center gap-1 sm:flex-col">
            {reached(2) ? (
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-sm",
                  reached(3)
                    ? "animate-in border-emerald-300 bg-emerald-50 text-emerald-900 duration-500 fade-in slide-in-from-left-2 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-ring bg-accent text-accent-foreground",
                )}
              >
                <Filter className="size-3" />
                {reached(3) ? "滤镜已应用" : "滤镜"}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                两栏还没并排
              </span>
            )}
          </div>

          <ReplyPanel
            title="有 System Prompt"
            note={filterOn ? "按你定的规则回答" : "滤镜关掉了，和左边一样"}
            reply={filterOn ? SOCRATIC_REPLY : DIRECT_REPLY}
            tone={filterOn ? "active" : "idle"}
          />
        </div>

        {reached(4) ? (
          <div className="animate-in rounded-md border border-ring bg-accent/40 p-2 duration-300 fade-in">
            <p className="text-sm font-medium">
              滤镜的本体就是这几行 —— 换掉它，右边那栏的回答方式就换掉
            </p>
            <div className="mt-1.5">
              <MonoBlock>{system}</MonoBlock>
            </div>
          </div>
        ) : null}
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamText
          label="System Prompt"
          value={system}
          rows={5}
          onChange={(value) => setParam("system", value)}
          hint="改完看第 5 步的高亮块：被改的就是那层「滤镜」本身。"
        />
        <ParamToggle
          label="应用滤镜"
          value={filterOn}
          onChange={(value) => setParam("filterOn", value)}
          hint="关掉它，右栏会退回直接给答案 —— 两栏一样的时候，差别只在那几行规则。"
        />
      </SceneControls>
    </div>
  );
}

/** 一栏回答。`key={reply}` 让内容变化时重新入场 —— 换的是「谁在答」。 */
function ReplyPanel({
  title,
  note,
  reply,
  tone,
}: {
  title: string;
  note: string;
  reply: string;
  tone: "idle" | "active" | "done";
}) {
  return (
    <SceneColumn
      className={cn(
        "rounded-md border p-2.5 transition-colors",
        tone === "active"
          ? "border-ring bg-accent/40"
          : tone === "done"
            ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-border bg-card",
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{note}</p>
      <p
        key={reply}
        className="animate-in text-sm leading-relaxed duration-300 fade-in"
      >
        {reply}
      </p>
    </SceneColumn>
  );
}