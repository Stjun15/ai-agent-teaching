"use client";

/**
 * 费曼复习卡（2026-10-08）
 *
 * 为什么要有这个组件
 * ----------------
 * 费曼学习法（Feynman Technique）是经过验证的最高效学习方法之一：
 * 「如果你不能简单地解释它，你就没有真正理解它。」
 *
 * 四步法
 * ------
 * 1. 选定概念 —— 闭上眼，这一讲你记住了哪一个核心概念？
 * 2. 假装教人 —— 用小学生能懂的话解释它，不准用术语
 * 3. 发现漏洞 —— 讲的过程中哪里卡壳了？那就是你的知识缺口
 * 4. 一句话说清 —— 把整个模块浓缩成一句话
 *
 * 本卡放在掌握判定之后，让学生在过关（或未过关）后有一次主动输出的机会。
 * 输出是最好的输入——费曼在《别闹了，费曼先生》里反复强调的就是这一点。
 */
import { useCallback, useState } from "react";
import { BookMarked, Lightbulb, Pencil, ScanEye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeynmanStep = 1 | 2 | 3 | 4;

const STEP_DEFS = [
  {
    step: 1 as FeynmanStep,
    icon: BookMarked,
    title: "第一步：选定概念",
    hint: "闭上眼，不要翻笔记——这一讲你脑子里印象最深的一个概念是什么？",
    placeholder:
      "写一个词或短语就行，比如「Agent Loop」「System Prompt」「RAG」……",
  },
  {
    step: 2 as FeynmanStep,
    icon: Pencil,
    title: "第二步：假装教人",
    hint: "假设你对面坐着一个完全不懂编程的8岁小孩。用大白话把你刚写的概念讲给他听。不准用任何术语——如果你忍不住想用，先解释那个术语是什么意思。",
    placeholder: "「嗨，我来告诉你xxx是什么意思。你想象一下……」",
  },
  {
    step: 3 as FeynmanStep,
    icon: ScanEye,
    title: "第三步：发现漏洞",
    hint: "讲的过程中有没有哪个地方你感觉「嗯……这里我其实不太确定」？有没有说到一半卡住了？诚实写下来——发现漏洞才是真正的学习。",
    placeholder:
      "「讲到xxx的时候我卡住了，因为我还没搞懂……」或者「没问题，我能从头到尾讲清楚」",
  },
  {
    step: 4 as FeynmanStep,
    icon: Sparkles,
    title: "第四步：一句话说清",
    hint: "现在把你刚才啰啰嗦嗦讲了三分钟的东西，压成一句话。去掉所有废话，只留最核心的那层意思。",
    placeholder: "「简单说，xxx就是……」",
  },
] as const;

export function FeynmanReview() {
  const [currentStep, setCurrentStep] = useState<FeynmanStep>(1);
  const [answers, setAnswers] = useState<Record<FeynmanStep, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [done, setDone] = useState(false);

  const updateAnswer = useCallback(
    (step: FeynmanStep, value: string) =>
      setAnswers((prev) => ({ ...prev, [step]: value })),
    [],
  );

  if (done) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Lightbulb className="size-4" aria-hidden />
          复习完成
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          你刚刚用自己的话把这一讲的核心概念讲了一遍——这就是费曼学习法的精髓。
          以后每次学完一个模块，试着不用笔记、用自己的话讲一遍，你会发现自己记得更牢。
        </p>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            setCurrentStep(1);
            setAnswers({ 1: "", 2: "", 3: "", 4: "" });
            setDone(false);
          }}
        >
          重新写一次
        </Button>
        {/* 复习结果摘要：可以写到学习报告 */}
        <div className="mt-2 space-y-2 rounded-md border bg-muted/30 px-3 py-3">
          <p className="text-[11px] font-medium text-muted-foreground">
            你的费曼复习卡
          </p>
          {([1, 2, 3, 4] as FeynmanStep[]).map((s) => {
            const def = STEP_DEFS[s - 1];
            return (
              <div key={s} className="text-xs leading-relaxed">
                <span className="font-medium">{def.title.slice(5)}</span>
                <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                  {answers[s] || "（未填写）"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const def = STEP_DEFS[currentStep - 1];
  const Icon = def.icon;

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-4 py-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-medium">{def.title}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {currentStep} / 4
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {def.hint}
      </p>

      <textarea
        className="min-h-[120px] w-full resize-y rounded-md border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
        placeholder={def.placeholder}
        value={answers[currentStep]}
        onChange={(e) => updateAnswer(currentStep, e.target.value)}
        rows={4}
      />

      <div className="flex items-center justify-between">
        {currentStep > 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentStep((prev) => Math.max(1, prev - 1) as FeynmanStep)
            }
          >
            上一步
          </Button>
        ) : (
          <span />
        )}
        {currentStep < 4 ? (
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              setCurrentStep((prev) => Math.min(4, prev + 1) as FeynmanStep)
            }
          >
            下一步
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => setDone(true)}
            disabled={!answers[4].trim()}
          >
            完成
          </Button>
        )}
      </div>
    </div>
  );
}
