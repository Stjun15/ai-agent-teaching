"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Circle, Lightbulb, RotateCcw } from "lucide-react";

const LEARN_STEPS = [
  { label: "概念讲解", done: true },
  { label: "观察示范", done: true },
  { label: "动手模仿", done: false },
  { label: "校验点评", done: false },
  { label: "可视化演示", done: false },
  { label: "变式练习", done: false },
  { label: "掌握判定", done: false },
] as const;

const MOCK_ADJUSTMENTS: Array<{
  type: "consecutive" | "buildup" | "decline" | "skip";
  reason: string;
  action: string;
  date: string;
}> = [
  {
    type: "consecutive",
    reason: "概念「tool-calling」连续 3 次校验不通过",
    action: "建议插入 3 道变式练习题，回放该概念的教学讲解。",
    date: "2026-09-26",
  },
  {
    type: "buildup",
    reason: "概念「tool-calling」累计错题 5 次，已达预警线",
    action: "建议暂停推进至下一模块，先对 tool-calling 进行集中复习后再继续。",
    date: "2026-09-25",
  },
  {
    type: "decline",
    reason: "掌握度从「system-prompt」(5/5) 下降到「tool-calling」(2/5)",
    action: "建议换一种讲解方式重新学习（类比优先），巩固后再继续练习。",
    date: "2026-09-24",
  },
  {
    type: "skip",
    reason: "模块「system-prompt」掌握度已达 4，但尚未标记为完成",
    action: "建议跳过剩余练习，直接进入下一模块「tool-calling」。",
    date: "2026-09-23",
  },
];

function cardIcon(type: (typeof MOCK_ADJUSTMENTS)[number]["type"]) {
  switch (type) {
    case "consecutive":
      return <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />;
    case "buildup":
      return <Lightbulb className="size-3.5 shrink-0 text-blue-500" />;
    case "decline":
      return <RotateCcw className="size-3.5 shrink-0 text-rose-500" />;
    case "skip":
      return <ArrowRight className="size-3.5 shrink-0 text-emerald-500" />;
  }
}

function typeLabel(type: (typeof MOCK_ADJUSTMENTS)[number]["type"]) {
  switch (type) {
    case "consecutive":
      return "连续失败";
    case "buildup":
      return "错题积压";
    case "decline":
      return "掌握下降";
    case "skip":
      return "建议跳过";
  }
}

function typeBadgeColor(type: (typeof MOCK_ADJUSTMENTS)[number]["type"]) {
  switch (type) {
    case "consecutive":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "buildup":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "decline":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "skip":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

export default function DemoAdjustmentsPage() {
  const [visible, setVisible] = useState(true);

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
      {/* ================================================================ */}
      {/* 左栏 —— 模拟模块页 module-workspace 的 <aside>                    */}
      {/* ================================================================ */}
      <aside className="flex w-56 shrink-0 flex-col gap-4">

        {/* ---- StepNav 模拟 ---- */}
        <nav aria-label="学习步骤" className="rounded-md border bg-card p-3">
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            学习步骤
          </h3>
          <ol className="flex flex-col gap-1.5">
            {LEARN_STEPS.map((step, i) => (
              <li
                key={step.label}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs"
              >
                {step.done ? (
                  <Check className="size-3.5 shrink-0 text-emerald-600" />
                ) : i === 2 ? (
                  <Circle className="size-3.5 shrink-0 fill-primary text-primary" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-muted-foreground/30" />
                )}
                <span
                  className={
                    step.done
                      ? "text-muted-foreground line-through"
                      : i === 2
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                  }
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        {/* ---- 路径调整（仿真 PathAdjustmentList） ---- */}
        {visible && (
          <section aria-label="路径调整" className="flex flex-col gap-2">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              路径调整
            </h2>
            <div className="flex flex-col gap-2">
              {MOCK_ADJUSTMENTS.map((adj, i) => (
                <div
                  key={i}
                  className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed"
                >
                  <span className="mt-0.5">{cardIcon(adj.type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block rounded border px-1 text-[10px] font-medium ${typeBadgeColor(adj.type)}`}
                      >
                        {typeLabel(adj.type)}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-foreground">
                      {adj.reason}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {adj.action}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {adj.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- 无调整状态（与 visible=false 对照） ---- */}
        {!visible && (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
            暂无路径调整建议
            <br />
            答题后系统会自动检测
          </div>
        )}
      </aside>

      {/* ================================================================ */}
      {/* 主区 —— 模拟教学区                                               */}
      {/* ================================================================ */}
      <main className="min-w-0 flex-1 rounded-lg border bg-card p-8">
        <h1 className="mb-2 text-xl font-semibold">
          路径调整演示
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          左栏展示了 Ploy 闭环策略的教学场景落地 —— 系统在每次答题评分后
          自动分析掌握度快照，产出路径调整建议。
        </p>

        {/* 开关 */}
        <div className="mb-8 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">调整建议：</span>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              visible
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {visible ? "已展示（点击隐藏）" : "已隐藏（点击展示）"}
          </button>
        </div>

        {/* 四条规则说明 */}
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              rule: "规则 1 · 连续失败",
              desc: "同一概念连续 3 次校验不通过（72h 内）→ 插入变式题 + 回放教学",
              icon: <AlertTriangle className="size-4 text-amber-500" />,
            },
            {
              rule: "规则 2 · 掌握下降",
              desc: "当前模块掌握度比上一已完成模块低 ≥ 2 分 → 换讲法、巩固后再练",
              icon: <RotateCcw className="size-4 text-rose-500" />,
            },
            {
              rule: "规则 3 · 错题积压",
              desc: "累计错题数（DB errorCount 字段）≥ 3 → 暂停推进、集中复习",
              icon: <Lightbulb className="size-4 text-blue-500" />,
            },
            {
              rule: "规则 4 · 建议跳过",
              desc: "掌握度 ≥ 4 但模块 status 为 in_progress → 跳过余下练习",
              icon: <ArrowRight className="size-4 text-emerald-500" />,
            },
          ].map((item) => (
            <div
              key={item.rule}
              className="flex items-start gap-2.5 rounded-md border bg-muted/20 px-4 py-3"
            >
              <span className="mt-0.5 shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-medium">{item.rule}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 数据流示意 */}
        <div className="mt-8 rounded-md border bg-muted/10 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            数据流
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
              answer-grade
            </span>
            <ArrowRight className="size-3" />
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
              path-adjuster.ts
            </span>
            <ArrowRight className="size-3" />
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">
              learning_paths.adjustments
            </span>
            <ArrowRight className="size-3" />
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
              StudentStore
            </span>
            <ArrowRight className="size-3" />
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
              PathAdjustmentList
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}