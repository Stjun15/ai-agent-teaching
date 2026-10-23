import { describe, expect, it } from "vitest";

import {
  SIMULATION_STEPS,
  STUDENT_PERSONAS,
  buildSimulatedStudentPrompt,
  findPersona,
  isSimulationStep,
} from "@/lib/agent/student/personas";

describe("学生人设表", () => {
  it("id 唯一，且三档人设都有说明文案", () => {
    const ids = STUDENT_PERSONAS.map((persona) => persona.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const persona of STUDENT_PERSONAS) {
      expect(persona.label.length).toBeGreaterThan(0);
      expect(persona.summary.length).toBeGreaterThan(0);
      expect(persona.prompt.length).toBeGreaterThan(0);
    }
  });

  it("按 id 查找；未知 id 返回 undefined（由调用方给 400）", () => {
    expect(findPersona(STUDENT_PERSONAS[0].id)?.id).toBe(STUDENT_PERSONAS[0].id);
    expect(findPersona("no-such-persona")).toBeUndefined();
  });
});

describe("可模拟的步骤", () => {
  it("只放行对话型步骤", () => {
    expect(SIMULATION_STEPS).toEqual(["explain", "observe", "imitate"]);
    expect(isSimulationStep("explain")).toBe(true);
    expect(isSimulationStep("validate")).toBe(false);
    expect(isSimulationStep("mastery")).toBe(false);
    expect(isSimulationStep("visualize")).toBe(false);
  });
});

describe("模拟学生提示词", () => {
  it("契约段写明动作只允许 ask / give_up，并要求纯 JSON", () => {
    const { systemPrompt } = buildSimulatedStudentPrompt({
      persona: STUDENT_PERSONAS[0],
      digest: "屏幕快照",
      turnIndex: 1,
      maxTurns: 2,
    });

    expect(systemPrompt).toContain("只输出一个 JSON 对象");
    expect(systemPrompt).toContain('"action"');
    expect(systemPrompt).toContain("give_up");
    expect(systemPrompt).toContain("cognitiveState");
  });

  it("系统提示词里包含该人设的人格段", () => {
    const persona = STUDENT_PERSONAS[1];
    const { systemPrompt } = buildSimulatedStudentPrompt({
      persona,
      digest: "屏幕快照",
      turnIndex: 1,
      maxTurns: 2,
    });
    expect(systemPrompt).toContain(persona.prompt);
  });

  it("用户消息带上屏幕快照与轮次信息", () => {
    const { userMessage } = buildSimulatedStudentPrompt({
      persona: STUDENT_PERSONAS[0],
      digest: "【屏幕快照 · 文本版】内容",
      turnIndex: 2,
      maxTurns: 3,
    });
    expect(userMessage).toContain("【屏幕快照 · 文本版】内容");
    expect(userMessage).toContain("第 2 轮");
    expect(userMessage).toContain("最多 3 轮");
  });
});
