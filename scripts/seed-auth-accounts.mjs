#!/usr/bin/env node
/**
 * 种子内置评审账号 + 演示学习数据
 *
 * 用法：node scripts/seed-auth-accounts.mjs（或 pnpm db:seed:auth）
 *
 * 做三件事：
 * 1. 把 test 这个固定评审账号写进 students 表（scrypt 密码哈希），
 *    登录走 /api/auth/login，不需要从 localStorage 读账号数组。
 *    另有 demo1 / demo2 两个**录制专用**账号（12 讲全通关、零提交记录），
 *    供两个人并行录制演示视频时各用各的，互不覆盖。
 * 2. 给 test 灌一份**全通关 + 完整记录**的演示数据（掌握度 / 答题记录 / 错题 /
 *    Prompt 历史 / 学习路径），它是评委的主账号：十二讲全部学完、报告页每一块都有内容。
 * 3. 清掉已下线的 eval 账号及其数据（旧版脚本种过，重复执行后库里只剩三个号）。
 *
 * 错题会同时写入 `next_review_at`（第 1/3/7/14 天档期），并刻意留几条「已过期」，
 * 让学习页的「今日该复习」卡片与报告页错题本的「该复习了」筛选有真实数据可看。
 * test 的到期条数：3 条。
 *
 * 幂等：演示数据 id 由「表前缀 + 序号」确定性生成，全部走
 * ON CONFLICT(id) DO UPDATE —— 重复执行只刷新成同一状态，不会产生重复行。
 * 为什么不用 randomUUID：那样每跑一次就是一批新行，演示库会越灌越花。
 */

import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ACCOUNTS = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    username: "test",
    nickname: "评审演示 (test)",
    password: "test1234",
    email: "test@demo.local",
  },
  // 录制专用：两个人并行录演示视频时各用各的，互不覆盖。
  // 数据形态见下方 `fullPassDemo()` —— 12 讲全通关，但零提交记录。
  {
    id: "aaaaaaaa-0000-4000-8000-000000000003",
    username: "demo1",
    nickname: "录制演示 (demo1)",
    password: "demo1234",
    email: "demo1@demo.local",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000004",
    username: "demo2",
    nickname: "录制演示 (demo2)",
    password: "demo1234",
    email: "demo2@demo.local",
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

/**
 * 复习档期（天）——与 `src/lib/review-schedule.ts` 的
 * `REVIEW_INTERVALS_DAYS = [1, 3, 7, 14]` 同规则。
 * 种子里不直接写死 `next_review_at`，而是由「档期 + 已过期天数」反推
 * `created_at`，保证 `next_review_at = created_at + 档期` 这条语义与真实写入一致。
 */
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14];

/**
 * 录制专用账号的数据形态：**12 讲全部通关，但一条提交记录都没有**。
 *
 * 为什么这样造
 * ------------
 * 演示视频由两个人并行录制，各用一个账号（demo1 / demo2），谁也不会覆盖谁。
 * 账号里的「提交记录」（`prompt_history` / `errors` / `question_results` /
 * `validation_results`）刻意留空：镜头里的那一次点评、那一条 Prompt 历史，
 * 必须是现场真交出来的，而不是提前摆在库里给人看的。
 *
 * 但掌握度必须先有：报告页的「六项子能力」「成长曲线」「掌握度」全部由
 * `mastery` 聚合而来，没有它整页会撞空态闸门（`report-view.tsx` 的
 * `hasAnything`）。分数取 4~5 分、状态一律 `mastered`，画面口径是
 * 「这门课已经学完，就差最后几次真实提交」。
 */
const FULL_PASS_MASTERY = [
  ["vibe-coding", 5],
  ["ts-basics", 5],
  ["llm-api", 5],
  ["system-prompt", 5],
  ["tool-calling", 4],
  ["agent-loop", 4],
  ["rag", 5],
  ["llm-wiki", 4],
  ["multi-agent", 4],
  ["mcp", 4],
  ["ai-safety", 4],
  ["platform-replica", 4],
];

function fullPassDemo() {
  return {
    mastery: FULL_PASS_MASTERY.map(([conceptId, score]) => [
      conceptId,
      score,
      0,
      "mastered",
    ]),
    questionResults: [],
    errors: [],
    promptHistory: [],
    learningPath: {
      currentModule: "platform-replica",
      nextModule: "platform-replica",
      adjustments: [],
    },
  };
}

