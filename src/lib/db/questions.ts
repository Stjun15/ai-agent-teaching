/**
 * 题库的数据访问
 *
 * 与 question-results.ts 同理：questions 表在 001_init.sql 里存在，但此前
 * 系统内**没有任何写入路径** —— generate-question 路由只把模型出的题返给前端，
 * 不落库。这直接导致 question_results.question_id（NOT NULL 外键）永远无法指向
 * 一个真实存在的题库行，答题结果插不进去。
 *
 * 本文件补齐 create（upsert，按模型给出的可读 id 写入，重复出题幂等）+
 * get / listByModule，使「出题 → 作答 → 评分 → question_results 落库」闭环成立。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import {
  asNullableString,
  asOptionalNumber,
  asString,
  parseJson,
  toJson,
  type Row,
} from "./helpers";
import type { Question } from "./types";

function mapQuestion(row: Row): Question {
  return {
    id: asString(row.id),
    moduleId: asString(row.module_id),
    conceptId: asString(row.concept_id),
    type: asString(row.type) as Question["type"],
    difficulty: asOptionalNumber(row.difficulty) ?? 1,
    scenario: asString(row.scenario),
    question: asString(row.question),
    options: parseJson<string[]>(row.options, []),
    correctAnswer: asString(row.correct_answer),
    explanation: asString(row.explanation),
    hintLevels: parseJson<string[]>(row.hint_levels, []),
    relatedAntiPattern: asNullableString(row.related_anti_pattern),
  };
}

/** 写入一道题所需的全部字段（来自出题 Agent 的输出）。 */
export interface QuestionSeed {
  id: string;
  moduleId: string;
  conceptId: string;
  type: Question["type"];
  difficulty: number;
  scenario: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  hintLevels: string[];
  relatedAntiPattern: string | null;
}

export const questionDb = {
  /**
   * 写入（或更新）一道题。按模型给出的可读 id 做 upsert：重复出题时
   * 用最新一次的输出覆盖，不会因「已存在」而静默失败。
   *
   * 这是 question_results.question_id 外键能指向真实行的写入入口；
   * 出题端点必须调用本方法，否则后续作答评分无法落库。
   */
  async create(seed: QuestionSeed): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO questions (
           id, module_id, concept_id, type, difficulty, scenario, question,
           options, correct_answer, explanation, hint_levels, related_anti_pattern
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           module_id = excluded.module_id,
           concept_id = excluded.concept_id,
           type = excluded.type,
           difficulty = excluded.difficulty,
           scenario = excluded.scenario,
           question = excluded.question,
           options = excluded.options,
           correct_answer = excluded.correct_answer,
           explanation = excluded.explanation,
           hint_levels = excluded.hint_levels,
           related_anti_pattern = excluded.related_anti_pattern`,
      )
      .run(
        seed.id,
        seed.moduleId,
        seed.conceptId,
        seed.type,
        seed.difficulty,
        seed.scenario,
        seed.question,
        toJson(seed.options),
        seed.correctAnswer,
        seed.explanation,
        toJson(seed.hintLevels),
        seed.relatedAntiPattern,
      );
  },

  /** 取单道题；无记录返回 null */
  async get(id: string): Promise<Question | null> {
    const row = getDb()
      .prepare("SELECT * FROM questions WHERE id = ? LIMIT 1")
      .get(id);
    return row ? mapQuestion(row as Row) : null;
  },

  /** 列出某模块下的题，按 id 取前 limit 道 */
  async listByModule(moduleId: string, limit: number): Promise<Question[]> {
    const rows = getDb()
      .prepare(
        `SELECT * FROM questions WHERE module_id = ? ORDER BY id LIMIT ?`,
      )
      .all(moduleId, limit);
    return (rows as Row[]).map(mapQuestion);
  },
};
