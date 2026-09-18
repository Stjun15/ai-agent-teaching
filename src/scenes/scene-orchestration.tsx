"use client";

/**
 * 场景：多 Agent 通信（模块 7 `multi-agent`）
 *
 * 动画步骤照 `module-specs.md` 模块 7 的「3. 可视化」逐条实现：用户一句话需求 →
 * 编排器出现、任务分裂成三份 → 三个 Agent 各自就位 → 需求交给代码 → 代码交给
 * 评审 → 评审给结论。
 *
 * 规格的最后两条为什么合成一步
 * -------------------------
 * 「评审通过 → 绿色勾」与「评审不通过 → 打回重做」是同一个判定节点的两个分支，
 * 同一时刻只会发生一个。拆成两步的话，播放时会依次出现互相矛盾的画面 ——
 * 学生对「到底通过没有」的印象会比只看一个分支更糊。
 *
 * 所以它是一步，由参数 `passed` 切换。这也正是学生该动手试的地方：关掉开关，
 * 第二根箭头会掉头变红。
 *
 * 三个 Agent 的样本数据在 `scene-orchestration-fixture.ts`，本文件只负责画。
 *
 * 交互为什么是「点开看 Prompt」
 * -------------------------
 * 「角色分工」在画面上就是三张长得一样的卡，从卡片本身看不出任何分工 ——
 * 分工全在三段 System Prompt 里。所以点卡片必须能展开对应那一段：
 * 只看动画不看 Prompt，等于没看到这个知识点。
 *
 * 箭头方向是**同一根线掉头**，不是另画一根反向箭头
 * --------------------------------
 * 打回走的就是刚才那条「代码 → 评审」的线，只是方向反了。另画一根的话，画面上
 * 会出现两条并行的线，学生会以为是两段不同的流程，而这里要讲的恰恰是
 * 「它是同一个来回」。
 */

import { Fragment } from "react";
import { Check, RotateCcw, User, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SceneColumn,
  SceneFrame,
  SceneRow,
  TONE_SURFACE,
} from "./scene-canvas";
import { ParamChoice, ParamToggle, SceneControls } from "./scene-controls";
import { MonoBlock, NodeCard, SceneArrow } from "./scene-parts";
import { paramBool, paramString } from "./scene-params";
import {
  TEAM,
  USER_REQUEST,
  findAgent,
  reviewOf,
} from "./scene-orchestration-fixture";
import type { SceneProps } from "./scene-types";

/** 两棒之间递的东西；下标 0 是「需求 → 代码」，1 是「代码 → 评审」。 */
const HANDOFF = ["功能点", "代码"] as const;

export function SceneOrchestration({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const focused = paramString(params, "focused", TEAM[0].id);
  const passed = paramBool(params, "passed", true);
  const active = findAgent(focused);
  const review = reviewOf(passed);
  const reached = (n: number) => stepIndex >= n;
  /** 结论已出且不通过：第二根箭头掉头。 */
  const rejected = reached(5) && !passed;

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="多 Agent 通信" caption={caption}>
        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="size-3" />
            用户输入
          </p>
          <p className="mt-0.5 text-xs">{USER_REQUEST}</p>
        </div>

        {reached(1) ? (
          <NodeCard
            title="编排器 Agent"
            subtitle="它不写代码，只决定谁做、按什么顺序做、什么时候停"
            icon={<Workflow className="size-3.5" />}
            tone="active"
            enter="down"
          />
        ) : null}

        {reached(2) ? (
          <SceneRow className="items-start">
            {TEAM.map((agent, index) => {
              const last = index === TEAM.length - 1;
              /** 第 1 根箭头在第 3 步亮，第 2 根在第 4 步亮。 */
              const lit = reached(index + 3);
              return (
                <Fragment key={agent.id}>
                  {index === 0 ? null : (
                    <SceneArrow
                      direction={last && rejected ? "left" : "right"}
                      tone={last && rejected ? "alert" : lit ? "done" : "idle"}
                      label={last && rejected ? "打回重做" : HANDOFF[index - 1]}
                    />
                  )}
                  <SceneColumn className="min-w-[8.5rem] flex-1">
                    <button
                      type="button"
                      onClick={() => setParam("focused", agent.id)}
                      aria-pressed={focused === agent.id}
                      className={cn(
                        "animate-in rounded-md border px-2.5 py-2 text-left transition-colors duration-300 fade-in slide-in-from-bottom-2",
                        focused === agent.id
                          ? "border-ring bg-accent"
                          : TONE_SURFACE.idle,
                      )}
                    >
                      <p className="text-xs font-medium">{agent.name}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">
                        {agent.duty}
                      </p>
                    </button>
                    {index < 2 && lit ? (
                      <MonoBlock>{agent.output}</MonoBlock>
                    ) : null}
                  </SceneColumn>
                </Fragment>
              );
            })}
          </SceneRow>
        ) : null}

        {reached(2) ? (
          <div className="flex animate-in flex-col gap-1 duration-300 fade-in">
            <span className="text-[10px] text-muted-foreground">
              {active.name} 的 System Prompt —— 三张卡的区别就在这一段
            </span>
            <MonoBlock tone="boxed">{active.systemPrompt}</MonoBlock>
          </div>
        ) : null}

        {reached(5) ? (
          <div
            className={cn(
              "animate-in rounded-md border px-2.5 py-2 text-xs duration-300 fade-in",
              passed
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                : "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40",
            )}
          >
            <p className="flex items-center gap-1.5 font-medium">
              {passed ? (
                <Check className="size-3.5" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              评审 Agent：{review.verdict}
            </p>
            <p className="mt-1 leading-relaxed opacity-90">{review.reason}</p>
            {passed ? null : (
              <p className="mt-1 text-[10px] leading-relaxed opacity-80">
                打回是个循环。只写「不合格就退回」、不写「怎样才算合格」，
                它就会一直转下去 —— 这是多 Agent 最容易翻车的地方。
              </p>
            )}
          </div>
        ) : null}
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamChoice
          label="看哪个 Agent 的 System Prompt"
          value={focused}
          options={TEAM.map((agent) => ({
            value: agent.id,
            label: agent.name,
          }))}
          onChange={(value) => setParam("focused", value)}
        />
        <ParamToggle
          label="评审通过"
          value={passed}
          onChange={(value) => setParam("passed", value)}
          hint="关掉看打回：第二根箭头掉头，代码 Agent 要重做。"
        />
      </SceneControls>
    </div>
  );
}
