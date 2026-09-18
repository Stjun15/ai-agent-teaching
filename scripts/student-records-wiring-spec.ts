/**
 * 学生记录的接线守卫（不调模型）
 *
 * 与 `student-records-spec.ts` 的分工：那个守存储层行为，本文件守路由层
 * 的两条兜底纪律 —— 它们不能证明运行时行为，但能拦住最常见的两类回退：
 * 「新增写入忘了挂兜底开关」和「把通过的提交也记进错题本」。
 *
 * 运行：
 *   （由 run-tests.mjs 的「学生记录写入」组统一拉起）
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("validate 路由：prompt_history 与 errors 的写入受兜底开关挡住", () => {
  const text = readSource("src/app/api/agent/validate/route.ts");
  const guard = text.indexOf("!result.usedFallback");
  assert.ok(guard > -1, "validate 路由必须有兜底开关");
  for (const call of ["promptHistoryDb.create", "errorDb.create"]) {
    const at = text.indexOf(call);
    assert.ok(at > -1, `validate 路由应包含 ${call}`);
    assert.ok(at > guard, `${call} 必须在兜底开关之内`);
  }
  // errors 只在「不通过」时写 —— 通过的提交进历史，不进错题本。
  const errorAt = text.indexOf("errorDb.create");
  const passGuard = text.indexOf("!result.success");
  assert.ok(
    passGuard > -1 && passGuard < errorAt,
    "errors 写入必须在 !success 分支内",
  );
});

test("answer-grade 路由：question_results 与 errors 同受兜底开关挡住", () => {
  const text = readSource("src/app/api/agent/answer-grade/route.ts");
  const guard = text.indexOf("!assessment.usedFallback");
  assert.ok(guard > -1, "answer-grade 路由必须有兜底开关");
  for (const call of ["questionResultDb.create", "errorDb.create"]) {
    const at = text.indexOf(call);
    assert.ok(at > -1, `answer-grade 路由应包含 ${call}`);
    assert.ok(at > guard, `${call} 必须在兜底开关之内`);
  }
  // conceptId 取题库行 —— 题目比请求体可信。
  assert.match(text, /conceptId: question\.conceptId/);
});
