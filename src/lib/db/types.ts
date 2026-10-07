/**
 * 数据模型类型定义
 *
 * 逐字来自 agent-prompts/references/data-models.md「一、TypeScript 类型定义」。
 * 除加 `export` 外未做任何改动 —— 这些类型是设计文档与数据库 schema 之间的契约，
 * 要改应先改文档，而不是改这里。
 *
 * 时间字段统一为 ISO 8601 UTC 字符串（见 migrations/001_init.sql 的映射规则）。
 */

// ---------------------------------------------------------------------------
// 学生相关
// ---------------------------------------------------------------------------

export interface Student {
  id: string;
  nickname: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  studentId: string;
  programmingBackground: "zero" | "beginner" | "intermediate";
  learningGoal: string;
  preferredLanguage: import("@/lib/languages").CodeLanguage;
  pace: "slow" | "normal" | "fast";
  explanationStyle: "analogy" | "example" | "theory";
  hintPreference: "try_first" | "hint_early" | "direct";
  feedbackPreference: "encouraging" | "strict" | "neutral";
  visualPreference: "animation" | "static" | "text";
  updatedAt: string;
}

export interface Mastery {
  studentId: string;
  conceptId: string;
  score: number;
  lastReviewedAt: string | null;
  errorCount: number;
  status: "not_started" | "in_progress" | "needs_review" | "mastered";
  updatedAt: string;
}

export interface LearningPath {
  studentId: string;
  currentModule: string;
  nextModule: string | null;
  modules: LearningPathModule[];
  adjustments: PathAdjustment[];
  updatedAt: string;
}

export interface LearningPathModule {
  order: number;
  moduleId: string;
  status: "not_started" | "in_progress" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  mastery: number;
}

export interface PathAdjustment {
  date: string;
  reason: string;
  action: string;
}

export interface ErrorRecord {
  id: string;
  studentId: string;
  moduleId: string;
  conceptId: string;
  taskType: "prompt" | "tool" | "code" | "question";
  question: string;
  studentAnswer: string;
  problems: string[];
  correctExample: string;
  relatedAntiPattern: string | null;
  isCorrected: boolean;
  variantQuestionsGenerated: number;
  nextReviewAt: string | null;
  createdAt: string;
}

export interface PromptHistory {
  id: string;
  studentId: string;
  moduleId: string;
  taskType: "prompt" | "tool" | "code";
  content: string;
  score: number;
  dimensions: PromptDimension[];
  issues: PromptIssue[];
  suggestions: string[];
  attemptNumber: number;
  isPassed: boolean;
  createdAt: string;
}

export interface PromptDimension {
  name: string;
  score: number;
  weight: number;
  comment: string;
}

export interface PromptIssue {
  type: "严重错误" | "优化建议";
  detail: string;
  deduction: number;
  relatedDimension: string;
  relatedAntiPattern: string | null;
}

export interface Project {
  id: string;
  studentId: string;
  projectTemplateId: string;
  name: string;
  status: "not_started" | "in_progress" | "completed";
  webAppChecklist: ChecklistItem[];
  ideChecklist: ChecklistItem[];
  promptRecordIds: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  mentorComment: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

// ---------------------------------------------------------------------------
// 会话相关
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  studentId: string;
  moduleId: string;
  currentStep: StepType;
  status: "active" | "paused" | "completed";
  startedAt: string;
  endedAt: string | null;
  totalTokens: number;
  totalDuration: number;
}

export type StepType =
  | "explain"
  | "observe"
  | "imitate"
  | "validate"
  | "visualize"
  | "practice"
  | "mastery";

export interface Message {
  id: string;
  sessionId: string;
  role:
    "student" | "teacher" | "reviewer" | "examiner" | "assistant" | "system";
  content: string;
  code?: string;
  language?: import("@/lib/languages").CodeLanguage;
  citations: Citation[];
  metadata: MessageMetadata;
  createdAt: string;
}

export interface MessageMetadata {
  /** 编排层 Agent 标识（teacher/reviewer/examiner/assistant/chat）。 */
  agent?: string;
  /** `agentSkill` 的别名，语义更直白；旧字段保留以兼容历史数据。 */
  agentSkill?: string;
  tokens?: { input: number; output: number };
  duration?: number;
  model?: string;
  /** 流式结束后若整轮失败，记录模型侧错误原因，便于复现。 */
  error?: string;
}

