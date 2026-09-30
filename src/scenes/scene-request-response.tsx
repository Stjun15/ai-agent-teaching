"use client";

/**
 * 场景：请求-响应流程（模块 1 `llm-api`）
 *
 * 动画步骤照 `module-specs.md` 模块 1 的「3. 可视化」逐条实现，一步不多：
 * 打字 → 卡片分位飞入 → 堆成数组 → 数据包飞向云端 → token 计数 → 打字机回复。
 *
 * 这一场要讲清三件事，都落在画面上而不是旁白里
 * ----------------------------------------
 * 1. **一次请求就是一整份消息数组**，不是「AI 在跟你聊天」——所以卡片最后收进
 *    一对 `[ ]`；这正是模块 1「常见误解：AI 记得我说过的话」的反面。
 * 2. **system 与 user 是数组里的两个位置**，不是两种说话方式 —— 所以两张卡片
 *    一个从上、一个从下进场。
 * 3. **token 是算出来的账**，输入与输出各算各的 —— 所以两个计数器分开滚。
 *
 * 内容与模块页的示例代码对齐：`QUESTION` / `DEFAULT_SYSTEM` 取自
 * `module-specs.md` 的「5. 导师展示代码」。学生看完动画往下翻，看到的代码就是
 * 刚才那两条消息 —— 若这里另编一句，动画与代码就成了两个故事。
 *
 * 交互按规格给了两个，都是**改完立刻看得出差别**的：改 system 消息会改掉第 2 步
 * 卡片里的字；切 stream 会换掉最后一次答复的呈现方式（逐字冒出 vs 整段出现）。
 * 改完看不出差别的开关等于没有交互。
 */

import { useEffect, useState } from "react";
import { Cloud } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneColumn, SceneFrame, SceneRow } from "./scene-canvas";
import { ParamText, ParamToggle, SceneControls } from "./scene-controls";
import { NodeCard, SceneArrow } from "./scene-parts";
import { paramBool, paramString } from "./scene-params";
import { Typewriter } from "./scene-typewriter";
import type { SceneProps } from "./scene-types";

const QUESTION = "你好，请介绍一下自己。";
/** 与目录里 `defaultParams.system` 同值；这是收窄失败时的兜底（见 scene-params）。 */
const DEFAULT_SYSTEM = "你是一个友好的编程学习助手。";
const REPLY =
  "你好！我是面向编程学习者的助手：可以陪你读懂报错、理清概念，也会一步步带你调试。";
const INPUT_TOKENS = 12;
const OUTPUT_TOKENS = 45;

export function SceneRequestResponse({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const system = paramString(params, "system", DEFAULT_SYSTEM);
  const stream = paramBool(params, "stream", true);
  /** 「这一步到了吗」。写成一个判断，比在每处都写 `stepIndex >= 3` 好读。 */
  const reached = (n: number) => stepIndex >= n;

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="请求-响应流程" caption={caption}>
        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="text-sm text-muted-foreground">用户输入</p>
          <p className="mt-0.5 font-mono text-sm">
            {stepIndex === 0 ? <Typewriter text={QUESTION} /> : QUESTION}
          </p>
        </div>

        <SceneArrow direction="down" tone={reached(3) ? "done" : "idle"} />

        <SceneRow className="items-stretch">
          {/* 消息数组。第 3 步之后收进一对 `[ ]` —— 「这是一份数组」是这一步的重点。 */}
          <div
            className={cn(
              "flex min-w-0 flex-[2] gap-1 rounded-md border border-dashed px-2 py-1.5",
              reached(2) ? "border-ring" : "border-transparent",
            )}
          >
            {reached(2) ? <Bracket>{"["}</Bracket> : null}
            <SceneColumn className="min-w-0 flex-1">
              {reached(1) ? (
                <>
                  <NodeCard
                    title="role: system"
                    subtitle="角色设定"
                    lines={[system]}
                    enter="down"
                    tone={stepIndex === 1 ? "active" : "done"}
                  />
                  <NodeCard
                    title="role: user"
                    subtitle="学生的提问"
                    lines={[QUESTION]}
                    enter="up"
                    tone={stepIndex === 1 ? "active" : "done"}
                  />
                </>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  消息卡片还没生成。
                </p>
              )}
            </SceneColumn>
            {reached(2) ? <Bracket>{"]"}</Bracket> : null}
          </div>

          <SceneArrow direction="right" tone={reached(3) ? "done" : "idle"} />

          <NodeCard
            className="flex-1"
            title="云端大模型"
            icon={<Cloud className="size-3.5" />}
            subtitle={reached(3) ? "收到整份消息数组" : "等待请求"}
            tone={stepIndex === 3 ? "active" : reached(3) ? "done" : "idle"}
          />
        </SceneRow>

        {reached(4) ? (
          <SceneRow>
            <TokenChip label="输入 token" value={INPUT_TOKENS} />
            <TokenChip label="输出 token" value={OUTPUT_TOKENS} />
          </SceneRow>
        ) : null}

        {reached(5) ? (
          <div
            className={cn(
              "rounded-md border px-2.5 py-2 text-sm",
              stream
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                : "border-border bg-muted/40",
            )}
          >
            <p className="text-sm text-muted-foreground">
              {stream
                ? "stream: true —— 逐字返回，界面能边收边显示"
                : "stream: false —— 等整段生成完再一次性返回，这之前界面是空的"}
            </p>
            <p className="mt-1 leading-relaxed">
              {/*
                两者的差别要看得见：流式是逐字冒出来的，非流式整段一次出现
                —— 后者不再另做「等一会儿」的假延迟，因为「等不到过程」这件事
                用一个没有过程的出现方式就说明白了。
              */}
              {stream ? (
                <Typewriter text={REPLY} />
              ) : (
                <span className="animate-in duration-300 fade-in">{REPLY}</span>
              )}
            </p>
          </div>
        ) : null}
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamText
          label="system 消息"
          value={system}
          onChange={(value) => setParam("system", value)}
          readOnly
          hint="系统设定消息，由课程预设，不可编辑。"
        />
        <ParamToggle
          label="stream（流式输出）"
          value={stream}
          onChange={(value) => setParam("stream", value)}
          hint="关掉它再看第 6 步：回复不再逐字冒出，而是整段一次出现。"
        />
      </SceneControls>
    </div>
  );
}

/** 数组的中括号，单独成件只是为了让那一对符号在两个方向上对齐。 */
function Bracket({ children }: { children: string }) {
  return (
    <span className="font-mono text-sm text-muted-foreground">{children}</span>
  );
}

/** token 计数：从 0 滚到目标值。 */
function TokenChip({ label, value }: { label: string; value: number }) {
  const [shown, setShown] = useState(0);
  // 每次前进约 1/12，大约 0.7 秒滚完；`Math.min` 兜住最后一次可能越过的量。
  const stride = Math.max(1, Math.ceil(value / 12));

  useEffect(() => {
    if (shown >= value) return;
    const timer = setTimeout(() => setShown((count) => count + stride), 60);
    return () => clearTimeout(timer);
  }, [shown, value, stride]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">
        {Math.min(shown, value)}
      </span>
    </span>
  );
}
