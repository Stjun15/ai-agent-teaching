#!/usr/bin/env node
/**
 * 种子内置评审账号 + 演示学习数据
 *
 * 用法：node scripts/seed-auth-accounts.mjs（或 pnpm db:seed:auth）
 *
 * 做两件事：
 * 1. 把 test / eval 两个固定账号写进 students 表（scrypt 密码哈希），
 *    登录走 /api/auth/login，不需要从 localStorage 读账号数组。
 * 2. 给这两个账号灌演示学习数据（掌握度 / 答题记录 / 错题 / Prompt 历史 /
 *    学习路径），让学习报告页展示出有价值的内容：
 *    - test = 中等进度学生（5 个模块完成，当前卡在 agent-loop）
 *    - eval = 优等进度学生（8 个模块完成，当前在 mcp）
 *
 * 幂等：演示数据 id 由「表前缀 + 序号」确定性生成，全部走
 * ON CONFLICT(id) DO UPDATE —— 重复执行只刷新成同一状态，不会产生重复行。
 * 为什么不用 randomUUID：那样每跑一次就是一批新行，演示库会越灌越花。
 */

import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const ACCOUNTS = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    username: "test",
    nickname: "评审演示 (test)",
    password: "test1234",
    email: "test@demo.local",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000002",
    username: "eval",
    nickname: "评审演示 (eval)",
    password: "eval1234",
    email: "eval@demo.local",
  },
];

const MODULES = [
  "vibe-coding",
  "ts-basics",
  "llm-api",
  "system-prompt",
  "tool-calling",
  "agent-loop",
  "rag",
  "llm-wiki",
  "multi-agent",
  "mcp",
  "ai-safety",
  "platform-replica",
];

const MODULE_NAMES = {
  "vibe-coding": "Vibe Coding",
  "ts-basics": "TypeScript 基础",
  "llm-api": "LLM API 入门",
  "system-prompt": "System Prompt",
  "tool-calling": "Tool Calling",
  "agent-loop": "Agent Loop",
  rag: "RAG 检索增强",
  "llm-wiki": "LLM Wiki",
  "multi-agent": "多 Agent 协作",
  mcp: "MCP 协议",
  "ai-safety": "AI 安全防护",
  "platform-replica": "教学平台复刻",
};

/**
 * 演示数据的确定性 id：`aaaaaaaa-0000-4000-9000-<12 位十六进制>`。
 * 末 12 位 = 账号序号(1 位) + 表序号(1 位) + 行序号(10 位)，同一行每次都一样。
 */
function demoId(accountIndex, tableIndex, rowIndex) {
  const tail = `${accountIndex}${tableIndex}${String(rowIndex).padStart(10, "0")}`;
  return `aaaaaaaa-0000-4000-9000-${tail}`;
}

/** 演示数据按账号分组，表序号用于生成互不冲突的 id。 */
const QUESTION_RESULTS = 1;
const ERRORS = 2;
const PROMPT_HISTORY = 3;

