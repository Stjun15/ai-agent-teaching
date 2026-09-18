# 数据模型完整定义

## 一、TypeScript 类型定义

### 学生相关

```typescript
interface Student {
  id: string;
  nickname: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}
interface StudentProfile {
  studentId: string;
  programmingBackground: "zero" | "beginner" | "intermediate";
  learningGoal: string;
  preferredLanguage: "typescript" | "python";
  pace: "slow" | "normal" | "fast";
  explanationStyle: "analogy" | "example" | "theory";
  hintPreference: "try_first" | "hint_early" | "direct";
  feedbackPreference: "encouraging" | "strict" | "neutral";
  visualPreference: "animation" | "static" | "text";
  updatedAt: string;
}
interface Mastery {
  studentId: string;
  conceptId: string;
  score: number;
  lastReviewedAt: string | null;
  errorCount: number;
  status: "not_started" | "in_progress" | "needs_review" | "mastered";
  updatedAt: string;
}
interface LearningPath {
  studentId: string;
  currentModule: string;
  nextModule: string | null;
  modules: LearningPathModule[];
  adjustments: PathAdjustment[];
  updatedAt: string;
}
interface LearningPathModule {
  order: number;
  moduleId: string;
  status: "not_started" | "in_progress" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  mastery: number;
}
interface PathAdjustment {
  date: string;
  reason: string;
  action: string;
}
interface ErrorRecord {
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
interface PromptHistory {
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
interface PromptDimension {
  name: string;
  score: number;
  weight: number;
  comment: string;
}
interface PromptIssue {
  type: "严重错误" | "优化建议";
  detail: string;
  deduction: number;
  relatedDimension: string;
  relatedAntiPattern: string | null;
}
interface Project {
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
interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}
```

### 会话相关

```typescript
interface Session {
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
type StepType =
  | "explain"
  | "observe"
  | "imitate"
  | "validate"
  | "visualize"
  | "practice"
  | "mastery";
interface Message {
  id: string;
  sessionId: string;
  role: "student" | "teacher" | "reviewer" | "examiner" | "assistant" | "system";
  content: string;
  code?: string;
  language?: "typescript" | "python";
  citations: Citation[];
  metadata: MessageMetadata;
  createdAt: string;
}
interface MessageMetadata {
  agentSkill?: string;
  tokens?: { input: number; output: number };
  duration?: number;
  model?: string;
}
/**
 * 引用。**当前唯一存储与读取路径是 `messages.citations` 这个 JSONB 列**：
 * 会话消息落库时把引用数组一并写入该列，前端也从消息对象读它。
 * 独立的 `citations` 表为**预留**（见下方建表 SQL 的注释）—— 尚无写入方与消费方。
 * 两处同时存在容易读成「双写」，此处的裁定即是消除该歧义。
 */
interface Citation {
  id: string;
  messageId: string;
  source: string;
  page?: number;
  snippet: string;
  relevance: number;
}
interface AgentEvent {
  id: string;
  sessionId: string;
  messageId: string;
  agent: "teacher" | "reviewer" | "examiner" | "assistant";
  type: "thinking" | "tool_call" | "tool_result" | "generate" | "validate";
  content: string;
  metadata: object;
  createdAt: string;
}
```

### 评分与题目

```typescript
interface ValidationResult {
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
interface Question {
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
interface QuestionResult {
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
```

### Trace

```typescript
interface AgentTrace {
  id: string;
  traceId: string;
  timestamp: string;
  studentId: string;
  /**
   * 会话归属。**模块级调用没有会话上下文时为 `null`** —— 如出题（按模块生成
   * 练习，不隶属某个会话）。下方建表 SQL 的 `session_id` 本就允许为空，二者一致：
   * 不为「字段齐全」编造会话 id，那会让观测数据指向错误归属。
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
```

## 二、CloudBase 建表 SQL

