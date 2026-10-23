import { describe, expect, it } from "vitest";

import {
  SIMULATION_LIMITS,
  budgetToStop,
  checkRunBudget,
  checkTurnBudget,
} from "@/lib/agent/student/limits";

describe("发起前的运行预算", () => {
  it("额度未用完且轮次合法时放行，并回填轮次", () => {
    const verdict = checkRunBudget({ runsToday: 0, requestedTurns: 3 });
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.maxTurns).toBe(3);
  });

  it("24 小时额度用尽时拒绝，并给出可读原因", () => {
    const verdict = checkRunBudget({
      runsToday: SIMULATION_LIMITS.maxTeacherRunsPerDay,
      requestedTurns: 1,
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.code).toBe("DAILY_RUN_CAP");
      expect(verdict.message).toContain("上限");
    }
  });

  it("额度还剩一次时仍然放行（边界不能提前一格拦）", () => {
    const verdict = checkRunBudget({
      runsToday: SIMULATION_LIMITS.maxTeacherRunsPerDay - 1,
      requestedTurns: 1,
    });
    expect(verdict.allowed).toBe(true);
  });

  it("轮次超出上限、为 0 或非整数时都拒绝", () => {
    for (const requestedTurns of [0, SIMULATION_LIMITS.maxTurnsPerRun + 1, 2.5]) {
      const verdict = checkRunBudget({ runsToday: 0, requestedTurns });
      expect(verdict.allowed, `requestedTurns=${requestedTurns}`).toBe(false);
      if (!verdict.allowed) expect(verdict.code).toBe("INVALID_TURNS");
    }
  });
});

describe("逐轮成本判定", () => {
  it("单轮超限时拒绝，并指明是单轮问题", () => {
    const verdict = checkTurnBudget({
      tokensSoFar: 0,
      turnTokens: SIMULATION_LIMITS.maxTurnTokens + 1,
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toBe("TURN_TOKENS");
      expect(verdict.message).toContain("单轮");
    }
  });

  it("累计超限时拒绝，并指明是预算问题", () => {
    const verdict = checkTurnBudget({
      tokensSoFar: SIMULATION_LIMITS.maxRunTokens - 10,
      turnTokens: 11,
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toBe("RUN_TOKENS");
      expect(verdict.message).toContain("预算");
    }
  });

  it("刚好到线时放行（比较是「超过」而不是「达到」）", () => {
    expect(
      checkTurnBudget({ tokensSoFar: 0, turnTokens: SIMULATION_LIMITS.maxTurnTokens })
        .allowed,
    ).toBe(true);
    expect(
      checkTurnBudget({
        tokensSoFar: SIMULATION_LIMITS.maxRunTokens - 100,
        turnTokens: 100,
      }).allowed,
    ).toBe(true);
  });
});

describe("预算停止的收尾形状", () => {
  it("记成 completed + token-budget，并把原因写进 error", () => {
    const stop = budgetToStop("累计超限");
    expect(stop.status).toBe("completed");
    expect(stop.stopReason).toBe("token-budget");
    expect(stop.error).toBe("累计超限");
  });
});