const DEMO = {
  test: {
    mastery: [
      ["vibe-coding", 5, 0, "mastered"],
      ["ts-basics", 5, 0, "mastered"],
      ["llm-api", 5, 0, "mastered"],
      ["system-prompt", 4, 1, "mastered"],
      ["tool-calling", 4, 2, "mastered"],
      ["agent-loop", 3, 3, "in_progress"],
      ["rag", 0, 0, "not_started"],
      ["llm-wiki", 0, 0, "not_started"],
      ["multi-agent", 0, 0, "not_started"],
      ["mcp", 0, 0, "not_started"],
      ["ai-safety", 0, 0, "not_started"],
      ["platform-replica", 0, 0, "not_started"],
    ],
    questionResults: [
      ["B", true, 100, 1],
      ["C", false, 0, 1],
      ["A", true, 100, 1],
      ["let 没有块级作用域", true, 100, 2],
      ["D", false, 0, 1],
      ["B", true, 100, 1],
      ["C", true, 100, 1],
      ["A", false, 0, 1],
      ["B", true, 100, 1],
      ["D", true, 100, 1],
      ["C", false, 33, 1],
      ["B", true, 100, 1],
    ],
    errors: [
      [
        "tool-calling",
        "tool-calling",
        "code",
        "请定义一个查天气的工具函数",
        "function queryWeather() {}",
        ["缺少参数定义", "没有 description 字段"],
        "function queryWeather(city: string) { return fetchWeather(city); }",
        false,
      ],
      [
        "tool-calling",
        "tool-calling",
        "code",
        "请定义工具调用的一致性检查",
        "只要参数名一样就行",
        ["没理解一致性的含义", "混淆了参数名和参数类型"],
        "一致性的正确理解是：LLM 传入的参数名和类型必须与工具定义完全一致",
        true,
      ],
      [
        "agent-loop",
        "agent-loop",
        "prompt",
        "描述 Agent Loop 的四步循环",
        "1.思考 2.行动 3.结束",
        ['缺少"观察"步骤', "直接把 Think-Act-Observe 写成了 Think-Act-End"],
        "Think → Act → Observe → Next Step",
        false,
      ],
      [
        "system-prompt",
        "system-prompt",
        "prompt",
        "设计奶茶店点单助手的 System Prompt",
        "你是一个奶茶店店员，帮顾客点单。",
        ["角色太笼统", "没有明确边界", "缺少格式要求"],
        null,
        true,
      ],
    ],
    promptHistory: [
      [
        "llm-api",
        "code",
        'messages: [{role:"user",content:"1+1=?"},{role:"assistant",content:"2"}] // 第二轮继续对话',
        85,
        [
          { name: "意图表达", score: 4 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 3 },
          { name: "质量判断", score: 5 },
          { name: "迭代调优", score: 4 },
          { name: "理解 AI 行为", score: 5 },
        ],
        ["messages 数组正确"],
        ["可以加注释说明为什么第二轮不需要重复 system prompt"],
        1,
        true,
      ],
      [
        "system-prompt",
        "prompt",
        "你是一个奶茶店点单助手，专门帮助顾客完成奶茶选购。\n\n## 角色\n- 你是甜啦啦奶茶店的 AI 店员",
        72,
        [
          { name: "意图表达", score: 3 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 2 },
          { name: "质量判断", score: 3 },
          { name: "迭代调优", score: 3 },
          { name: "理解 AI 行为", score: 5 },
        ],
        ["角色定义不错", "边界可以更清晰"],
        ['建议加上"如果顾客问的不是奶茶就走兜底话术"'],
        1,
        true,
      ],
      [
        "tool-calling",
        "code",
        "tool_calling_check_package(name: string, phone: string): status",
        58,
        [
          { name: "意图表达", score: 3 },
          { name: "任务分解", score: 2 },
          { name: "上下文管理", score: 3 },
          { name: "质量判断", score: 2 },
          { name: "迭代调优", score: 2 },
          { name: "理解 AI 行为", score: 3 },
        ],
        [
          "工具名不规范（下划线 + 单词），应为全小写英文字母且用破折号连接",
          "description 未定义",
          "参数缺少类型注释",
        ],
        [
          '工具名改为 check-package，加上 description: "根据姓名和手机号查询快递状态"',
        ],
        1,
        false,
      ],
      [
        "tool-calling",
        "code",
        "function check_package(name: string, phone: string) { return fetchStatus(name, phone); }",
        65,
        [
          { name: "意图表达", score: 3 },
          { name: "任务分解", score: 3 },
          { name: "上下文管理", score: 3 },
          { name: "质量判断", score: 2 },
          { name: "迭代调优", score: 2 },
          { name: "理解 AI 行为", score: 3 },
        ],
        ["具名仍有下划线", "缺少 description 说明触发条件"],
        ["命名为 check-package，加上 description"],
        2,
        false,
      ],
      [
        "agent-loop",
        "prompt",
        "Agent Loop 就像做菜：先想菜谱（Think），再动手切菜（Act），尝一口（Observe），不够咸再加盐（Next Step）。",
        70,
        [
          { name: "意图表达", score: 4 },
          { name: "任务分解", score: 3 },
          { name: "上下文管理", score: 2 },
          { name: "质量判断", score: 3 },
          { name: "迭代调优", score: 2 },
          { name: "理解 AI 行为", score: 4 },
        ],
        ["类比部分有亮点但不够精确，没说明不观察的后果"],
        ["加上：如果跳过尝一口直接加盐，最后整锅都废了"],
        1,
        true,
      ],
      [
        "agent-loop",
        "prompt",
        "Think → Act → Observe → Next Step，四步不断循环直到目标达成",
        82,
        [
          { name: "意图表达", score: 4 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 3 },
          { name: "质量判断", score: 4 },
          { name: "迭代调优", score: 4 },
          { name: "理解 AI 行为", score: 4 },
        ],
        ["四步写全了"],
        ["可以加一个具体例子来说明"],
        2,
        true,
      ],
    ],
    learningPath: {
      currentModule: "agent-loop",
      nextModule: "rag",
      adjustments: [
        {
          date: "2026-10-18",
          reason: "agent-loop 掌握度不足，插入 3 道变式题巩固",
          type: "variant",
        },
        {
          date: "2026-10-14",
          reason: "tool-calling 第一次点评未通过，插入针对性补练",
          type: "review",
        },
      ],
    },
  },
  eval: {
    mastery: [
      ["vibe-coding", 5, 0, "mastered"],
      ["ts-basics", 5, 0, "mastered"],
      ["llm-api", 5, 0, "mastered"],
      ["system-prompt", 5, 0, "mastered"],
      ["tool-calling", 4, 1, "mastered"],
      ["agent-loop", 4, 1, "mastered"],
      ["rag", 5, 0, "mastered"],
      ["llm-wiki", 4, 0, "mastered"],
      ["multi-agent", 3, 2, "in_progress"],
      ["mcp", 3, 2, "in_progress"],
      ["ai-safety", 0, 0, "not_started"],
      ["platform-replica", 0, 0, "not_started"],
    ],
    questionResults: [
      ["B", true, 100, 1],
      ["C", true, 100, 1],
      ["A", true, 100, 1],
      ["D", true, 100, 1],
      ["B", true, 100, 1],
      ["C", false, 0, 1],
      ["A", true, 100, 1],
      ["B", true, 100, 1],
      ["D", true, 100, 1],
      ["C", true, 100, 1],
      ["B", false, 0, 1],
      ["A", true, 100, 1],
      ["C", true, 100, 1],
      ["D", true, 100, 1],
      ["A", true, 100, 1],
      ["B", true, 100, 1],
      ["C", true, 100, 1],
      ["D", false, 0, 1],
      ["A", true, 100, 1],
      ["B", true, 100, 1],
    ],
    errors: [
      [
        "multi-agent",
        "multi-agent",
        "prompt",
        "设计三个 Agent 写周报的协作流程",
        "Agent A 收集 → Agent B 写 → Agent C 发",
        ["Agent 之间没有输入输出定义", "没有说失败时怎么重试"],
        "Agent A（收集数据）→ 输出 markdown 草稿 → Agent B（润色+排错）→ 输出终稿 → Agent C（邮件发送），失败退回 B 重试",
        false,
      ],
      [
        "mcp",
        "mcp",
        "code",
        "定义一个本地文件管理的 MCP Server，至少 3 个工具",
        "readFile, writeFile",
        [
          "只有 2 个工具",
          "缺少 deleteFile 或 listFiles",
          "工具定义太简略没写字段",
        ],
        null,
        false,
      ],
      [
        "tool-calling",
        "tool-calling",
        "code",
        "定义查快递的函数工具",
        "function query(no: number) {}",
        ["函数名不规范", "缺少 description"],
        null,
        true,
      ],
      [
        "agent-loop",
        "agent-loop",
        "prompt",
        "说说 Agent Loop 为什么要 Observe",
        "Observe 没啥用，LLM 自己知道对不对",
        ["完全没理解观察步骤的必要性"],
        "观察步骤是 Agent 判断下一步行动的唯一依据，跳过它 Agent 就变成了按规则机械执行",
        true,
      ],
    ],
    promptHistory: [
      [
        "llm-api",
        "code",
        'messages: [{role:"user",content:"你好"},{role:"assistant",content:"你好！"},{role:"user",content:"再问一个问题"}]',
        90,
        [
          { name: "意图表达", score: 5 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 4 },
          { name: "质量判断", score: 5 },
          { name: "迭代调优", score: 4 },
          { name: "理解 AI 行为", score: 5 },
        ],
        [],
        [],
        1,
        true,
      ],
      [
        "system-prompt",
        "prompt",
        "你是甜啦啦奶茶店的 AI 店员小甜。…完整 System Prompt…",
        88,
        [
          { name: "意图表达", score: 5 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 4 },
          { name: "质量判断", score: 4 },
          { name: "迭代调优", score: 4 },
          { name: "理解 AI 行为", score: 5 },
        ],
        [],
        ["角色和格式都很完整"],
        1,
        true,
      ],
      [
        "rag",
        "prompt",
        "知识库文档：\n## doc1: 猫粮选购指南\n内容…\n## doc2: 仓鼠饲养指南\n内容…\n## doc3: 宠物洗澡频率\n内容…\n用户问「兔子怎么喂」",
        70,
        [
          { name: "意图表达", score: 3 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 3 },
          { name: "质量判断", score: 2 },
          { name: "迭代调优", score: 3 },
          { name: "理解 AI 行为", score: 4 },
        ],
        ["buildContext 用评分公式筛选文档是正确的思路"],
        ["选仓鼠那篇是对的（啮齿类有参考价值），选猫粮那篇应该解释为什么不选"],
        1,
        false,
      ],
      [
        "rag",
        "prompt",
        "用户问「仓鼠吃什么」，buildContext 返回了仓鼠饲养指南的摘要：仓鼠饲料建议…",
        82,
        [
          { name: "意图表达", score: 4 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 4 },
          { name: "质量判断", score: 3 },
          { name: "迭代调优", score: 4 },
          { name: "理解 AI 行为", score: 4 },
        ],
        [],
        [],
        2,
        true,
      ],
      [
        "multi-agent",
        "prompt",
        "周报协作：Agent A 收集各人日报 → 汇总草稿 → Agent B 润色 → Agent C 邮件发送",
        78,
        [
          { name: "意图表达", score: 4 },
          { name: "任务分解", score: 5 },
          { name: "上下文管理", score: 3 },
          { name: "质量判断", score: 3 },
          { name: "迭代调优", score: 3 },
          { name: "理解 AI 行为", score: 4 },
        ],
        ["Agent 分工清晰，输入输出有定义"],
        ["3 个 Agent 的职责界限再明确一点更好"],
        1,
        true,
      ],
      [
        "mcp",
        "prompt",
        "MCP Server 定义：3 个工具 readFile/writeFile/deleteFile，每个都有 name/description/inputSchema",
        76,
        [
          { name: "意图表达", score: 4 },
          { name: "任务分解", score: 4 },
          { name: "上下文管理", score: 3 },
          { name: "质量判断", score: 3 },
          { name: "迭代调优", score: 3 },
          { name: "理解 AI 行为", score: 4 },
        ],
        [],
        [],
        1,
        true,
      ],
    ],
    learningPath: {
      currentModule: "mcp",
      nextModule: "ai-safety",
      adjustments: [
        {
          date: "2026-10-20",
          reason: "multi-agent 掌握度偏低，安排回炉再看一次概念页",
          type: "review",
        },
      ],
    },
  },
};

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function resolveDbPath() {
  const raw = process.env.DATABASE_URL?.trim();
  const withoutScheme = raw?.startsWith("file:")
    ? raw.slice("file:".length)
    : raw;
  const relative =
    withoutScheme && withoutScheme.length > 0 ? withoutScheme : "dev.db";
  return path.resolve(process.cwd(), relative);
}

