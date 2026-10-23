/**
 * 教学闭环（出题→作答→评分）DB 集成测试（不调模型）
 *
 * 守的是方向 A「教学闭环贯通」落地的三件事在真实 dev.db 上能跑通：
 *   1. questions 表从此有写入路径（generate-question 落库，answer-grade 才能按 id 取题）；
 *   2. 客观题评分走 gradeObjective 纯函数（确定性，不烧模型）；
 *   3. 答题结果经 questionResultDb.create 落库，question_results.question_id
 *      外键能指向真实题库行。
 *
 * 为什么只测 DB 层 + 纯函数
 * -----------------------
 * 主观题评分复用 reviewer 模型（与 /api/agent/validate 同一路径），调模型是慢/随机/
 * 烧钱的，不适合放进「每次 npm test 都跑」的纯函数组；但上述三件事都不依赖模型，
 * 必须能在 DB 层被钉死。本测试直接打 repository 与 gradeObjective，绕开 HTTP 与模型。
 *
 * 在 dev.db 上真跑
 * --------------
 * 测试以 cwd=项目根运行，getDb() 默认命中 ./dev.db（与 app / 种子脚本同一文件）。
 * 跑完后 questions / question_results 会多出真实行，正是对「闭环已通」的事实核验。
 *
 * 运行：
 *   pnpm test:teaching-grade
 */

import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getDb } from "@/lib/db/sqlite";
import { questionDb, questionResultDb } from "@/lib/db";
import {
  gradeObjective,
  runAssessLoop,
} from "@/lib/agent/orchestrator/assess-loop";

/** 与种子脚本 / 浏览器侧共用同一固定 UUID，避免「接口全报学生不存在」。 */
const DEMO_STUDENT = JSON.parse(
  readFileSync(
    new URL("../src/lib/demo-student.json", import.meta.url),
    "utf8",
  ),
) as { studentId: string };
const TEST_STUDENT_ID = DEMO_STUDENT.studentId;

/** question_results / questions 都外键到 sessions(id)，复用固定会话。 */
const TEST_SESSION_ID = "test-session-grade";

/** 固定题库 id，使本组测试不依赖「手动先灌过题库」。 */
const TEST_QUESTION_ID = "q_grade_objective";

/**
 * 保证 demo 学生 / 会话存在（结果表及其外键都指向它们）。
 * 用 INSERT OR IGNORE，使本组测试不依赖「手动先跑过种子」：
 * 全新克隆拿到的是空 dev.db，npm test 也应能独立跑通。
 */
