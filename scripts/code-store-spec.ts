/**
 * CodeStore —— 代码/校验状态的读写与 selector
 *
 * 纯 Zustand store，无模型、无 DOM。
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { useCodeStore, selectIsPassed } from "@/stores/code";

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

test("setLanguage → 切换语言", () => {
  useCodeStore.getState().setLanguage("python");
  assert.equal(useCodeStore.getState().language, "python");
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
  const result = { totalScore: 90, isCorrect: true, issues: [], suggestions: [] };
  useCodeStore.getState().resolveValidation(result as any);

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
    validationResult: { totalScore: 100, isCorrect: true, issues: [], suggestions: [] },
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
    validationResult: { totalScore: 100, isCorrect: true, issues: [], suggestions: [] },
  });
  assert.equal(selectIsPassed(useCodeStore.getState()), true);
});

test("selectIsPassed：isCorrect=false → false", () => {
  useCodeStore.setState({
    validationResult: { totalScore: 50, isCorrect: false, issues: [], suggestions: [] },
  });
  assert.equal(selectIsPassed(useCodeStore.getState()), false);
});