/**
 * 掌握度时间线需要多个证据日才能画出成长曲线（`buildSubAbilityTimeline`
 * 只在出现新证据的日期取点，同日写入只会有「首次记录」一个点）。
 * 已学模块按课程顺序每两天一个证据日；未开始模块落在建档日 ——
 * 语义：账号建立时写入「未开始 = 0 分证据」，此后每学一讲产生新证据日，
 * 曲线随学习抬升。全部确定性偏移，重跑不漂移。
 */
const CREATED_OFFSET_DAYS = 14;
const SCORED_OFFSET_DAYS = [12, 10, 8, 6, 4, 2, 0];

function fillMastery(db, studentId, mastery) {
  const upsert = db.prepare(
    `INSERT INTO mastery (student_id, concept_id, score, error_count, status, last_reviewed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, concept_id) DO UPDATE SET
       score = excluded.score,
       error_count = excluded.error_count,
       status = excluded.status,
       last_reviewed_at = excluded.last_reviewed_at,
       updated_at = excluded.updated_at`,
  );
  let scoredIndex = 0;
  for (const [conceptId, score, errorCount, status] of mastery) {
    const offsetDays =
      status === "not_started"
        ? CREATED_OFFSET_DAYS
        : SCORED_OFFSET_DAYS[
            Math.min(scoredIndex++, SCORED_OFFSET_DAYS.length - 1)
          ];
    const at = new Date(Date.now() - offsetDays * 86400000).toISOString();
    upsert.run(
      studentId,
      conceptId,
      score,
      errorCount,
      status,
      status === "not_started" ? null : at,
      at,
    );
  }
}

