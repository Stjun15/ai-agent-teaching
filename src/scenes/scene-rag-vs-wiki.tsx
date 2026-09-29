"use client";

/**
 * 场景：RAG vs Wiki 对比（模块 6 `llm-wiki`）
 *
 * 动画步骤照 `module-specs.md` 模块 6 的「3. 可视化」逐条实现：左侧传统 RAG →
 * 右侧 LLM Wiki 知识树生长 → 两栏对比 → 复利效应。
 *
 * 这一场不能只是「两栏并排」：并排谁都会画，难的是让「复利」变成看得见的东西。
 * 这里用一根「每次查询要读多少」的条 —— 左边随资料份数线性变长，右边始终一小截，
 * 拖动份数滑块差距自己张开。复利复的是**成本差**，不是一个虚的箭头。
 *
 * 节点取自本项目真实的 wiki 结构：点击看到的 `concepts/*.md` 与
 * `students/{id}/*.md` 都是仓库里真实存在的路径（见 `SCHEMA.md`）。用一个编出来的
 * 目录演示「知识树的形状」，学生会去比对项目里的真实目录 —— 对不上就整段不可信。
 *
 * 三种视图（两栏 / 只看一边）来自规格里的「切换左右对比」：窄屏下两栏会堆叠，
 * 切成单栏能看得更清，所以这不是摆设。
 */

import { FileText, GitBranch } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneColumn, SceneFrame } from "./scene-canvas";
import { ParamChoice, ParamSlider, SceneControls } from "./scene-controls";
import { MonoBlock } from "./scene-parts";
import { paramNumber, paramString } from "./scene-params";
import type { SceneProps } from "./scene-types";

/** 知识树上的节点 —— 路径与 `SCHEMA.md` / `wiki-schema.md` 的真实结构一致。 */
const NODES = [
  { id: "llm-api", kind: "concept", path: "concepts/llm-api.md" },
  { id: "rag", kind: "concept", path: "concepts/rag.md" },
  { id: "llm-wiki", kind: "concept", path: "concepts/llm-wiki.md" },
  { id: "mastery", kind: "student", path: "students/{id}/mastery.md" },
  { id: "errors", kind: "student", path: "students/{id}/errors.md" },
];

/** 对比表，逐行取自模块 6 概念页的「RAG vs LLM Wiki」。 */
const CONTRAST = [
  ["模式", "解释器：每次现场算", "编译器：一次编译后直接读"],
  ["每次查询", "重新检索一遍资料", "读已编译的知识"],
  ["积累", "没有", "有复利效应"],
  ["成本", "随查询次数线性增长", "一次编译，持续复用"],
];

export function SceneRagVsWiki({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const documents = paramNumber(params, "documents", 20, { min: 1, max: 100 });
  const view = paramString(params, "view", "both");
  const selected = paramString(params, "node", "llm-wiki");
  const reached = (n: number) => stepIndex >= n;
  const node = NODES.find((item) => item.id === selected) ?? NODES[0];

  const showRag = view !== "wiki";
  const showWiki = view !== "rag";
  const twoUp = showRag && showWiki;
  /** 树随资料份数长出新节点：这是「Wiki 像树一样生长」的可控版本。 */
  const grown = Math.min(NODES.length, 1 + Math.floor(documents / 25));

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="RAG 与 LLM Wiki 对比" caption={caption}>
        <div
          className={cn("grid gap-2", twoUp ? "sm:grid-cols-2" : "grid-cols-1")}
        >
          {showRag ? (
            <SceneColumn className="rounded-md border border-border bg-card p-2.5">
              <p className="text-sm font-medium">
                传统 RAG · 解释器模式{reached(0) ? "" : "（还没出现）"}
              </p>
              {reached(0) ? (
                <>
                  <p className="rounded border border-dashed border-border px-2 py-1 text-sm text-muted-foreground">
                    第一次查询：从零检索 {documents} 份资料 → 现场拼 Prompt
                  </p>
                  <p className="text-sm text-muted-foreground">
                    第二次、第三次：一模一样，再把全部资料读一遍
                  </p>
                </>
              ) : null}
            </SceneColumn>
          ) : null}

          {showWiki ? (
            <SceneColumn className="rounded-md border border-border bg-card p-2.5">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <GitBranch className="size-3.5" />
                LLM Wiki · 编译器模式{reached(1) ? "" : "（还没出现）"}
              </p>
              {reached(1)
                ? NODES.slice(0, grown).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setParam("node", item.id)}
                      aria-pressed={item.id === selected}
                      className={cn(
                        "flex items-center gap-1.5 rounded border px-2 py-1 text-left font-mono text-sm transition-colors",
                        item.id === selected
                          ? "border-ring bg-accent font-medium"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <FileText className="size-3" />
                      {item.path}
                    </button>
                  ))
                : null}
            </SceneColumn>
          ) : null}
        </div>

        {reached(2) ? (
          <div className="flex animate-in flex-col gap-1 duration-300 fade-in">
            {CONTRAST.map(([dimension, ragSide, wikiSide]) => (
              <div
                key={dimension}
                className={cn(
                  "grid gap-2 rounded border border-border px-2 py-1 text-sm",
                  twoUp ? "sm:grid-cols-[5rem_1fr_1fr]" : "grid-cols-1",
                )}
              >
                <span className="font-medium">{dimension}</span>
                {showRag ? (
                  <span className="text-muted-foreground">{ragSide}</span>
                ) : null}
                {showWiki ? <span>{wikiSide}</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {reached(3) ? (
          <div className="flex animate-in flex-col gap-1.5 rounded-md border border-ring bg-accent/30 p-2 duration-300 fade-in">
            <p className="text-sm font-medium">
              复利效应 · 每次查询要读多少（资料 {documents} 份）
            </p>
            <RatioBar label="RAG" ratio={documents / 100} />
            <RatioBar label="Wiki" ratio={0.06} />
            <p className="text-sm leading-relaxed text-muted-foreground">
              左边线性增长（每次全读一遍），右边恒定（读已编译的知识结构）。资料从
              1 份加到 100 份，左边涨 100 倍，右边不变 ——
              这就是「一次编译、持续复用」。
            </p>
          </div>
        ) : null}
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamSlider
          label="wiki 里已编译的资料"
          value={documents}
          min={1}
          max={100}
          suffix=" 份"
          onChange={(value) => setParam("documents", value)}
          hint="拖到 100 份再看第 4 步：左边的条张满，右边还是那一小截。"
        />
        <ParamChoice
          label="看哪一栏"
          value={view}
          options={[
            { value: "both", label: "两栏对比" },
            { value: "rag", label: "只看 RAG" },
            { value: "wiki", label: "只看 Wiki" },
          ]}
          onChange={(value) => setParam("view", value)}
        />
        <div className="min-w-[14rem] flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            点节点看它是哪一页
          </p>
          <MonoBlock tone="boxed">
            {`type: ${node.kind}\npath: ${node.path}`}
          </MonoBlock>
        </div>
      </SceneControls>
    </div>
  );
}

/** 比例条：宽度就是「每次查询要读多少」。 */
function RatioBar({ label, ratio }: { label: string; ratio: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-9 shrink-0 font-mono">{label}</span>
      <span className="h-3 min-w-0 flex-1 overflow-hidden rounded bg-muted">
        <span
          className="block h-full rounded bg-foreground/70 transition-[width] duration-300"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
    </div>
  );
}