/**
 * CodeStore —— 代码/校验状态的读写与 selector
 *
 * 纯 Zustand store，无模型、无 DOM。
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { useCodeStore, selectIsPassed } from "@/stores/code";
import type { ValidationResult } from "@/lib/db";

/**
 * 完整的 `ValidationResult` fixture。
 *
 * 为什么不直接写 `{ totalScore, isCorrect, issues, suggestions }`：
 * Store 的 `validationResult` 类型就是数据库契约（11 个字段），少写的字段
 * 在类型上不合法。用例只关心分数与是否通过，其余字段取固定默认值。
 */
function makeValidationResult(
  overrides: Partial<ValidationResult> = {},
): ValidationResult {
  return {
    id: "vr-1",
    studentId: "00000000-0000-4000-8000-000000000001",
    sessionId: "00000000-0000-4000-8000-000000000002",
    taskType: "code",
    totalScore: 0,
    level: "不及格",
    isCorrect: false,
    dimensions: [],
    issues: [],
    suggestions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function reset() {
  useCodeStore.setState({
    code: "",
    language: "typescript",
    taskType: "code",
    validationStatus: "idle",
    validationResult: null,
    validationError: null,
    attempt: 0,
  });
}

afterEach(reset);

test("setCode → 更新代码内容", () => {
  useCodeStore.getState().setCode("const x = 1;");
  assert.equal(useCodeStore.getState().code, "const x = 1;");
});

test("setLanguage → 设置语言（平台只教 TypeScript）", () => {
  useCodeStore.getState().setLanguage("typescript");
  assert.equal(useCodeStore.getState().language, "typescript");
});

test("setTaskType → 切换任务类型", () => {
  useCodeStore.getState().setTaskType("prompt");
  assert.equal(useCodeStore.getState().taskType, "prompt");
});

test("beginValidation → status 转 validating，attempt 自增", () => {
  assert.equal(useCodeStore.getState().attempt, 0);
  useCodeStore.getState().beginValidation();
  assert.equal(useCodeStore.getState().validationStatus, "validating");
  assert.equal(useCodeStore.getState().attempt, 1);

  useCodeStore.getState().beginValidation();
  assert.equal(useCodeStore.getState().attempt, 2);
});

test("beginValidation → 清除上次的错误信息", () => {
  useCodeStore.setState({ validationError: "上次失败" });
  useCodeStore.getState().beginValidation();
  assert.equal(useCodeStore.getState().validationError, null);
});

test("resolveValidation → 写入结果，状态转 done", () => {
  const result = makeValidationResult({ totalScore: 90, isCorrect: true });
  useCodeStore.getState().resolveValidation(result);

  assert.equal(useCodeStore.getState().validationStatus, "done");
  assert.equal(useCodeStore.getState().validationResult, result);
});

test("failValidation → 记录错误信息，状态转 error", () => {
  useCodeStore.getState().failValidation("网络超时");

  assert.equal(useCodeStore.getState().validationStatus, "error");
  assert.equal(useCodeStore.getState().validationError, "网络超时");
});

test("clear → 重置所有字段", () => {
  useCodeStore.setState({
    code: "x",
    validationStatus: "done",
    validationResult: makeValidationResult({ totalScore: 100, isCorrect: true }),
    attempt: 3,
  });

  useCodeStore.getState().clear();

  const s = useCodeStore.getState();
  assert.equal(s.code, "");
  assert.equal(s.validationStatus, "idle");
  assert.equal(s.validationResult, null);
  assert.equal(s.attempt, 0);
});

test("selectIsPassed：未校验 → false", () => {
  assert.equal(selectIsPassed(useCodeStore.getState()), false);
});

test("selectIsPassed：isCorrect=true → true", () => {
  useCodeStore.setState({
    validationResult: makeValidationResult({ totalScore: 100, isCorrect: true }),
  });
  assert.equal(selectIsPassed(useCodeStore.getState()), true);
});

test("selectIsPassed：isCorrect=false → false", () => {
  useCodeStore.setState({
    validationResult: makeValidationResult({ totalScore: 50, isCorrect: false }),
  });
  assert.equal(selectIsPassed(useCodeStore.getState()), false);
});