"use client";

/**
 * 场景：工具调用链（模块 4 `tool-calling`）
 *
 * 动画步骤照 `module-specs.md` 模块 4 的「3. 可视化」逐条实现：工具箱展开 → 用户
 * 提出需要两个工具的任务 → 选 getWeather → 返回 25°C → 选 calculate → 返回 77°F
 * → 调用链依次亮起。
 *
 * 两个交互都落在「工具定义是给模型看的说明书」这一句上：点工具卡能看到模型真正读
 * 到的三要素；把描述改成空，Agent 就选不到这个工具、链子当场断在第一环 —— 这不是
 * 编的效果，而是「描述为空则无从判断适用场景」的直接推论。
 *
 * 卡片上的描述与下方展开的 JSON 取自同一个对象，改了描述两处一起变：否则学生会看
 * 到「卡片变了、定义没变」，那一瞬间「定义就是这段 JSON」的印象就散了。
 * 25°C → 77°F 同样由同一个表达式算出，学生按计算器两次都对得上。
 */

import { Calculator, Cloud } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneColumn, SceneFrame } from "./scene-canvas";
import { ParamText, SceneControls } from "./scene-controls";
import { MonoBlock, SceneArrow, ToolCard } from "./scene-parts";
import { paramString } from "./scene-params";
import type { SceneProps } from "./scene-types";

const CELSIUS = 25;
/** 华氏度由摄氏度算出来 —— 与「先查天气、再算华氏度」这个任务描述一致。 */
const FAHRENHEIT = Math.round((CELSIUS * 9) / 5 + 32);
const CALC_EXPRESSION = `${CELSIUS} * 9 / 5 + 32`;

export function SceneToolChain({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const weatherDescription = paramString(
    params,
    "weatherDescription",
    "查询指定城市的天气",
  );
  const selected = paramString(params, "selectedTool", "getWeather");
  const reached = (n: number) => stepIndex >= n;

  /**
   * 描述为空时 Agent 判断不了这个工具什么时候该用。
   *
   * 这不是额外的规则，而是「工具描述」这个字段存在的唯一理由 —— 把唯一理由
   * 抹掉，调用链就断。
   */
  const describable = weatherDescription.trim() !== "";
  const blocked = !describable && reached(2);

  const tools = [
    {
      name: "getWeather",
      description: describable ? weatherDescription : "（描述为空）",
      parameters: { city: "string" },
    },
    {
      name: "calculate",
      description: "计算数学表达式，例如温度换算",
      parameters: { expression: "string" },
    },
  ];
  const detail = tools.find((tool) => tool.name === selected) ?? tools[0];

  /** 调用链的两环。第一环显式写 `note: undefined`，让两环形状一致、可同一套渲染。 */
  const chain = [
    {
      name: "getWeather",
      result: `${CELSIUS}°C`,
      note: undefined as string | undefined,
      called: reached(2) && describable,
      returned: reached(3) && describable,
    },
    {
      name: "calculate",
      result: `${FAHRENHEIT}°F`,
      note: CALC_EXPRESSION,
      called: reached(4),
      returned: reached(5),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="工具调用链" caption={caption}>
        {/* 工具箱：两张卡，点了在下方展开它的定义。 */}
        <div className="grid gap-2 sm:grid-cols-2">
          {tools.map((tool) => {
            const isWeather = tool.name === "getWeather";
            const activeStep = isWeather ? 2 : 4;
            const called =
              reached(activeStep) && (isWeather ? describable : true);
            return (
              <ToolCard
                key={tool.name}
                name={tool.name}
                description={tool.description}
                icon={
                  isWeather ? (
                    <Cloud className="size-3.5" />
                  ) : (
                    <Calculator className="size-3.5" />
                  )
                }
                selected={tool.name === selected}
                trouble={isWeather && blocked}
                tone={
                  isWeather && blocked
                    ? "alert"
                    : called
                      ? stepIndex === activeStep
                        ? "active"
                        : "done"
                      : "idle"
                }
                onSelect={() => setParam("selectedTool", tool.name)}
              />
            );
          })}
        </div>

        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="text-sm text-muted-foreground">用户输入</p>
          <p className="mt-0.5 text-sm">查北京天气，再算华氏度</p>
        </div>

        {blocked ? (
          <p className="animate-in rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-sm leading-relaxed text-rose-900 duration-300 fade-in dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            getWeather 的描述是空的 —— Agent
            判断不了「什么时候该用它」，调用链断在
            第一环，后面的换算也不会发生。
          </p>
        ) : null}

        {/* 调用链：每一次调用与返回各占一环。 */}
        <div className="flex flex-wrap items-center gap-2">
          {chain.map((link, index) => (
            <div key={link.name} className="flex flex-1 items-center gap-2">
              {index > 0 ? (
                <SceneArrow
                  direction="right"
                  tone={link.called ? "done" : "idle"}
                />
              ) : null}
              <SceneColumn
                className={cn(
                  "min-w-[8rem] flex-1 rounded-md border px-2 py-1.5",
                  link.returned
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                    : link.called
                      ? "border-ring bg-accent"
                      : "border-dashed border-border bg-card opacity-60",
                )}
              >
                <p className="font-mono text-sm font-medium">{link.name}()</p>
                <p className="text-sm text-muted-foreground">
                  {link.returned
                    ? `返回 ${link.result}`
                    : link.called
                      ? "已调用，等返回…"
                      : "还没轮到"}
                </p>
                {link.note !== undefined && !link.returned ? (
                  <p className="font-mono text-sm text-muted-foreground">
                    {link.note}
                  </p>
                ) : null}
              </SceneColumn>
            </div>
          ))}
        </div>
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamText
          label="getWeather 的描述"
          value={weatherDescription}
          rows={2}
          onChange={(value) => setParam("weatherDescription", value)}
          hint="把内容清空再看：Agent 选不到它了，链子断在第一环。"
        />
        <div className="min-w-[16rem] flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            模型看到的工具定义（点上面的卡片切换）
          </p>
          <MonoBlock tone="boxed">{JSON.stringify(detail, null, 2)}</MonoBlock>
        </div>
      </SceneControls>
    </div>
  );
}