/**
 * 演示数据一键重置 —— 公开体验后的「恢复出厂」。
 *
 * 场景
 * ----
 * 体验者（评审 / 同学）通过公网隧道真实使用平台后，会留下他们自己的
 * 会话、掌握度、错题、点评记录。体验账号与演示账号（种子学生）是
 * **隔离**的（这是鉴权 + 数据隔离设计的一部分），所以他们的操作
 * 本来就不会污染种子学生的报告——但账号本身的数据会持续累积。
 *
 * 本脚本清掉**非种子学生**的全部学习痕迹（保留账号本身，下次还能登录），
 * 让每一次体验都从干净状态开始。种子学生（00000000-0000-4000-8000-
 * 000000000001）的数据一律不动。
 *
 * 运行：pnpm demo:reset        （--keep-agents 保留学生 Agent 的记录）
 *
 * 安全：只操作 dev.db；外键顺序先子后父；全程事务。
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const keepAgents = args.includes("--keep-agents");

const seed = JSON.parse(
  readFileSync(
    new URL("../src/lib/demo-student.json", import.meta.url),
    "utf8",
  ),
);
const SEED_ID = seed.studentId;

const db = new DatabaseSync("dev.db");

// 受保护的学生：种子学生；--keep-agents 时学生 Agent 的两个身份也保留
const protectedIds = [SEED_ID];
if (keepAgents) {
  protectedIds.push(
    "a9e70000-0000-4000-8000-0000000000a1",
    "a9e70000-0000-4000-8000-0000000000a2",
  );
}

const placeholders = () => protectedIds.map(() => "?").join(",");
const protectedParams = () => protectedIds;

const victimSessions = db
  .prepare(
    `SELECT id FROM sessions WHERE student_id NOT IN (${placeholders()})`,
  )
  .all(...protectedParams())
  .map((r) => r.id);

db.exec("BEGIN");
try {
  // 先删会话子表（messages 以 session_id 关联，无 student_id 列）
  if (victimSessions.length > 0) {
    const ph = victimSessions.map(() => "?").join(",");
    db.prepare(`DELETE FROM messages WHERE session_id IN (${ph})`).run(
      ...victimSessions,
    );
    db.prepare(`DELETE FROM agent_events WHERE session_id IN (${ph})`).run(
      ...victimSessions,
    );
    db.prepare(
      `DELETE FROM validation_results WHERE session_id IN (${ph})`,
    ).run(...victimSessions);
  }

  // 按学生维度清理（子表在前）
  const bad = placeholders();
  const badParams = protectedParams();
  db.prepare(
    `DELETE FROM question_results WHERE student_id NOT IN (${bad})`,
  ).run(...badParams);
  db.prepare(`DELETE FROM mastery WHERE student_id NOT IN (${bad})`).run(
    ...badParams,
  );
  db.prepare(`DELETE FROM errors WHERE student_id NOT IN (${bad})`).run(
    ...badParams,
  );
  db.prepare(`DELETE FROM prompt_history WHERE student_id NOT IN (${bad})`).run(
    ...badParams,
  );
  db.prepare(`DELETE FROM agent_traces WHERE student_id NOT IN (${bad})`).run(
    ...badParams,
  );
  db.prepare(
    `DELETE FROM student_profiles WHERE student_id NOT IN (${bad})`,
  ).run(...badParams);
  db.prepare(`DELETE FROM sessions WHERE student_id NOT IN (${bad})`).run(
    ...badParams,
  );
  db.exec("COMMIT");
  console.log(
    `演示数据已重置：清除了非种子学生的会话/掌握度/错题/点评/答题记录` +
      (keepAgents ? "（保留学生 Agent 记录）" : "") +
      `。种子学生数据未动。`,
  );
} catch (error) {
  db.exec("ROLLBACK");
  console.error("重置失败，已回滚：", error);
  process.exitCode = 1;
} finally {
  db.close();
}