const DEMO = {
  demo1: fullPassDemo(),
  demo2: fullPassDemo(),
  test: {
    mastery: [
      ["vibe-coding", 5, 0, "mastered"],
      ["ts-basics", 5, 0, "mastered"],
      ["llm-api", 5, 0, "mastered"],
      ["system-prompt", 4, 1, "mastered"],
      ["tool-calling", 4, 2, "mastered"],
      ["agent-loop", 4, 3, "mastered"],
      ["rag", 5, 0, "mastered"],
      ["llm-wiki", 4, 0, "mastered"],
      ["multi-agent", 4, 1, "mastered"],
      ["mcp", 4, 1, "mastered"],
      ["ai-safety", 4, 0, "mastered"],
      ["platform-replica", 4, 0, "mastered"],
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
        // 第 1 天档期，已过期 2 天 → 在「今日待复习」里
        0,
        2,
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
        // 已订正、第 3 天档期，还有 2 天才到期
        1,
        -2,
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
        // 第 1 天档期，过期 1 天
        0,
        1,
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
        // 已订正、第 7 天档期，过期 3 天（拖了好几天没复习）
        2,
        3,
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
        [
          {
            type: "优化建议",
            detail:
              "第二轮消息里没有注释说明为何不必重复 system prompt，读者分不清是有意省略还是漏写",
            deduction: 15,
            relatedDimension: "上下文管理",
            relatedAntiPattern: null,
          },
        ],
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
        [
          {
            type: "优化建议",
            detail: "边界可以更清晰",
            deduction: 8,
            relatedDimension: "边界条件",
            relatedAntiPattern: "vague-prompt",
          },
        ],
        ['角色定义不错；建议加上"如果顾客问的不是奶茶就走兜底话术"'],
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
          {
            type: "严重错误",
            detail:
              "工具名不规范（下划线 + 单词），应为全小写英文字母且用破折号连接",
            deduction: 15,
            relatedDimension: "工具定义",
            relatedAntiPattern: "missing-params",
          },
          {
            type: "严重错误",
            detail: "description 未定义",
            deduction: 12,
            relatedDimension: "工具定义",
            relatedAntiPattern: "missing-params",
          },
          {
            type: "优化建议",
            detail: "参数缺少类型注释",
            deduction: 5,
            relatedDimension: "工具定义",
            relatedAntiPattern: "missing-params",
          },
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
        [
          {
            type: "严重错误",
            detail: "具名仍有下划线",
            deduction: 10,
            relatedDimension: "工具定义",
            relatedAntiPattern: "missing-params",
          },
          {
            type: "优化建议",
            detail: "缺少 description 说明触发条件",
            deduction: 8,
            relatedDimension: "工具定义",
            relatedAntiPattern: "missing-params",
          },
        ],
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
        [
          {
            type: "优化建议",
            detail: "类比部分有亮点但不够精确，没说明不观察的后果",
            deduction: 10,
            relatedDimension: "表达清晰度",
            relatedAntiPattern: "vague-prompt",
          },
        ],
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
        [
          {
            type: "优化建议",
            detail: "四步写全了，但缺一个具体例子",
            deduction: 6,
            relatedDimension: "表达清晰度",
            relatedAntiPattern: null,
          },
        ],
        ["可以加一个具体例子来说明"],
        2,
        true,
      ],
    ],
    learningPath: {
      currentModule: "platform-replica",
      nextModule: "platform-replica",
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
};

/**
 * 两个演示账号的 promptHistory 每条记录的 issues，扁平成一个记录列表
 * （每项是一条 `promptHistory` 条目的 `issues` 数组）。
 *
 * 给 `scripts/seed-contract-spec.ts` 用：这份数据手写、不经 Zod，
 * 和 `PromptIssue` 契约之间没有任何东西强制一致（TS 看不见 .mjs 里的字面量）。
 * 2026-11-10 就因此把 issues 写成了字符串数组，报告页上每条 issue
 * 渲染成空徽章 +「（-）」，问题文本整个消失。导出出来才能被测试钉住。
 *
 * 元组位置 5 是 issues —— 与 `fillPromptHistory` 的解构顺序同源。
 */
export const DEMO_PROMPT_ISSUES = Object.values(DEMO).flatMap((demo) =>
  demo.promptHistory.map((entry) => entry[5]),
);

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
    `INSERT INTO errors (id, student_id, module_id, concept_id, task_type, question, student_answer, problems, correct_example, is_corrected, next_review_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       question = excluded.question,
       student_answer = excluded.student_answer,
       problems = excluded.problems,
       correct_example = excluded.correct_example,
       is_corrected = excluded.is_corrected,
       next_review_at = excluded.next_review_at,
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
        stage,
        overdueDays,
      ],
      i,
    ) => {
      // 语义：next_review_at = created_at + 档期；
      // overdueDays > 0 表示这条已过期（进「今日待复习」），< 0 表示还没到。
      const interval = REVIEW_INTERVALS_DAYS[stage];
      const nextReviewAt = new Date(
        Date.now() - overdueDays * 86400000,
      ).toISOString();
      const createdAt = new Date(
        Date.now() - (overdueDays + interval) * 86400000,
      ).toISOString();
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
        nextReviewAt,
        createdAt,
      );
    },
  );
}

function fillPromptHistory(db, studentId, accountIndex, entries) {
  // 先清掉「同一个演示账号、同模块、同内容，但 id 不是本脚本生成的」残留行。
  //
  // 为什么需要这一步：文件头承诺「重复执行不会产生重复行」，而那个承诺
  // 只在「id 一直是 demoId 生成」的前提下成立。旧版脚本曾用 randomUUID 写
  // 演示行，那些行留在库里，重跑只会 upsert 自己那份，旧行原地不动 ——
  // 于是报告页同一个 Prompt 出现两次（实测 test 账号多出 12 行、eval 多出 18 行），
  // 且它们的 `issues` 还是不合契约的字符串数组。
  //
  // 匹配条件用 (module_id, content) **加** 随机 id 判定，不用「删该账号全部」：
  // 演示账号上也有真实产生的行（实测 test 的 platform-replica 一条），
  // 一刀切会把真实数据一起删掉。内容逐字相同才算残留 —— 学生自主提交
  // 出与种子一字不差的内容在实际上不会发生。
  const seedKeys = new Set(entries.map((entry) => `${entry[0]}|${entry[2]}`));
  const stale = db
    .prepare(
      `SELECT id, module_id, content FROM prompt_history WHERE student_id = ?`,
    )
    .all(studentId)
    .filter(
      (row) =>
        !row.id.startsWith("aaaaaaaa-0000-4000-9000-") &&
        seedKeys.has(`${row.module_id}|${row.content}`),
    )
    .map((row) => row.id);
  if (stale.length > 0) {
    const ph = stale.map(() => "?").join(",");
    db.prepare(`DELETE FROM prompt_history WHERE id IN (${ph})`).run(...stale);
    console.log(
      `  清掉 ${stale.length} 条旧版演示残留（同模块同内容、id 非 demoId）`,
    );
  }

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

  // 删旧账号时要先关外键：其他业务表（会话、审计等）也引用 students，
  // 且未必声明 ON DELETE CASCADE。PRAGMA 在事务内是 no-op，所以必须写在 BEGIN 前。
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    // 已下线的评审账号：旧版脚本种过 eval，这里连它的演示数据一起清掉，
    // 保证重复执行后库里只剩 test / demo1 / demo2 三个号。
    // 表名动态扫：凡是带 student_id 列的表都清一遍，不写死表清单。
    const RETIRED_STUDENT_ID = "aaaaaaaa-0000-4000-8000-000000000002";
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    for (const { name } of tables) {
      const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
      if (columns.some((column) => column.name === "student_id")) {
        db.prepare(`DELETE FROM "${name}" WHERE student_id = ?`).run(
          RETIRED_STUDENT_ID,
        );
      }
    }
    db.prepare("DELETE FROM students WHERE id = ?").run(RETIRED_STUDENT_ID);

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

// 直接 `node scripts/seed-auth-accounts.mjs` 才执行；被测试 import 时不做任何副作用（
// 否则那条「数据形状」的断言会顺带把演示数据写进 dev.db）。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
