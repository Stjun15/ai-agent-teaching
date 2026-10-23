"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  FolderOpen,
  List,
  MessageSquare,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownView } from "@/components/chat/markdown-view";

import { DifficultyBadge } from "@/components/learn/difficulty-badge";
import { ReplicaToolbox } from "@/components/learn/replica-toolbox";
import { useReplicaPhase } from "@/hooks/use-replica-phase";

import {
  REPLICA_PHASES,
  type PreKnowledgeEntry,
  type ReplicaPhase,
} from "@/lib/platform-replica-phases";
import type { TeachingModule } from "@/lib/modules";

export function PlatformReplicaWorkspace({
  teachingModule,
  allModules,
}: {
  teachingModule: TeachingModule;
  allModules: readonly TeachingModule[];
}) {
  const { phaseIndex: activePhaseIndex, setPhaseIndex: setActivePhaseIndex } =
    useReplicaPhase(REPLICA_PHASES.length);
  const [wikiContent, setWikiContent] = useState<string | null>(null);
  const [wikiLoading, setWikiLoading] = useState(true);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(false);

  /** 从 wiki markdown 中提取 h2/h3 标题，生成目录项。 */
  interface TocItem {
    level: number;
    text: string;
    slug: string;
  }
  const tocItems = useMemo<TocItem[]>(() => {
    if (!wikiContent) return [];
    const headings: TocItem[] = [];
    const lines = wikiContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (!match) continue;
      const level = match[1].length;
      const text = match[2].trim();
      const slug = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
      headings.push({ level, text, slug });
    }
    return headings;
  }, [wikiContent]);

  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToHeading = useCallback((slug: string) => {
    const container = contentRef.current;
    if (!container) return;
    const el = container.querySelector(
      `#${CSS.escape(slug)}`,
    ) as HTMLElement | null;
    if (!el) return;
    container.scrollTo({
      top: el.offsetTop - container.offsetTop,
      behavior: "smooth",
    });
  }, []);

  /**
   * 拉取完整教案。
   *
   * 注意：这里**不**在开头同步置 `wikiLoading` —— 挂载时初值本来就是 true，
   * 而重试按钮自己负责置位（见 `retryWikiContent`）。effect 里只 await
   * 网络结果再落状态，不会造成 effect 内同步 setState 的级联渲染。
   */
  const fetchWikiContent = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/module-content?moduleId=" + encodeURIComponent(teachingModule.id),
      );
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ message: String(res.status) }));
        throw new Error(body.message ?? String(res.status));
      }
      const data = (await res.json()) as { content: string };
      setWikiContent(data.content);
    } catch (err: unknown) {
      setWikiError(err instanceof Error ? err.message : String(err));
    } finally {
      setWikiLoading(false);
    }
  }, [teachingModule.id]);

  const retryWikiContent = useCallback(() => {
    setWikiLoading(true);
    setWikiError(null);
    void fetchWikiContent();
  }, [fetchWikiContent]);

  const loadedPhaseRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // 用 async IIFE 表达「只在 await 之后落状态」：effect 体内没有同步
    // setState（fetchWikiContent 的 loading/error/content 更新都在 await 之后）。
    void (async () => {
      await fetchWikiContent();
    })();
  }, [fetchWikiContent]);

  useEffect(() => {
    if (wikiContent === null) return;
    const loadPhase = async (phaseIdx: number) => {
      if (loadedPhaseRef.current.has(phaseIdx)) return;
      loadedPhaseRef.current = new Set(loadedPhaseRef.current).add(phaseIdx);
      const phaseId = String(phaseIdx).padStart(2, "0");
      try {
        const res = await fetch(
          `/api/module-content?moduleId=platform-replica-${phaseId}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { content: string };
        setWikiContent(data.content);
      } catch {
        loadedPhaseRef.current.delete(phaseIdx);
      }
    };

    loadPhase(activePhaseIndex);
  }, [activePhaseIndex, wikiContent === null]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [activePhaseIndex]);

  const prerequisiteNames = teachingModule.prerequisites.map(
    (id) => allModules.find((m) => m.id === id)?.name ?? id,
  );
  const phase = REPLICA_PHASES[activePhaseIndex];

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
      <nav aria-label="面包屑" className="mb-3 text-xs text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/learn" className="underline-offset-4 hover:underline">
              学习中心
            </Link>
          </li>
          <ChevronRight className="size-3" aria-hidden />
          <li className="text-foreground">{teachingModule.name}</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {teachingModule.name}
        </h1>
        <DifficultyBadge difficulty={teachingModule.difficulty} />
        <Badge variant="outline">
          <Clock aria-hidden />
          {teachingModule.estimatedTime}
        </Badge>
        {prerequisiteNames.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            前置：{prerequisiteNames.join("、")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            无前置，从这里开始
          </span>
        )}
      </header>

      {teachingModule.summary ? (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {teachingModule.summary}
        </p>
      ) : null}

      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        这一讲在浏览器外完成：命令敲在<b>你自己电脑的终端</b>里，代码写在
        <b>你自己的项目</b>
        里。这个页面是你的任务卡、验收速查和导师——卡住了随时问。
      </p>

      {/* ---- 双栏：阶段导航 + 阶段详情 ---- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="搭建阶段" className="flex flex-col gap-1">
          {REPLICA_PHASES.map((p, i) => {
            const isActive = i === activePhaseIndex;
            const isDone = i < activePhaseIndex;
            const isLast = i === REPLICA_PHASES.length - 1;

            return (
              <div key={p.index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {isDone ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                  ) : isActive ? (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {i + 1}
                    </div>
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground/40" />
                  )}
                  {!isLast ? (
                    <div
                      className={
                        isDone
                          ? "my-0.5 w-px flex-1 bg-emerald-500/30"
                          : "my-0.5 w-px flex-1 bg-muted"
                      }
                    />
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setActivePhaseIndex(i)}
                  className={
                    "flex-1 pb-5 text-left text-sm transition-colors " +
                    (isActive
                      ? "font-semibold text-foreground"
                      : isDone
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-muted-foreground/60 hover:text-muted-foreground")
                  }
                >
                  <div>{p.title}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed opacity-70">
                    {isDone
                      ? "已完成"
                      : p.goal.length > 28
                        ? p.goal.slice(0, 28) + "..."
                        : p.goal}
                  </div>
                </button>
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-4">
          {phase ? (
            <PhaseDetailCard phase={phase} />
          ) : (
            <p className="text-sm text-muted-foreground">阶段数据缺失</p>
          )}

          {/* ---- 工具箱：验收脚本 / Skill 自查 / 交付与检验单 ---- */}
          <ReplicaToolbox
            phase={phase!}
            moduleId={teachingModule.id}
          />

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={activePhaseIndex === 0}
              onClick={() =>
                setActivePhaseIndex(Math.max(0, activePhaseIndex - 1))
              }
            >
              上一阶段
            </Button>
            <span className="text-xs text-muted-foreground">
              {activePhaseIndex + 1} / {REPLICA_PHASES.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={activePhaseIndex === REPLICA_PHASES.length - 1}
              onClick={() =>
                setActivePhaseIndex(
                  Math.min(REPLICA_PHASES.length - 1, activePhaseIndex + 1),
                )
              }
            >
              下一阶段
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ---- 教案 ---- */}
      {wikiLoading ? (
        <Card className="mt-3">
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            正在加载教案…
          </CardContent>
        </Card>
      ) : wikiError ? (
        <Card className="mt-3">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-red-600">
            <AlertTriangle className="size-4" />
            加载失败：{wikiError}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={retryWikiContent}
            >
              重试
            </Button>
          </CardContent>
        </Card>
      ) : wikiContent ? (
        <Card className="mt-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">完整教案</CardTitle>
              {tocItems.length > 0 ? (
                <Button
                  variant={showToc ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowToc((v) => !v)}
                >
                  <List className="mr-1 size-3.5" />
                  {showToc ? "隐藏目录" : "目录"}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 gap-0 p-0">
            {showToc && tocItems.length > 0 ? (
              <nav className="hidden w-52 shrink-0 overflow-y-auto border-r bg-muted/20 py-3 lg:block">
                <div className="mb-2 px-3 text-[11px] font-semibold text-muted-foreground">
                  目录
                </div>
                <ul className="space-y-0.5">
                  {tocItems.map((item, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => scrollToHeading(item.slug)}
                        className={
                          "block w-full truncate px-3 py-1 text-left text-xs transition-colors hover:bg-muted hover:text-foreground " +
                          (item.level === 2
                            ? "font-medium text-foreground/80"
                            : "pl-6 text-muted-foreground")
                        }
                        title={item.text}
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <div
              ref={contentRef}
              className="prose prose-sm dark:prose-invert max-w-none min-w-0 flex-1 overflow-y-auto px-6 py-4 [&_li]:text-[clamp(12px,1.8vw,16px)] [&_p]:text-[clamp(12px,1.8vw,16px)] [&_pre]:text-[clamp(11px,1.6vw,14px)] [&_table]:text-[clamp(11px,1.6vw,14px)]"
              style={{ maxHeight: "60vh" }}
            >
              <MarkdownView source={wikiContent ?? ""} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

/** 当前阶段的任务卡片（含详细指导和常见坑）+ 验收脚本。 */
function PhaseDetailCard({ phase }: { phase: ReplicaPhase }) {
  const hasDetailTasks = phase.tasks.some(
    (t) => t.detail || (t.pitfalls && t.pitfalls.length > 0),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            第 {phase.index + 1} / {REPLICA_PHASES.length} 阶段
          </span>
        </div>
        <CardTitle className="text-lg">{phase.title}</CardTitle>
        <p className="text-base text-muted-foreground">{phase.goal}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {phase.preKnowledge && phase.preKnowledge.length > 0 ? (
          <PreKnowledgeSection entries={phase.preKnowledge} />
        ) : null}

        {hasDetailTasks ? (
          <div className="space-y-3">
            {phase.tasks.map((task, i) => (
              <div key={i} className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-medium text-primary">
                    {i + 1}
                  </span>
                  <span className="text-base font-medium">{task.label}</span>
                  {task.file ? (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-base text-muted-foreground">
                      <FileText className="size-3" />
                      {task.file}
                    </span>
                  ) : null}
                  {task.moduleRef ? (
                    <Link
                      href={"/learn/" + task.moduleRef}
                      className="inline-flex items-center gap-1 text-base text-primary underline-offset-4 hover:underline"
                    >
                      <FolderOpen className="size-3" />
                      {task.moduleRef}
                    </Link>
                  ) : null}
                </div>

                {task.detail ? (
                  <p className="mb-2 text-base leading-relaxed whitespace-pre-line text-muted-foreground">
                    {task.detail}
                  </p>
                ) : null}

                {task.why ? (
                  <p className="mb-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-base leading-relaxed text-muted-foreground">
                    <span className="font-medium text-primary">
                      为什么有这步：
                    </span>
                    {task.why}
                  </p>
                ) : null}

                {task.askAI ? (
                  <div className="mb-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 dark:border-blue-800 dark:bg-blue-950/30">
                    <div className="mb-1 flex items-center gap-1 text-base font-medium text-blue-700 dark:text-blue-400">
                      <MessageSquare className="size-3" />
                      试试先问 AI
                    </div>
                    <p className="text-base leading-relaxed text-blue-800 dark:text-blue-300">
                      {task.askAI}
                    </p>
                  </div>
                ) : null}

                {task.stuckPrompt ? (
                  <div className="mb-2 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-2 dark:border-orange-800 dark:bg-orange-950/30">
                    <div className="mb-1 flex items-center gap-1 text-base font-medium text-orange-700 dark:text-orange-400">
                      <AlertTriangle className="size-3" />
                      卡住了？
                    </div>
                    <p className="text-base leading-relaxed text-orange-800 dark:text-orange-300">
                      {task.stuckPrompt}
                    </p>
                  </div>
                ) : null}

                {task.pitfalls && task.pitfalls.length > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-800 dark:bg-amber-950/30">
                    <div className="mb-1 flex items-center gap-1 text-base font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-3" />
                      常见坑
                    </div>
                    <ul className="space-y-0.5">
                      {task.pitfalls.map((p, j) => (
                        <li
                          key={j}
                          className="text-base leading-relaxed text-amber-800 dark:text-amber-300"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    做什么
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    用到的模块
                  </th>
                  <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">
                    关键文件
                  </th>
                </tr>
              </thead>
              <tbody>
                {phase.tasks.map((task, i) => (
                  <tr
                    key={i}
                    className={
                      "border-b last:border-0 " +
                      (i % 2 === 0 ? "bg-background" : "bg-muted/20")
                    }
                  >
                    <td className="px-3 py-2">{task.label}</td>
                    <td className="px-3 py-2">
                      {task.moduleRef ? (
                        <Link
                          href={"/learn/" + task.moduleRef}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {task.moduleRef}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 font-mono text-[11px] text-muted-foreground sm:table-cell">
                      {task.file ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {phase.acceptanceScript || phase.acceptanceDesc ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/30">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              验收脚本和 Skill 自查清单已移至下方「工具箱」面板——一键复制、一键发送给导师。
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** 前置知识速查：可折叠的词条列表，零基础学生进入阶段前先扫一眼。 */
function PreKnowledgeSection({
  entries,
}: {
  entries: PreKnowledgeEntry[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-1.5 text-base font-medium text-green-700 dark:text-green-400">
          <span className="text-base">📖</span>
          前置知识速查
          <span className="text-base font-normal text-green-600 dark:text-green-500">
            （{entries.length} 个词条，遇到不认识的先看这里）
          </span>
        </div>
        <ChevronRight
          className={`size-4 text-green-600 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded ? (
        <div className="border-t border-green-200 px-3 py-2 dark:border-green-800">
          <ul className="space-y-1.5">
            {entries.map((e, i) => (
              <li key={i} className="text-base leading-relaxed">
                <span className="font-medium text-green-800 dark:text-green-300">
                  {e.term}
                </span>
                <span className="text-green-700 dark:text-green-400">
                  {" —— "}{e.explanation}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-base text-green-600 dark:text-green-500">
            还有词不懂？在下方对话里直接问导师：「xxx 是什么意思？」
          </p>
        </div>
      ) : null}
    </div>
  );
}