export interface Citation {
  id: string;
  messageId: string;
  source: string;
  page?: number;
  snippet: string;
  relevance: number;
}

export interface AgentEvent {
  id: string;
  sessionId: string;
  messageId: string;
  agent: "teacher" | "reviewer" | "examiner" | "assistant";
  type: "thinking" | "tool_call" | "tool_result" | "generate" | "validate";
  content: string;
  metadata: object;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 评分与题目
// ---------------------------------------------------------------------------

export interface ValidationResult {
  id: string;
  studentId: string;
  sessionId: string;
  taskType: "prompt" | "tool" | "code";
  totalScore: number;
  level: "优秀" | "良好" | "及格" | "不及格";
  isCorrect: boolean;
  dimensions: PromptDimension[];
  issues: PromptIssue[];
  suggestions: string[];
  createdAt: string;
}

export interface Question {
  id: string;
  moduleId: string;
  conceptId: string;
  type: "选择题" | "填空题" | "简答题" | "实战题";
  difficulty: number;
  scenario: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hintLevels: string[];
  relatedAntiPattern: string | null;
}

export interface QuestionResult {
  id: string;
  studentId: string;
  questionId: string;
  sessionId: string;
  studentAnswer: string;
  isCorrect: boolean;
  score: number;
  attempts: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Trace
// ---------------------------------------------------------------------------

export interface AgentTrace {
  id: string;
  traceId: string;
  timestamp: string;
  studentId: string;
  /**
   * 会话归属。**模块级调用没有会话上下文时为 null**（如出题：按模块生成练习，
   * 不隶属某个会话），与表里 `session_id` 可空一致 —— 不为记录方便编造会话 id。
   */
  sessionId: string | null;
  agent: "teacher" | "reviewer" | "examiner" | "assistant";
  skill: string;
  input: object;
  output: object;
  wikiReads: string[];
  wikiWrites: string[];
  durationMs: number;
  tokens: { input: number; output: number };
  retries: number;
  success: boolean;
  error?: string;
}

// 课程审计（2026-10-07 产品内审计员）
// ---------------------------------------------------------------------------

/**
 * 严重度。取值与 `curriculum-audit.ts` 的 AuditFinding.severity 同源 ——
 * 开发期子智能体走查与产品内审计员用同一套刻度，两边结论才能直接比。
 */
export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";

/** 一条审计发现：课程内容的一个缺陷。 */
export interface AuditFindingRecord {
  id: string;
  moduleId: string;
  moduleName: string;
  severity: AuditSeverity;
  /**
   * 缺陷维度。中文短语，直接用于显示（可读性 / 认知负荷 / 可达性 /
   * 术语断层 / 内容一致性），不做内部英文枚举 —— 少一处映射就少一处
   * 可能漂移的地方。
   */
  dimension: string;
  title: string;
  /** 证据：文件路径 / 行号 / 原文摘录。必须能独立复核。 */
  evidence: string;
  recommendation: string;
  /** 幂等键：(module_id, dimension, title) 的哈希。 */
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
}

/** 一讲的审计总分。 */
export interface ModuleAuditRecord {
  moduleId: string;
  moduleName: string;
  /**
   * 四维得分 0-1，与 `deterministic.ts` 的 `scores` 逐一同名。
   *
   * **null = 该维度本轮未检测**，不用 0 冒充 ——「没检测过」与「检测过但很差」
   * 在报告里必须能分开看见（与报告页「尚未测评 ≠ 0 分」同一条规矩）。
   */
  /** 讲稿有没有任务节。缺失 → 任务卡整卡不渲染（可达性断死）。 */
  reachability: number | null;
  /** 示范代码是否配了面向学生的说明（无小节 = 0，只有代码 = 0.4，有说明 = 1）。 */
  demoReadability: number | null;
  /** 术语断层扣分后的得分；null = 无讲稿缓存，未检测。 */
  terminologyGap: number | null;
  /** 概念页与讲稿的机制承诺是否对齐。 */
  consistency: number | null;
  /**
   * 认知负荷。**当前恒为 null**：它要模型判「这一讲读起来累不累」，
   * 而确定性检查判不了。列留着是为了让「这一维度存在但本轮没测」在表里
   * 看得见 —— 真要显示 0 分就是编数据。
   */
  cognitiveLoad: number | null;
  /** 是否跑通了真实模型；false = 只跑了确定性检查，结论覆盖面更窄。 */
  usedModel: boolean;
  findingsCount: number;
  updatedAt: string;
}