function fillQuestionResults(db, studentId, accountIndex, entries) {
  const upsert = db.prepare(
    `INSERT INTO question_results (id, student_id, question_id, student_answer, is_correct, score, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       student_answer = excluded.student_answer,
       is_correct = excluded.is_correct,
       score = excluded.score,
       attempts = excluded.attempts,
       created_at = excluded.created_at`,
  );
  entries.forEach(([studentAnswer, isCorrect, score, attempts], i) => {
    const daysAgo = (i % 10) + 1;
    const createdAt = new Date(Date.now() - 86400000 * daysAgo).toISOString();
    upsert.run(
      demoId(accountIndex, QUESTION_RESULTS, i),
      studentId,
      null,
      studentAnswer,
      isCorrect ? 1 : 0,
      score,
      attempts,
      createdAt,
    );
  });
}

function fillErrors(db, studentId, accountIndex, entries) {
  const upsert = db.prepare(
    `INSERT INTO errors (id, student_id, module_id, concept_id, task_type, question, student_answer, problems, correct_example, is_corrected, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       question = excluded.question,
       student_answer = excluded.student_answer,
       problems = excluded.problems,
       correct_example = excluded.correct_example,
       is_corrected = excluded.is_corrected,
       created_at = excluded.created_at`,
  );
  entries.forEach(
    (
      [
        moduleId,
        conceptId,
        taskType,
        question,
        studentAnswer,
        problems,
        correctExample,
        isCorrected,
      ],
      i,
    ) => {
      const daysAgo = (i % 14) + 1;
      const createdAt = new Date(Date.now() - 86400000 * daysAgo).toISOString();
      upsert.run(
        demoId(accountIndex, ERRORS, i),
        studentId,
        moduleId,
        conceptId,
        taskType,
        question,
        studentAnswer,
        JSON.stringify(problems),
        correctExample,
        isCorrected ? 1 : 0,
        createdAt,
      );
    },
  );
}