function ensureDemoStudent(): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO students (id, nickname, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    TEST_STUDENT_ID,
    "种子学生",
    new Date().toISOString(),
    new Date().toISOString(),
  );

  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, student_id, module_id)
     VALUES (?, ?, ?)`,
  ).run(TEST_SESSION_ID, TEST_STUDENT_ID, "llm-api");
}

before(() => {
  ensureDemoStudent();
});

test("gradeObjective：客观题规则判分（正确/错误 + feedback 含解析）", () => {
  const q = {
    type: "选择题",
    text: "中国的首都是？",
    correctAnswer: "北京",
    explanation: "北京是中国的首都。",
  };

  const right = gradeObjective(q, "北京");
  assert.equal(right.isCorrect, true, "答对应为 true");
  assert.equal(right.score, 100, "答对满分");
  assert.equal(right.gradedBy, "rule", "客观题走规则判分");
  assert.match(right.feedback, /北京是中国的首都/, "feedback 应含解析");

  const wrong = gradeObjective(q, "上海");
  assert.equal(wrong.isCorrect, false, "答错应为 false");
  assert.equal(wrong.score, 0, "答错零分");
  assert.match(wrong.feedback, /正确答案：北京/, "feedback 应给出正确答案");
});

test("gradeObjective：填空题剥离答案备注并接受覆盖标准答案的完整短句", () => {
  // 实测失败模式：出题 Agent 把可接受变体写进 correct_answer，
  // 学生答「晴，东南风 3 级」被精确比对判错 —— 界面点评自己都说
  // 「或任何合理的天气描述」，判分与解析口径矛盾。
  const q = {
    type: "填空题",
    text: "请填写一个合理且符合场景的 weather 字段内容。",
    correctAnswer: "晴（或任何合理的天气描述，如多云、小雨等）",
    explanation: "weather 字段应填入一个描述天气的词语或短句。",
  };

  const exact = gradeObjective(q, "晴");
  assert.equal(exact.isCorrect, true, "标准答案本身应判对");

  const longer = gradeObjective(q, "晴，东南风 3 级");
  assert.equal(longer.isCorrect, true, "覆盖标准答案的完整短句应判对");

  const empty = gradeObjective(q, "不知道");
  assert.equal(empty.isCorrect, false, "不含标准答案仍应判错");
});

test("gradeObjective：选择题保持精确比对（不做包含放行）", () => {
  const q = {
    type: "选择题",
    text: "以下哪个输入用来设定 AI 的角色和回复风格？",
    correctAnswer: "B",
    explanation: "system message 用于设定角色与风格。",
  };
  // 学生把答案抄成带解释的长句不是选择题的作答方式，不因「包含 B」而放行。
  const padded = gradeObjective(q, "我的选择是 B，因为 system message 管角色");
  assert.equal(padded.isCorrect, false, "选择题应精确比对选项");
});

test("gradeObjective：选择题对账选项字母与整段选项文本", () => {
  // 实测失败模式：题库 correct_answer 存选项字母（"A"），界面送的是
  // 整段选项文本（"A. 在对话开始时作为系统提示词发送…"）—— 精确比对
  // 把答对的学生判 0 分。规则判分必须对账这两种形态。
  const q = {
    type: "选择题",
    text: "小华应该把这句角色设定放在哪里？",
    correctAnswer: "A",
    explanation: "系统提示词在对话开始前发送。",
  };

  const fullOption = gradeObjective(
    q,
    "A. 在对话开始时作为系统提示词发送，而不是当作普通问题",
  );
  assert.equal(fullOption.isCorrect, true, "整段选项文本应对账到字母");

  const bareLetter = gradeObjective(q, "A");
  assert.equal(bareLetter.isCorrect, true, "裸字母本就精确比对命中");

  const otherLetter = gradeObjective(q, "B. 在每一条 AI 回答之后重复一遍");
  assert.equal(otherLetter.isCorrect, false, "选错字母仍应判错");
});

test("gradeObjective：选择题对账裸选项文本（无字母前缀）", () => {
  // 实测失败模式（2026-10-03 复刻模拟）：题库 options 存裸文本（无
  // 「B. 」前缀），学生/界面提交裸选项文本 —— 既不是字母精确匹配，
  // 也没有前缀字母可提取，答对判 0。三种形态（字母/带前缀/裸文本）
  // 必须全对账。同时钉住：不同选项的裸文本不得被放行。
  const q = {
    type: "选择题",
    text: "这份需求描述最关键的缺陷是什么？",
    correctAnswer: "B",
    explanation: "需求要有用户、场景和完成标准。",
    options: [
      "没有写编程语言",
      "缺少具体用户、核心场景和完成标准",
      "没有设计数据库表结构",
      "没有提到界面颜色",
    ],
  };

  const bareText = gradeObjective(q, "缺少具体用户、核心场景和完成标准");
  assert.equal(bareText.isCorrect, true, "裸选项文本应对账到字母 B");

  const wrongText = gradeObjective(q, "没有提到界面颜色");
  assert.equal(wrongText.isCorrect, false, "其它选项的文本必须判错");

  const prefixStillWorks = gradeObjective(
    q,
    "B. 缺少具体用户、核心场景和完成标准",
  );
  assert.equal(prefixStillWorks.isCorrect, true, "带前缀形态回归不破");
});

test("runAssessLoop：客观题不调模型直接走规则", async () => {
  const q = {
    type: "填空题",
    text: "请填写答案。",
    correctAnswer: "42",
    explanation: "答案是 42。",
  };
  const result = await runAssessLoop({
    question: q,
    studentAnswer: "42",
    moduleId: "llm-api",
  });
  assert.equal(result.gradedBy, "rule", "客观题不应触发模型");
  assert.equal(result.isCorrect, true);
  assert.equal(result.score, 100);
});

test("questionDb 写/读闭环（create + get + listByModule，含 JSON 列还原）", async () => {
  await questionDb.create({
    id: TEST_QUESTION_ID,
    moduleId: "llm-api",
    conceptId: "llm-api",
    type: "选择题",
    difficulty: 2,
    scenario: "基础概念",
    question: "中国的首都是？",
    options: ["北京", "上海", "广州"],
    correctAnswer: "北京",
    explanation: "北京是首都。",
    hintLevels: ["想一下地理", "是北方城市"],
    relatedAntiPattern: null,
  });

  const got = await questionDb.get(TEST_QUESTION_ID);
  assert.ok(got, "刚写入的题目应能被 get 读回");
  assert.equal(got?.type, "选择题");
  assert.deepEqual(
    got?.options,
    ["北京", "上海", "广州"],
    "options 应原样读回",
  );
  assert.deepEqual(
    got?.hintLevels,
    ["想一下地理", "是北方城市"],
    "hintLevels 应原样读回",
  );
  assert.equal(got?.correctAnswer, "北京");

  const list = await questionDb.listByModule("llm-api", 10);
  assert.ok(
    list.some((q) => q.id === TEST_QUESTION_ID),
    "刚写入的题目应能被 listByModule 读回",
  );
});

test("完整闭环：客观题评分 → question_results 真实落库", async () => {
  const id = crypto.randomUUID();
  const assessment = await runAssessLoop({
    question: {
      type: "选择题",
      text: "中国的首都是？",
      correctAnswer: "北京",
      explanation: "北京是首都。",
    },
    studentAnswer: "北京",
    moduleId: "llm-api",
  });

  await questionResultDb.create({
    id,
    studentId: TEST_STUDENT_ID,
    questionId: TEST_QUESTION_ID,
    sessionId: TEST_SESSION_ID,
    studentAnswer: "北京",
    isCorrect: assessment.isCorrect,
    score: assessment.score,
  });

  const got = await questionResultDb.get(id);
  assert.ok(got, "刚写入的答题结果应能被 get 读回");
  assert.equal(got?.questionId, TEST_QUESTION_ID, "外键应指向真实题库行");
  assert.equal(got?.isCorrect, true);
  assert.equal(got?.score, 100);

  // 真实落库：外键约束下该学生答题结果行数应 ≥1。
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM question_results WHERE student_id = ?")
    .get(TEST_STUDENT_ID) as { c: number };
  assert.ok(row.c >= 1, "question_results 真实行数应 ≥1（外键指向真实题库行）");
});
