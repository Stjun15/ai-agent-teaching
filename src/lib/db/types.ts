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

/**
 * 账号角色。
 *
 * `student` 是默认值（迁移 006 的列默认值），`teacher` 只能由种子脚本写入 ——
 * 没有任何接口可以把学生升级成教师，判权在 `api-auth.ts` 的 `requireTeacher`。
 */
export type StudentRole = "student" | "teacher";

export interface Student {
  id: string;
  nickname: string;
  email?: string;
  role: StudentRole;
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
  taskType: "prompt" | "tool" | "code" | "question" | "qa";
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
  taskType: "prompt" | "tool" | "code" | "qa";
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
  taskType: "prompt" | "tool" | "code" | "qa";
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

// ---------------------------------------------------------------------------
// 教师端：学生模拟运行
// ---------------------------------------------------------------------------

/**
 * 一次模拟运行的状态。
 *
 * `running` 是唯一可写的初始值；服务进程重启会让运行中的记录停在 `running` ——
 * 这是进程内执行（无外部队列）的已知边界，控制台按 `startedAt` 显示「疑似中断」，
 * 而不是由后台任务去改写别人的行（那是日志撒谎）。
 */
export type SimulationRunStatus = "running" | "completed" | "failed" | "aborted";

/** 运行结束的原因。空 = 还在跑。 */
export type SimulationStopReason =
  | "max-turns"
  | "student-gave-up"
  | "token-budget";

/** 逐轮记录里的说话人：模拟学生 / 导师（产品里学生看到的那一侧）。 */
export type SimulationSpeaker = "student" | "mentor";

export interface SimulationRun {
  id: string;
  teacherId: string;
  moduleId: string;
  step: StepType;
  /** 模拟学生人设 id，见 `src/lib/agent/student/personas.ts`。 */
  persona: string;
  status: SimulationRunStatus;
  /** 教师请求的轮次上限（已按成本边界收敛，见 `simulation/limits.ts`）。 */
  maxTurns: number;
  turnsUsed: number;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  stopReason: SimulationStopReason | null;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface SimulationTurn {
  id: string;
  runId: string;
  /** 从 1 开始。 */
  turnIndex: number;
  speaker: SimulationSpeaker;
  content: string;
  /** 模拟学生这一轮「看到的屏幕」文本快照（截断后）。 */
  screenDigest: string;
  cognitiveState: string | null;
  actionType: string | null;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  createdAt: string;
}