```sql
-- 学生表
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 学生画像
CREATE TABLE student_profiles (
  student_id UUID PRIMARY KEY REFERENCES students(id),
  programming_background TEXT NOT NULL,
  learning_goal TEXT,
  preferred_language TEXT DEFAULT 'typescript',
  pace TEXT DEFAULT 'normal',
  explanation_style TEXT DEFAULT 'analogy',
  hint_preference TEXT DEFAULT 'try_first',
  feedback_preference TEXT DEFAULT 'encouraging',
  visual_preference TEXT DEFAULT 'animation',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 掌握度
CREATE TABLE mastery (
  student_id UUID REFERENCES students(id),
  concept_id TEXT NOT NULL,
  score INT DEFAULT 0 CHECK (score >= 0 AND score <= 5),
  last_reviewed_at TIMESTAMPTZ,
  error_count INT DEFAULT 0,
  status TEXT DEFAULT 'not_started',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, concept_id)
);
-- 学习路径
CREATE TABLE learning_paths (
  student_id UUID PRIMARY KEY REFERENCES students(id),
  current_module TEXT,
  next_module TEXT,
  modules JSONB DEFAULT '[]',
  adjustments JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 错题记录
CREATE TABLE errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  module_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  question TEXT,
  student_answer TEXT,
  problems JSONB DEFAULT '[]',
  correct_example TEXT,
  related_anti_pattern TEXT,
  is_corrected BOOLEAN DEFAULT FALSE,
  variant_questions_generated INT DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Prompt 历史
CREATE TABLE prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  module_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  content TEXT NOT NULL,
  score INT,
  dimensions JSONB DEFAULT '[]',
  issues JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  attempt_number INT DEFAULT 1,
  is_passed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 项目
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  project_template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'not_started',
  web_app_checklist JSONB DEFAULT '[]',
  ide_checklist JSONB DEFAULT '[]',
  prompt_record_ids JSONB DEFAULT '[]',
  repo_url TEXT,
  demo_url TEXT,
  mentor_comment TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
-- 会话
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  module_id TEXT NOT NULL,
  current_step TEXT DEFAULT 'explain',
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_tokens INT DEFAULT 0,
  total_duration INT DEFAULT 0
);
-- 消息
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  role TEXT NOT NULL,
  content TEXT,
  code TEXT,
  language TEXT,
  citations JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 引用（**预留表**）：当前实现只写 `messages.citations` 这个 JSONB 列，不写本表。
-- 两者在文档里同时存在但未说明何时用哪个；裁定（2026-09-18）：以该 JSONB 列为
-- 唯一存储，本表留作「跨消息检索引用来源」的预留，出现明确消费方时再补写入。
-- 实现侧说明见 src/lib/db/messages.ts 文件头。
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id),
  source TEXT NOT NULL,
  page INT,
  snippet TEXT,
  relevance FLOAT DEFAULT 0
);
-- Agent 事件
CREATE TABLE agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  message_id UUID REFERENCES messages(id),
  agent TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 校验结果
CREATE TABLE validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  session_id UUID REFERENCES sessions(id),
  task_type TEXT NOT NULL,
  total_score INT,
  level TEXT,
  is_correct BOOLEAN,
  dimensions JSONB DEFAULT '[]',
  issues JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 题库
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  type TEXT NOT NULL,
  difficulty INT,
  scenario TEXT,
  question TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  hint_levels JSONB DEFAULT '[]',
  related_anti_pattern TEXT
);
-- 答题结果
CREATE TABLE question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  question_id TEXT REFERENCES questions(id),
  session_id UUID REFERENCES sessions(id),
  student_answer TEXT,
  is_correct BOOLEAN,
  score INT,
  attempts INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Trace
CREATE TABLE agent_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  student_id UUID REFERENCES students(id),
  session_id UUID REFERENCES sessions(id),
  agent TEXT NOT NULL,
  skill TEXT,
  input JSONB,
  output JSONB,
  wiki_reads JSONB DEFAULT '[]',
  wiki_writes JSONB DEFAULT '[]',
  duration_ms INT,
  tokens JSONB DEFAULT '{}',
  retries INT DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error TEXT
);
-- 索引
CREATE INDEX idx_mastery_student ON mastery(student_id);
CREATE INDEX idx_errors_student ON errors(student_id, module_id);
CREATE INDEX idx_prompts_student ON prompt_history(student_id, module_id);
CREATE INDEX idx_sessions_student ON sessions(student_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_agent_events_session ON agent_events(session_id);
CREATE INDEX idx_traces_student ON agent_traces(student_id, timestamp);
CREATE INDEX idx_question_results_student ON question_results(student_id);
-- 向量扩展（用于 RAG）
CREATE EXTENSION IF NOT EXISTS vector;
-- 知识库向量表
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_knowledge_embedding ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## 三、数据表关系图

```
students ──┬── student_profiles (1:1)
           ├── mastery (1:N, concept_id)
           ├── learning_paths (1:1)
           ├── errors (1:N)
           ├── prompt_history (1:N)
           ├── projects (1:N)
           ├── sessions (1:N) ──┬── messages (1:N) ──┬── citations (1:N)
           │                    │                    └── agent_events (1:N)
           │                    └── validation_results (1:N)
           ├── question_results (1:N)
           └── agent_traces (1:N)
questions (独立表，被 question_results 引用)
knowledge_embeddings (独立表，RAG 用)
```

## 四、数据访问层设计

```typescript
// src/lib/db/students.ts
export const studentDb = {
  get: (id: string) => Promise<Student>,
  update: (id: string, data: Partial<Student>) => Promise<void>,
  getProfile: (id: string) => Promise<StudentProfile>,
  updateProfile: (id: string, data: Partial<StudentProfile>) => Promise<void>
};
// src/lib/db/mastery.ts
export const masteryDb = {
  get: (studentId: string) => Promise<Mastery[]>,
  getByConcept: (studentId: string, conceptId: string) => Promise<Mastery>,
  update: (studentId: string, conceptId: string, score: number) => Promise<void>,
  incrementError: (studentId: string, conceptId: string) => Promise<void>
};
// src/lib/db/learning-path.ts
export const learningPathDb = {
  get: (studentId: string) => Promise<LearningPath>,
  updateModule: (studentId: string, moduleId: string, status: string) => Promise<void>,
  addAdjustment: (studentId: string, adjustment: PathAdjustment) => Promise<void>
};
// src/lib/db/sessions.ts
export const sessionDb = {
  create: (studentId: string, moduleId: string) => Promise<Session>,
  get: (id: string) => Promise<Session>,
  update: (id: string, data: Partial<Session>) => Promise<void>,
  end: (id: string) => Promise<void>
};
// src/lib/db/messages.ts
export const messageDb = {
  create: (data: Omit<Message, "id" | "createdAt">) => Promise<Message>,
  listBySession: (sessionId: string) => Promise<Message[]>
};
// src/lib/db/traces.ts
export const traceDb = {
  create: (trace: AgentTrace) => Promise<void>,
  listByStudent: (studentId: string, limit: number) => Promise<AgentTrace[]>
};

```