function fillPromptHistory(db, studentId, accountIndex, entries) {
  const upsert = db.prepare(
    `INSERT INTO prompt_history (id, student_id, module_id, task_type, content, score, dimensions, issues, suggestions, attempt_number, is_passed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       score = excluded.score,
       dimensions = excluded.dimensions,
       issues = excluded.issues,
       suggestions = excluded.suggestions,
       attempt_number = excluded.attempt_number,
       is_passed = excluded.is_passed,
       created_at = excluded.created_at`,
  );
  entries.forEach(
    (
      [
        moduleId,
        taskType,
        content,
        score,
        dimensions,
        issues,
        suggestions,
        attempt,
        passed,
      ],
      i,
    ) => {
      const daysAgo = (i % 14) + 1;
      const createdAt = new Date(Date.now() - 86400000 * daysAgo).toISOString();
      upsert.run(
        demoId(accountIndex, PROMPT_HISTORY, i),
        studentId,
        moduleId,
        taskType,
        content,
        score,
        JSON.stringify(dimensions),
        JSON.stringify(issues),
        JSON.stringify(suggestions),
        attempt,
        passed ? 1 : 0,
        createdAt,
      );
    },
  );
}

function fillLearningPath(
  db,
  studentId,
  { currentModule, nextModule, adjustments },
  now,
) {
  const upsert = db.prepare(
    `INSERT INTO learning_paths (student_id, current_module, next_module, modules, adjustments, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       current_module = excluded.current_module,
       next_module = excluded.next_module,
       modules = excluded.modules,
       adjustments = excluded.adjustments,
       updated_at = excluded.updated_at`,
  );
  upsert.run(
    studentId,
    currentModule,
    nextModule,
    JSON.stringify(MODULES.map((id) => ({ id, name: MODULE_NAMES[id] }))),
    JSON.stringify(adjustments),
    now,
  );
}

function main() {
  const dbPath = resolveDbPath();
  console.log("种子目标:", dbPath);

  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    const upsertStudent = db.prepare(
      `INSERT INTO students (id, nickname, username, password_hash, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nickname = excluded.nickname,
         username = excluded.username,
         password_hash = excluded.password_hash,
         email = excluded.email,
         updated_at = excluded.updated_at`,
    );

    ACCOUNTS.forEach((account, accountIndex) => {
      upsertStudent.run(
        account.id,
        account.nickname,
        account.username,
        hashPassword(account.password),
        account.email,
        now,
        now,
      );
      console.log(`\n--- ${account.username} (id=${account.id}) ---`);

      const demo = DEMO[account.username];
      fillMastery(db, account.id, demo.mastery);
      fillQuestionResults(db, account.id, accountIndex, demo.questionResults);
      fillErrors(db, account.id, accountIndex, demo.errors);
      fillPromptHistory(db, account.id, accountIndex, demo.promptHistory);
      fillLearningPath(db, account.id, demo.learningPath, now);

      console.log(
        `  mastery ${demo.mastery.length} / 答题 ${demo.questionResults.length} / 错题 ${demo.errors.length} / Prompt ${demo.promptHistory.length} / 路径 current=${demo.learningPath.currentModule}`,
      );
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  console.log("\n评审账号与演示数据已就绪（重复执行不会产生重复行）。");
}

main();
