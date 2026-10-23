"use client";

/**
 * 场景：检索-生成流程（模块 5 `rag`）
 *
 * 动画步骤照 `module-specs.md` 模块 5 的「3. 可视化」逐条实现：用户提问 →
 * 问题向量化 → 飞向知识库 → 检索到片段并依次亮起 → 组装成新 Prompt →
 * 生成回答并标注引用。
 *
 * 样本数据与拼装逻辑在 `scene-rag-fixture.ts`，本文件只负责画。这样切之后那边
 * 能被回归测试直接 import（测试不编译 JSX），而这里只剩下布局与状态判断。
 *
 * 两个交互都得有真后果，否则不如不做
 * -----------------------------
 * 1. **topK 滑块**：拖动时检索条数真的变，回答句子也跟着变（要点数变了）。往小拖
 *    是「缺要点」，往大拖是「捞进低相关噪声」—— 模块 5 的常见误解「检索越多越好」
 *    就是被后一个方向演示掉的。
 * 2. **点引用**：点「引用 2」会高亮第 2 条资料卡，那就是这句回答的出处。引用若
 *    不能回指原文，「可溯源」就只是页面上的三个字。
 *
 * 发出去的 Prompt 是现场拼的，不是截好的字符串 —— 拖 topK 时它会跟着变长变短。
 * 学生要看到的正是这件事：RAG 发出去的不是原问题，而是「问题 + 资料」拼成的新请求。
 */

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneColumn, SceneFrame } from "./scene-canvas";
import { ParamSlider, SceneControls } from "./scene-controls";
import { MonoBlock, SceneArrow } from "./scene-parts";
import { paramNumber, paramString } from "./scene-params";
import {
  RELEVANT_COUNT,
  buildAnswer,
  buildPrompt,
  retrieve,
} from "./scene-rag-fixture";
import { Typewriter } from "./scene-typewriter";
import type { SceneProps } from "./scene-types";

const QUESTION = "作业提交截止日期是什么？";
/** 示例向量；真实模型一般是 1024 或 1536 维，这里只取前几维示意。 */
const VECTOR = "[0.12, -0.88, 0.34, 0.07, -0.41, …]";

export function SceneRetrieveGenerate({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const topK = paramNumber(params, "topK", 3, { min: 1, max: 5 });
  const focused = paramString(params, "focused", "");
  const reached = (n: number) => stepIndex >= n;

  const retrieved = retrieve(topK);
  const answer = buildAnswer(retrieved);
  const prompt = buildPrompt(retrieved, QUESTION);
  const missing = retrieved.filter((chunk) => chunk.relevant).length;

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="检索-生成流程" caption={caption}>
        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="text-sm text-muted-foreground">用户输入</p>
          <p className="mt-0.5 text-sm">{QUESTION}</p>
        </div>

        {reached(1) ? (
          <MonoBlock tone="boxed">{`问题 → ${VECTOR}`}</MonoBlock>
        ) : null}

        <SceneArrow
          direction="down"
          tone={reached(2) ? "done" : "idle"}
          label="向量检索"
        />

        <div
          className={cn(
            "flex flex-col gap-1.5 rounded-md border border-dashed p-2 transition-colors",
            reached(3) ? "border-ring" : "border-border opacity-60",
          )}
        >
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Search className="size-3.5" />
            知识库
            <span className="font-normal text-muted-foreground">
              {reached(3)
                ? `检索到 ${retrieved.length} 个片段`
                : "还没开始检索"}
            </span>
          </p>
          <SceneColumn>
            {retrieved.map((chunk, index) => (
              <div
                key={chunk.id}
                className={cn(
                  "flex items-start gap-2 rounded border px-2 py-1.5 text-sm leading-relaxed transition-colors",
                  focused === chunk.id
                    ? "border-ring bg-accent"
                    : chunk.relevant
                      ? "border-border bg-card"
                      : "border-dashed border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <span className="shrink-0 font-mono text-sm">
                  引用 {index + 1}
                </span>
                <span className="min-w-0 flex-1">{chunk.text}</span>
                {chunk.relevant ? null : (
                  <span className="shrink-0 rounded bg-rose-100 px-1 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-200">
                    低相关
                  </span>
                )}
              </div>
            ))}
          </SceneColumn>
        </div>

        {reached(4) ? (
          <div className="flex animate-in flex-col gap-1 duration-300 fade-in">
            <span className="text-sm text-muted-foreground">
              发给模型的新 Prompt —— 资料与问题拼在一起
            </span>
            <MonoBlock tone="boxed">{prompt}</MonoBlock>
          </div>
        ) : null}

        {reached(5) ? (
          <div className="animate-in rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-sm duration-300 fade-in dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-sm text-muted-foreground">生成回答</p>
            <p className="mt-1 leading-relaxed">
              <Typewriter text={answer} />
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-sm text-muted-foreground">
                点引用看原文：
              </span>
              {retrieved.map((chunk, index) => (
                <button
                  key={chunk.id}
                  type="button"
                  onClick={() => setParam("focused", chunk.id)}
                  aria-pressed={focused === chunk.id}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-sm transition-colors",
                    focused === chunk.id
                      ? "border-ring bg-accent font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  [{index + 1}]
                </button>
              ))}
            </div>
            {missing < RELEVANT_COUNT ? (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                只检索到 {missing} 条相关片段，回答就只有这么多 ——
                缺的要点它并不知道， 它只会基于检索到的内容说。
              </p>
            ) : null}
          </div>
        ) : null}
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamSlider
          label="topK（检索几条）"
          value={topK}
          min={1}
          max={5}
          onChange={(value) => setParam("topK", value)}
          hint="往小拖：回答会缺要点。往大拖：会捞进低相关片段，反而干扰模型。"
        />
      </SceneControls>
    </div>
  );
}
