"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clipboard,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  Terminal,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidateSubmit } from "@/components/code/validate-submit";

import type { ReplicaPhase } from "@/lib/platform-replica-phases";
import {
  extractCodeBlockFromMarkdown,
  isStandalonePhase,
  parseAgentTool,
  parseStandaloneScript,
  type AgentToolContent,
  type StandaloneScriptContent,
} from "@/lib/replica-check-parser";

type Tab = "script" | "agent-check" | "validate";

export function ReplicaToolbox({
  phase,
  moduleId,
}: {
  phase: ReplicaPhase;
  moduleId: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(
    phase.acceptanceScript ? "script" : "agent-check",
  );
  const [scriptCopied, setScriptCopied] = useState(false);
  const [skillRaw, setSkillRaw] = useState<string | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [copiedSections, setCopiedSections] = useState<Record<number, boolean>>({});
  const [standaloneCopied, setStandaloneCopied] = useState(false);

  const isLastPhase = phase.index === 5;
  const isStandalone = isStandalonePhase(phase.index);

  const skillId = `platform-replica-${String(phase.index).padStart(2, "0")}-check`;

  // 切换阶段时清空旧的 skill 数据，防止 Phase 1 的独立脚本内容
  // 泄漏到 Phase 2+ 的 Agent 自查面板中。
  useEffect(() => {
    setSkillRaw(null);
    setSkillError(null);
  }, [phase.index]);

  const skillParsed = useMemo(() => {
    if (!skillRaw) return null;
    if (isStandalone) {
      return parseStandaloneScript(skillRaw);
    }
    return parseAgentTool(skillRaw);
  }, [skillRaw, isStandalone]);

  const loadSkill = useCallback(async () => {
    if (skillRaw !== null || skillLoading) return;
    setSkillLoading(true);
    setSkillError(null);
    try {
      const res = await fetch(`/api/skill?skillId=${skillId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? String(res.status));
      }
      const data = (await res.json()) as { content: string };
      setSkillRaw(data.content);
    } catch (err: unknown) {
      setSkillError(err instanceof Error ? err.message : String(err));
    } finally {
      setSkillLoading(false);
    }
  }, [skillRaw, skillLoading, skillId]);

  useEffect(() => {
    if (activeTab === "agent-check" && skillRaw === null) {
      loadSkill();
    }
  }, [activeTab, skillRaw, loadSkill]);

  const copyScript = useCallback(async () => {
    if (!phase.acceptanceScript) return;
    await navigator.clipboard.writeText(phase.acceptanceScript);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  }, [phase.acceptanceScript]);

  const copySection = useCallback(async (index: number, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedSections((prev) => ({ ...prev, [index]: true }));
    setTimeout(() => {
      setCopiedSections((prev) => ({ ...prev, [index]: false }));
    }, 2000);
  }, []);

  const copyStandalone = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code);
    setStandaloneCopied(true);
    setTimeout(() => setStandaloneCopied(false), 2000);
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    ...(phase.acceptanceScript
      ? [
          {
            key: "script" as Tab,
            label: "验收脚本",
            icon: <Terminal className="size-3.5" />,
          },
        ]
      : []),
    {
      key: "agent-check" as Tab,
      label: isStandalone ? "自查脚本" : "Agent 自查",
      icon: <Wrench className="size-3.5" />,
    },
    ...(isLastPhase
      ? [
          {
            key: "validate" as Tab,
            label: "交付与检验单",
            icon: <MessageSquare className="size-3.5" />,
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">工具箱</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-base font-medium transition-colors " +
                (activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 验收脚本 Tab */}
        {activeTab === "script" && phase.acceptanceScript ? (
          <div className="flex flex-col gap-2">
            <p className="text-base text-muted-foreground">
              在项目目录下打开终端，逐条运行。每条标注了预期输出。
            </p>
            <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-3 font-mono text-base leading-relaxed dark:border-slate-800 dark:bg-slate-900/50">
              {phase.acceptanceScript}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="self-end"
              onClick={copyScript}
            >
              {scriptCopied ? (
                <>
                  <ClipboardCheck className="mr-1.5 size-3.5" />
                  已复制
                </>
              ) : (
                <>
                  <Clipboard className="mr-1.5 size-3.5" />
                  复制脚本
                </>
              )}
            </Button>
            {phase.acceptanceDesc ? (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-base text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                {phase.acceptanceDesc}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Agent 自查 / 自查脚本 Tab */}
        {activeTab === "agent-check" ? (
          <div className="flex flex-col gap-2">
            {skillLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {isStandalone ? "加载自查脚本…" : "加载校验工具…"}
              </div>
            ) : skillError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30">
                加载失败：{skillError}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    setSkillRaw(null);
                    setSkillError(null);
                    setSkillLoading(false);
                  }}
                >
                  重试
                </Button>
              </div>
            ) : skillParsed ? (
              <>
                <p className="text-base text-muted-foreground">
                  {"intro" in skillParsed ? (skillParsed as { intro: string }).intro : ""}
                </p>

                {/* ── 独立脚本模式：一个大代码块 + 运行方式 + 预期输出 ── */}
                {isStandalone && "script" in skillParsed ? (
                  <>
                    {(function () {
                      const content = skillParsed as StandaloneScriptContent;
                      return (
                        <div className="flex flex-col gap-5">
                          <div className="flex items-center justify-between">
                            <span className="text-base font-medium text-muted-foreground">
                              验收脚本
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-base"
                              onClick={() => copyStandalone(content.script)}
                            >
                              {standaloneCopied ? (
                                <>
                                  <ClipboardCheck className="mr-1 size-3" />
                                  已复制
                                </>
                              ) : (
                                <>
                                  <Clipboard className="mr-1 size-3" />
                                  复制代码
                                </>
                              )}
                            </Button>
                          </div>
                          <pre className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-100 p-2.5 font-mono text-base leading-relaxed whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-900/50">
                            {content.script}
                          </pre>

                          {content.runInstructions ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                              <div className="mb-2 text-base font-medium text-amber-800 dark:text-amber-400">
                                怎么运行
                              </div>
                              <div className="whitespace-pre-wrap font-mono text-base leading-relaxed text-amber-700 dark:text-amber-300">
                                {extractCodeBlockFromMarkdown(content.runInstructions)}
                              </div>
                            </div>
                          ) : null}

                          {content.expectedOutput ? (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                              <div className="mb-2 text-base font-medium text-green-800 dark:text-green-400">
                                你会看到什么
                              </div>
                              <div className="whitespace-pre-wrap font-mono text-base leading-relaxed text-green-700 dark:text-green-300">
                                {extractCodeBlockFromMarkdown(content.expectedOutput)}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </>
                ) : null}

                {/* ── Agent 工具模式：Schema + Execute + Install + Usage ── */}
                {!isStandalone && "codeSections" in skillParsed ? (
                  <>
                    {(function () {
                      const content = skillParsed as AgentToolContent;
                      return (
                        <>
                          {content.codeSections.map((section, i) => (
                            <div key={i} className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-base font-medium text-muted-foreground">
                                  {section.title}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-base"
                                  onClick={() => copySection(i, section.code)}
                                >
                                  {copiedSections[i] ? (
                                    <>
                                      <ClipboardCheck className="mr-1 size-3" />
                                      已复制
                                    </>
                                  ) : (
                                    <>
                                      <Clipboard className="mr-1 size-3" />
                                      复制代码
                                    </>
                                  )}
                                </Button>
                              </div>
                              <pre className="max-h-44 overflow-y-auto rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 font-mono text-base leading-relaxed whitespace-pre-wrap dark:border-indigo-800 dark:bg-indigo-950/30">
                                {section.code.slice(0, 1500)}
                                {section.code.length > 1500 ? (
                                  <span className="text-muted-foreground">
                                    {"\n\n"}...（内容过长，已截断预览。点击「复制代码」获取完整内容）
                                  </span>
                                ) : null}
                              </pre>
                            </div>
                          ))}

                          {content.installSteps ? (
                            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/30">
                              <div className="mb-2 text-base font-medium text-orange-800 dark:text-orange-400">
                                安装步骤
                              </div>
                              <div className="whitespace-pre-wrap font-mono text-base leading-relaxed text-orange-700 dark:text-orange-300">
                                {content.installSteps}
                              </div>
                            </div>
                          ) : null}

                          {content.usage ? (
                            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/30">
                              <div className="mb-2 text-base font-medium text-purple-800 dark:text-purple-400">
                                使用方法
                              </div>
                              <div className="whitespace-pre-wrap font-mono text-base leading-relaxed text-purple-700 dark:text-purple-300">
                                {content.usage}
                              </div>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {/* 交付与检验单 Tab */}
        {activeTab === "validate" ? (
          <div className="flex flex-col gap-2">
            <p className="text-base text-muted-foreground">
              逐条对照 8 条验收清单，每条写一句话证据贴进编辑器，点「提交点评」。点评导师按评分维度出正式检验单（维度分、扣分点、改进建议，并计入掌握度）。
            </p>
            <ValidateSubmit moduleId={moduleId} redirectOnComplete={false} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}