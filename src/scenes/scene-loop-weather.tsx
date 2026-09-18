"use client";

/**
 * 场景：Agent Loop 天气查询（模块 3 `agent-loop`）
 *
 * 动画步骤照 `module-specs.md` 模块 3 的「3. 可视化」逐条实现：用户提问 →
 * Loop 1 的思考气泡 → 工具卡片 → 数据面板 → Loop 2 的思考气泡 → 打字机回答。
 *
 * 这一场要回答的是「为什么要两轮」
 * ---------------------------
 * 每一轮 Loop 上方都写清「这一轮模型手里有什么」：
 *   - Loop 1 手里只有用户的问题，所以它能决定的只有「先调工具」；
 *   - Loop 2 手里多了工具返回的数据，所以它才能给出答案。
 * 这两句话才是这一场的真正内容 —— 动画只是把「手里有什么变了」演出来。
 * 若只把两轮画成两个盒子，学生会以为 Loop 是「重复执行两次」。
 *
 * 两轮的结构刻意长得一样
 * -------------------
 * 同一个 `LoopBox`：编号、手里有什么、气泡、动作。相似是有意的 —— 学生要看出
 * 「同一个循环转了两圈」，而不是「两个不同的步骤」。差别只在内层动作不同
 * （调工具 / 给回答），因为差别本来就在那里。
 *
 * 示例数据是可切换的，并且标明是示例
 * ------------------------------
 * `module-specs.md` 的例子写死 `{ temp: 25, condition: "晴" }`（北京）。这里保留
 * 北京那一组原值，另给两座城市 —— 换城市看数据面板与最终回答一起变，学生能确认
 * 「回答里的 25°C 是从工具返回里来的」，而不是模型自己记得的。数据面板标明「示例
 * 返回」：**这一场演示的是循环结构，不是真的去查天气**，不能让人误以为接了实时
 * 天气接口。
 */

import { Database, MessageSquareQuote, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneFrame } from "./scene-canvas";
import { ParamChoice, SceneControls } from "./scene-controls";
import { NodeCard } from "./scene-parts";
import { paramString } from "./scene-params";
import { Typewriter } from "./scene-typewriter";
import type { SceneProps } from "./scene-types";

/** 示例数据（北京那一组与 `module-specs.md` 的示例代码一致）。 */
const CITIES = [
  { value: "北京", temp: 25, condition: "晴" },
  { value: "上海", temp: 31, condition: "多云" },
  { value: "广州", temp: 33, condition: "雷阵雨" },
] as const;

export function SceneLoopWeather({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const city =
    CITIES.find(
      (item) => item.value === paramString(params, "city", CITIES[0].value),
    ) ?? CITIES[0];
  const reached = (n: number) => stepIndex >= n;
  const answer = `${city.value}今天${city.condition}，气温 ${city.temp}°C。`;

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="Agent Loop 天气查询" caption={caption}>
        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="text-[10px] text-muted-foreground">用户输入</p>
          <p className="mt-0.5 text-xs">{city.value}今天天气怎么样？</p>
        </div>

        <LoopBox
          index={1}
          holdings="手里只有用户的问题 —— 能决定的只有「先调工具」"
          active={stepIndex >= 1 && stepIndex <= 3}
        >
          {reached(1) ? <Thought text="我需要调用 getWeather" /> : <Waiting />}
          {reached(2) ? (
            <NodeCard
              title="调用工具 getWeather"
              subtitle="工具入参"
              icon={<Wrench className="size-3.5" />}
              lines={[`{ "city": "${city.value}" }`]}
              tone={stepIndex === 2 ? "active" : "done"}
            />
          ) : null}
          {reached(3) ? (
            <NodeCard
              title="工具返回（示例数据）"
              icon={<Database className="size-3.5" />}
              lines={[
                `{ "temp": ${city.temp}, "condition": "${city.condition}" }`,
              ]}
              tone={stepIndex === 3 ? "active" : "done"}
            />
          ) : null}
        </LoopBox>

        <LoopBox
          index={2}
          holdings="手里多了工具返回的数据 —— 可以给出回答了"
          active={reached(4)}
        >
          {reached(4) ? <Thought text="我拿到数据了，可以回答" /> : <Waiting />}
          {reached(5) ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-[10px] text-muted-foreground">最终回复</p>
              <p className="mt-1 leading-relaxed">
                <Typewriter text={answer} />
              </p>
            </div>
          ) : null}
        </LoopBox>
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamChoice
          label="问哪座城市"
          value={city.value}
          options={CITIES.map((item) => ({
            value: item.value,
            label: item.value,
          }))}
          onChange={(value) => setParam("city", value)}
        />
        <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground">
          换一座城市，工具返回与最终回答会一起变 ——
          回答里的气温是从工具返回里取来的，不是模型自己记得的。
        </p>
      </SceneControls>
    </div>
  );
}

/** 一轮 Loop 的盒子：编号 + 这一轮手里有什么 + 这一轮做了什么。 */
function LoopBox({
  index,
  holdings,
  active,
  children,
}: {
  index: number;
  /** 「这一轮模型手里有什么」——这一场真正要讲的那句话。 */
  holdings: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border p-2.5 transition-colors",
        active
          ? "border-ring bg-accent/30"
          : "border-border bg-card/60 opacity-70",
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background">
          Loop {index}
        </span>
        <span className="font-normal text-muted-foreground">{holdings}</span>
      </p>
      {children}
    </div>
  );
}

/** 思考气泡。 */
function Thought({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-relaxed">
      <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

/** 这一轮还没轮到时的一句话，避免盒子看起来「坏了」。 */
function Waiting() {
  return <p className="text-[11px] text-muted-foreground">还没轮到这里。</p>;
}
