import { beforeEach, describe, expect, it } from "vitest";

import { useCodeStore } from "@/stores/code";
import { useQaStore } from "@/stores/qa";

/**
 * 换讲必须清草稿。
 *
 * 2026-11-02 学生走查：在第一讲动手步写的代码，切到第二讲的动手步还在。
 * 根因是 CodeStore / QaStore 是全局单例、从不按讲清空。守卫钉住两条语义：
 * 换讲清空；同讲内切步（imitate → validate）绝不清 —— 点评面板靠 store 渲染。
 */
describe("草稿按讲隔离", () => {
  beforeEach(() => {
    useCodeStore.getState().clear();
    useQaStore.getState().clear();
    useCodeStore.setState({ moduleId: null });
    useQaStore.setState({ moduleId: null });
  });

  it("同一讲内切步不清空代码", () => {
    const store = useCodeStore.getState();
    store.syncModule("llm-api");
    store.setCode("const a = 1");
    store.beginValidation();
    store.syncModule("llm-api");

    expect(useCodeStore.getState().code).toBe("const a = 1");
    expect(useCodeStore.getState().attempt).toBe(1);
  });

  it("换讲清空代码、校验结果与尝试次数", () => {
    const store = useCodeStore.getState();
    store.syncModule("llm-api");
    store.setCode("const a = 1");
    store.beginValidation();
    store.failValidation("网络抖动");

    store.syncModule("system-prompt");
    const next = useCodeStore.getState();
    expect(next.moduleId).toBe("system-prompt");
    expect(next.code).toBe("");
    expect(next.validationStatus).toBe("idle");
    expect(next.validationError).toBeNull();
    expect(next.attempt).toBe(0);
  });

  it("QaStore 同样按讲隔离", () => {
    const store = useQaStore.getState();
    store.syncModule("ai-safety");
    store.beginValidation("安全优先");
    store.resolveValidation({ totalScore: 60, level: "一般", feedback: "还差一点" });

    store.syncModule("ai-safety");
    expect(useQaStore.getState().submittedAnswer).toBe("安全优先");

    store.syncModule("llm-api");
    expect(useQaStore.getState().submittedAnswer).toBe("");
    expect(useQaStore.getState().result).toBeNull();
    expect(useQaStore.getState().attempt).toBe(0);
  });
});
