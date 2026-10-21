"use client";

/**
 * 技术要点卡（2026-10-20）
 *
 * 为什么替换费曼复习卡
 * ------------------
 * 费曼卡训练的是「概念理解」（假装讲给小学生），但平台复刻阶段需要的
 * 是「技术零件清单」——学生要有能喂给 AI 生成教材的原材料。
 *
 * 五栏填空
 * ------
 * 1. 一句话（这个模块做什么）
 * 2. 核心机制（怎么跑的）
 * 3. 关键零件（至少 3 个技术组件）
 * 4. 常见坑（一个具体问题）
 * 5. 前后关系（依赖什么、服务什么）
 *
 * 提交后展示参考答案并排对比，全程零 AI 调用、零流量。
 * 学生答案持久化到 localStorage（按 studentId 隔离），跨模块累积。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Link2,
  Puzzle,
  Siren,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentStudentId } from "@/lib/client-identity";
import {
  getKnowledgeCardReference,
  type StudentCard,
} from "@/lib/knowledge-card-reference";

const STORAGE_BASE = "knowledge-cards";

function storageKey(): string {
  return `${STORAGE_BASE}:${currentStudentId()}`;
}

function loadCards(): Record<string, StudentCard> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(storageKey());
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCards(cards: Record<string, StudentCard>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(), JSON.stringify(cards));
}

const FIELD_DEFS = [
  {
    key: "summary" as const,
    icon: Zap,
    label: "一句话",
    hint: "这个模块是做什么的？用你自己的话写一句。",
    example:
      "例如：调用大模型的标准方式——构造消息发过去，接收回复读回来。",
    rows: 2,
  },
  {
    key: "mechanism" as const,
    icon: Puzzle,
    label: "核心机制",
    hint: "它是怎么跑的？不是怎么用的——描述运行原理，不是操作步骤。",
    example:
      "例如：请求-响应模型，每次调用独立。流式模式下逐 token 返回，前端用 TextDecoder 解码渲染。",
    rows: 3,
  },
  {
    key: "parts" as const,
    icon: BookOpen,
    label: "关键零件",
    hint: "最少列 3 个技术组件，每个用一句话说清它是什么、为什么需要。",
    example: "1. \n2. \n3. ",
    rows: 5,
  },
  {
    key: "pitfall" as const,
    icon: Siren,
    label: "常见坑",
    hint: "你踩过或听说过的一个具体问题。不是泛泛而谈——要具体到「做了什么 → 出了什么错」。",
    example:
      "例如：stream 数据直接用 toString() → 中文被截断在两个 chunk 之间时乱码。",
    rows: 3,
  },
  {
    key: "relationships" as const,
    icon: Link2,
    label: "前后关系",
    hint: "这个模块依赖前面的什么？后面的什么依赖它？",
    example:
      "例如：是 system-prompt 和 agent-loop 的前置，因为 system 消息和循环的每一步都调 API。",
    rows: 3,
  },
] as const;

function parseParts(raw: string): string[] {
  return raw
    .split(/\n/)
    .map((s) => s.replace(/^\d+[\.\)、\s]+/, "").trim())
    .filter(Boolean);
}

export function KnowledgeCard({
  moduleId,
  moduleName,
}: {
  moduleId: string;
  moduleName: string;
}) {
  const ref = useMemo(() => getKnowledgeCardReference(moduleId), [moduleId]);
  const [mounted, setMounted] = useState(false);

  const [answers, setAnswers] = useState({
    summary: "",
    mechanism: "",
    parts: "",
    pitfall: "",
    relationships: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [expandedExplanations, setExpandedExplanations] = useState<
    Record<string, boolean>
  >({});
  const [focusedFields, setFocusedFields] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setMounted(true);
    const cards = loadCards();
    const existing = cards[moduleId];
    if (existing) {
      setAnswers({
        summary: existing.summary,
        mechanism: existing.mechanism,
        parts: existing.parts.join("\n"),
        pitfall: existing.pitfall,
        relationships: existing.relationships,
      });
      setSubmitted(true);
    }
  }, [moduleId]);

  const handleChange = useCallback(
    (field: keyof typeof answers, value: string) => {
      setAnswers((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const cards = loadCards();
    cards[moduleId] = {
      summary: answers.summary.trim(),
      mechanism: answers.mechanism.trim(),
      parts: parseParts(answers.parts),
      pitfall: answers.pitfall.trim(),
      relationships: answers.relationships.trim(),
      submittedAt: new Date().toISOString(),
    };
    saveCards(cards);
    setSubmitted(true);
  }, [moduleId, answers]);

  const handleRewrite = useCallback(() => {
    setSubmitted(false);
  }, []);

  const toggleExplanation = useCallback((key: string) => {
    setExpandedExplanations((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleFocus = useCallback((key: string) => {
    setFocusedFields((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const isComplete = Object.values(answers).every((v) => v.trim().length > 0);

  if (!mounted) {
    return (
      <div className="rounded-lg border px-4 py-6">
        <div className="h-40 animate-pulse rounded bg-muted/50" />
      </div>
    );
  }

  if (!ref) {
    return (
      <CardShell>
        <p className="text-sm text-muted-foreground">
          暂无 {moduleName} 的参考答案数据。
        </p>
      </CardShell>
    );
  }

  if (!submitted) {
    return (
      <CardShell>
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="text-sm font-medium">
            技术要点卡 —— {moduleName}
          </span>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
          学完这一讲，用你自己的话把关键技术要点写下来。
          后面做平台复刻时，这些卡片就是生成教材的原材料。
        </p>

        <div className="space-y-4">
          {FIELD_DEFS.map((def) => {
            const Icon = def.icon;
            const isFocused = focusedFields.has(def.key);

            return (
              <div key={def.key}>
                <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  {def.label}
                </label>
                <p className="mb-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  {def.hint}
                </p>

                <textarea
                  className={
                    "w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none" +
                    (isFocused || answers[def.key] ? "" : " text-muted-foreground/50")
                  }
                  rows={def.rows}
                  value={isFocused ? answers[def.key] : answers[def.key] || def.example}
                  onChange={(e) => handleChange(def.key, e.target.value)}
                  onFocus={() => handleFocus(def.key)}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">
            {isComplete ? "已填写完整" : "还有空白项未填"}
          </span>
          <Button size="sm" onClick={handleSubmit} disabled={!isComplete}>
            提交答案
          </Button>
        </div>
      </CardShell>
    );
  }

  // Submitted state: comparison view
  const studentParts = parseParts(answers.parts);
  const refParts = ref.parts;

  return (
    <CardShell>
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2
          className="size-4 shrink-0 text-emerald-600"
          aria-hidden
        />
        <span className="text-sm font-medium">
          参考答案 —— {moduleName}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={handleRewrite}
        >
          重写
        </Button>
      </div>

      <div className="space-y-4">
        {/* Summary */}
        <CompareBlock
          icon={Zap}
          label="一句话"
          student={answers.summary.trim()}
          reference={ref.summary}
          explanation={ref.explanations.summary}
          expanded={!!expandedExplanations.summary}
          onToggle={() => toggleExplanation("summary")}
        />

        {/* Mechanism */}
        <CompareBlock
          icon={Puzzle}
          label="核心机制"
          student={answers.mechanism.trim()}
          reference={ref.mechanism}
          explanation={ref.explanations.mechanism}
          expanded={!!expandedExplanations.mechanism}
          onToggle={() => toggleExplanation("mechanism")}
        />

        {/* Parts */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
            <BookOpen className="size-3.5 shrink-0 text-muted-foreground" />
            关键零件
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                你的回答
              </p>
              {studentParts.length > 0 ? (
                <ul className="list-inside list-disc space-y-1 text-[12px] leading-relaxed">
                  {studentParts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] italic text-muted-foreground">
                  未填写
                </p>
              )}
            </div>
            <div className="rounded-md border bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/20">
              <p className="mb-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                参考答案
              </p>
              <ul className="list-inside list-disc space-y-1 text-[12px] leading-relaxed">
                {refParts.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
          <ExplanationToggle
            expanded={!!expandedExplanations.parts}
            onToggle={() => toggleExplanation("parts")}
          />
          {expandedExplanations.parts && (
            <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {ref.explanations.parts.map((e, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    <span className="font-medium text-foreground">
                      {i + 1}.{" "}
                    </span>
                    {e}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>

        {/* Pitfall */}
        <CompareBlock
          icon={Siren}
          label="常见坑"
          student={answers.pitfall.trim()}
          reference={ref.pitfall}
          explanation={ref.explanations.pitfall}
          expanded={!!expandedExplanations.pitfall}
          onToggle={() => toggleExplanation("pitfall")}
        />

        {/* Relationships */}
        <CompareBlock
          icon={Link2}
          label="前后关系"
          student={answers.relationships.trim()}
          reference={ref.relationships}
          explanation={ref.explanations.relationships}
          expanded={!!expandedExplanations.relationships}
          onToggle={() => toggleExplanation("relationships")}
        />
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground">
        你的答案已保存。完成所有模块后，这些卡片可以在平台复刻阶段用来生成教学文档。
      </p>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-4 py-4">{children}</div>
  );
}

function CompareBlock({
  icon: Icon,
  label,
  student,
  reference,
  explanation,
  expanded,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  student: string;
  reference: string;
  explanation: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            你的回答
          </p>
          <p className="text-[12px] leading-relaxed whitespace-pre-wrap">
            {student || (
              <span className="italic text-muted-foreground">未填写</span>
            )}
          </p>
        </div>
        <div className="rounded-md border bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/20">
          <p className="mb-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            参考答案
          </p>
          <p className="text-[12px] leading-relaxed">{reference}</p>
        </div>
      </div>
      <ExplanationToggle expanded={expanded} onToggle={onToggle} />
      {expanded && (
        <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

function ExplanationToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      onClick={onToggle}
    >
      {expanded ? (
        <ChevronUp className="size-3" />
      ) : (
        <ChevronDown className="size-3" />
      )}
      {expanded ? "收起解析" : "查看解析"}
    </button>
  );
}